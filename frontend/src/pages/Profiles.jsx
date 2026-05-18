import { useState } from 'react';
import { useProfiles } from '../components/ProfileManager';
import NeonCard from '../components/ui/NeonCard';
import NeonButton from '../components/ui/NeonButton';
import InfoTooltip from '../components/ui/InfoTooltip';

const TOKEN_INFO = (
  <div className="space-y-2 text-xs">
    <p><span style={{ color: '#00f0ff' }}>What is a GitHub token?</span><br/>
    A Personal Access Token (PAT) lets VigilAgent authenticate with GitHub on your behalf.</p>
    <p><span style={{ color: '#00f0ff' }}>How to create:</span><br/>
    github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
    <p><span style={{ color: '#00f0ff' }}>Required scopes:</span><br/>
    <span style={{ color: '#00ff88' }}>repo</span> — read &amp; clone repos<br/>
    <span style={{ color: '#00ff88' }}>read:user</span> — identify account</p>
    <p style={{ color: '#00f0ff' }}>Classic tokens recommended over fine-grained.</p>
    <p style={{ color: 'rgba(0,255,136,0.7)', fontSize: 10 }}>
      🔒 Stored in your browser's localStorage only. Never transmitted to any external server.
    </p>
  </div>
);

export default function Profiles() {
  const { profiles, addProfile, removeProfile } = useProfiles();
  const [name, setName]   = useState('');
  const [token, setToken] = useState('');
  const [show, setShow]   = useState(false);
  const [msg, setMsg]     = useState(null);

  const handleAdd = e => {
    e.preventDefault();
    if (!name.trim() || !token.trim()) return;
    addProfile({ name: name.trim(), token: token.trim() });
    setName(''); setToken('');
    setMsg({ ok: true, text: '// Profile saved.' });
    setTimeout(() => setMsg(null), 3000);
  };

  const mask = t => t ? `${t.slice(0,6)}••••••${t.slice(-3)}` : '';

  return (
    <div className="pt-12 min-h-screen">
      <div className="max-w-2xl mx-auto p-4 space-y-6">

        {/* Header */}
        <div>
          <h1 style={{ color: '#00f0ff', fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', margin: 0 }}>
            [ GITHUB PROFILES ]
          </h1>
          <p style={{ color: 'rgba(0,240,255,0.4)', fontSize: 11, marginTop: 6 }}>
            Tokens are stored locally in your browser. Never transmitted externally.
          </p>
        </div>

        {/* Saved profiles */}
        {profiles.length > 0 && (
          <NeonCard className="p-4 space-y-2">
            <div style={{ color: '#00f0ff', fontSize: 10, letterSpacing: '0.12em' }}>// SAVED PROFILES</div>
            {profiles.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2"
                style={{ border: '1px solid rgba(0,240,255,0.12)', background: 'rgba(0,0,0,0.3)' }}
              >
                <div>
                  <div style={{ color: '#00f0ff', fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 10 }}>{mask(p.token)}</div>
                </div>
                <button
                  onClick={() => removeProfile(p.id)}
                  style={{ color: '#ff4444', background: 'none', border: '1px solid rgba(255,68,68,0.3)', padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.08em' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 8px rgba(255,68,68,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </NeonCard>
        )}

        {/* Add form */}
        <NeonCard className="p-4">
          <div style={{ color: '#00f0ff', fontSize: 10, letterSpacing: '0.12em', marginBottom: 12 }}>
            // ADD PROFILE
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                PROFILE NAME
              </label>
              <input
                className="w-full px-3 py-2 text-xs rounded-none"
                style={{ border: '1px solid rgba(0,240,255,0.25)', fontSize: 12 }}
                placeholder="e.g. Personal / Work"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>
                  GITHUB TOKEN
                </label>
                <InfoTooltip content={TOKEN_INFO} />
              </div>
              <div className="flex gap-1">
                <input
                  className="flex-1 px-3 py-2 text-xs rounded-none"
                  style={{ border: '1px solid rgba(0,240,255,0.25)', fontSize: 12 }}
                  type={show ? 'text' : 'password'}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  style={{ padding: '0 10px', color: 'rgba(0,240,255,0.4)', background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                >
                  {show ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {msg && (
              <div style={{ color: msg.ok ? '#00ff88' : '#ff4444', fontSize: 11 }}>{msg.text}</div>
            )}

            <NeonButton green type="submit" className="w-full justify-center">
              SAVE PROFILE
            </NeonButton>
          </form>
        </NeonCard>

        {/* Security notice */}
        <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 10, letterSpacing: '0.05em', lineHeight: 1.8 }}>
          // tokens stored in localStorage · never sent to any external server<br/>
          // clear browser data to remove all saved profiles
        </div>
      </div>
    </div>
  );
}
