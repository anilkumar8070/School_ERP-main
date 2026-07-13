const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.js');
let code = fs.readFileSync(file, 'utf8');

const notificationApi = `
// ===================== Notification Settings =====================
export async function getNotificationSettings(token) {
  const res = await fetch(\`\${API_BASE}/api/notification-settings\`, { headers: { Authorization: \`Bearer \${token}\` } })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to fetch settings') }
  return res.json()
}

export async function updateNotificationSettings(payload, token) {
  const res = await fetch(\`\${API_BASE}/api/notification-settings\`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, body: JSON.stringify(payload)
  })
  if (!res.ok) { const err = await tryParseJson(res); throw new Error(err.message || 'Failed to update settings') }
  return res.json()
}
`;

fs.writeFileSync(file, code + '\n' + notificationApi);
console.log('Patched frontend API for notification settings');
