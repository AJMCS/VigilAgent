import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import ReportViewer from '../components/ReportViewer'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ReportDetail() {
  const { filename } = useParams()

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', filename],
    queryFn: () => api.getReport(decodeURIComponent(filename)),
    enabled: !!filename,
  })

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center text-slate-500 text-sm">
        Loading report…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <Link to="/reports" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 text-sm">
          Failed to load report: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ReportViewer report={report} filename={decodeURIComponent(filename)} />
    </div>
  )
}
