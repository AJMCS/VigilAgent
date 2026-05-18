import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWatchlist, addWatch, removeWatch } from '../api';
import NeonButton from './ui/NeonButton';
import StatusDot from './ui/StatusDot';

export default function WatchlistManager({ selectedProfile, pickedRepos = [] }) {
  const [open, setOpen]           = useState(false);
  const [mode, setMode]           = useState('profile');
  const [manualTok, setManualTok] = useState('');
  const [repoUrl, setRepoUrl]     = useState('');
  const [err, setErr]             = useState('');
  const [adding, setAdding]       = useState(null); // url currently being added

  const qc = useQueryClient();

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: getWatchlist,
    refetchInterval: 30000, // match backend poll interval
  });

  const addMut = useMutation({
    mutationFn: ({ repo_url, github_token }) => addWatch({ repo_url, github_token }),
    onSuccess: () => {
      setRepoUrl(''); setOpen(false); setErr(''); setAdding(null);
      qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
    onError: e => { setErr(e.message); setAdding(null); },
  });

  const delMut = useMutation({
    mutationFn: ({ owner, repo }) => removeWatch(owner, repo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  const activeToken = mode === 'profile' ? selectedProfile?.token : manualTok;

  const isWatched = url => watchlist.some(w => w.repo_url === url.replace(/\/$/, ''));

  const handleRepoToggle = url => {
    if (!activeToken || isWatched(url)) return;
    setAdding(url);
    addMut.mutate({ repo_url: url, github_token: activeToken });
  };

  const handleAdd = e => {
    e.preventDefault();
    setErr('');
    if (!repoUrl.trim()) return setErr('Repo URL required.');
    if (!activeToken)    return setErr('No token — select a profile or enter one manually.');
    addMut.mutate({ repo_url: repoUrl.trim(), github_token: activeToken });
  };

  return (
    <div className="space-y-3">

      {/* ── Repos from scan selection ─────────────────────────────────────── */}
      {pickedRepos.length > 0 && (
        <div className="space-y-1">
          <div style={{ color: 'rgba(0,255,136,0.5)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 4 }}>
            // FROM SCAN SELECTION — click to watch
          </div>
          {pickedRepos.map(url => {
            const watched  = isWatched(url);
            const repoName = url.replace('https://github.com/', '');
            const isAdding = adding === url;
            return (
              <label
                key={url}
                className="flex items-center gap-2 px-2 py-1.5 transition-all duration-100"
                style={{
                  cursor: watched ? 'default' : activeToken ? 'pointer' : 'not-allowed',
                  background: watched ? 'rgba(0,255,136,0.05)' : 'transparent',
                  border: `1px solid ${watched ? 'rgba(0,255,136,0.2)' : 'rgba(0,240,255,0.08)'}`,
                  opacity: isAdding ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={watched}
                  disabled={watched || !activeToken || isAdding}
                  onChange={() => handleRepoToggle(url)}
                  style={{ accentColor: '#00ff88', width: 12, height: 12, flexShrink: 0 }}
                />
                <span
                  className="flex-1 truncate"
                  style={{ color: watched ? '#00ff88' : '#ccc', fontSize: 11 }}
                >
                  {repoName}
                </span>
                {watched && (
                  <span style={{ color: '#00ff88', fontSize: 9, letterSpacing: '0.1em', flexShrink: 0 }}>
                    WATCHING
                  </span>
                )}
                {isAdding && (
                  <span style={{ color: 'rgba(0,240,255,0.5)', fontSize: 9 }} className="animate-pulse">
                    adding...
                  </span>
                )}
              </label>
            );
          })}

          {!activeToken && (
            <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>
              Select a profile above to enable watching.
            </div>
          )}
        </div>
      )}

      {/* ── Currently watched list ────────────────────────────────────────── */}
      {watchlist.length > 0 && (
        <div className="space-y-1.5">
          <div style={{ color: 'rgba(0,255,136,0.4)', fontSize: 10, letterSpacing: '0.1em' }}>
            // ACTIVE WATCHLIST
          </div>
          {watchlist.map(w => (
            <div
              key={`${w.owner}/${w.repo}`}
              className="flex items-center justify-between px-3 py-2"
              style={{ border: '1px solid rgba(0,255,136,0.15)', background: 'rgba(0,255,136,0.03)' }}
            >
              <div className="flex items-center gap-2">
                <StatusDot active size={6} />
                <span style={{ color: '#00ff88', fontSize: 11 }}>{w.owner}/{w.repo}</span>
              </div>
              <button
                onClick={() => delMut.mutate({ owner: w.owner, repo: w.repo })}
                style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', opacity: 0.5 }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {watchlist.length === 0 && pickedRepos.length === 0 && (
        <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }}>
          No repos being watched.
        </div>
      )}

      {/* ── Manual add form ───────────────────────────────────────────────── */}
      {!open ? (
        <NeonButton green small onClick={() => setOpen(true)} className="w-full justify-center">
          + ADD BY URL
        </NeonButton>
      ) : (
        <form onSubmit={handleAdd} className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(0,255,136,0.1)' }}>
          <div className="flex gap-0 text-[10px]">
            {['profile', 'manual'].map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className="flex-1 py-0.5 tracking-wider uppercase"
                style={{
                  background: mode === m ? 'rgba(0,255,136,0.08)' : 'transparent',
                  color: mode === m ? '#00ff88' : 'rgba(0,255,136,0.3)',
                  border: `1px solid ${mode === m ? 'rgba(0,255,136,0.4)' : 'rgba(0,255,136,0.1)'}`,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}>
                {m === 'profile' ? 'Profile' : 'Token'}
              </button>
            ))}
          </div>

          {mode === 'manual' && (
            <input className="w-full px-2 py-1 text-xs rounded-none"
              style={{ border: '1px solid rgba(0,255,136,0.25)', fontSize: 11 }}
              type="password" placeholder="ghp_..."
              value={manualTok} onChange={e => setManualTok(e.target.value)} />
          )}

          <input className="w-full px-2 py-1 text-xs rounded-none"
            style={{ border: '1px solid rgba(0,255,136,0.25)', fontSize: 11 }}
            placeholder="https://github.com/owner/repo"
            value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />

          {err && <div style={{ color: '#ff4444', fontSize: 10 }}>{err}</div>}

          <div className="flex gap-2">
            <NeonButton green type="submit" small disabled={addMut.isPending} className="flex-1">
              {addMut.isPending ? 'ADDING...' : 'WATCH'}
            </NeonButton>
            <NeonButton type="button" small onClick={() => { setOpen(false); setErr(''); }} className="flex-1">
              CANCEL
            </NeonButton>
          </div>
        </form>
      )}

      <div style={{ color: 'rgba(0,255,136,0.3)', fontSize: 10, letterSpacing: '0.05em' }}>
        // polls every 5 min — auto-scans new PRs
      </div>
    </div>
  );
}
