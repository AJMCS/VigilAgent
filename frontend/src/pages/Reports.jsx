import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listReports, getReport } from '../api';
import ReportViewer from '../components/ReportViewer';
import SeverityBadge from '../components/ui/SeverityBadge';

function parseFilename(name) {
  const m1 = name.match(/^(.+?)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.json$/);
  if (m1) return { repo: m1[1], date: m1[2], time: m1[3].replace(/-/g, ':'), display: `${m1[2]} ${m1[3].replace(/-/g, ':')}` };
  const m2 = name.match(/^(.+?)_(\d{4}-\d{2}-\d{2})\.json$/);
  if (m2) return { repo: m2[1], date: m2[2], time: '', display: m2[2] };
  return { repo: name.replace(/\.json$/, ''), date: '', time: '', display: '' };
}

export default function Reports() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeRepo, setActiveRepo]     = useState(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: listReports,
    refetchInterval: 15000,
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['report', selectedFile],
    queryFn: () => getReport(selectedFile),
    enabled: !!selectedFile,
  });

  // Group files by repo
  const byRepo = {};
  files.forEach(f => {
    const p = parseFilename(f.filename);
    if (!byRepo[p.repo]) byRepo[p.repo] = [];
    byRepo[p.repo].push({ ...f, ...p });
  });
  const repos = Object.keys(byRepo).sort();
  const currentRepo = activeRepo || repos[0];

  if (isLoading) return (
    <div className="pt-20 flex items-center justify-center" style={{ color: 'rgba(0,240,255,0.4)', fontSize: 12 }}>
      // loading reports...
    </div>
  );

  if (files.length === 0) return (
    <div className="pt-12 flex flex-col items-center justify-center min-h-screen gap-4">
      <div style={{ color: 'rgba(0,240,255,0.2)', fontSize: 48 }}>◉</div>
      <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 14 }}>No reports yet.</div>
      <Link to="/" style={{ color: '#00ff88', fontSize: 12, textDecoration: 'none', border: '1px solid rgba(0,255,136,0.3)', padding: '4px 16px' }}>
        ▶ RUN A SCAN
      </Link>
    </div>
  );

  const repoReports = (byRepo[currentRepo] || [])
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const overallSeverity = report?.summary?.overall_severity;

  return (
    <div className="pt-12 min-h-screen flex" style={{ height: '100vh' }}>

      {/* ── Left panel: project + report list ──────────────────────────────── */}
      <div
        className="flex flex-col shrink-0 no-print"
        style={{ width: 260, borderRight: '1px solid rgba(0,240,255,0.1)', overflowY: 'auto' }}
      >
        {/* Project list */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,240,255,0.1)', color: '#00f0ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>
          [ PROJECTS ]
        </div>
        {repos.map(repo => {
          const isActive = repo === currentRepo;
          return (
            <button
              key={repo}
              onClick={() => { setActiveRepo(repo); setSelectedFile(null); }}
              className="w-full text-left px-4 py-2 transition-all duration-100"
              style={{
                background: isActive ? 'rgba(0,240,255,0.06)' : 'transparent',
                borderBottom: '1px solid rgba(0,240,255,0.06)',
                borderLeft: `2px solid ${isActive ? '#00f0ff' : 'transparent'}`,
                color: isActive ? '#00f0ff' : 'rgba(0,240,255,0.45)',
                fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <div className="truncate">{repo}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,240,255,0.3)', marginTop: 1 }}>
                {byRepo[repo].length} report{byRepo[repo].length > 1 ? 's' : ''}
              </div>
            </button>
          );
        })}

        {/* Report list for selected project */}
        {currentRepo && (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,240,255,0.08)', borderTop: '1px solid rgba(0,240,255,0.1)', color: 'rgba(0,240,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', marginTop: 8 }}>
              [ SCANS ]
            </div>
            {repoReports.map(r => {
              const isSelected = r.filename === selectedFile;
              return (
                <button
                  key={r.filename}
                  onClick={() => setSelectedFile(r.filename)}
                  className="w-full text-left px-4 py-2.5 transition-all duration-100"
                  style={{
                    background: isSelected ? 'rgba(0,255,136,0.06)' : 'transparent',
                    borderBottom: '1px solid rgba(0,240,255,0.06)',
                    borderLeft: `2px solid ${isSelected ? '#00ff88' : 'transparent'}`,
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <div style={{ color: isSelected ? '#00ff88' : 'rgba(0,240,255,0.6)', fontSize: 10, fontWeight: isSelected ? 700 : 400 }}>
                    {r.display || r.filename}
                  </div>
                  <div style={{ color: 'rgba(0,240,255,0.25)', fontSize: 9, marginTop: 1 }}>
                    {Math.round(r.size_bytes / 1024)}KB
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* ── Right panel: inline report view ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative">
        {!selectedFile ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'rgba(0,240,255,0.2)', gap: 12 }}>
            <div style={{ fontSize: 36 }}>◉</div>
            <div style={{ fontSize: 12 }}>Select a report to view it here</div>
          </div>
        ) : reportLoading ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'rgba(0,240,255,0.4)', fontSize: 12 }} >
            <span className="animate-pulse">// loading report...</span>
          </div>
        ) : report ? (
          <div>
            {/* Toolbar: severity + print button */}
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-2 no-print"
              style={{ background: 'rgba(10,10,10,0.97)', borderBottom: '1px solid rgba(0,240,255,0.12)', backdropFilter: 'blur(6px)' }}
            >
              <div className="flex items-center gap-3">
                {overallSeverity && <SeverityBadge severity={overallSeverity.toLowerCase()} />}
                <span style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10 }}>
                  {selectedFile}
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 text-[11px] font-bold tracking-widest uppercase transition-all duration-150"
                style={{ color: '#00f0ff', border: '1px solid rgba(0,240,255,0.35)', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,240,255,0.08)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(0,240,255,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                ⎙ PRINT
              </button>
            </div>

            <div className="p-5">
              <ReportViewer report={report} filename={selectedFile} />
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
