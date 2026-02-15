const mongoose = require('mongoose');
const { User, Job } = require('./models');
const Application = require('./models/Application');
const FeaturedPlacement = require('./models/FeaturedPlacement');
require('dotenv').config();

const addDummyPlacements = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
        console.log('Connected to MongoDB');

        // Get a few approved students
        const students = await User.find({ role: 'student' }).limit(5);
        // Get a few jobs
        const jobs = await Job.find({}).limit(5);

        if (students.length === 0 || jobs.length === 0) {
            console.log('Not enough students or jobs. Run seed.js first.');
            process.exit(0);
        }

        // Clear existing featured placements and applications
        await FeaturedPlacement.deleteMany({});

        const dummyData = [];
        const quotes = [
            'Navgurukul transformed my life. I went from having zero coding knowledge to working at a top tech company.',
            'The focus on hands-on projects and peer learning at Navgurukul is what made the difference for me.',
            'I am proud to be a Navgurukul graduate. The support system here is unmatched.',
            'Grateful for the opportunity to learn and grow in such a diverse and inclusive environment.'
        ];

        const heroImages = [
            'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1920&auto=format&fit=crop'
        ];

        for (let i = 0; i < Math.min(students.length, jobs.length, 4); i++) {
            // Create an accepted application first
            let app = await Application.findOne({ student: students[i]._id, job: jobs[i]._id });
            if (!app) {
                app = await Application.create({
                    student: students[i]._id,
                    job: jobs[i]._id,
                    status: 'accepted', // This might need to match an ID, but 'accepted' usually works as a fallback
                    offerDetails: {
                        salary: 800000 + (i * 100000),
                        joiningDate: new Date()
                    }
                });
            } else {
                app.status = 'accepted';
                await app.save();
            }

            dummyData.push({
                application: app._id,
                student: students[i]._id,
                job: jobs[i]._id,
                heroImage: heroImages[i],
                customQuote: quotes[i],
                displayOrder: i + 1,
                featuredAt: new Date()
            });
        }

        await FeaturedPlacement.insertMany(dummyData);
        console.log(`Successfully added ${dummyData.length} dummy featured placements`);

        // Add dummy hiring partners
        const Settings = require('./models/Settings');
        const settings = await Settings.getSettings();
        settings.hiringPartners = [
            { name: 'Google', logo: 'https://www.vectorlogo.zone/logos/google/google-ar21.svg' },
            { name: 'Amazon', logo: 'https://www.vectorlogo.zone/logos/amazon/amazon-ar21.svg' },
            { name: 'Microsoft', logo: 'https://www.vectorlogo.zone/logos/microsoft/microsoft-ar21.svg' },
            { name: 'Meta', logo: 'https://www.vectorlogo.zone/logos/facebook/facebook-ar21.svg' },
            { name: 'Apple', logo: 'https://www.vectorlogo.zone/logos/apple/apple-ar21.svg' },
            { name: 'Netflix', logo: 'https://www.vectorlogo.zone/logos/netflix/netflix-ar21.svg' },
            { name: 'Tesla', logo: 'https://www.vectorlogo.zone/logos/tesla/tesla-ar21.svg' },
            { name: 'Adobe', logo: 'https://www.vectorlogo.zone/logos/adobe/adobe-ar21.svg' },
            { name: 'Slack', logo: 'https://www.vectorlogo.zone/logos/slack/slack-ar21.svg' },
            { name: 'Spotify', logo: 'https://www.vectorlogo.zone/logos/spotify/spotify-ar21.svg' }
        ];
        await settings.save();
        console.log('Successfully added dummy hiring partners');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error adding dummy placements:', error);
        process.exit(1);
    }
};

addDummyPlacements();
