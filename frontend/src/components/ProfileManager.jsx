import { useState } from 'react'
import { User, Plus, Trash2, Check, Eye, EyeOff } from 'lucide-react'

const STORAGE_KEY = 'vigil_profiles'

export function useProfiles() {
  const [profiles, setProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })

  const save = (next) => {
    setProfiles(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const addProfile = (name, token) => {
    save([...profiles, { id: crypto.randomUUID(), name, token }])
  }

  const removeProfile = (id) => save(profiles.filter(p => p.id !== id))

  return { profiles, addProfile, removeProfile }
}

function maskToken(token) {
  if (!token || token.length < 10) return '••••••••'
  return token.slice(0, 6) + '••••••••' + token.slice(-4)
}

export default function ProfileManager({ profiles, addProfile, removeProfile, selectedId, onSelect }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const handleAdd = () => {
    if (!name.trim() || !token.trim()) return
    addProfile(name.trim(), token.trim())
    setName('')
    setToken('')
    setShowForm(false)
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <User size={14} /> GitHub Profiles
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Add profile form */}
      {showForm && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg space-y-2 border border-slate-700">
          <input
            type="text"
            placeholder="Profile name (e.g. Personal)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="ghp_..."
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono pr-9"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-md transition-colors"
            >
              Save Profile
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-4">No profiles yet. Add one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {profiles.map(p => (
            <li
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                selectedId === p.id
                  ? 'border-indigo-500/50 bg-indigo-600/10'
                  : 'border-transparent bg-slate-800 hover:bg-slate-750'
              }`}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
                <div className="text-xs font-mono text-slate-500 truncate">{maskToken(p.token)}</div>
              </div>
              {selectedId === p.id && <Check size={14} className="text-indigo-400 shrink-0" />}
              <button
                onClick={e => { e.stopPropagation(); removeProfile(p.id) }}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
