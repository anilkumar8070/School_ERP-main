const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.js');
let code = fs.readFileSync(file, 'utf8');

const exportApi = `
// ===================== Excel Exports =====================
export async function exportAttendanceExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(\`\${API_BASE}/api/export/attendance-excel?\${qs.toString()}\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export attendance') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = \`attendance_report_\${new Date().toISOString().split('T')[0]}.xlsx\`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportFeesExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(\`\${API_BASE}/api/export/fees-excel?\${qs.toString()}\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export fees') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = \`fees_report_\${new Date().toISOString().split('T')[0]}.xlsx\`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function exportMarksExcel(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(\`\${API_BASE}/api/export/marks-excel?\${qs.toString()}\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to export marks') }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = \`marks_report_\${new Date().toISOString().split('T')[0]}.xlsx\`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
`
fs.writeFileSync(file, code + '\n' + exportApi);
console.log('Patched frontend API with Excel exports');
