import { Link, useLocation } from 'react-router-dom'
import { Shield, LayoutDashboard, FileText, Settings } from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/profiles', label: 'Profiles', icon: Settings },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-indigo-400 font-bold text-lg shrink-0">
          <Shield size={20} className="text-indigo-400" />
          VigilAgent
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-600 font-mono">nemotron-super (local)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="API online" />
        </div>
      </div>
    </nav>
  )
}
