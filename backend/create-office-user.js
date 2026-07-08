const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/school-erp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

async function createOfficeUser() {
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ username: 'office' });
        if (existingUser) {
            console.log('Office user already exists');
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('office123', 10);

        // Create office management user
        const officeUser = new User({
            username: 'office',
            password: hashedPassword,
            role: 'office-management',
            name: 'Office Manager',
            designation: 'Office Manager'
        });

        await officeUser.save();
        console.log('Office Management user created successfully!');
        console.log('Username: office');
        console.log('Password: office123');
        console.log('Role: office-management');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating office user:', error);
        process.exit(1);
    }
}

createOfficeUser();
