export default function NeonButton({
  children,
  onClick,
  type = 'button',
  green = false,
  disabled = false,
  small = false,
  className = '',
}) {
  const color  = green ? '#00ff88' : '#00f0ff';
  const shadow = green
    ? '0 0 10px rgba(0,255,136,0.4), 0 0 24px rgba(0,255,136,0.15)'
    : '0 0 10px rgba(0,240,255,0.4), 0 0 24px rgba(0,240,255,0.15)';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative font-mono tracking-widest uppercase transition-all duration-200
        ${small ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      style={{
        background: 'transparent',
        color: disabled ? 'rgba(128,128,128,0.5)' : color,
        border: `1px solid ${disabled ? 'rgba(128,128,128,0.3)' : `${color}55`}`,
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = shadow;
        e.currentTarget.style.background = `${color}0d`;
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
