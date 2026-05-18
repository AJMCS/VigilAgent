import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listScans, cancelScan } from '../api';
import PipelineSteps from './PipelineSteps';
import SeverityBadge from './ui/SeverityBadge';
import NeonCard from './ui/NeonCard';
import StatusDot from './ui/StatusDot';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}
function repoShort(url) {
  try { const p = new URL(url).pathname.replace(/^\//, ''); return p; } catch { return url; }
}
function isAutoPr(j) { return j.trigger === 'auto_pr'; }

const STATUS_COLOR = {
  queued:    '#00f0ff',
  running:   '#00f0ff',
  completed: '#00ff88',
  failed:    '#ff4444',
  cancelled: '#666666',
};

function JobCard({ job }) {
  const [cancelling, setCancelling] = useState(false);
  const qc = useQueryClient();
  const isActive = ['queued','running'].includes(job.status);
  const color    = STATUS_COLOR[job.status] || '#888';
  // Support both new schema (meta.scanned_at) and legacy schema (generated_at)
  const reports  = (job.results || []).flatMap(r =>
    (r.report?.meta?.scanned_at || r.report?.generated_at) ? [r] : []
  );

  return (
    <NeonCard green={job.status === 'completed'} className="p-3 space-y-2 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && <StatusDot active blue={job.status === 'running'} size={6} />}
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5"
            style={{ color, border: `1px solid ${color}44`, background: `${color}0d` }}
          >
            {job.status}
          </span>
          {isAutoPr(job) && (
            <span className="text-[10px] px-1.5 py-0.5 tracking-wider" style={{ color: '#aa88ff', border: '1px solid rgba(170,136,255,0.3)', background: 'rgba(170,136,255,0.06)' }}>
              PR #{job.pr_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10 }}>{timeAgo(job.created_at)}</span>
          {isActive && (
            <button
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                try { await cancelScan(job.job_id); } catch {}
                qc.invalidateQueries({ queryKey: ['scans'] });
                setCancelling(false);
              }}
              style={{
                color: cancelling ? '#555' : '#ff4444',
                background: 'transparent',
                border: '1px solid rgba(255,68,68,0.35)',
                padding: '1px 7px',
                fontSize: 9,
                letterSpacing: '0.1em',
                fontFamily: 'inherit',
                cursor: cancelling ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!cancelling) e.currentTarget.style.boxShadow = '0 0 8px rgba(255,68,68,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              {cancelling ? 'ABORTING...' : '✕ ABORT'}
            </button>
          )}
        </div>
      </div>

      {/* Repos */}
      <div className="space-y-0.5">
        {(job.repos || []).map(u => (
          <div key={u} style={{ color: '#ccc', fontSize: 11 }}>
            // {repoShort(u)}
          </div>
        ))}
        {isAutoPr(job) && job.pr_title && (
          <div style={{ color: '#aa88ff', fontSize: 10 }}>"{job.pr_title}"</div>
        )}
      </div>

      {/* Pipeline */}
      <PipelineSteps currentAgent={job.current_agent} agentsDone={job.agents_done || []} />

      {/* Scan progress bar */}
      {job.status === 'running' && <div className="scan-progress" />}

      {/* Error */}
      {job.status === 'failed' && job.error && (
        <div style={{ color: '#ff4444', fontSize: 10, borderLeft: '2px solid #ff4444', paddingLeft: 8 }}>
          {job.error}
        </div>
      )}

      {/* Reports links */}
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1" style={{ borderTop: '1px solid rgba(0,240,255,0.1)' }}>
          {reports.map(r => {
            const slug = (r.report.repo_url || '').split('/').pop();
            const ts   = (r.report.generated_at || '').slice(0,10);
            const fname = `${slug}_${ts}.json`; // best-effort filename
            return (
              <Link
                key={r.repo_url}
                to={`/reports`}
                className="text-[10px] tracking-wider transition-all duration-150"
                style={{
                  color: '#00ff88',
                  border: '1px solid rgba(0,255,136,0.25)',
                  padding: '1px 6px',
                  background: 'rgba(0,255,136,0.06)',
                  textDecoration: 'none',
                }}
              >
                VIEW REPORT ↗
              </Link>
            );
          })}
        </div>
      )}
    </NeonCard>
  );
}

export default function JobMonitor({ hideEmptyState = false }) {
  const { data: jobs = [] } = useQuery({
    queryKey: ['scans'],
    queryFn: listScans,
    refetchInterval: d => {
      const arr = d?.state?.data || [];
      return arr.some(j => ['queued','running'].includes(j.status)) ? 2000 : 10000;
    },
  });

  const active   = jobs.filter(j => ['queued','running'].includes(j.status));
  const recent   = jobs.filter(j => !['queued','running'].includes(j.status)).slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Active */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2" style={{ color: '#00f0ff', fontSize: 10, letterSpacing: '0.1em' }}>
            <StatusDot active blue size={6} />
            ACTIVE SCANS ({active.length})
          </div>
          <div className="space-y-2">
            {active.map(j => <JobCard key={j.job_id} job={j} />)}
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>
            // RECENT SCANS
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recent.map(j => <JobCard key={j.job_id} job={j} />)}
          </div>
        </div>
      )}

      {active.length === 0 && recent.length === 0 && !hideEmptyState && (
        <div className="text-center py-12" style={{ color: 'rgba(0,240,255,0.2)', fontSize: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>◉</div>
          No scans yet. Submit a repo to begin.
        </div>
      )}
    </div>
  );
}
