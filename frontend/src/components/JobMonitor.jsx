import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, Clock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import PipelineSteps from './PipelineSteps'
import { api } from '../api'

function statusBadge(status) {
  const map = {
    queued:    'bg-slate-700 text-slate-300',
    running:   'bg-indigo-500/20 text-indigo-300 animate-pulse',
    completed: 'bg-emerald-500/20 text-emerald-300',
    failed:    'bg-red-500/20 text-red-300',
  }
  return map[status] || map.queued
}

function repoShort(url) {
  try { return new URL(url).pathname.replace(/^\//, '') } catch { return url }
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function JobCard({ job }) {
  const hasResults = job.status === 'completed' && job.results?.length > 0

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate font-mono">
            {job.repos.map(repoShort).join(', ')}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
            <Clock size={11} />
            {timeAgo(job.created_at)}
            {job.current_repo && job.repos.length > 1 && (
              <span className="text-slate-600">· scanning {repoShort(job.current_repo)}</span>
            )}
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge(job.status)}`}>
          {job.status}
        </span>
      </div>

      {/* Pipeline visualizer */}
      <PipelineSteps
        currentAgent={job.current_agent}
        agentsDone={job.agents_done || []}
        status={job.status}
      />

      {/* Error */}
      {job.results?.some(r => r.error) && (
        <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <XCircle size={12} className="mt-0.5 shrink-0" />
          {job.results.find(r => r.error)?.error}
        </div>
      )}

      {/* View report links */}
      {hasResults && job.results.map((r, i) => {
        if (!r.report?.generated_at) return null
        // Match the backend filename format: YYYY-MM-DD_HH-MM-SS
        const ts = r.report.generated_at
        const fileTs = ts
          ? ts.slice(0, 19).replace('T', '_').replaceAll(':', '-')
          : null
        const slug = r.repo_url?.split('/').pop()
        const filename = fileTs ? `${slug}_${fileTs}.json` : null
        if (!filename) return null
        return (
          <Link
            key={i}
            to={`/report/${encodeURIComponent(filename)}`}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <CheckCircle2 size={12} />
            View report for {repoShort(r.repo_url)}
            <ExternalLink size={11} />
          </Link>
        )
      })}
    </div>
  )
}

export default function JobMonitor() {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: api.listScans,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(j => j.status === 'queued' || j.status === 'running')
      return hasActive ? 2000 : 10000
    },
  })

  const sorted = [...jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const active = sorted.filter(j => j.status === 'queued' || j.status === 'running')
  const finished = sorted.filter(j => j.status === 'completed' || j.status === 'failed')

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Activity size={14} />
        Agent Monitor
        {active.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded-full font-medium">
            {active.length} active
          </span>
        )}
      </h2>

      {isLoading && (
        <p className="text-xs text-slate-600 text-center py-6">Connecting…</p>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-600">No scans yet. Submit one on the left.</p>
        </div>
      )}

      {active.map(job => <JobCard key={job.job_id} job={job} />)}

      {finished.length > 0 && (
        <>
          {active.length > 0 && <div className="border-t border-slate-800" />}
          <p className="text-xs text-slate-600 font-medium uppercase tracking-wider">Recent</p>
          {finished.slice(0, 5).map(job => <JobCard key={job.job_id} job={job} />)}
        </>
      )}
    </div>
  )
}
