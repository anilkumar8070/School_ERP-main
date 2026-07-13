import { clearAuth } from '../utils/session'

// Transport allocation and receipts (admin)
export async function getTransportAllocations(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/transport/allocations${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load transport allocations')
  }
  return res.json()
}

export async function createTransportAllocation(payload, token) {
  const res = await fetch(`${API_BASE}/api/transport/allocations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to create transport allocation')
  }
  return res.json()
}

export async function markTransportAllocationPaid(id, token, payload = {}) {
  const res = await fetch(`${API_BASE}/api/transport/allocations/${id}/mark-paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to mark transport allocation paid')
  }
  return res.json()
}

// Transport Razorpay order and confirm (student)
export async function createTransportRazorpayOrder(amount, receipt, token) {
  const res = await fetch(`${API_BASE}/api/payments/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify({ amount, receipt })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create order')
  }
  return res.json()
}

export async function confirmTransportPayment(payload, token) {
  const res = await fetch(`${API_BASE}/api/transport/payments/confirm`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to confirm transport payment')
  }
  return res.json()
}
// Transport allocation and receipts (student)
export async function getMyTransportAllocations(token) {
  const res = await fetch(`${API_BASE}/api/transport/allocations/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load transport allocation')
  }
  return res.json()
}

export async function getMyTransportReceipts(token) {
  const res = await fetch(`${API_BASE}/api/transport/receipts/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load transport receipts')
  }
  return res.json()
}
// Default API base: use VITE_API_BASE when provided, otherwise fall back to localhost:4000 during development.
let API_BASE = import.meta.env.VITE_API_BASE || ''

// Prevent localhost API base in production (when hosted on Vercel/etc.)
if (typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && API_BASE.includes('localhost')) {
  API_BASE = 'https://school-erp-backend-nhqd.onrender.com' // Fall back to production backend URL
} else if (!API_BASE && typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // If API_BASE is empty in production, point to the Render backend
  API_BASE = 'https://school-erp-backend-nhqd.onrender.com'
}

if (!API_BASE) {
  // If running the Vite dev server (commonly on port 5173), default to backend on localhost:4001
  try {
    if (typeof window !== 'undefined' && window.location && String(window.location.port).includes('5173')) {
      API_BASE = 'http://localhost:4001'
    }
  } catch (e) {
    API_BASE = ''
  }
}
export { API_BASE }

// Helper to try parsing JSON but fall back to text on failure so callers get a readable message
async function tryParseJson(res) {
  try {
    return await res.json()
  } catch (e) {
    const txt = await res.text().catch(() => '')
    return { message: txt || 'Server returned non-JSON response' }
  }
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Login failed' }))
    throw new Error(err.message || 'Login failed')
  }
  return res.json()
}

export async function getProfile(token) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Unauthorized')
  return res.json()
}

export async function updateProfile(payload, token) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update profile')
  }
  return res.json()
}

// Resolve current logged-in user's Faculty document
export async function getMyFaculty(token) {
  const res = await fetch(`${API_BASE}/api/faculty/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to resolve faculty identity' }))
    throw new Error(err.message || 'Failed to resolve faculty identity')
  }
  return res.json()
}

// Faculty dashboard summary (optional endpoint)
export async function getFacultyDashboard(token) {
  const res = await fetch(`${API_BASE}/api/faculty/dashboard`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load faculty dashboard' }))
    throw new Error(err && err.message ? err.message : 'Failed to load faculty dashboard')
  }
  return res.json()
}

export async function getFacultyCard(facultyId, token) {
  const res = await fetch(`${API_BASE}/api/idcards/faculty/${facultyId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load faculty card')
  }
  return res.json()
}

export async function getStaffCard(userId, token) {
  const res = await fetch(`${API_BASE}/api/idcards/staff/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load staff card')
  }
  return res.json()
}

export async function logoutApi() {
  const res = await fetch(`${API_BASE}/api/logout`, { method: 'POST' })
  if (!res.ok) throw new Error('Logout failed')
  return res.json()
}

export async function postComplaint(text, priority, token) {
  const res = await fetch(`${API_BASE}/api/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, priority }),
  })
  if (!res.ok) throw new Error('Failed to submit complaint')
  return res.json()
}

export async function getComplaints(token) {
  const res = await fetch(`${API_BASE}/api/complaints`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch complaints')
  return res.json()
}

export async function updateComplaintStatus(id, status, note, token) {
  const res = await fetch(`${API_BASE}/api/complaints/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update complaint' }))
    throw new Error(err.message || 'Failed to update complaint')
  }
  return res.json()
}


export async function postEvent(data, token) {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create event')
  return res.json()
}

// Forms: list public forms and submit form queries (with attachment)
export async function getForms() {
  const res = await fetch(`${API_BASE}/api/forms`)
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load forms')
  }
  return res.json()
}

export async function submitFormQuery(formData) {
  const res = await fetch(`${API_BASE}/api/form-query`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to submit form')
  }
  return res.json()
}

// Syllabus API
export async function createSyllabus(formData, token) {
  const res = await fetch(`${API_BASE}/api/syllabus`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to upload syllabus' }))
    throw new Error(err.message || 'Failed to upload syllabus')
  }
  return res.json()
}

