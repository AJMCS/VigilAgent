import { useState } from 'react';
import NeonButton from './ui/NeonButton';
import InfoTooltip from './ui/InfoTooltip';
import { validateGitHubToken } from '../utils/validateToken';

/* ── Hook ─────────────────────────────────────────────────────────────────────
   Only call this in ONE place (Dashboard). Multiple instances = isolated state. */
export function useProfiles() {
  const KEY = 'vigil_profiles';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const [profiles, setProfiles] = useState(load);
  const save = p => { setProfiles(p); localStorage.setItem(KEY, JSON.stringify(p)); };
  const addProfile    = p  => save([...load(), p]);
  const removeProfile = id => save(load().filter(p => p.id !== id));
  return { profiles, addProfile, removeProfile };
}

const TOKEN_INFO = (
  <div className="space-y-2">
    <p><span style={{ color: '#00f0ff' }}>What is a GitHub token?</span><br/>
    A Personal Access Token (PAT) that lets VigilAgent authenticate with GitHub on your behalf.</p>
    <p><span style={{ color: '#00f0ff' }}>Where to create one:</span><br/>
    github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
    <p><span style={{ color: '#00f0ff' }}>Required permissions:</span><br/>
    <span style={{ color: '#00ff88' }}>repo</span> — clone &amp; read repos<br/>
    <span style={{ color: '#00ff88' }}>read:user</span> — identify the account</p>
    <p style={{ color: 'rgba(0,255,136,0.7)' }}>🔒 Stored locally. Never sent externally.</p>
  </div>
);

/* ── Component ────────────────────────────────────────────────────────────────
   Receives profiles + handlers as props — does NOT call useProfiles() itself. */
export default function ProfileManager({ profiles, addProfile, removeProfile, selectedId, onSelect }) {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [token, setToken]       = useState('');
  const [show, setShow]         = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError]       = useState('');

  const handleAdd = async e => {
    e.preventDefault();
    if (!name.trim() || !token.trim()) return;
    setError('');
    setValidating(true);

    const result = await validateGitHubToken(token.trim());
    setValidating(false);

    if (!result.ok) {
      setError(result.message);
      return; // token rejected — do not save
    }

    const id = crypto.randomUUID();
    addProfile({ id, name: name.trim(), token: token.trim() });
    onSelect(id); // auto-select so repo picker appears immediately
    setName(''); setToken(''); setOpen(false); setError('');
  };

  const mask = t => t ? `${t.slice(0, 4)}••••••${t.slice(-2)}` : '';

  return (
    <div className="space-y-2">
      {profiles.length === 0 ? (
        <div className="text-center py-4" style={{ color: 'rgba(0,240,255,0.35)', fontSize: 12 }}>
          No profiles. Add one below.
        </div>
      ) : (
        <div className="space-y-1.5">
          {profiles.map(p => {
            const active = p.id === selectedId;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(active ? null : p.id)}
                className="flex items-center justify-between px-3 py-2 cursor-pointer transition-all duration-150"
                style={{
                  border: `1px solid ${active ? 'rgba(0,240,255,0.5)' : 'rgba(0,240,255,0.12)'}`,
                  background: active ? 'rgba(0,240,255,0.06)' : 'rgba(0,0,0,0.3)',
                  boxShadow: active ? '0 0 12px rgba(0,240,255,0.12)' : 'none',
                }}
              >
                <div>
                  <div style={{ color: active ? '#00f0ff' : '#ccc', fontWeight: active ? 700 : 400, fontSize: 12 }}>
                    {active && <span style={{ color: '#00ff88' }}>▶ </span>}{p.name}
                  </div>
                  <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>{mask(p.token)}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeProfile(p.id); if (active) onSelect(null); }}
                  style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!open ? (
        <NeonButton green onClick={() => setOpen(true)} small className="w-full justify-center mt-1">
          + ADD PROFILE
        </NeonButton>
      ) : (
        <form onSubmit={handleAdd} className="space-y-2 pt-2" style={{ borderTop: '1px solid rgba(0,240,255,0.12)' }}>
          <input
            className="w-full px-3 py-1.5 text-xs rounded-none"
            style={{ border: '1px solid rgba(0,240,255,0.3)', fontSize: 12 }}
            placeholder="Profile name..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-1">
            <input
              className="flex-1 px-3 py-1.5 text-xs rounded-none"
              style={{ border: '1px solid rgba(0,240,255,0.3)', fontSize: 12 }}
              type={show ? 'text' : 'password'}
              placeholder="ghp_..."
              value={token}
              onChange={e => { setToken(e.target.value); setError(''); }}
            />
            <InfoTooltip content={TOKEN_INFO} />
            <button type="button" onClick={() => setShow(s => !s)}
              style={{ color: 'rgba(0,240,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              {show ? '🙈' : '👁'}
            </button>
          </div>

          {/* Validation error */}
          {error && (
            <div className="p-2 text-[11px] leading-relaxed whitespace-pre-line"
              style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.05)' }}>
              ✕ {error}
            </div>
          )}

          <div className="flex gap-2">
            <NeonButton green type="submit" disabled={validating} small className="flex-1">
              {validating ? '// VALIDATING...' : 'SAVE'}
            </NeonButton>
            <NeonButton type="button" onClick={() => { setOpen(false); setError(''); }} small className="flex-1">
              CANCEL
            </NeonButton>
          </div>

          {validating && (
            <div style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.08em' }} className="animate-pulse">
              // checking token permissions with GitHub...
            </div>
          )}
        </form>
      )}
    </div>
  );
}
