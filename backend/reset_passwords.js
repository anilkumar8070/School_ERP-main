const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/school_erp_placeholder').then(async () => {
    try {
        const User = require('./models/User');
        const hashed = await bcrypt.hash('password123', 10);
        
        await User.updateMany(
            { username: { $in: ['faculty', 'student', 'parent', 'staff'] } },
            { $set: { password: hashed } }
        );
        
        console.log('Passwords reset successfully');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}).catch(console.error);
