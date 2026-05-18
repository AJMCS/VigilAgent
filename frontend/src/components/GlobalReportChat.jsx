import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { globalChat } from '../api';
import logo from '../assets/vigilagent_logo.svg';

const SUGGESTED_CHIPS = [
  "How many critical vulnerabilities in the last 90 days?",
  "Which repo has the most findings overall?",
  "How many scans were triggered by PR branches in the last 30 days?",
  "What's the security trend over time — are we improving?",
  "Which category (static, deps, secrets) shows up most across all scans?",
  "Which collaborator introduced the most vulnerabilities via PRs?",
];

export default function GlobalReportChat({ totalReports = 0 }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendText = async (text) => {
    const q = text.trim();
    if (!q || loading) return;
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(m => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const { answer } = await globalChat(q, history);
      setMessages(m => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `✕ ${e.message}`, error: true }]);
    } finally { setLoading(false); }
  };

  const send = () => sendText(input);

  return (
    <div className="flex flex-col h-full relative" style={{ background: '#050505' }}>
      {/* Logo watermark — sits behind all chat content */}
      <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none" style={{ zIndex: 0, opacity: 0.07 }}>
        <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(60%) brightness(0.5)' }} />
      </div>
      {/* Header */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,240,255,0.12)', background: 'rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: '#00f0ff', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>
            [ ANALYTICS CHAT ]
          </span>
          <span style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>
            {totalReports} report{totalReports !== 1 ? 's' : ''} in context
          </span>
        </div>
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
      <div className="relative z-10 flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-5 pt-4">
            <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11, lineHeight: 1.7 }}>
              Ask aggregate questions about all your reports — trends over time, totals by severity,
              which repos or branches have the most issues, and more.
            </div>
            <div>
              <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 9, letterSpacing: '0.12em', marginBottom: 10 }}>
                SUGGESTED QUESTIONS
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CHIPS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendText(q)}
                    className="text-left transition-all duration-150"
                    style={{
                      fontSize: 10,
                      color: '#00f0ff',
                      background: 'rgba(0,240,255,0.06)',
                      border: '1px solid rgba(0,240,255,0.25)',
                      padding: '5px 12px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      lineHeight: 1.5,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(0,240,255,0.12)';
                      e.currentTarget.style.borderColor = '#00f0ff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(0,240,255,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.25)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
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
                padding: '8px 12px',
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
              // analysing reports...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative z-10 flex gap-2 p-4 shrink-0" style={{ borderTop: '1px solid rgba(0,240,255,0.12)' }}>
        <textarea
          className="flex-1 px-3 py-2 text-xs rounded-none resize-none"
          style={{ border: '1px solid rgba(0,240,255,0.25)', fontSize: 11, minHeight: 40, maxHeight: 100, background: 'rgba(0,0,0,0.4)', color: '#c0c0c0', fontFamily: 'inherit' }}
          placeholder="Ask about trends, totals, or patterns across all reports..."
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
