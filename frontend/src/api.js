const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const github = {
  async listRepos(token) {
    const repos = []
    let page = 1
    while (true) {
      const res = await fetch(
        `https://api.github.com/user/repos?per_page=100&sort=updated&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `GitHub API error ${res.status}`)
      }
      const batch = await res.json()
      if (batch.length === 0) break
      repos.push(...batch)
      page++
    }
    return repos
  },
}

export const api = {
  health: () => request('/health'),
  submitScan: (github_token, repos) =>
    request('/scan', { method: 'POST', body: JSON.stringify({ github_token, repos }) }),
  getScan: (jobId) => request(`/scan/${jobId}`),
  listScans: () => request('/scans'),
  listReports: () => request('/reports'),
  getReport: (filename) => request(`/reports/${encodeURIComponent(filename)}`),
  chatWithReport: (filename, question, history) =>
    request(`/reports/${encodeURIComponent(filename)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    }),
  getWatchlist: () => request('/watch'),
  addWatch: (repo_url, github_token) =>
    request('/watch', { method: 'POST', body: JSON.stringify({ repo_url, github_token }) }),
  removeWatch: (owner, repo) =>
    request(`/watch/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: 'DELETE' }),
}

// Named exports for direct import convenience
export const cancelScan    = id => request(`/scan/${id}/cancel`, { method: 'POST' })
export const health        = () => api.health()
export const submitScan    = ({ github_token, repos }) => api.submitScan(github_token, repos)
export const getScan       = id => api.getScan(id)
export const listScans     = () => api.listScans()
export const listReports   = () => api.listReports()
export const getReport     = f  => api.getReport(f)
export const chatWithReport = (f, q, h) => api.chatWithReport(f, q, h)
export const getWatchlist  = () => api.getWatchlist()
export const addWatch      = ({ repo_url, github_token }) => api.addWatch(repo_url, github_token)
export const removeWatch   = (owner, repo) => api.removeWatch(owner, repo)
