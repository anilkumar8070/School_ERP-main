export function setAuth(token, role) {
  try {
    sessionStorage.setItem('erp_token', token)
    sessionStorage.setItem('erp_role', role)
  } catch (e) {}
}

export function getAuth() {
  try {
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
    const role = sessionStorage.getItem('erp_role') || localStorage.getItem('erp_role')
    return { token, role }
  } catch (e) {
    return { token: null, role: null }
  }
}

export function parseToken(token) {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64))
    return json
  } catch (e) {
    return null
  }
}

export function clearAuth({ global = false } = {}) {
  try {
    sessionStorage.removeItem('erp_token')
    sessionStorage.removeItem('erp_role')
    if (global) {
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_role')
      try { localStorage.setItem('erp_logout', Date.now().toString()) } catch (e) {}
    }
  } catch (e) {}
}

export function isAuthenticated() {
  return !!(sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token'))
}