// Resources API: upload and list
export async function uploadResource(formData, token) {
  const res = await fetch(`${API_BASE}/api/resources`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to upload resource' }))
    throw new Error(err.message || 'Failed to upload resource')
  }
  return res.json()
}

export async function getResources(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/resources${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load resources' }))
    throw new Error(err.message || 'Failed to load resources')
  }
  return res.json()
}

export async function getMyResources(token) {
  const res = await fetch(`${API_BASE}/api/resources/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my resources' }))
    throw new Error(err.message || 'Failed to load my resources')
  }
  return res.json()
}

export async function getSyllabus(query = {}) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/syllabus${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load syllabus' }))
    throw new Error(err.message || 'Failed to load syllabus')
  }
  return res.json()
}

export async function deleteSyllabus(id, token) {
  const res = await fetch(`${API_BASE}/api/syllabus/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to delete syllabus')
  }
  return res.json()
}

// Timetable API
export async function createTimetable(formData, token) {
  const res = await fetch(`${API_BASE}/api/timetable`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to upload timetable' }))
    throw new Error(err.message || 'Failed to upload timetable')
  }
  return res.json()
}

// Certificates API
export async function createCertificate(formData, token) {
  const res = await fetch(`${API_BASE}/api/certificates`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create certificate')
  }
  return res.json()
}

export async function getCertificates(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/certificates${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load certificates')
  }
  return res.json()
}

export async function getMyCertificates(token) {
  const res = await fetch(`${API_BASE}/api/certificates/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load my certificates')
  }
  return res.json()
}

// Admit Cards API
export async function createAdmitCards(formData, token) {
  const res = await fetch(`${API_BASE}/api/admitcards`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create admit cards')
  }
  return res.json()
}

export async function getAdmitCards(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/admitcards${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load admit cards')
  }
  return res.json()
}

// Gallery API
export async function createGallery(formData, token) {
  const res = await fetch(`${API_BASE}/api/gallery`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create gallery')
  }
  return res.json()
}

export async function getGallery() {
  const res = await fetch(`${API_BASE}/api/gallery`)
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load gallery')
  }
  return res.json()
}

export async function deleteGallery(id, token) {
  const res = await fetch(`${API_BASE}/api/gallery/${id}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to delete gallery')
  }
  return res.json()
}

export async function addGalleryImages(id, formData, token) {
  const res = await fetch(`${API_BASE}/api/gallery/${id}/images`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to add images')
  }
  return res.json()
}

export async function deleteGalleryImage(id, filename, token) {
  const url = `${API_BASE}/api/gallery/${id}/images?filename=${encodeURIComponent(filename)}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to delete image')
  }
  return res.json()
}

export async function getMyAdmitCards(token) {
  // If no token provided, return empty list instead of making an unauthorized request
  if (!token) return []
  const res = await fetch(`${API_BASE}/api/admitcards/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    try { clearAuth({ global: false }) } catch (e) {}
    return []
  }
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load my admit cards')
  }
  return res.json()
}

export async function regenerateTimetablePdf(id, token) {
  const res = await fetch(`${API_BASE}/api/timetable/${id}/regenerate-pdf`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to regenerate timetable PDF' }))
    throw new Error(err.message || 'Failed to regenerate timetable PDF')
  }
  return res.json()
}

export async function getTimetable(query = {}) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/timetable${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load timetable' }))
    throw new Error(err.message || 'Failed to load timetable')
  }
  return res.json()
}

export async function getEvents() {
  const res = await fetch(`${API_BASE}/api/events`)
  if (!res.ok) throw new Error('Failed to load events')
  return res.json()
}

// Hostel allocation API
export async function getHostelAllocations(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/hostel/allocations${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load allocations')
  }
  return res.json()
}

export async function createHostelAllocation(payload, token) {
  const res = await fetch(`${API_BASE}/api/hostel/allocations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to create allocation')
  }
  return res.json()
}

export async function clearHostelAllocations(token) {
  const res = await fetch(`${API_BASE}/api/hostel/allocations`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to clear allocations')
  }
  return res.json()
}

export async function getMyHostelAllocations(token) {
  const res = await fetch(`${API_BASE}/api/hostel/allocations/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load my hostel allocations')
  }
  return res.json()
}

export async function markHostelAllocationPaid(id, token) {
  const res = await fetch(`${API_BASE}/api/hostel/allocations/${id}/mark-paid`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to mark paid')
  }
  return res.json()
}

export async function getMyHostelReceipts(token) {
  const res = await fetch(`${API_BASE}/api/hostel/receipts/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load receipts')
  }
  return res.json()
}

// Razorpay: create order and confirm payment
export async function createRazorpayOrder(amount, receipt, token) {
  const res = await fetch(`${API_BASE}/api/payments/order`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify({ amount, receipt })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create order')
  }
  return res.json()
}

export async function confirmPayment(payload, token) {
  const res = await fetch(`${API_BASE}/api/payments/confirm`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to confirm payment')
  }
  return res.json()
}

export async function getMyStudent(token) {
  const res = await fetch(`${API_BASE}/api/students/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to resolve student')
  }
  return res.json()
}

// Assignments API
export async function getAssignmentsApi(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/assignments${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load assignments')
  }
  return res.json()
}

