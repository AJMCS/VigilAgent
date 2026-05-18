const CONFIG = {
  critical: { label: 'CRITICAL', color: '#ff4444', bg: 'rgba(255,68,68,0.12)',  border: 'rgba(255,68,68,0.4)',  glow: '0 0 8px rgba(255,68,68,0.5)' },
  high:     { label: 'HIGH',     color: '#ff8800', bg: 'rgba(255,136,0,0.12)',  border: 'rgba(255,136,0,0.4)',  glow: '0 0 8px rgba(255,136,0,0.5)' },
  medium:   { label: 'MEDIUM',   color: '#ffcc00', bg: 'rgba(255,204,0,0.10)',  border: 'rgba(255,204,0,0.4)',  glow: '0 0 8px rgba(255,204,0,0.4)' },
  low:      { label: 'LOW',      color: '#00f0ff', bg: 'rgba(0,240,255,0.08)',  border: 'rgba(0,240,255,0.3)',  glow: '0 0 8px rgba(0,240,255,0.3)' },
  info:     { label: 'INFO',     color: '#888888', bg: 'rgba(128,128,128,0.1)', border: 'rgba(128,128,128,0.3)', glow: 'none' },
  clean:    { label: 'CLEAN',    color: '#00ff88', bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.3)',  glow: '0 0 8px rgba(0,255,136,0.3)' },
};

export default function SeverityBadge({ severity = 'info', count }) {
  const key = severity.toLowerCase();
  const cfg = CONFIG[key] || CONFIG.info;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: cfg.glow,
        fontFamily: 'inherit',
      }}
    >
      {cfg.label}
      {count !== undefined && (
        <span className="ml-1 opacity-80">{count}</span>
      )}
    </span>
  );
}
