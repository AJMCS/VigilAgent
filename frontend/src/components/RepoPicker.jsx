import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { github } from '../api';

export default function RepoPicker({ token, selected, onChange }) {
  const [search, setSearch] = useState('');

  const { data: repos = [], isLoading, error } = useQuery({
    queryKey: ['github-repos', token],
    queryFn: () => github.listRepos(token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggle = url => onChange(
    selected.includes(url) ? selected.filter(u => u !== url) : [...selected, url]
  );

  if (!token) return (
    <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }} className="py-2">
      Select a profile to browse repos.
    </div>
  );

  if (isLoading) return (
    <div style={{ color: '#00f0ff', fontSize: 11 }} className="py-2 animate-pulse">
      // fetching repos...
    </div>
  );

  if (error) return (
    <div style={{ color: '#ff4444', fontSize: 11 }} className="py-2">
      ✕ Failed to fetch repos — check token permissions.
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-2 py-1 text-xs rounded-none"
          style={{ border: '1px solid rgba(0,240,255,0.25)', fontSize: 11 }}
          placeholder="search repos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button onClick={() => onChange(filtered.map(r => r.html_url))}
          style={{ color: '#00ff88', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          ALL
        </button>
        <button onClick={() => onChange([])}
          style={{ color: '#ff4444', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          CLR
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 180, border: '1px solid rgba(0,240,255,0.1)' }}>
        {filtered.length === 0 ? (
          <div className="p-2" style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }}>No repos match.</div>
        ) : (
          filtered.map(repo => {
            const checked = selected.includes(repo.html_url);
            return (
              <label
                key={repo.id}
                className="flex items-start gap-2 px-2 py-1.5 cursor-pointer transition-colors duration-100"
                style={{
                  background: checked ? 'rgba(0,240,255,0.06)' : 'transparent',
                  borderBottom: '1px solid rgba(0,240,255,0.07)',
                }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(0,240,255,0.03)'; }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(repo.html_url)}
                  style={{ accentColor: '#00f0ff', marginTop: 2, width: 12, height: 12 }}
                />
                <div className="min-w-0">
                  <div style={{ color: checked ? '#00f0ff' : '#ccc', fontSize: 11, fontWeight: checked ? 600 : 400 }}>
                    {repo.full_name}
                  </div>
                  {repo.description && (
                    <div className="truncate" style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>
                      {repo.description}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 9, letterSpacing: '0.05em', padding: '1px 4px',
                  color: repo.private ? '#00ff88' : 'rgba(0,240,255,0.4)',
                  border: `1px solid ${repo.private ? 'rgba(0,255,136,0.3)' : 'rgba(0,240,255,0.15)'}`,
                  flexShrink: 0, marginLeft: 'auto',
                }}>
                  {repo.private ? 'PRIV' : 'PUB'}
                </span>
              </label>
            );
          })
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ color: '#00ff88', fontSize: 10, letterSpacing: '0.05em' }}>
          ✓ {selected.length} repo{selected.length > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
