import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listModels, selectModel } from '../api';
import StatusDot from './ui/StatusDot';

function sizeLabel(gb) {
  if (!gb) return '';
  return `${gb}GB`;
}

function modelShortName(name) {
  // e.g. "nemotron-3-nano:30b" → keep as-is; just truncate if very long
  return name.length > 28 ? name.slice(0, 26) + '…' : name;
}

export default function ModelSelector() {
  const qc = useQueryClient();
  const [switching, setSwitching] = useState(null); // name of model being switched to

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['models'],
    queryFn: listModels,
    refetchInterval: false,
    retry: 1,
  });

  const models  = data?.models  || [];
  const current = data?.current || '';

  const handleSelect = async (name) => {
    if (name === current || switching) return;
    setSwitching(name);
    try {
      await selectModel(name);
      await qc.invalidateQueries({ queryKey: ['models'] });
      await qc.invalidateQueries({ queryKey: ['scans'] }); // health bar reflects new model
    } catch (e) {
      console.error('Model switch failed:', e);
    } finally {
      setSwitching(null);
    }
  };

  if (isLoading) return (
    <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }} className="animate-pulse">
      // detecting models...
    </div>
  );

  if (isError) return (
    <div className="space-y-2">
      <div style={{ color: '#ff4444', fontSize: 10 }}>
        ✕ {error?.message || 'Cannot reach Ollama'}
      </div>
      <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 9 }}>
        Make sure Ollama is running, then{' '}
        <button
          onClick={() => refetch()}
          style={{ color: '#00f0ff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, padding: 0, textDecoration: 'underline' }}
        >
          retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Current model pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot active blue size={5} />
          <span style={{ color: '#00f0ff', fontSize: 10, fontWeight: 700 }} className="truncate">
            {modelShortName(current || 'none')}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ color: 'rgba(0,240,255,0.35)', fontSize: 9, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00f0ff'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0,240,255,0.35)'; }}
          title="Refresh model list"
        >
          {isFetching ? '...' : '↺'}
        </button>
      </div>

      {/* Model list */}
      {models.length === 0 ? (
        <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 10 }}>
          No models found. Run{' '}
          <code style={{ color: '#00f0ff', fontSize: 9 }}>ollama pull &lt;model&gt;</code>{' '}
          to install one.
        </div>
      ) : (
        <div className="space-y-1">
          {models.map(m => {
            const isActive   = m.name === current;
            const isLoading  = m.name === switching;
            return (
              <button
                key={m.name}
                onClick={() => handleSelect(m.name)}
                disabled={isActive || !!switching}
                className="w-full text-left transition-all duration-100"
                style={{
                  background:   isActive ? 'rgba(0,240,255,0.08)' : 'transparent',
                  border:       `1px solid ${isActive ? 'rgba(0,240,255,0.35)' : 'rgba(0,240,255,0.1)'}`,
                  borderLeft:   `3px solid ${isActive ? '#00f0ff' : 'transparent'}`,
                  padding:      '5px 8px',
                  cursor:       isActive || switching ? 'default' : 'pointer',
                  opacity:      switching && !isLoading ? 0.4 : 1,
                  fontFamily:   'inherit',
                }}
                onMouseEnter={e => { if (!isActive && !switching) { e.currentTarget.style.background = 'rgba(0,240,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.25)'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(0,240,255,0.1)'; e.currentTarget.style.borderLeftColor = 'transparent'; }}}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate"
                    style={{ color: isActive ? '#00f0ff' : '#999', fontSize: 10, fontWeight: isActive ? 700 : 400 }}
                  >
                    {isLoading ? '// switching...' : modelShortName(m.name)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && (
                      <span style={{ color: '#00ff88', fontSize: 8, letterSpacing: '0.1em' }}>ACTIVE</span>
                    )}
                    {m.parameter_size && (
                      <span style={{ color: 'rgba(0,240,255,0.4)', fontSize: 8 }}>{m.parameter_size}</span>
                    )}
                    {m.size_gb > 0 && (
                      <span style={{ color: 'rgba(0,240,255,0.3)', fontSize: 8 }}>{sizeLabel(m.size_gb)}</span>
                    )}
                  </div>
                </div>
                {m.quantization && (
                  <div style={{ color: 'rgba(0,240,255,0.25)', fontSize: 8, marginTop: 1 }}>{m.quantization}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
