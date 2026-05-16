import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen, FileText, ChevronRight, BarChart2 } from 'lucide-react'
import { api } from '../api'

function parseFilename(filename) {
  // New format: repo_YYYY-MM-DD_HH-MM-SS.json
  const tsMatch = filename.match(/^(.+)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.json$/)
  if (tsMatch) {
    const [, repo, date, time] = tsMatch
    return { repo, date, time: time.replaceAll('-', ':'), label: `${date} at ${time.replaceAll('-', ':')} UTC` }
  }
  // Legacy format: repo_YYYY-MM-DD.json
  const dateMatch = filename.match(/^(.+)_(\d{4}-\d{2}-\d{2})\.json$/)
  if (dateMatch) return { repo: dateMatch[1], date: dateMatch[2], time: null, label: dateMatch[2] }
  return { repo: filename, date: 'unknown', time: null, label: 'unknown' }
}

function groupByRepo(files) {
  const map = {}
  files.forEach(f => {
    const parsed = parseFilename(f.filename)
    if (!map[parsed.repo]) map[parsed.repo] = []
    map[parsed.repo].push({ ...f, ...parsed })
  })
  return map
}

export default function Reports() {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: api.listReports,
    refetchInterval: 15000,
  })

  const grouped = groupByRepo(files)
  const repos = Object.keys(grouped).sort()
  const [selectedRepo, setSelectedRepo] = useState(null)
  const currentRepo = selectedRepo || repos[0]

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-600 text-sm">
        Loading reports…
      </div>
    )
  }

  if (repos.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <BarChart2 size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No reports yet.</p>
          <p className="text-slate-600 text-xs mt-1">Run a scan from the Dashboard to generate reports.</p>
          <Link to="/" className="inline-block mt-4 text-indigo-400 text-sm hover:text-indigo-300">
            Go to Dashboard →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Repo sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-fit">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            Projects
          </h2>
          <ul className="space-y-1">
            {repos.map(repo => (
              <li key={repo}>
                <button
                  onClick={() => setSelectedRepo(repo)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    currentRepo === repo
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <FolderOpen size={14} className="shrink-0" />
                  <span className="truncate font-mono">{repo}</span>
                  <span className="ml-auto text-xs text-slate-600 shrink-0">
                    {grouped[repo].length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Scan list for selected repo */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 font-mono">{currentRepo}</h2>
          {currentRepo && grouped[currentRepo]
            ?.sort((a, b) => b.filename.localeCompare(a.filename))
            .map(file => (
              <Link
                key={file.filename}
                to={`/report/${encodeURIComponent(file.filename)}`}
                className="flex items-center gap-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-5 py-4 transition-all group"
              >
                <FileText size={18} className="text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{file.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {(file.size_bytes / 1024).toFixed(1)} KB
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </Link>
            ))}
        </div>
      </div>
    </div>
  )
}