export async function submitAssignmentApi(assignmentId, formData, token) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submit`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to submit assignment')
  }
  return res.json()
}

export async function getSubmissionsApi(assignmentId, token) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submissions`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load submissions')
  }
  return res.json()
}

// Create assignment (form-data with optional file)
// (assignment helpers declared later in file to avoid duplicate declarations)

// Hostels CRUD
export async function getHostels(token) {
  const res = await fetch(`${API_BASE}/api/hostels`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load hostels')
  }
  return res.json()
}

export async function createHostel(payload, token) {
  const res = await fetch(`${API_BASE}/api/hostels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to create hostel')
  }
  return res.json()
}

export async function getHostelsPublic() {
  const res = await fetch(`${API_BASE}/api/hostels/public`)
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load hostels')
  }
  return res.json()
}

export async function updateHostel(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/hostels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to update hostel')
  }
  return res.json()
}

export async function deleteHostel(id, token) {
  const res = await fetch(`${API_BASE}/api/hostels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to delete hostel')
  }
  return res.json()
}


export async function postLeave(from, to, reason, token) {
  const res = await fetch(`${API_BASE}/api/leaves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ from, to, reason }),
  })
  if (!res.ok) throw new Error('Failed to submit leave')
  return res.json()
}

export async function getMyLeaves(token) {
  const res = await fetch(`${API_BASE}/api/leaves/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch leaves')
  return res.json()
}

export async function getLeaves(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/leaves${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch leaves')
  return res.json()
}

export async function updateLeaveStatus(id, status, note, token) {
  const res = await fetch(`${API_BASE}/api/leaves/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, note })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update leave status' }))
    throw new Error(err.message || 'Failed to update leave status')
  }
  return res.json()
}

// Notices
export async function createNotice(payload, token) {
  // If payload contains a File under `file`, submit as FormData
  if (payload && payload.file instanceof File) {
    const fd = new FormData()
    fd.append('file', payload.file)
    fd.append('title', payload.title || '')
    fd.append('body', payload.body || '')
    if (payload.targets) fd.append('targets', Array.isArray(payload.targets) ? payload.targets.join(',') : payload.targets)
    if (payload.studentAll !== undefined) fd.append('studentAll', String(payload.studentAll))
    if (payload.studentClass) fd.append('studentClass', payload.studentClass)
    if (payload.studentSection) fd.append('studentSection', payload.studentSection)

    const res = await fetch(`${API_BASE}/api/notices`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to create notice' }))
      throw new Error(err.message || 'Failed to create notice')
    }
    return res.json()
  }

  const res = await fetch(`${API_BASE}/api/notices`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create notice' }))
    throw new Error(err.message || 'Failed to create notice')
  }
  return res.json()
}

export async function getNotices(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/notices${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load notices' }))
    throw new Error(err.message || 'Failed to load notices')
  }
  return res.json()
}

// Messages
export async function postMessage(payload, token) {
  const res = await fetch(`${API_BASE}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit message' }))
    throw new Error(err.message || 'Failed to submit message')
  }
  return res.json()
}

export async function getMessages(token) {
  const res = await fetch(`${API_BASE}/api/messages`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json()
}

export async function getMyMessages(token) {
  const res = await fetch(`${API_BASE}/api/messages/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error('Failed to fetch my messages')
  return res.json()
}

export async function getMyMeetings(token) {
  const res = await fetch(`${API_BASE}/api/meetings/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load meetings' }))
    throw new Error(err.message || 'Failed to load meetings')
  }
  return res.json()
}

// Test Management APIs
export async function createTest(formData, token) {
  const res = await fetch(`${API_BASE}/api/tests`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create test' }))
    throw new Error(err.message || 'Failed to create test')
  }
  return res.json()
}

// Generic small file upload helper (returns { url })
export async function uploadFile(formData, token) {
  const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Upload failed')
  }
  return res.json()
}

export async function createTestBulk(formData, token) {
  const res = await fetch(`${API_BASE}/api/tests/bulk`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create bulk test' }))
    throw new Error(err.message || 'Failed to create bulk test')
  }
  return res.json()
}

export async function parseTestFile(formData, token) {
  const res = await fetch(`${API_BASE}/api/tests/parse`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to parse file')
  }
  return res.json()
}

export async function createTestQuestions(testId, questions, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ questions }) })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create questions')
  }
  return res.json()
}

export async function updateTest(testId, payload, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update test')
  }
  return res.json()
}

export async function deleteTest(testId, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to delete test')
  }
  return res.json()
}

export async function getTests(token) {
  const res = await fetch(`${API_BASE}/api/tests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load tests' }))
    throw new Error(err.message || 'Failed to load tests')
  }
  return res.json()
}

export async function getMyTests(token) {
  const res = await fetch(`${API_BASE}/api/tests/my`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my tests' }))
    throw new Error(err.message || 'Failed to load my tests')
  }
  return res.json()
}

// Salary APIs
export async function getSalaryFaculties(token) {
  const res = await fetch(`${API_BASE}/api/salary/faculties`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load faculties' }))
    throw new Error(err.message || 'Failed to load faculties')
  }
  return res.json()
}

export async function getSalaryPayments(token) {
  const res = await fetch(`${API_BASE}/api/salary/payments`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load payments' }))
    throw new Error(err.message || 'Failed to load payments')
  }
  return res.json()
}

export async function createSalaryPayment(payload, token) {
  const res = await fetch(`${API_BASE}/api/salary/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create payment' }))
    throw new Error(err.message || 'Failed to create payment')
  }
  return res.json()
}

