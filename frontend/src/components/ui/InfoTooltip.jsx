import { useState, useRef, useEffect } from 'react';

const PADDING = 10; // min distance from viewport edges

export default function InfoTooltip({ content }) {
  const [open, setOpen]   = useState(false);
  const [pos, setPos]     = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const tipRef = useRef(null);

  const reposition = () => {
    if (!btnRef.current || !tipRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    // Prefer below button, fallback above
    let top = btn.bottom + 6;
    if (top + tip.height + PADDING > vh) top = btn.top - tip.height - 6;
    top = Math.max(PADDING, Math.min(top, vh - tip.height - PADDING));

    // Align left with button, clamp to viewport
    let left = btn.left;
    left = Math.max(PADDING, Math.min(left, vw - tip.width - PADDING));

    setPos({ top, left });
  };

  useEffect(() => {
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all duration-150 focus:outline-none shrink-0"
        style={{
          color: '#00f0ff',
          border: '1px solid rgba(0,240,255,0.4)',
          background: 'rgba(0,240,255,0.08)',
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#00f0ff';
          e.currentTarget.style.boxShadow = '0 0 8px rgba(0,240,255,0.4)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(0,240,255,0.4)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        ?
      </button>

      {open && (
        <div
          ref={tipRef}
          className="animate-slide-up"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            width: 280,
            padding: '10px 12px',
            background: '#0d0d0d',
            border: '1px solid rgba(0,240,255,0.35)',
            boxShadow: '0 0 24px rgba(0,240,255,0.15)',
            color: '#c0c0c0',
            fontFamily: 'inherit',
            fontSize: 11,
            lineHeight: 1.7,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
