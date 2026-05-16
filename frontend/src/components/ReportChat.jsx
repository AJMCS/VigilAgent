import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api'

export default function ReportChat({ filename }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const question = input.trim()
    if (!question || loading) return

    const userMsg = { role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for the API (exclude the message we just added)
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const data = await api.chatWithReport(filename, question, history)
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        error: true,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden no-print">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800 bg-slate-900/80">
        <Bot size={15} className="text-indigo-400" />
        <span className="text-sm font-semibold text-slate-300">Ask Nemotron</span>
        <span className="text-xs text-slate-600 ml-1">about this report</span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <Bot size={28} className="text-slate-700" />
            <div>
              <p className="text-sm text-slate-500">Ask anything about this report</p>
              <p className="text-xs text-slate-700 mt-1">
                e.g. "What's the most urgent fix?" · "Explain the token exposure" · "How do I patch the npm vulns?"
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
              msg.role === 'user'
                ? 'bg-indigo-600/30 text-indigo-400'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-600/20 text-slate-200 rounded-tr-sm'
                : msg.error
                  ? 'bg-red-500/10 text-red-400 rounded-tl-sm'
                  : 'bg-slate-800 text-slate-300 rounded-tl-sm'
            }`}>
              {msg.role === 'assistant' && !msg.error ? (
                <div className="report-body prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 text-slate-400">
              <Bot size={13} />
            </div>
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2 text-slate-500 text-sm">
              <Loader size={13} className="animate-spin" />
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 px-4 py-3 flex gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about this report… (Enter to send)"
          disabled={loading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="shrink-0 flex items-center justify-center w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Send size={14} className="text-white" />
        </button>
      </div>
    </div>
  )
}