export async function getMySalaryPayments(token) {
  const res = await fetch(`${API_BASE}/api/salary/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my salary' }))
    throw new Error(err.message || 'Failed to load my salary')
  }
  return res.json()
}

export async function createSalaryOrder(payload, token) {
  const res = await fetch(`${API_BASE}/api/salary/order`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create order' }))
    throw new Error(err.message || 'Failed to create order')
  }
  return res.json()
}

export async function confirmSalaryPayment(payload, token) {
  const res = await fetch(`${API_BASE}/api/salary/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to confirm payment' }))
    throw new Error(err.message || 'Failed to confirm payment')
  }
  return res.json()
}

// Staff Salary APIs
export async function getStaffList(token) {
  const res = await fetch(`${API_BASE}/api/staff-salary/staff`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load staff' }))
    throw new Error(err.message || 'Failed to load staff')
  }
  return res.json()
}

export async function getStaffSalaryPayments(token) {
  const res = await fetch(`${API_BASE}/api/staff-salary/payments`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load payments' }))
    throw new Error(err.message || 'Failed to load payments')
  }
  return res.json()
}

export async function createStaffSalaryOrder(payload, token) {
  const res = await fetch(`${API_BASE}/api/staff-salary/order`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create order' }))
    throw new Error(err.message || 'Failed to create order')
  }
  return res.json()
}

export async function confirmStaffSalaryPayment(payload, token) {
  const res = await fetch(`${API_BASE}/api/staff-salary/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to confirm payment' }))
    throw new Error(err.message || 'Failed to confirm payment')
  }
  return res.json()
}

export async function getMyStaffSalaryPayments(token) {
  const res = await fetch(`${API_BASE}/api/staff-salary/my-payments`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load payments' }))
    throw new Error(err.message || 'Failed to load payments')
  }
  return res.json()
}

export async function getTestResults(testId, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}/results`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load test results' }))
    throw new Error(err.message || 'Failed to load test results')
  }
  return res.json()
}

// Subjective review API removed — functions intentionally omitted.

export async function uploadTestResults(testId, formData, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}/results/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to upload test results' }))
    throw new Error(err.message || 'Failed to upload test results')
  }
  return res.json()
}

export async function getMyTestResults(token) {
  const res = await fetch(`${API_BASE}/api/tests/results/my`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my test results' }))
    throw new Error(err.message || 'Failed to load my test results')
  }
  return res.json()
}

export async function getTestResultsByStudent(studentId, token) {
  const res = await fetch(`${API_BASE}/api/tests/results/by-student/${encodeURIComponent(studentId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load test results' }))
    throw new Error(err.message || 'Failed to load test results')
  }
  return res.json()
}

export async function getTestQuestions(testId, token, opts = {}) {
  const qs = new URLSearchParams()
  if (opts.started) qs.set('started', 'true')
  const url = `${API_BASE}/api/tests/${testId}/questions${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load questions' }))
    throw new Error(err.message || 'Failed to load questions')
  }
  return res.json()
}

// Report cards API helpers are in a separate file but export here for convenience
import * as reportCardsApi from './reportCards'
export const createReportCard = reportCardsApi.createReportCard
export const getReportCards = reportCardsApi.getReportCards
export const getMyReportCards = reportCardsApi.getMyReportCards

export async function submitTest(testId, answersOrPayload, token) {
  // if caller passed an array of answers, wrap it; if an object, send as-is
  const bodyObj = Array.isArray(answersOrPayload) ? { answers: answersOrPayload } : (typeof answersOrPayload === 'object' ? answersOrPayload : { answers: [] })
  const res = await fetch(`${API_BASE}/api/tests/${testId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(bodyObj) })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to submit test')
  }
  return res.json()
}

export async function forfeitTest(testId, token) {
  const res = await fetch(`${API_BASE}/api/tests/${testId}/forfeit`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to forfeit test')
  }
  return res.json()
}

export async function createMeeting(payload, token) {
  const res = await fetch(`${API_BASE}/api/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create meeting' }))
    throw new Error(err.message || 'Failed to create meeting')
  }
  return res.json()
}

export async function getMeetings(token) {
  const res = await fetch(`${API_BASE}/api/meetings`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load meetings' }))
    throw new Error(err.message || 'Failed to load meetings')
  }
  return res.json()
}

export async function updateMessageStatus(id, status, note, token) {
  const res = await fetch(`${API_BASE}/api/messages/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update message' }))
    throw new Error(err.message || 'Failed to update message')
  }
  return res.json()
}

export async function getStudents(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => {
    if (query[k]) qs.set(k, query[k])
  })
  const url = `${API_BASE}/api/students${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load students' }))
    throw new Error(err.message || 'Failed to load students')
  }
  return res.json()
}

export async function postAttendance(payload, token) {
  const res = await fetch(`${API_BASE}/api/attendance`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save attendance' }))
    throw new Error(err.message || 'Failed to save attendance')
  }
  return res.json()
}

export async function getAttendance(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load attendance' }))
    throw new Error(err.message || 'Failed to load attendance')
  }
  return res.json()
}

export async function exportAttendanceCsv(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance/export${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to export attendance' }))
    throw new Error(err.message || 'Failed to export attendance')
  }
  const blob = await res.blob()
  // try get filename from header
  let filename = 'attendance_students.csv'
  const cd = res.headers.get('Content-Disposition')
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
    if (m) filename = decodeURIComponent((m[1] || m[2] || '').trim()) || filename
  }
  return { blob, filename }
}

