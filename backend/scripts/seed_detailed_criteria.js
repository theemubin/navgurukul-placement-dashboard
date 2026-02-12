const mongoose = require('mongoose');
const { JobReadinessConfig } = require('../models/JobReadiness');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SCHOOL = 'School of Programming';

const NEW_CRITERIA_LIST = [
    {
        name: 'One Real Life Project Done',
        description: 'Provide a link to a deployed real-life project you have built.',
        type: 'link', // Will need to be 'multi_input' in future, but 'link' works for now as it asks for URL
        category: 'technical',
        isMandatory: true,
    },
    {
        name: 'One AI Integrated Project Done',
        description: 'Provide a link to a project that integrates AI features.',
        type: 'link',
        category: 'technical',
        isMandatory: true,
    },
    {
        name: '70%+ on AI Interviewer Tool',
        description: 'Did you score above 70%? Providing proof is optional but recommended.',
        type: 'yes/no', // We can switch this to 'answer' if we want them to type the score
        numericTarget: 70,
        category: 'preparation',
        isMandatory: true,
    },
    {
        name: 'LinkedIn Updated + Reviewed',
        description: 'Ensure your LinkedIn profile is professional and up to date.',
        type: 'link',
        category: 'profile',
        isMandatory: true,
    },
    {
        name: 'Resume Updated + Reviewed',
        description: 'Your resume must be reviewed and approved by a mentor.',
        type: 'yes/no', // Currently 'yes/no' but ideally file upload
        category: 'profile',
        isMandatory: true,
    },
    {
        name: 'Portfolio Updated + Reviewed',
        description: 'Link to your personal portfolio website.',
        type: 'link',
        category: 'profile',
        isMandatory: true,
    },
    {
        name: 'At least 2 Mock Interviews Done',
        description: 'Confirm you have completed at least 2 mock interviews.',
        type: 'answer',
        category: 'preparation',
        isMandatory: true,
    },
    {
        name: '5 Communication Engagements',
        description: 'List your 5 major communication activities.',
        type: 'comment',
        category: 'skills',
        isMandatory: true,
    },
    {
        name: 'Placement Drive Completed',
        description: 'Have you participated in a placement drive?',
        type: 'yes/no',
        category: 'other',
        isMandatory: true,
    }
];

async function seedCriteria() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Find existing config for this school (Global/No Campus)
        let config = await JobReadinessConfig.findOne({ school: SCHOOL, campus: null });

        if (!config) {
            console.log('Creating new config...');
            config = new JobReadinessConfig({
                school: SCHOOL,
                campus: null,
                criteria: [],
                createdBy: new mongoose.Types.ObjectId('000000000000000000000000') // Placeholder ID, ideally real admin ID
            });
        }

        // 2. Map new criteria to schema format
        const newCriteriaObjects = NEW_CRITERIA_LIST.map(c => ({
            criteriaId: c.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now() + Math.floor(Math.random() * 1000),
            name: c.name,
            description: c.description,
            type: c.type,
            category: c.category,
            isMandatory: c.isMandatory
        }));

        // 3. Append to existing (or replace if you prefer - here we append to be safe)
        // To replace, uncomment: config.criteria = [];
        config.criteria.push(...newCriteriaObjects);

        await config.save();
        console.log(`Successfully added ${newCriteriaObjects.length} new criteria to ${SCHOOL}`);
        process.exit(0);
    } catch (err) {
        console.error('Error seeding:', err);
        process.exit(1);
    }
}

seedCriteria();
