import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import ReportDetail from './pages/ReportDetail'
import Profiles from './pages/Profiles'

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/report/:filename" element={<ReportDetail />} />
        <Route path="/profiles" element={<Profiles />} />
      </Routes>
    </div>
  )
}