export async function postFacultyAttendance(payload, token) {
  const res = await fetch(`${API_BASE}/api/attendance/faculty`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save faculty attendance' }))
    throw new Error(err.message || 'Failed to save faculty attendance')
  }
  return res.json()
}

export async function getFacultyAttendance(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance/faculty${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load faculty attendance' }))
    throw new Error(err.message || 'Failed to load faculty attendance')
  }
  return res.json()
}

export async function exportFacultyAttendanceCsv(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance/faculty/export${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to export faculty attendance' }))
    throw new Error(err.message || 'Failed to export faculty attendance')
  }
  const blob = await res.blob()
  let filename = 'attendance_faculty.csv'
  const cd = res.headers.get('Content-Disposition')
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
    if (m) filename = decodeURIComponent((m[1] || m[2] || '').trim()) || filename
  }
  return { blob, filename }
}

// Staff attendance (if backend exposes separate endpoints)
export async function getStaffAttendance(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance/staff${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load staff attendance' }))
    throw new Error(err.message || 'Failed to load staff attendance')
  }
  return res.json()
}

export async function exportStaffAttendanceCsv(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/attendance/staff/export${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to export staff attendance' }))
    throw new Error(err.message || 'Failed to export staff attendance')
  }
  const blob = await res.blob()
  let filename = 'attendance_staff.csv'
  const cd = res.headers.get('Content-Disposition')
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd)
    if (m) filename = decodeURIComponent((m[1] || m[2] || '').trim()) || filename
  }
  return { blob, filename }
}

export async function postStaffAttendance(payload, token) {
  const res = await fetch(`${API_BASE}/api/attendance/staff`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save staff attendance' }))
    throw new Error(err.message || 'Failed to save staff attendance')
  }
  return res.json()
}

export async function postMark(payload, token) {
  const res = await fetch(`${API_BASE}/api/marks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save mark' }))
    throw new Error(err.message || 'Failed to save mark')
  }
  return res.json()
}

export async function updateMark(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/marks/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update mark' }))
    throw new Error(err.message || 'Failed to update mark')
  }
  return res.json()
}

export async function getMarks(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/marks${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load marks' }))
    throw new Error(err.message || 'Failed to load marks')
  }
  return res.json()
}

export async function postMarksBulk(marksArray, token) {
  const res = await fetch(`${API_BASE}/api/marks/bulk`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(marksArray)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save bulk marks' }))
    throw new Error(err.message || 'Failed to save bulk marks')
  }
  return res.json()
}

export async function getMyMarks(token, studentId) {
  const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const res = await fetch(`${API_BASE}/api/marks/my${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load marks' }))
    throw new Error(err.message || 'Failed to load marks')
  }
  return res.json()
}

export async function getMyAttendance(token, date, studentId) {
  // if studentId provided, fetch by student class/section would be required; API supports class/section/date
  const qs = new URLSearchParams()
  if (date) qs.set('date', date)
  const url = `${API_BASE}/api/attendance${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load attendance' }))
    throw new Error(err.message || 'Failed to load attendance')
  }
  return res.json()
}

export async function changeStudentClass(id, newClass, token, section) {
  const body = { class: newClass }
  if (section !== undefined && section !== null && String(section || '').trim() !== '') body.section = section
  const res = await fetch(`${API_BASE}/api/students/${id}/change-class`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to change class')
  }
  return res.json()
}

export async function changeStudentHouse(id, house, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/change-house`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ house })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to change house')
  }
  return res.json()
}

export async function bulkChangeStudentHouse(updates, token) {
  const body = Array.isArray(updates) ? updates : (updates?.updates || [])
  const res = await fetch(`${API_BASE}/api/students/bulk-change-house`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to bulk change house')
  }
  return res.json()
}

export async function facultyBlockStudent(id, block, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/block-by-faculty`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ block })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update block status')
  }
  return res.json()
}

export async function requestStudentDeletion(id, note, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/delete-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to request deletion')
  }
  return res.json()
}

export async function getStudentDeleteRequests(token) {
  const res = await fetch(`${API_BASE}/api/students/delete-requests`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to fetch delete requests')
  }
  return res.json()
}

export async function approveStudentDeleteRequest(id, token) {
  const res = await fetch(`${API_BASE}/api/students/delete-requests/${id}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to approve delete request')
  }
  return res.json()
}

// Assignments API
export async function createAssignment(formData, token) {
  const res = await fetch(`${API_BASE}/api/assignments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create assignment' }))
    throw new Error(err.message || 'Failed to create assignment')
  }
  return res.json()
}

// (assignment helpers implemented below; no compatibility aliases here)

export async function getAssignments(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/assignments${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load assignments' }))
    throw new Error(err.message || 'Failed to load assignments')
  }
  return res.json()
}

export async function submitAssignment(assignmentId, formData, token) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submit`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit assignment' }))
    throw new Error(err.message || 'Failed to submit assignment')
  }
  return res.json()
}

