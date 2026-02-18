const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function manualSync() {
    const email = 'ankush25@navgurukul.org';
    const uri = process.env.MONGODB_URI;

    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        // Mocking the behavior of gharApiService.syncStudentData but with local models
        const User = require('./backend/models/User');
        const gharApiService = require('./backend/services/gharApiService');

        console.log(`Starting sync for ${email}...`);

        // We can just call syncStudentData
        const result = await gharApiService.syncStudentData(email);

        if (result) {
            console.log('Sync result returned data.');
            const user = await User.findOne({ email, role: 'student' });
            if (user) {
                console.log('User found in DB after sync.');
                console.log('Ghar Data in DB:', JSON.stringify(user.studentProfile?.externalData?.ghar, null, 2));
                console.log('Resolved Profile:', JSON.stringify(user.resolvedProfile, null, 2));
            } else {
                console.log('User NOT found in DB. Is the email correct? (ankush25@navgurukul.org)');
            }
        } else {
            console.log('Fell through: gharApiService.syncStudentData(email) returned null');
        }

    } catch (error) {
        console.error('Error:', error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

manualSync();
