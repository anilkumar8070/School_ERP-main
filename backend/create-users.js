const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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

// Users to create
const users = [
    {
        username: 'office1',
        password: 'office123',
        role: 'office-management',
        name: 'Office Manager 1'
    },
    {
        username: 'office2',
        password: 'office456',
        role: 'office-management',
        name: 'Office Manager 2'
    },
    {
        username: 'admin1',
        password: 'admin123',
        role: 'admin',
        name: 'Admin User 1'
    },
    {
        username: 'teacher1',
        password: 'teacher123',
        role: 'faculty',
        name: 'Teacher User 1'
    },
    {
        username: 'student1',
        password: 'student123',
        role: 'student',
        name: 'Student User 1'
    },
    {
        username: 'parent1',
        password: 'parent123',
        role: 'parent',
        name: 'Parent User 1'
    },
    {
        username: 'staff1',
        password: 'staff123',
        role: 'staff',
        name: 'Staff User 1'
    }
];

async function createUsers() {
    try {
        for (const user of users) {
            // Check if user already exists
            const existingUser = await User.findOne({ username: user.username });
            if (existingUser) {
                console.log(`User '${user.username}' already exists`);
                continue;
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(user.password, 10);

            // Create user
            const newUser = new User({
                username: user.username,
                password: hashedPassword,
                role: user.role,
                name: user.name
            });

            await newUser.save();
            console.log(`✅ Created user: ${user.username} (${user.role})`);
        }
        
        console.log('\n🎉 All users created successfully!');
        console.log('\nLogin credentials:');
        users.forEach(user => {
            console.log(`- ${user.name}: ${user.username} / ${user.password} (${user.role})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating users:', error);
        process.exit(1);
    }
}

createUsers();
