const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  const token = jwt.sign({ sub: 'some-uuid', username: 'faculty@example.com', role: 'faculty' }, process.env.JWT_SECRET || 'change-this-secret');
  
  fs.writeFileSync('test_dummy.txt', 'hello world');
  
  const form = new FormData();
  form.append('title', 'Test Assignment with file');
  form.append('class', '10');
  form.append('file', fs.createReadStream('test_dummy.txt'));
  
  try {
    const res = await axios.post('http://localhost:4000/api/assignments', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: 'Bearer ' + token
      }
    });
    console.log('SUCCESS:', res.status, res.data);
  } catch (err) {
    console.log('ERROR STATUS:', err.response ? err.response.status : err.message);
    if (err.response) console.log('ERROR DATA:', err.response.data);
  }
}
run();
