export function logout(redirectTo = '/start', { global = false } = {}) {
  try {
    // Default: per-tab logout using sessionStorage only
    sessionStorage.removeItem('erp_token')
    sessionStorage.removeItem('erp_role')
  } catch (e) {}

  if (global) {
    try {
      // clear persistent storage and notify other tabs
      localStorage.removeItem('erp_token')
      localStorage.removeItem('erp_role')
      localStorage.removeItem('faculty_profile')
      localStorage.removeItem('student_profile')
    } catch (e) {}
    try { localStorage.setItem('erp_logout', Date.now().toString()) } catch (e) {}
  }

  if (typeof window !== 'undefined') window.location.href = redirectTo
}

export function isAuthenticated() {
  // Consider authenticated if either session or local token present
  return !!(sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token'))
}
