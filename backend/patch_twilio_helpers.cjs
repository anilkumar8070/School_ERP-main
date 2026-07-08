const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.js');
let code = fs.readFileSync(file, 'utf8');

const twilioHelpers = `
// ===================== Twilio Notifications =====================
const twilio = require('twilio');
const NotificationSettings = require('./models/NotificationSettings');

let twilioClient;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  } catch(e) {
    console.error('Failed to init twilio:', e.message);
  }
}

async function sendSMS(to, message) {
  if (!twilioClient || !to) return;
  try {
    // Format phone number to start with + if not already (assume India +91 for simplicity if 10 digits)
    let formattedTo = to.replace(/\\D/g, '');
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;
    else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;
    
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: formattedTo
    });
    console.log('SMS sent to', formattedTo);
  } catch (err) {
    console.error('Twilio SMS Error:', err.message);
  }
}

async function sendWhatsApp(to, message) {
  if (!twilioClient || !to) return;
  try {
    let formattedTo = to.replace(/\\D/g, '');
    if (formattedTo.length === 10) formattedTo = '+91' + formattedTo;
    else if (!formattedTo.startsWith('+')) formattedTo = '+' + formattedTo;

    await twilioClient.messages.create({
      body: message,
      from: \`whatsapp:\${process.env.TWILIO_WHATSAPP_FROM}\`,
      to: \`whatsapp:\${formattedTo}\`
    });
    console.log('WhatsApp sent to', formattedTo);
  } catch (err) {
    console.error('Twilio WhatsApp Error:', err.message);
  }
}

async function notifyEvent({ event, emailOpts, phone, message }) {
  try {
    const config = await NotificationSettings.findOne({ event }).lean();
    if (!config) return; // if no config exists, we don't send SMS/WA (emails are handled by legacy logic if any)

    if (config.sms && phone) {
      await sendSMS(phone, message);
    }
    if (config.whatsapp && phone) {
      await sendWhatsApp(phone, message);
    }
    // Note: If config.email is true, the legacy email should have been sent already in the handler or we can send it here.
    // For safety, we will let existing code handle email or we can optionally send it here if emailOpts is passed.
    if (config.email && emailOpts && emailOpts.to) {
       // Only send if not already sent by legacy code. We'll pass emailOpts when we want this helper to send it.
       await sendMail(emailOpts).catch(()=>{});
    }
  } catch(e) {
    console.error('notifyEvent error:', e.message);
  }
}

app.get('/api/notification-settings', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const settings = await NotificationSettings.find().lean();
    res.json(settings);
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch('/api/notification-settings', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const items = req.body; // array of { event, email, sms, whatsapp }
    for (const item of items) {
      await NotificationSettings.findOneAndUpdate(
        { event: item.event },
        { email: item.email, sms: item.sms, whatsapp: item.whatsapp },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
});
`;

code = code.replace(/\/\/ Global error handling middleware/, twilioHelpers + '\n// Global error handling middleware');
fs.writeFileSync(file, code);
console.log('Patched index.js with Twilio helpers');
