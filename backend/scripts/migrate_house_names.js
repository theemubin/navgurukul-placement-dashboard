require('dotenv').config();
const mongoose = require('mongoose');

// Define a minimal User model for migration
const UserSchema = new mongoose.Schema({
    studentProfile: {
        houseName: String
    }
});
const User = mongoose.model('User', UserSchema);

const migrate = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement-dashboard';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const houseMap = {
            'Bageshree': 'Bageshree House',
            'Bhairav': 'Bhairav House',
            'Malhar': 'Malhar House'
        };

        let totalUpdated = 0;
        for (const [oldName, newName] of Object.entries(houseMap)) {
            const result = await User.updateMany(
                { 'studentProfile.houseName': oldName },
                { $set: { 'studentProfile.houseName': newName } }
            );
            totalUpdated += result.modifiedCount;
            console.log(`Updated ${result.modifiedCount} users: ${oldName} -> ${newName}`);
        }

        // Also update Jobs if they have the old house names in eligibility.houses
        const JobSchema = new mongoose.Schema({
            eligibility: {
                houses: [String]
            }
        });
        const Job = mongoose.model('Job', JobSchema);

        const jobs = await Job.find({ 'eligibility.houses': { $exists: true, $ne: [] } });
        let jobsUpdated = 0;
        for (const job of jobs) {
            let changed = false;
            const newHouses = job.eligibility.houses.map(h => {
                if (houseMap[h]) {
                    changed = true;
                    return houseMap[h];
                }
                return h;
            });

            if (changed) {
                job.eligibility.houses = newHouses;
                await job.save();
                jobsUpdated++;
            }
        }
        console.log(`Updated ${jobsUpdated} jobs with new house names`);

        console.log(`Migration complete. Total users updated: ${totalUpdated}`);
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
