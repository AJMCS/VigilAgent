import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getReport } from '../api';
import ReportViewer from '../components/ReportViewer';

export default function ReportDetail() {
  const { filename } = useParams();
  const decoded = decodeURIComponent(filename);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', decoded],
    queryFn: () => getReport(decoded),
  });

  return (
    <div className="pt-12 min-h-screen">
      {/* Back nav */}
      <div className="px-4 py-2 no-print" style={{ borderBottom: '1px solid rgba(0,240,255,0.1)' }}>
        <Link
          to="/reports"
          style={{ color: 'rgba(0,240,255,0.5)', fontSize: 11, textDecoration: 'none', letterSpacing: '0.08em' }}
          onMouseEnter={e => e.currentTarget.style.color = '#00f0ff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,240,255,0.5)'}
        >
          ← REPORTS
        </Link>
      </div>

      <div className="p-4">
        {isLoading && (
          <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 12, paddingTop: 40 }} className="animate-pulse text-center">
            // loading report...
          </div>
        )}
        {error && (
          <div className="text-center pt-12 space-y-3">
            <div style={{ color: '#ff4444', fontSize: 14 }}>✕ Failed to load report</div>
            <div style={{ color: 'rgba(0,240,255,0.4)', fontSize: 11 }}>{error.message}</div>
            <Link to="/reports" style={{ color: '#00f0ff', fontSize: 11, textDecoration: 'none' }}>← back to reports</Link>
          </div>
        )}
        {report && <ReportViewer report={report} filename={decoded} />}
      </div>
    </div>
  );
}
