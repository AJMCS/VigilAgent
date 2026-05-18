import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitScan } from '../api';
import RepoPicker from './RepoPicker';
import NeonButton from './ui/NeonButton';
import InfoTooltip from './ui/InfoTooltip';
import { validateGitHubToken } from '../utils/validateToken';

const REPOS_INFO = (
  <div className="space-y-1">
    <p><span style={{ color: '#00f0ff' }}>Format:</span> One GitHub repo URL per line.</p>
    <p style={{ color: '#b0b0b0' }}>Example:<br/>
    https://github.com/owner/repo1<br/>
    https://github.com/owner/repo2</p>
    <p style={{ color: 'rgba(0,240,255,0.5)' }}>Or use the repo picker above to select from your account.</p>
  </div>
);

export default function ScanForm({ selectedProfile, pickedRepos, onPickedReposChange }) {
  const [mode, setMode]             = useState('profile');
  const [manualToken, setManualToken] = useState('');
  const [manualUrls, setManualUrls]   = useState('');
  const [msg, setMsg]               = useState(null);
  const [validating, setValidating] = useState(false);

  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: submitScan,
    onSuccess: () => {
      setManualUrls('');
      setMsg({ ok: true, text: '// scan queued successfully' });
      qc.invalidateQueries({ queryKey: ['scans'] });
      setTimeout(() => setMsg(null), 4000);
    },
    onError: e => setMsg({ ok: false, text: `✕ ${e.message}` }),
  });

  const activeToken = mode === 'profile' ? selectedProfile?.token : manualToken;

  const handleSubmit = async e => {
    e.preventDefault();
    setMsg(null);

    const urls = [
      ...pickedRepos,
      ...manualUrls.split('\n').map(u => u.trim()).filter(Boolean),
    ];
    const unique = [...new Set(urls)];
    if (!unique.length) return setMsg({ ok: false, text: '✕ No repos selected.' });
    if (!activeToken)   return setMsg({ ok: false, text: '✕ No GitHub token.' });

    // Validate manual tokens at scan time (profile tokens are validated at save time)
    if (mode === 'manual') {
      setValidating(true);
      const result = await validateGitHubToken(activeToken);
      setValidating(false);
      if (!result.ok) {
        setMsg({ ok: false, text: result.message });
        return;
      }
    }

    mutation.mutate({ github_token: activeToken, repos: unique });
  };

  const repoCount = pickedRepos.length + manualUrls.split('\n').filter(s => s.trim()).length;
  const busy = mutation.isPending || validating;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-0 text-[11px]">
        {['profile', 'manual'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="flex-1 py-1 tracking-widest uppercase transition-all duration-150"
            style={{
              background: mode === m ? 'rgba(0,240,255,0.08)' : 'transparent',
              color: mode === m ? '#00f0ff' : 'rgba(0,240,255,0.35)',
              border: `1px solid ${mode === m ? 'rgba(0,240,255,0.4)' : 'rgba(0,240,255,0.1)'}`,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {m === 'profile' ? 'USE PROFILE' : 'MANUAL TOKEN'}
          </button>
        ))}
      </div>

      {mode === 'profile' && !selectedProfile && (
        <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 11 }}>
          ↑ Select or create a profile above
        </div>
      )}

      {mode === 'manual' && (
        <input
          className="w-full px-3 py-1.5 text-xs rounded-none"
          style={{ border: '1px solid rgba(0,240,255,0.3)', fontSize: 12 }}
          type="password"
          placeholder="ghp_..."
          value={manualToken}
          onChange={e => setManualToken(e.target.value)}
        />
      )}

      {/* Repo picker */}
      {activeToken && (
        <div>
          <div style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 6 }}>
            // SELECT FROM YOUR ACCOUNT
          </div>
          <RepoPicker token={activeToken} selected={pickedRepos} onChange={onPickedReposChange} />
        </div>
      )}

      {/* Manual URLs */}
      <div>
        <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>
          // OR PASTE URLS
          <InfoTooltip content={REPOS_INFO} />
        </div>
        <textarea
          className="w-full px-3 py-2 text-xs rounded-none resize-none"
          style={{ border: '1px solid rgba(0,240,255,0.2)', fontSize: 11, minHeight: 72 }}
          placeholder="https://github.com/owner/repo"
          value={manualUrls}
          onChange={e => setManualUrls(e.target.value)}
        />
      </div>

      {validating && (
        <div style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.08em' }} className="animate-pulse">
          // validating token permissions...
        </div>
      )}

      {msg && (
        <div className="p-2 text-[11px] leading-relaxed whitespace-pre-line"
          style={{ color: msg.ok ? '#00ff88' : '#ff4444', border: `1px solid ${msg.ok ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`, background: msg.ok ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)' }}>
          {msg.text}
        </div>
      )}

      <NeonButton green type="submit" disabled={busy || !activeToken} className="w-full justify-center">
        {validating ? '// VALIDATING...' : busy ? '// SCANNING...' : `▶ SCAN${repoCount > 0 ? ` (${repoCount})` : ''}`}
      </NeonButton>
    </form>
  );
}
