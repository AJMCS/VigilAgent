export default function StatusDot({ active = true, blue = false, size = 8 }) {
  const color = !active ? '#ff4444' : blue ? '#00f0ff' : '#00ff88';
  const anim  = !active ? 'none' : blue ? 'pulseDotBlue 2s ease-in-out infinite' : 'pulseDot 2s ease-in-out infinite';
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: anim,
      }}
    />
  );
}
