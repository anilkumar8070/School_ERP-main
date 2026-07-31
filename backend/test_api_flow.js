const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
async function run() {
  const token = jwt.sign({ sub: 'some-uuid', username: 'Ni@gmail.com', role: 'faculty' }, process.env.JWT_SECRET || 'change-this-secret');
  try {
    const fRes = await axios.get('http://localhost:4000/api/faculty/me', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Faculty /me:', fRes.data.assignments);
    
    const sRes = await axios.get('http://localhost:4000/api/students?class=12', { headers: { Authorization: 'Bearer ' + token } });
    console.log('Students /students?class=12:', sRes.data.map(s => s.name));
  } catch (err) {
    console.log('Error:', err.response ? err.response.data : err.message);
  }
}
run();
