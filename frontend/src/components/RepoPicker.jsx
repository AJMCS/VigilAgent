import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Lock, Globe, Loader, AlertCircle, X } from 'lucide-react'
import { github } from '../api'

export default function RepoPicker({ token, selectedUrls, onToggle }) {
  const [search, setSearch] = useState('')

  const { data: repos = [], isLoading, error } = useQuery({
    queryKey: ['github-repos', token],
    queryFn: () => github.listRepos(token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // cache for 5 min per profile session
  })

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedCount = selectedUrls.size

  const handleSelectAll = () => filtered.forEach(r => {
    if (!selectedUrls.has(r.html_url)) onToggle(r.html_url)
  })

  const handleClear = () => filtered.forEach(r => {
    if (selectedUrls.has(r.html_url)) onToggle(r.html_url)
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-500">Select repositories</label>
        <div className="flex items-center gap-2 text-xs">
          {selectedCount > 0 && (
            <span className="text-indigo-400 font-medium">{selectedCount} selected</span>
          )}
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            All
          </button>
          <span className="text-slate-700">·</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search repos…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Repo list */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader size={14} className="animate-spin" />
            Fetching your repositories…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            {error.message}
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-600">
            {search ? `No repos matching "${search}"` : 'No repositories found'}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <ul className="max-h-56 overflow-y-auto divide-y divide-slate-700/50">
            {filtered.map(repo => {
              const checked = selectedUrls.has(repo.html_url)
              return (
                <li key={repo.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(repo.html_url)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-800 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-200 truncate">
                          {repo.full_name}
                        </span>
                        <span className={`shrink-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          repo.private
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {repo.private ? <Lock size={9} /> : <Globe size={9} />}
                          {repo.private ? 'Private' : 'Public'}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
