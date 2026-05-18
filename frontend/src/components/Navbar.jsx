import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { health } from '../api';
import logo from '../assets/vigilagent_logo.svg';
import StatusDot from './ui/StatusDot';

const LINKS = [
  { to: '/',         label: 'DASHBOARD' },
  { to: '/reports',  label: 'REPORTS'   },
  { to: '/profiles', label: 'PROFILES'  },
];

export default function Navbar() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: health,
    refetchInterval: 15000,
    retry: false,
  });
  const online = !!data;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 no-print flex items-center justify-between px-4 h-12"
      style={{
        background: 'rgba(10,10,10,0.96)',
        borderBottom: '1px solid rgba(0,240,255,0.15)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Logo */}
      <NavLink to="/" className="flex items-center shrink-0">
        <img src={logo} alt="VigilAgent" className="h-8 w-auto" />
      </NavLink>

      {/* Nav links */}
      <div className="flex items-center gap-0.5">
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              color: '#00f0ff',
              fontFamily: 'inherit',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              padding: '4px 12px',
              opacity: isActive ? 1 : 0.45,
              borderBottom: isActive ? '1px solid #00f0ff' : '1px solid transparent',
              textShadow: isActive ? '0 0 8px rgba(0,240,255,0.7)' : 'none',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
            onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
            onMouseLeave={e => {
              // active check not available here — rely on NavLink className fallback
            }}
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
        <StatusDot active={online} />
        <span style={{
          color: online ? '#00ff88' : '#ff4444',
          textShadow: online ? '0 0 6px rgba(0,255,136,0.6)' : 'none',
          fontWeight: 700,
        }}>
          {online ? 'SYSTEM ONLINE' : 'OFFLINE'}
        </span>
        {online && data?.model && (
          <span className="hidden md:inline" style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>
            // {data.model}
          </span>
        )}
      </div>
    </nav>
  );
}