export async function getSubmissions(assignmentId, token) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/submissions`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load submissions' }))
    throw new Error(err.message || 'Failed to load submissions')
  }
  return res.json()
}

export async function extendAssignment(assignmentId, dueDate, token) {
  const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/extend`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ dueDate }) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to extend assignment' }))
    throw new Error(err.message || 'Failed to extend assignment')
  }
  return res.json()
}

export async function getFaculty(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const url = `${API_BASE}/api/faculty${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load faculty' }))
    throw new Error(err.message || 'Failed to load faculty')
  }
  return res.json()
}

export async function getAdmins(query = '', token) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  const res = await fetch(`${API_BASE}/api/admins${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to load admins')
  }
  return res.json()
}

export async function createAdmin(payload, token) {
  const res = await fetch(`${API_BASE}/api/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to create admin')
  }
  return res.json()
}

export async function deleteAdmin(id, token) {
  const res = await fetch(`${API_BASE}/api/admins/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to delete admin')
  }
  return res.json()
}

export async function blockAdmin(id, block, token) {
  const res = await fetch(`${API_BASE}/api/admins/${id}/block`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ block })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to update admin status')
  }
  return res.json()
}

export async function updateAdmin(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/admins/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err.message || 'Failed to update admin')
  }
  return res.json()
}

// Staff management (admin)
export async function getStaff(query = '', token) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  const res = await fetch(`${API_BASE}/api/staff${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to load staff') }
  return res.json()
}

export async function createStaff(payload, token) {
  const res = await fetch(`${API_BASE}/api/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to create staff') }
  return res.json()
}

export async function deleteStaff(id, token) {
  const res = await fetch(`${API_BASE}/api/staff/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to delete staff') }
  return res.json()
}

export async function blockStaff(id, block, token) {
  const res = await fetch(`${API_BASE}/api/staff/${id}/block`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ block }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update staff status') }
  return res.json()
}

export async function updateStaff(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/staff/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update staff') }
  return res.json()
}

// HR management (admin)
export async function getHR(query = '', token) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  const res = await fetch(`${API_BASE}/api/hr${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to load HR list') }
  return res.json()
}

export async function createHR(payload, token) {
  const res = await fetch(`${API_BASE}/api/hr`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to create HR') }
  return res.json()
}

export async function deleteHR(id, token) {
  const res = await fetch(`${API_BASE}/api/hr/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to delete HR') }
  return res.json()
}

export async function blockHR(id, block, token) {
  const res = await fetch(`${API_BASE}/api/hr/${id}/block`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ block }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update HR status') }
  return res.json()
}

export async function updateHR(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/hr/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update HR') }
  return res.json()
}

// Parents management (admin)
export async function getParents(query = '', token) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : ''
  const res = await fetch(`${API_BASE}/api/parents${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load parents')
  }
  return res.json()
}

export async function deleteParent(id, token) {
  const res = await fetch(`${API_BASE}/api/parents/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to delete parent')
  }
  return res.json()
}

export async function blockParent(id, block, token) {
  const res = await fetch(`${API_BASE}/api/parents/${id}/block`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ block })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update parent block status')
  }
  return res.json()
}

export async function createParent(payload, token) {
  const res = await fetch(`${API_BASE}/api/parents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create parent')
  }
  return res.json()
}

// Student: get or generate parent access code
export async function getParentAccessCode(token) {
  const res = await fetch(`${API_BASE}/api/students/parent-code`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to get parent code')
  }
  return res.json()
}

// Parent: link to student using access code
export async function linkParentByCode(code, token) {
  const res = await fetch(`${API_BASE}/api/parents/link`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ code })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to link student')
  }
  return res.json()
}

// Parent/Admin: receipts for a student
export async function getReceiptsByStudent(studentId, token) {
  const res = await fetch(`${API_BASE}/api/finance/receipts/by-student/${encodeURIComponent(studentId)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load receipts')
  }
  return res.json()
}

// Parent/Admin: basic student info
export async function getStudentBasic(id, token) {
  const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(id)}/basic`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load student')
  }
  return res.json()
}

export async function updateFaculty(id, data, token) {
  const res = await fetch(`${API_BASE}/api/faculty/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update faculty' }))
    throw new Error(err.message || 'Failed to update faculty')
  }
  return res.json()
}

export async function deleteFaculty(id, token) {
  const res = await fetch(`${API_BASE}/api/faculty/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to delete faculty' }))
    throw new Error(err.message || 'Failed to delete faculty')
  }
  return res.json()
}

export async function blockFaculty(id, block, token) {
  const res = await fetch(`${API_BASE}/api/faculty/${id}/block`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ block }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to update block status' }))
    throw new Error(err.message || 'Failed to update block status')
  }
  return res.json()
}

export async function deleteStudent(id, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to delete student' }))
    throw new Error(err.message || 'Failed to delete student')
  }
  return res.json()
}

export async function createStudent(payload, token) {
  const res = await fetch(`${API_BASE}/api/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to create student')
  }
  return res.json()
}

export async function updateStudent(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update student')
  }
  return res.json()
}

export async function setStudentStream(id, stream, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/stream`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stream })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to set student stream')
  }
  return res.json()
}

