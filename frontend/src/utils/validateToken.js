/**
 * Validates a GitHub PAT has the required scopes (repo + read:user).
 * Returns { ok: true } or { ok: false, message: string }.
 */
export async function validateGitHubToken(token) {
  let resp;
  try {
    resp = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
  } catch (e) {
    return { ok: false, message: `Could not reach GitHub API: ${e.message}` };
  }

  if (resp.status === 401) {
    return {
      ok: false,
      message:
        'Token is invalid or expired.\n\n' +
        'Go to github.com → Settings → Developer settings → ' +
        'Personal access tokens and generate a new one.',
    };
  }
  if (!resp.ok) {
    return {
      ok: false,
      message: `GitHub returned HTTP ${resp.status}. Check your token and try again.`,
    };
  }

  const rawScopes = resp.headers.get('X-OAuth-Scopes') || '';
  const scopes = rawScopes.split(',').map(s => s.trim()).filter(Boolean);

  // Fine-grained tokens don't expose X-OAuth-Scopes — we can't verify them
  if (scopes.length === 0) {
    return {
      ok: false,
      message:
        'Cannot verify token permissions.\n\n' +
        'Fine-grained tokens are not supported. Please use a classic token.\n\n' +
        'Create one at:\n' +
        'github.com → Settings → Developer settings → ' +
        'Personal access tokens → Tokens (classic)\n\n' +
        'Enable the "repo" and "read:user" checkboxes.',
    };
  }

  const hasRepo     = scopes.some(s => s === 'repo' || s === 'public_repo');
  const hasReadUser = scopes.some(s => s === 'read:user' || s === 'user');

  const missing = [];
  if (!hasRepo)     missing.push('"repo"');
  if (!hasReadUser) missing.push('"read:user"');

  if (missing.length > 0) {
    return {
      ok: false,
      message:
        `Token is missing required permissions: ${missing.join(' and ')}.\n\n` +
        `Current scopes: ${scopes.join(', ')}.\n\n` +
        'To fix: delete this token at github.com → Settings → Developer settings → ' +
        'Personal access tokens, then generate a new classic token with both ' +
        '"repo" and "read:user" checked.',
    };
  }

  return { ok: true, scopes };
}
