const mongoose = require('mongoose');

async function dumpUser() {
    const uri = 'mongodb://localhost:27017/placement_dashboard';

    try {
        await mongoose.connect(uri);
        const User = mongoose.model('User', new mongoose.Schema({
            email: String,
            role: String,
            studentProfile: Object
        }), 'users');

        const user = await User.findOne({ email: 'ankush25@navgurukul.org' });
        if (user) {
            console.log('--- USER DATA ---');
            console.log(JSON.stringify(user.studentProfile?.externalData?.ghar, null, 2));
        } else {
            console.log('User not found in local database.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

dumpUser();
