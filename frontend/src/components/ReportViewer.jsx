import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReportChat from './ReportChat';
import SeverityBadge from './ui/SeverityBadge';
import NeonButton from './ui/NeonButton';
import InfoTooltip from './ui/InfoTooltip';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEV_PRINT_COLOR = { critical: '#c00', high: '#c60', medium: '#960', low: '#006', info: '#333', clean: '#060', error: '#c00' };

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 print:flex print:gap-2">
      <span style={{ color: 'rgba(0,240,255,0.45)', fontSize: 10, whiteSpace: 'nowrap' }} className="print:text-gray-500 print:text-xs">{label}</span>
      <span style={{ color: '#ccc', fontSize: 10 }} className="print:text-black print:text-xs">{value}</span>
    </div>
  );
}

function CountPill({ label, value, color }) {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 print-count-pill"
      style={{ border: `1px solid ${color}44`, background: `${color}0d`, minWidth: 56 }}>
      <span style={{ color, fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{value}</span>
      <span style={{ color: `${color}99`, fontSize: 8, letterSpacing: '0.1em', marginTop: 2 }}>{label}</span>
    </div>
  );
}

function SectionHeader({ label, count, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2 transition-all duration-100 no-print"
      style={{
        background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.15)',
        color: '#00f0ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span>[ {label} ] {count !== undefined && `(${count})`}</span>
      <span style={{ opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
    </button>
  );
}

// Always-visible header for print
function PrintSectionHeader({ label }) {
  return (
    <div className="hidden print:block font-bold text-black border-b border-gray-400 pb-1 mb-2 mt-4 uppercase tracking-widest text-xs">
      {label}
    </div>
  );
}

function FindingCard({ finding, prefix }) {
  const sev = (finding.severity || 'info').toLowerCase();
  return (
    <div className="p-3 mb-2 print-finding"
      style={{ border: '1px solid rgba(0,240,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span style={{ color: 'rgba(0,240,255,0.4)', fontSize: 10 }}>{finding.id || ''}</span>
        <SeverityBadge severity={sev} />
        {finding.tool && (
          <span style={{ color: 'rgba(0,240,255,0.35)', fontSize: 10, border: '1px solid rgba(0,240,255,0.15)', padding: '0 4px' }}>
            {finding.tool}
          </span>
        )}
        {finding.rule && <span style={{ color: '#00f0ff', fontSize: 10 }}>{finding.rule}</span>}
        {finding.package && <span style={{ color: '#00f0ff', fontSize: 10 }}>{finding.package} {finding.version}</span>}
        {finding.cve && <span style={{ color: '#ff8800', fontSize: 10 }}>{finding.cve}</span>}
        {finding.secret_type && <span style={{ color: '#ff4444', fontSize: 10 }}>{finding.secret_type}</span>}
      </div>
      {(finding.file || finding.line) && (
        <div style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, marginBottom: 4, fontFamily: 'monospace' }}>
          {finding.file}{finding.line ? `:${finding.line}` : ''}
        </div>
      )}
      {finding.description && (
        <div style={{ color: '#c0c0c0', fontSize: 11, marginBottom: 4 }}>{finding.description}</div>
      )}
      {finding.recommendation && (
        <div style={{ color: '#00ff88', fontSize: 10, borderLeft: '2px solid rgba(0,255,136,0.3)', paddingLeft: 8 }}>
          ↳ {finding.recommendation}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SCORING_INFO = (
  <div>
    <div style={{ color: '#00f0ff', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6, fontSize: 11 }}>
      HOW FINDINGS ARE SCORED
    </div>
    <div style={{ marginBottom: 8 }}>
      Each finding is assigned a severity level. The overall report severity equals the highest severity found.
    </div>
    <div style={{ marginBottom: 5 }}>
      <span style={{ color: '#ff4444', fontWeight: 700 }}>CRITICAL</span> — Exploitable flaws, exposed secrets, or critical CVEs. Fix immediately.
    </div>
    <div style={{ marginBottom: 5 }}>
      <span style={{ color: '#ff8800', fontWeight: 700 }}>HIGH</span> — Serious vulnerabilities with significant risk. Fix before release.
    </div>
    <div style={{ marginBottom: 5 }}>
      <span style={{ color: '#ffcc00', fontWeight: 700 }}>MEDIUM</span> — Moderate risk. Should be addressed soon.
    </div>
    <div style={{ marginBottom: 8 }}>
      <span style={{ color: '#00f0ff', fontWeight: 700 }}>LOW</span> — Minor or informational findings. Fix when convenient.
    </div>
    <div style={{ color: 'rgba(0,240,255,0.5)', fontSize: 10, borderTop: '1px solid rgba(0,240,255,0.15)', paddingTop: 6 }}>
      Findings span 3 categories: <strong style={{ color: '#aa88ff' }}>STATIC</strong> (code patterns &amp; anti-patterns), <strong style={{ color: '#aa88ff' }}>DEPS</strong> (package CVEs), and <strong style={{ color: '#aa88ff' }}>SECRETS</strong> (leaked credentials).
    </div>
  </div>
);

export default function ReportViewer({ report, filename }) {
  const [showChat, setShowChat] = useState(false);
  const [openSections, setOpenSections] = useState({ static: true, deps: true, secrets: true, synthesis: true });

  const toggle = key => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  // Detect format
  const isStructured = report?.meta && report?.summary && report?.findings && report?.ai_synthesis;

  // Export JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'report.json';
    a.click();
  };

  // ── Legacy markdown format ────────────────────────────────────────────────
  if (!isStructured) {
    const reportText = report?.report || JSON.stringify(report, null, 2);
    return (
      <div className="space-y-4">
        <div className="no-print flex gap-2">
          <NeonButton green small onClick={() => setShowChat(s => !s)}>
            {showChat ? '▼ HIDE AI CHAT' : '▶ ASK AI'}
          </NeonButton>
          <NeonButton small onClick={handleExport}>↓ EXPORT JSON</NeonButton>
        </div>
        {showChat && <div className="no-print"><ReportChat filename={filename} totalFindings={0} overallSeverity="unknown" /></div>}
        <div className="p-4 report-body" style={{ border: '1px solid rgba(0,240,255,0.12)', background: '#050505' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}
            components={{ table: ({ node, ...props }) => <div className="table-wrap"><table {...props} /></div> }}>
            {reportText}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // ── Structured JSON format ────────────────────────────────────────────────
  const { meta, summary, findings, ai_synthesis } = report;
  const sev       = (summary.overall_severity || 'UNKNOWN').toLowerCase();
  const repoName  = (meta.repo || '').split('/').slice(-2).join('/');
  const scannedAt = meta.scanned_at ? new Date(meta.scanned_at).toLocaleString() : '';
  const staticF   = findings.static_analysis  || [];
  const depsF     = findings.dependency_audit || [];
  const secretsF  = findings.secret_detection || [];

  return (
    <div className="space-y-4 report-print-root">

      {/* ── Meta header ────────────────────────────────────────────────────── */}
      <div className="p-4" style={{ border: '1px solid rgba(0,240,255,0.2)', background: '#0a0a0a' }}>
        {/* Repo name */}
        <div style={{ color: '#00f0ff', fontSize: 15, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 6 }}>
          {repoName || meta.repo || 'Unknown Repo'}
        </div>

        {/* Meta grid */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4">
          <MetaRow label="BRANCH"    value={meta.branch} />
          <MetaRow label="COMMIT"    value={meta.commit} />
          <MetaRow label="SCANNED"   value={scannedAt} />
          <MetaRow label="DURATION"  value={meta.scan_duration_seconds ? `${meta.scan_duration_seconds}s` : null} />
          <MetaRow label="MODEL"     value={meta.model} />
          <MetaRow label="VERSION"   value={`VigilAgent ${meta.vigilagent_version}`} />
        </div>

        {/* Summary counts */}
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: 'rgba(0,240,255,0.4)', fontSize: 9, letterSpacing: '0.12em' }}>FINDINGS SUMMARY</span>
          <InfoTooltip content={SCORING_INFO} />
        </div>
        <div className="flex flex-wrap gap-3 items-start">
          <div className="flex flex-col items-center px-4 py-2"
            style={{ border: '1px solid rgba(0,240,255,0.3)', background: 'rgba(0,240,255,0.04)' }}>
            <span style={{ color: '#00f0ff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{summary.total_findings}</span>
            <span style={{ color: 'rgba(0,240,255,0.5)', fontSize: 8, letterSpacing: '0.1em', marginTop: 2 }}>TOTAL</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <CountPill label="CRITICAL" value={summary.by_severity?.critical ?? 0} color="#ff4444" />
            <CountPill label="HIGH"     value={summary.by_severity?.high     ?? 0} color="#ff8800" />
            <CountPill label="MEDIUM"   value={summary.by_severity?.medium   ?? 0} color="#ffcc00" />
            <CountPill label="LOW"      value={summary.by_severity?.low      ?? 0} color="#00f0ff" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <CountPill label="STATIC"   value={summary.by_category?.static_analysis  ?? 0} color="#aa88ff" />
            <CountPill label="DEPS"     value={summary.by_category?.dependency_audit ?? 0} color="#aa88ff" />
            <CountPill label="SECRETS"  value={summary.by_category?.secret_detection ?? 0} color="#aa88ff" />
          </div>
        </div>

        {/* Top priority */}
        {summary.top_priority_finding && (
          <div className="mt-3 px-3 py-2" style={{ borderLeft: '3px solid rgba(255,68,68,0.6)', background: 'rgba(255,68,68,0.04)' }}>
            <div style={{ color: 'rgba(255,68,68,0.7)', fontSize: 9, letterSpacing: '0.1em', marginBottom: 2 }}>TOP PRIORITY</div>
            <div style={{ color: '#c0c0c0', fontSize: 11 }}>{summary.top_priority_finding}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 flex-wrap no-print">
          <NeonButton green small onClick={() => setShowChat(s => !s)}>
            {showChat ? '▼ HIDE AI CHAT' : '▶ ASK AI'}
          </NeonButton>
          <NeonButton small onClick={handleExport}>↓ EXPORT JSON</NeonButton>
        </div>
      </div>

      {/* AI Chat */}
      {showChat && <div className="no-print"><ReportChat filename={filename} totalFindings={summary?.total_findings ?? 0} overallSeverity={sev} /></div>}

      {/* ── AI Synthesis ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="AI SYNTHESIS" open={openSections.synthesis} onToggle={() => toggle('synthesis')} />
        <PrintSectionHeader label="AI Synthesis" />
        {openSections.synthesis && (
          <div className="p-4 space-y-4" style={{ border: '1px solid rgba(0,240,255,0.1)', borderTop: 'none', background: '#050505' }}>
            {ai_synthesis.executive_summary && (
              <div>
                <div style={{ color: '#00f0ff', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>EXECUTIVE SUMMARY</div>
                <div style={{ color: '#c0c0c0', fontSize: 12, lineHeight: 1.7 }}>{ai_synthesis.executive_summary}</div>
              </div>
            )}
            {ai_synthesis.risk_assessment && (
              <div>
                <div style={{ color: '#00f0ff', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>RISK ASSESSMENT</div>
                <div style={{ color: '#c0c0c0', fontSize: 12, lineHeight: 1.7 }}>{ai_synthesis.risk_assessment}</div>
              </div>
            )}
            {ai_synthesis.critical_actions?.length > 0 && (
              <div>
                <div style={{ color: '#ff4444', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>CRITICAL ACTIONS</div>
                <ul className="space-y-1">
                  {ai_synthesis.critical_actions.map((a, i) => (
                    <li key={i} className="flex gap-2" style={{ color: '#c0c0c0', fontSize: 11 }}>
                      <span style={{ color: '#ff4444' }}>✕</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ai_synthesis.recommended_priority_order?.length > 0 && (
              <div>
                <div style={{ color: '#00ff88', fontSize: 9, letterSpacing: '0.12em', marginBottom: 4 }}>PRIORITY ORDER</div>
                <ol className="space-y-1">
                  {ai_synthesis.recommended_priority_order.map((a, i) => (
                    <li key={i} className="flex gap-2" style={{ color: '#c0c0c0', fontSize: 11 }}>
                      <span style={{ color: '#00ff88', minWidth: 18 }}>{i + 1}.</span>{a}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Static Analysis ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="STATIC ANALYSIS" count={staticF.length} open={openSections.static} onToggle={() => toggle('static')} />
        <PrintSectionHeader label={`Static Analysis (${staticF.length})`} />
        {openSections.static && (
          <div className="p-3" style={{ border: '1px solid rgba(0,240,255,0.1)', borderTop: 'none', background: '#050505' }}>
            {staticF.length === 0
              ? <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }}>// No static analysis findings.</div>
              : staticF.map((f, i) => <FindingCard key={i} finding={f} prefix="SA" />)
            }
          </div>
        )}
      </div>

      {/* ── Dependency Audit ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="DEPENDENCY AUDIT" count={depsF.length} open={openSections.deps} onToggle={() => toggle('deps')} />
        <PrintSectionHeader label={`Dependency Audit (${depsF.length})`} />
        {openSections.deps && (
          <div className="p-3" style={{ border: '1px solid rgba(0,240,255,0.1)', borderTop: 'none', background: '#050505' }}>
            {depsF.length === 0
              ? <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }}>// No dependency vulnerabilities found.</div>
              : depsF.map((f, i) => <FindingCard key={i} finding={f} prefix="DA" />)
            }
          </div>
        )}
      </div>

      {/* ── Secret Detection ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="SECRET DETECTION" count={secretsF.length} open={openSections.secrets} onToggle={() => toggle('secrets')} />
        <PrintSectionHeader label={`Secret Detection (${secretsF.length})`} />
        {openSections.secrets && (
          <div className="p-3" style={{ border: '1px solid rgba(0,240,255,0.1)', borderTop: 'none', background: '#050505' }}>
            {secretsF.length === 0
              ? <div style={{ color: 'rgba(0,240,255,0.3)', fontSize: 11 }}>// No secrets detected.</div>
              : secretsF.map((f, i) => <FindingCard key={i} finding={f} prefix="SD" />)
            }
          </div>
        )}
      </div>

    </div>
  );
}
