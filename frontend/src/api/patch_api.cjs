const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, 'index.js')
let code = fs.readFileSync(file, 'utf8')

const apiAdditions = `
// ===================== Library Management =====================
export async function getLibraryBooks(token) {
  const res = await fetch(\`\${API_BASE}/api/library/books\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch library books') }
  return res.json()
}
export async function addLibraryBook(payload, token) {
  const res = await fetch(\`\${API_BASE}/api/library/books\`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add book') }
  return res.json()
}
export async function issueLibraryBook(id, studentId, token) {
  const res = await fetch(\`\${API_BASE}/api/library/books/\${id}/issue\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify({ studentId }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to issue book') }
  return res.json()
}
export async function returnLibraryBook(id, studentId, token) {
  const res = await fetch(\`\${API_BASE}/api/library/books/\${id}/return\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify({ studentId }) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to return book') }
  return res.json()
}
export async function deleteLibraryBook(id, token) {
  const res = await fetch(\`\${API_BASE}/api/library/books/\${id}\`, { method: 'DELETE', headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to delete book') }
  return res.json()
}

// ===================== Behavior Records =====================
export async function getBehaviorRecords(studentId, token) {
  const res = await fetch(\`\${API_BASE}/api/behavior-records/by-student/\${studentId}\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch behavior records') }
  return res.json()
}
export async function addBehaviorRecord(payload, token) {
  const res = await fetch(\`\${API_BASE}/api/behavior-records\`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add behavior record') }
  return res.json()
}

// ===================== Lesson Plans =====================
export async function getLessonPlans(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query).forEach(k => { if (query[k]) qs.set(k, query[k]) })
  const res = await fetch(\`\${API_BASE}/api/faculty/lesson-plans?\${qs.toString()}\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch lesson plans') }
  return res.json()
}
export async function addLessonPlan(payload, token) {
  const res = await fetch(\`\${API_BASE}/api/faculty/lesson-plans\`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(payload) })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to add lesson plan') }
  return res.json()
}
`

code += apiAdditions;
fs.writeFileSync(file, code)
