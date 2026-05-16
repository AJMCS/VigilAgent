import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Plus, Trash2, Radio, AlertCircle } from 'lucide-react'
import { api } from '../api'

export default function WatchlistManager({ profiles, selectedProfileId }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)
  const token = useManual ? manualToken : (selectedProfile?.token || '')

  const { data: watchlist = [] } = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
    refetchInterval: 30000,
  })

  const { mutate: addWatch, isPending: adding, error: addError } = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('Select a profile or enter a token')
      if (!repoUrl.trim()) throw new Error('Enter a repo URL')
      return api.addWatch(repoUrl.trim(), token)
    },
    onSuccess: () => {
      setRepoUrl('')
      setManualToken('')
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })

  const { mutate: removeWatch } = useMutation({
    mutationFn: ({ owner, repo }) => api.removeWatch(owner, repo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Radio size={14} className="text-purple-400" />
          Auto-Monitor
          {watchlist.length > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded-full font-medium">
              {watchlist.length} watching
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          <Plus size={13} /> Watch repo
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg space-y-2 border border-slate-700">
          <p className="text-xs text-slate-500">
            VigilAgent will scan this repo automatically whenever a new PR is opened.
          </p>

          {/* Token source */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setUseManual(false)}
              className={`px-2 py-0.5 rounded-full transition-colors ${!useManual ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Profile
            </button>
            <button
              onClick={() => setUseManual(true)}
              className={`px-2 py-0.5 rounded-full transition-colors ${useManual ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Manual token
            </button>
          </div>

          {useManual ? (
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_..."
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono pr-9"
              />
              <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          ) : (
            !selectedProfile && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} /> Select a profile above first
              </p>
            )
          )}

          <input
            type="url"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />

          {addError && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {addError.message}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => addWatch()}
              disabled={adding}
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded-md transition-colors"
            >
              {adding ? 'Adding…' : 'Start Watching'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 text-xs text-slate-400 hover:text-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Watchlist */}
      {watchlist.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-3">
          No repos watched. Add one to enable autonomous PR scanning.
        </p>
      ) : (
        <ul className="space-y-2">
          {watchlist.map(entry => (
            <li key={entry.repo_url} className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
              <span className="text-sm font-mono text-slate-200 truncate flex-1">
                {entry.owner}/{entry.repo}
              </span>
              <button
                onClick={() => removeWatch({ owner: entry.owner, repo: entry.repo })}
                className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {watchlist.length > 0 && (
        <p className="text-[10px] text-slate-600 mt-3 text-center">
          Polling every {Math.round(300 / 60)} min · scans trigger automatically on new PRs
        </p>
      )}
    </div>
  )
}
