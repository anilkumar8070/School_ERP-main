
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://iitiancraftservice_db_user:o8cWxhSAw4uQid8k@erp.ma22wdz.mongodb.net/?appName=erp';

async function check() {
  const conn = await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log('Database Name:', conn.connection.db.databaseName);

  const UserSchema = new mongoose.Schema({ username: String }, { collection: 'users' });
  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const count = await User.countDocuments();
  console.log('User count in this DB:', count);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