export async function blockStudent(id, block, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/block`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ block })
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update student block status')
  }
  return res.json()
}

export async function getFacultyRegistrations(status = '', token) {
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  const url = `${API_BASE}/api/faculty/registrations${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load registrations' }))
    throw new Error(err.message || 'Failed to load registrations')
  }
  return res.json()
}

export async function submitFacultyRegistration(payload) {
  const res = await fetch(`${API_BASE}/api/faculty/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit registration' }))
    throw new Error(err.message || 'Failed to submit registration')
  }
  return res.json()
}

export async function approveFacultyRegistration(id, token) {
  const res = await fetch(`${API_BASE}/api/faculty/registrations/${id}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to approve registration' }))
    throw new Error(err.message || 'Failed to approve registration')
  }
  return res.json()
}

export async function rejectFacultyRegistration(id, note, token) {
  const res = await fetch(`${API_BASE}/api/faculty/registrations/${id}/reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to reject registration' }))
    throw new Error(err.message || 'Failed to reject registration')
  }
  return res.json()
}

export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE}/api/password/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to request password reset' }))
    throw new Error(err.message || 'Failed to request password reset')
  }
  return res.json()
}

export async function resetPassword(token, password) {
  const res = await fetch(`${API_BASE}/api/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to reset password' }))
    throw new Error(err.message || 'Failed to reset password')
  }
  return res.json()
}

export async function submitStudentRegistration(payload) {
  const res = await fetch(`${API_BASE}/api/students/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to submit student registration' }))
    throw new Error(err.message || 'Failed to submit student registration')
  }
  return res.json()
}

// Generic registration endpoint (parents/admin/other roles that POST to /api/register)
export async function submitRegister(payload) {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to register' }))
    throw new Error(err.message || 'Registration failed')
  }
  return res.json()
}

// Finance API
export async function getFeeStructure(token) {
  // Use the public fee-structure endpoint so non-admin users can read fee data
  const res = await fetch(`${API_BASE}/api/finance/fee-structure/public`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load fee structure')
  }
  return tryParseJson(res)
}

export async function getFeeForClass(cls, section = 'ALL', token) {
  const qs = new URLSearchParams({ class: cls, section })
  const res = await fetch(`${API_BASE}/api/finance/fee-structure/public?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load fee for class' }))
    throw new Error(err.message || 'Failed to load fee for class')
  }
  return res.json()
}

export async function saveFeeStructure(payload, token) {
  const res = await fetch(`${API_BASE}/api/finance/fee-structure`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to save fee')
  }
  return tryParseJson(res)
}

export async function deleteFeeHistory(feeId, historyId, token) {
  const res = await fetch(`${API_BASE}/api/finance/fee-structure/${feeId}/history/${historyId}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to delete history' }))
    throw new Error(err.message || 'Failed to delete history')
  }
  return res.json()
}



export async function getReceipts(token) {
  const res = await fetch(`${API_BASE}/api/finance/receipts`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load receipts' }))
    throw new Error(err.message || 'Failed to load receipts')
  }
  return res.json()
}

export async function getMyReceipts(token) {
  const res = await fetch(`${API_BASE}/api/finance/receipts/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my receipts' }))
    throw new Error(err.message || 'Failed to load my receipts')
  }
  return res.json()
}

export async function getStudentRegistrations(status = '', token) {
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  const url = `${API_BASE}/api/students/registrations${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load student registrations' }))
    throw new Error(err.message || 'Failed to load student registrations')
  }
  return res.json()
}



export async function assignFeeToStudents(payload, token) {
  const res = await fetch(`${API_BASE}/api/finance/assign-fee`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to assign fee' }))
    throw new Error(err.message || 'Failed to assign fee')
  }
  return res.json()
}

export async function approveStudentRegistration(id, token) {
  const res = await fetch(`${API_BASE}/api/students/registrations/${id}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to approve student registration' }))
    throw new Error(err.message || 'Failed to approve student registration')
  }
  return res.json()
}

