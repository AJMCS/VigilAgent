export default function NeonCard({ children, className = '', green = false, glow = false }) {
  const accent      = green ? 'rgba(0,255,136,' : 'rgba(0,240,255,';
  const borderBase  = `1px solid ${accent}0.22)`;
  const borderHover = `${accent}0.5)`;
  const glowShadow  = green
    ? '0 0 16px rgba(0,255,136,0.2), 0 0 40px rgba(0,255,136,0.08)'
    : '0 0 16px rgba(0,240,255,0.2), 0 0 40px rgba(0,240,255,0.08)';
  const c = green ? '#00ff88' : '#00f0ff';

  // Corner bracket helper — uses fully inline styles with -1px offsets so the
  // bracket aligns with the outer edge of the card's 1px border, not inside it.
  const corner = (pos, borderSides) => (
    <span
      style={{
        position: 'absolute',
        width: 12,
        height: 12,
        pointerEvents: 'none',
        zIndex: 2,
        opacity: 0.85,
        ...pos,
        ...borderSides,
      }}
    />
  );

  return (
    <div
      className={`relative bg-[#0a0a0a] transition-all duration-200 ${className}`}
      style={{ border: borderBase, boxShadow: glow ? glowShadow : undefined }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = borderHover;
        e.currentTarget.style.boxShadow = glowShadow;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${accent}0.22)`;
        e.currentTarget.style.boxShadow = glow ? glowShadow : 'none';
      }}
    >
      {corner({ top: -1, left:  -1 }, { borderTop:    `2px solid ${c}`, borderLeft:  `2px solid ${c}` })}
      {corner({ top: -1, right: -1 }, { borderTop:    `2px solid ${c}`, borderRight: `2px solid ${c}` })}
      {corner({ bottom: -1, left:  -1 }, { borderBottom: `2px solid ${c}`, borderLeft:  `2px solid ${c}` })}
      {corner({ bottom: -1, right: -1 }, { borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}` })}

      {children}
    </div>
  );
}
