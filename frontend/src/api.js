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
}
