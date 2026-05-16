import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScanLine, AlertCircle } from 'lucide-react'
import { api } from '../api'
import RepoPicker from './RepoPicker'

export default function ScanForm({ profiles, selectedProfileId, onSelectProfile }) {
  const [selectedUrls, setSelectedUrls] = useState(new Set())
  const [manualUrls, setManualUrls] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [useManual, setUseManual] = useState(false)
  const qc = useQueryClient()

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)
  const token = useManual ? manualToken : (selectedProfile?.token || '')

  const handleToggle = (url) => {
    setSelectedUrls(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const { mutate, isPending, error, isSuccess } = useMutation({
    mutationFn: () => {
      const pickedRepos = [...selectedUrls]
      const manualRepos = manualUrls.split('\n').map(u => u.trim()).filter(Boolean)
      const repos = [...new Set([...pickedRepos, ...manualRepos])]
      if (!token) throw new Error('Select a profile or enter a token')
      if (repos.length === 0) throw new Error('Select at least one repository')
      return api.submitScan(token, repos)
    },
    onSuccess: () => {
      setSelectedUrls(new Set())
      setManualUrls('')
      qc.invalidateQueries({ queryKey: ['scans'] })
    },
  })

  const totalCount = selectedUrls.size +
    manualUrls.split('\n').filter(u => u.trim()).length

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <ScanLine size={14} /> New Scan
      </h2>

      {/* Token source toggle */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setUseManual(false)}
          className={`px-3 py-1 rounded-full transition-colors ${!useManual ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Use Profile
        </button>
        <button
          onClick={() => setUseManual(true)}
          className={`px-3 py-1 rounded-full transition-colors ${useManual ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Manual Token
        </button>
      </div>

      {useManual ? (
        <input
          type="password"
          placeholder="Paste GitHub token (ghp_...)"
          value={manualToken}
          onChange={e => setManualToken(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
        />
      ) : (
        <div>
          {profiles.length === 0 ? (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={13} /> Add a profile first (panel above)
            </p>
          ) : (
            <select
              value={selectedProfileId || ''}
              onChange={e => {
                onSelectProfile(e.target.value)
                setSelectedUrls(new Set())
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— select profile —</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Repo picker — shown when a profile is active */}
      {!useManual && selectedProfile && (
        <RepoPicker
          token={selectedProfile.token}
          selectedUrls={selectedUrls}
          onToggle={handleToggle}
        />
      )}

      {/* Additional URLs textarea */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">
          {selectedProfile && !useManual
            ? 'Additional URLs'
            : 'Repository URLs'}
          {' '}
          <span className="text-slate-600">(one per line)</span>
        </label>
        <textarea
          rows={3}
          placeholder={"https://github.com/owner/repo"}
          value={manualUrls}
          onChange={e => setManualUrls(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle size={13} /> {error.message}
        </p>
      )}

      {isSuccess && (
        <p className="text-xs text-emerald-400">Scan queued — monitor progress on the right.</p>
      )}

      <button
        onClick={() => mutate()}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Queuing…
          </>
        ) : (
          <>
            <ScanLine size={15} />
            {totalCount > 0 ? `Scan ${totalCount} repo${totalCount !== 1 ? 's' : ''}` : 'Launch Scan'}
          </>
        )}
      </button>
    </div>
  )
}
