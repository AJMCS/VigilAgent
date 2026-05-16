import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Printer, ArrowLeft, Shield, Calendar, Cpu, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import ReportChat from './ReportChat'

function extractRiskScore(text) {
  const m = text?.match(/risk score[^0-9]*(\d{1,3})/i)
  return m ? parseInt(m[1]) : null
}

function riskColor(score) {
  if (score >= 75) return 'text-red-400 bg-red-500/10 ring-1 ring-red-500/30'
  if (score >= 50) return 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/30'
  if (score >= 25) return 'text-yellow-400 bg-yellow-500/10 ring-1 ring-yellow-500/30'
  return 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/30'
}

function riskLabel(score) {
  if (score >= 75) return 'Critical'
  if (score >= 50) return 'High'
  if (score >= 25) return 'Medium'
  return 'Low'
}

const markdownComponents = {
  // Wrap every table in a horizontally-scrollable div so wide tables don't overflow the card.
  // Print styles override this to let the table reflow to the full page width.
  table: ({ children }) => (
    <div className="table-scroll">
      <table>{children}</table>
    </div>
  ),
}

export default function ReportViewer({ report, filename }) {
  const [chatOpen, setChatOpen] = useState(false)
  const repoName = report.repo_url?.split('/').slice(-2).join('/')
  const generatedAt = report.generated_at
  const displayTs = generatedAt
    ? new Date(generatedAt).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short',
      })
    : '—'
  const riskScore = extractRiskScore(report.report)

  const handlePrint = () => window.print()

  return (
    <div className="space-y-6">
      {/* Header — hidden on print */}
      <div className="flex items-center justify-between no-print">
        <Link
          to="/reports"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm transition-colors ${
              chatOpen
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <MessageSquare size={14} /> Ask Nemotron
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <Printer size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Report card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl print-area">
        {/* Report header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-indigo-400" />
                <h1 className="text-lg font-bold text-slate-100 font-mono">{repoName}</h1>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {displayTs}
                </span>
                <span className="flex items-center gap-1">
                  <Cpu size={11} /> {report.model}
                </span>
              </div>
            </div>

            {riskScore !== null && (
              <div className={`flex flex-col items-center px-4 py-2 rounded-xl ${riskColor(riskScore)}`}>
                <span className="text-2xl font-bold leading-none">{riskScore}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                  {riskLabel(riskScore)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Markdown body */}
        <div className="px-6 py-6">
          <div className="report-body max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {report.report}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    {chatOpen && filename && (
        <ReportChat filename={filename} />
      )}
    </div>
  )
}
