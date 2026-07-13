
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://iitiancraftservice_db_user:o8cWxhSAw4uQid8k@erp.ma22wdz.mongodb.net/?appName=erp';

async function check() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const UserSchema = new mongoose.Schema({
    username: String,
    disabled: { type: Boolean, default: false }
  }, { collection: 'users' });

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const email = 'admin@gmail.com';
  const user = await User.findOne({ username: email }).lean();

  if (user) {
    console.log(`User ${email} disabled: ${user.disabled}`);
  } else {
    console.log(`User ${email} not found`);
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
