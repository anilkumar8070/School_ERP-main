const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const anchor = "} = require('./users');";
const insertion = `
const { verifyToken, requireRole } = require('./middleware/auth');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || process.env.MAX_JSON_BODY_BYTES || '10mb';
const SUBJECTIVE_THRESHOLD = Number(process.env.SUBJECTIVE_THRESHOLD || 0.7);
const SUBJECTIVE_SCORING = process.env.SUBJECTIVE_SCORING || 'proportional';
const DEBUG_MATCH_THRESHOLD = Number(process.env.DEBUG_MATCH_THRESHOLD || 40);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET === 'change-this-secret') {
    console.error('FATAL ERROR: JWT_SECRET is missing or set to insecure default "change-this-secret" in production. Exiting process.');
    process.exit(1);
  }
}
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist');
let Razorpay = null;
let razorpayClient = null;
`;

const idx = code.indexOf(anchor);
if (idx !== -1) {
  code = code.substring(0, idx + anchor.length) + insertion + code.substring(idx + anchor.length);
  fs.writeFileSync('index.js', code);
  console.log('Restored broken lines!');
} else {
  console.log('Could not find anchor');
}