export async function rejectStudentRegistration(id, note, token) {
  const res = await fetch(`${API_BASE}/api/students/registrations/${id}/reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to reject student registration' }))
    throw new Error(err.message || 'Failed to reject student registration')
  }
  return res.json()
}

// ===================== ID Cards API =====================
export async function generateIdCards(payload, token) {
  const res = await fetch(`${API_BASE}/api/idcards/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to generate cards') }
  return res.json()
}

export async function generateFacultyIdCards(payload, token) {
  const res = await fetch(`${API_BASE}/api/idcards/generate-faculty`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to generate faculty cards') }
  return res.json()
}

export async function generateStaffIdCards(payload, token) {
  const res = await fetch(`${API_BASE}/api/idcards/generate-staff`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to generate staff cards') }
  return res.json()
}

export async function listIdCards(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/idcards${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to load cards') }
  return res.json()
}

export async function listIdCardBatches(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/idcards/batches${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to load batches') }
  return res.json()
}

export async function getIdCardsByBatch(batchId, token) {
  const res = await fetch(`${API_BASE}/api/idcards/by-batch/${batchId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to load batch cards') }
  return res.json()
}

export async function updateIdCard(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/idcards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update card') }
  return res.json()
}

export async function getStudentCard(studentId, token) {
  const res = await fetch(`${API_BASE}/api/idcards/student/${studentId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'No card found') }
  return res.json()
}

export async function getIdCardByCode(code, token) {
  const res = await fetch(`${API_BASE}/api/idcards/verify/${encodeURIComponent(code)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Invalid code') }
  return res.json()
}

// House management
export async function setStudentHouseRole(id, role, token) {
  const res = await fetch(`${API_BASE}/api/students/${id}/house-role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role })
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to set house role') }
  return res.json()
}

// Contact queries (public + admin)
export async function postContactQuery(formData) {
  const res = await fetch(`${API_BASE}/api/contact-query`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to submit contact query')
  }
  return res.json()
}

export async function getAdminContactQueries(token) {
  const res = await fetch(`${API_BASE}/api/admin/contact-queries`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to load contact queries')
  }
  return res.json()
}

export async function updateContactQueryStatus(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/admin/contact-queries/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await tryParseJson(res)
    throw new Error(err && err.message ? err.message : 'Failed to update contact query')
  }
  return res.json()
}

// ===================== Front Office =====================
export async function getFrontOfficeEntries(token) {
  const res = await fetch(`${API_BASE}/api/front-office`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch front office') }
  return res.json()
}
export async function createFrontOfficeEntry(payload, token) {
  const res = await fetch(`${API_BASE}/api/front-office`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to create entry') }
  return res.json()
}

// ===================== Admission Enquiry =====================
export async function getAdmissionEnquiries(token) {
  const res = await fetch(`${API_BASE}/api/admission-enquiry`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch admission enquiries') }
  return res.json()
}
export async function createAdmissionEnquiry(payload, token) {
  const res = await fetch(`${API_BASE}/api/admission-enquiry`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to create admission enquiry') }
  return res.json()
}
export async function updateAdmissionEnquiry(id, payload, token) {
  const res = await fetch(`${API_BASE}/api/admission-enquiry/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update admission enquiry') }
  return res.json()
}

// ===================== Online Admissions =====================
export async function getOnlineAdmissions(token) {
  const res = await fetch(`${API_BASE}/api/online-admission`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch online admissions') }
  return res.json()
}
export async function submitOnlineAdmission(formData) {
  const res = await fetch(`${API_BASE}/api/online-admission`, { method: 'POST', body: formData })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to submit online admission') }
  return res.json()
}

// ===================== Discount Management =====================
export async function getDiscounts(token) {
  const res = await fetch(`${API_BASE}/api/discounts`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch discounts') }
  return res.json()
}
export async function createDiscount(payload, token) {
  const res = await fetch(`${API_BASE}/api/discounts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to create discount') }
  return res.json()
}
export async function deleteDiscount(id, token) {
  const res = await fetch(`${API_BASE}/api/discounts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to delete discount') }
  return res.json()
}

// ===================== Library Management =====================
export async function getLibraryBooks(token) {
  const res = await fetch(`${API_BASE}/api/library/books`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch library books') }
  return res.json()
}
export async function addLibraryBook(payload, token) {
  const res = await fetch(`${API_BASE}/api/library/books`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add book') }
  return res.json()
}
export async function issueLibraryBook(id, studentId, token) {
  const res = await fetch(`${API_BASE}/api/library/books/${id}/issue`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ studentId }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to issue book') }
  return res.json()
}
export async function returnLibraryBook(id, studentId, token) {
  const res = await fetch(`${API_BASE}/api/library/books/${id}/return`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ studentId }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to return book') }
  return res.json()
}
export async function deleteLibraryBook(id, token) {
  const res = await fetch(`${API_BASE}/api/library/books/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to delete book') }
  return res.json()
}

// ===================== Behavior Records =====================
export async function getBehaviorRecords(studentId, token) {
  const res = await fetch(`${API_BASE}/api/behavior-records/by-student/${studentId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch behavior records') }
  return res.json()
}
export async function addBehaviorRecord(payload, token) {
  const res = await fetch(`${API_BASE}/api/behavior-records`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add behavior record') }
  return res.json()
}

// ===================== Lesson Plans =====================
export async function getLessonPlans(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(`${API_BASE}/api/faculty/lesson-plans?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch lesson plans') }
  return res.json()
}
export async function addLessonPlan(payload, token) {
  const res = await fetch(`${API_BASE}/api/faculty/lesson-plans`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add lesson plan') }
  return res.json()
}


// ===================== Excel Exports =====================
export async function exportAttendanceExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(`${API_BASE}/api/export/attendance-excel?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export attendance') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportFeesExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(`${API_BASE}/api/export/fees-excel?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export fees') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fees_report_${new Date().toISOString().split('T')[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportMarksExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(`${API_BASE}/api/export/marks-excel?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export marks') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `marks_report_${new Date().toISOString().split('T')[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}


// ===================== Notification Settings =====================
export async function getNotificationSettings(token) {
  const res = await fetch(`${API_BASE}/api/notification-settings`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch settings') }
  return res.json()
}

export async function updateNotificationSettings(payload, token) {
  const res = await fetch(`${API_BASE}/api/notification-settings`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update settings') }
  return res.json()
}
