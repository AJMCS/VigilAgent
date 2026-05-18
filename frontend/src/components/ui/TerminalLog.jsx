import { useEffect, useRef } from 'react';

export default function TerminalLog({ lines = [], maxHeight = 200, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      className={`overflow-y-auto font-mono text-xs ${className}`}
      style={{
        maxHeight,
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(0,240,255,0.15)',
        padding: '0.5rem 0.75rem',
      }}
    >
      {lines.length === 0 ? (
        <span style={{ color: 'rgba(0,240,255,0.3)' }}>— awaiting events —</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="log-line whitespace-pre-wrap leading-5" style={{ color: '#00ff88' }}>
            {line}
          </div>
        ))
      )}
      <span style={{ color: 'rgba(0,240,255,0.5)' }}>█</span>
    </div>
  );
}
