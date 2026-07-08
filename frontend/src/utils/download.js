import { getAuth } from './session'
import { API_BASE } from '../api'

export async function openOrDownload(url) {
  try {
    if (!url) return
    const full = (String(url).startsWith('http')) ? url : `${API_BASE}${url}`
    const { token } = getAuth()
    const res = await fetch(full, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      window.open(full, '_blank')
      return
    }
    const blob = await res.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const w = window.open(blobUrl, '_blank')
    if (!w) {
      // popup blocked — trigger download
      const a = document.createElement('a')
      a.href = blobUrl
      // try to infer filename
      try {
        const parts = full.split('/')
        a.download = parts.pop() || 'file'
      } catch (e) { a.download = 'file' }
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000)
  } catch (e) {
    console.error('openOrDownload failed', e)
    try { window.open(url && url.startsWith('http') ? url : `${API_BASE}${url}`, '_blank') } catch (err) {}
  }
}

export async function downloadFile(url) {
  try {
    if (!url) return
    const full = (String(url).startsWith('http')) ? url : `${API_BASE}${url}`
    const { token } = getAuth()
    const res = await fetch(full, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      // fallback: open in new tab
      window.open(full, '_blank')
      return
    }
    const blob = await res.blob()
    // try to infer filename from Content-Disposition or URL
    let filename = 'file'
    try {
      const cd = res.headers.get('content-disposition')
      if (cd) {
        const m = /filename\*=UTF-8''([^;\n]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd)
        if (m) filename = decodeURIComponent(m[1])
      }
    } catch (e) {}
    if (!filename || filename === 'file') {
      try { filename = full.split('/').pop() || 'file' } catch (e) {}
    }
    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000)
  } catch (e) {
    console.error('downloadFile failed', e)
    try { window.open(url && url.startsWith('http') ? url : `${API_BASE}${url}`, '_blank') } catch (err) {}
  }
}
