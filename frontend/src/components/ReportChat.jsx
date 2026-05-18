import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chatWithReport } from '../api';

export default function ReportChat({ filename }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(m => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const { answer } = await chatWithReport(filename, q, history);
      setMessages(m => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `✕ ${e.message}`, error: true }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col" style={{ border: '1px solid rgba(0,240,255,0.2)', background: '#050505' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}>
        <span style={{ color: '#00f0ff', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>[ AI CHAT ]</span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 360 }}>
        {messages.length === 0 && (
          <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11, textAlign: 'center', paddingTop: 24 }}>
            Ask anything about this report...
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-6 h-6 flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                border: `1px solid ${m.role === 'user' ? 'rgba(0,240,255,0.4)' : 'rgba(0,255,136,0.4)'}`,
                color: m.role === 'user' ? '#00f0ff' : '#00ff88',
                background: m.role === 'user' ? 'rgba(0,240,255,0.06)' : 'rgba(0,255,136,0.06)',
              }}
            >
              {m.role === 'user' ? 'U' : 'AI'}
            </div>
            <div
              className="flex-1 text-xs leading-relaxed report-body"
              style={{
                color: m.error ? '#ff4444' : '#c0c0c0',
                padding: '6px 10px',
                background: m.role === 'user' ? 'rgba(0,240,255,0.04)' : 'rgba(0,0,0,0.4)',
                border: `1px solid ${m.role === 'user' ? 'rgba(0,240,255,0.12)' : 'rgba(0,240,255,0.08)'}`,
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-[10px]"
              style={{ border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}>AI</div>
            <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 11, paddingTop: 6 }} className="animate-pulse">
              // processing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3" style={{ borderTop: '1px solid rgba(0,240,255,0.12)' }}>
        <textarea
          className="flex-1 px-3 py-2 text-xs rounded-none resize-none"
          style={{ border: '1px solid rgba(0,240,255,0.25)', fontSize: 11, minHeight: 36, maxHeight: 80 }}
          placeholder="Ask about this report..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 text-xs font-bold tracking-wider uppercase transition-all duration-150"
          style={{
            color: '#00ff88',
            border: '1px solid rgba(0,255,136,0.35)',
            background: 'transparent',
            fontFamily: 'inherit',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.4 : 1,
          }}
          onMouseEnter={e => { if (!loading && input.trim()) { e.currentTarget.style.background = 'rgba(0,255,136,0.08)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(0,255,136,0.3)'; }}}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
