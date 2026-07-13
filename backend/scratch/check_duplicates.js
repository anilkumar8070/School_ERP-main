
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb+srv://iitiancraftservice_db_user:o8cWxhSAw4uQid8k@erp.ma22wdz.mongodb.net/?appName=erp';

async function check() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const UserSchema = new mongoose.Schema({
    username: String,
    password: { type: String, select: true },
    role: String
  }, { collection: 'users' });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const email = 'admin@gmail.com';
  const users = await User.find({ username: { $regex: `^${email}$`, $options: 'i' } }).lean();

  console.log(`Found ${users.length} users with email ${email}`);
  
  for (const u of users) {
    const matches = await bcrypt.compare('Admin@IITianCraft', u.password);
    console.log(`User ID: ${u._id}, Role: ${u.role}, Password Matches: ${matches}`);
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
