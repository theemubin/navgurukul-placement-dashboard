require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Campus, Skill, Job, PlacementCycle } = require('./models');
const Settings = require('./models/Settings');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard');
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Campus.deleteMany({}),
      Skill.deleteMany({}),
      Job.deleteMany({}),
      Settings.deleteMany({}),
      PlacementCycle.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create Settings with Navgurukul-specific options
    await Settings.updateSettings({
      schoolModules: {
        'School Of Programming': [
          'Programming Foundations',
          'Problem Solving & Flowcharts',
          'Web Fundamentals',
          'JavaScript Fundamentals',
          'Advanced JavaScript',
          'DOM & Browser APIs',
          'Python Fundamentals',
          'Advanced Python',
          'Data Structures & Algorithms',
          'Advanced Data Structures',
          'React & Frontend Frameworks'
        ],
        'School Of Business': [
          'CRM',
          'Digital Marketing',
          'Data Analytics',
          'Advance Google Sheet'
        ],
        'School of Second Chance': [
          'Master Chef',
          'Fashion Designing'
        ],
        'School of Finance': [
          'Financial Literacy',
          'Accounting Basics',
          'Investment Fundamentals'
        ],
        'School of Education': [
          'Pedagogy Basics',
          'Classroom Management',
          'Curriculum Development'
        ]
      },
      rolePreferences: [
        'Frontend Developer',
        'Backend Developer',
        'Full Stack Developer',
        'Low Code-No Code Developer',
        'Data Analyst',
        'Social Media Associate',
        'Business Developer',
        'CRM Executive',
        'Digital Marketing',
        'General Marketing',
        'Intern - Full Stack',
        'Intern - FE',
        'Intern - BE',
        'Chef',
        'Fashion Designer',
        'Teaching Assistant',
        'Finance Executive'
      ],
      technicalSkills: [
        // Programming skills
        'HTML/CSS',
        'JavaScript',
        'React',
        'Node.js',
        'Python',
        'Data Structures',
        'Algorithms',
        'Git/GitHub',
        'REST APIs',
        'Databases (SQL/NoSQL)',
        // Business skills
        'Salesforce CRM',
        'HubSpot',
        'Google Analytics',
        'SEO/SEM',
        'Social Media Marketing',
        'Google Sheets/Excel',
        'Data Visualization',
        'Content Writing',
        // Second Chance skills
        'Culinary Arts',
        'Food Safety',
        'Kitchen Management',
        'Fashion Design',
        'Garment Construction',
        'Pattern Making',
        // Finance skills
        'Tally',
        'Accounting',
        'Financial Analysis',
        // Education skills
        'Teaching Methods',
        'Curriculum Planning',
        'Student Assessment'
      ],
      degreeOptions: [
        'High School',
        '10th Pass',
        '12th Pass',
        'Diploma',
        'Bachelor\'s Degree (B.Tech/B.E.)',
        'Bachelor\'s Degree (BCA)',
        'Bachelor\'s Degree (B.Sc)',
        'Bachelor\'s Degree (B.Com)',
        'Bachelor\'s Degree (BA)',
        'Bachelor\'s Degree (BBA)',
        'Master\'s Degree',
        'Other'
      ],
      softSkills: [
        'Communication',
        'Teamwork',
        'Problem Solving',
        'Time Management',
        'Leadership',
        'Adaptability',
        'Critical Thinking',
        'Creativity',
        'Attention to Detail',
        'Work Ethic'
      ]
    });
    console.log('Created settings');

    // Create campuses (Navgurukul campuses)
    const campuses = await Campus.insertMany([
      { name: 'Jashpur', code: 'JASH', location: { city: 'Jashpur', state: 'Chhattisgarh' }, placementTarget: 50 },
      { name: 'Raigarh', code: 'RAIG', location: { city: 'Raigarh', state: 'Chhattisgarh' }, placementTarget: 50 },
      { name: 'Dantewada', code: 'DANT', location: { city: 'Dantewada', state: 'Chhattisgarh' }, placementTarget: 40 },
      { name: 'Dharamshala', code: 'DHAR', location: { city: 'Dharamshala', state: 'Himachal Pradesh' }, placementTarget: 60 },
      { name: 'Eternal BCA', code: 'EBCA', location: { city: 'Bangalore', state: 'Karnataka' }, placementTarget: 80 },
      { name: 'Kishanganj', code: 'KISH', location: { city: 'Kishanganj', state: 'Bihar' }, placementTarget: 45 },
      { name: 'Sarjapur', code: 'SARJ', location: { city: 'Sarjapur', state: 'Karnataka' }, placementTarget: 70 },
      { name: 'Pune', code: 'PUNE', location: { city: 'Pune', state: 'Maharashtra' }, placementTarget: 55 }
    ]);
    console.log('Created campuses');

    // Create skills
    const skills = await Skill.insertMany([
      { name: 'JavaScript', category: 'technical', description: 'JavaScript programming language' },
      { name: 'Python', category: 'technical', description: 'Python programming language' },
      { name: 'React', category: 'technical', description: 'React.js framework' },
      { name: 'Node.js', category: 'technical', description: 'Node.js runtime' },
      { name: 'SQL', category: 'technical', description: 'Structured Query Language' },
      { name: 'MongoDB', category: 'technical', description: 'MongoDB NoSQL database' },
      { name: 'Java', category: 'technical', description: 'Java programming language' },
      { name: 'Communication', category: 'soft_skill', description: 'Verbal and written communication' },
      { name: 'Teamwork', category: 'soft_skill', description: 'Ability to work in teams' },
      { name: 'Problem Solving', category: 'soft_skill', description: 'Analytical thinking and problem solving' },
      { name: 'English', category: 'language', description: 'English language proficiency' },
      { name: 'AWS Certified', category: 'certification', description: 'AWS Cloud certification' },
      { name: 'Machine Learning', category: 'domain', description: 'Machine learning and AI' }
    ]);
    console.log('Created skills');

    // Create users - pass plain password, User model will hash it
    const plainPassword = 'password123';

    // Manager
    const manager = await User.create({
      email: 'manager@placement.edu',
      password: plainPassword,
      firstName: 'Admin',
      lastName: 'Manager',
      role: 'manager',
      phone: '9876543210'
    });

    // Coordinator
    const coordinator = await User.create({
      email: 'coordinator@placement.edu',
      password: plainPassword,
      firstName: 'Placement',
      lastName: 'Coordinator',
      role: 'coordinator',
      phone: '9876543211'
    });

    // Campus POCs (one per campus)
    const pocJashpur = await User.create({
      email: 'poc.jashpur@placement.edu',
      password: plainPassword,
      firstName: 'Jashpur',
      lastName: 'POC',
      role: 'campus_poc',
      campus: campuses[0]._id, // Jashpur
      phone: '9876543212'
    });

    const pocDharamshala = await User.create({
      email: 'poc.dharamshala@placement.edu',
      password: plainPassword,
      firstName: 'Dharamshala',
      lastName: 'POC',
      role: 'campus_poc',
      campus: campuses[3]._id, // Dharamshala
      phone: '9876543213'
    });

    // Alias for backward compatibility in seed
    const pocMain = pocJashpur;
    const pocNorth = pocDharamshala;

    // Hash password for insertMany (pre-save hook doesn't run on insertMany)
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Students with Navgurukul-specific profile data
    const students = await User.insertMany([
      {
        email: 'john.doe@student.edu',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        campus: campuses[0]._id, // Jashpur
        phone: '9876543220',
        studentProfile: {
          enrollmentNumber: 'STU2024001',
          department: 'Computer Science',
          batch: '2024',
          cgpa: 8.5,
          skills: [
            { skill: skills[0]._id, status: 'approved', approvedBy: pocMain._id },
            { skill: skills[2]._id, status: 'approved', approvedBy: pocMain._id },
            { skill: skills[3]._id, status: 'pending' }
          ],
          linkedIn: 'https://linkedin.com/in/johndoe',
          about: 'Passionate about web development'
        },
        currentEducation: {
          school: 'School Of Programming',
          joiningDate: new Date('2023-06-01'),
          currentModule: 'Advanced JavaScript'
        },
        hometown: {
          pincode: '560001',
          village: 'Bangalore Central',
          district: 'Bangalore',
          state: 'Karnataka'
        },
        tenthGrade: {
          percentage: 85,
          board: 'CBSE',
          yearOfPassing: 2019
        },
        twelfthGrade: {
          percentage: 82,
          board: 'CBSE',
          stream: 'Science',
          yearOfPassing: 2021
        },
        degree: {
          name: '12th Pass',
          institution: 'Delhi Public School',
          yearOfCompletion: 2021
        },
        technicalSkills: [
          { name: 'JavaScript', proficiency: 'advanced', selfAssessed: true },
          { name: 'React', proficiency: 'intermediate', selfAssessed: true },
          { name: 'HTML/CSS', proficiency: 'advanced', selfAssessed: true }
        ],
        englishProficiency: {
          reading: 'B2',
          writing: 'B1',
          speaking: 'B2',
          listening: 'B2'
        },
        softSkills: ['Communication', 'Teamwork', 'Problem Solving'],
        rolePreferences: ['Frontend Developer', 'Full Stack Developer', 'Intern - FE'],
        profileStatus: 'approved',
        approvalHistory: [
          {
            status: 'approved',
            reviewedBy: pocMain._id,
            reviewedAt: new Date(),
            comments: 'Profile looks good. Approved.'
          }
        ]
      },
      {
        email: 'jane.smith@student.edu',
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'student',
        campus: campuses[0]._id,
        phone: '9876543221',
        studentProfile: {
          enrollmentNumber: 'STU2024002',
          department: 'Information Technology',
          batch: '2024',
          cgpa: 9.0,
          skills: [
            { skill: skills[1]._id, status: 'approved', approvedBy: pocMain._id },
            { skill: skills[12]._id, status: 'approved', approvedBy: pocMain._id }
          ],
          about: 'Data science enthusiast'
        },
        currentEducation: {
          school: 'School Of Business',
          joiningDate: new Date('2023-07-15'),
          currentModule: 'Data Analytics'
        },
        hometown: {
          pincode: '400001',
          village: 'Mumbai Central',
          district: 'Mumbai',
          state: 'Maharashtra'
        },
        tenthGrade: {
          percentage: 92,
          board: 'ICSE',
          yearOfPassing: 2018
        },
        twelfthGrade: {
          percentage: 88,
          board: 'ISC',
          stream: 'Commerce',
          yearOfPassing: 2020
        },
        technicalSkills: [
          { name: 'Google Sheets/Excel', proficiency: 'advanced', selfAssessed: true },
          { name: 'Data Visualization', proficiency: 'intermediate', selfAssessed: true },
          { name: 'Google Analytics', proficiency: 'beginner', selfAssessed: true }
        ],
        englishProficiency: {
          reading: 'C1',
          writing: 'B2',
          speaking: 'B2',
          listening: 'C1'
        },
        softSkills: ['Communication', 'Leadership', 'Critical Thinking'],
        rolePreferences: ['Data Analyst', 'Digital Marketing', 'Business Developer'],
        profileStatus: 'pending_approval'
      },
      {
        email: 'mike.wilson@student.edu',
        password: hashedPassword,
        firstName: 'Mike',
        lastName: 'Wilson',
        role: 'student',
        campus: campuses[1]._id,
        phone: '9876543222',
        studentProfile: {
          enrollmentNumber: 'STU2024003',
          department: 'Computer Science',
          batch: '2024',
          cgpa: 7.8,
          skills: [
            { skill: skills[6]._id, status: 'approved', approvedBy: pocNorth._id },
            { skill: skills[4]._id, status: 'pending' }
          ],
          about: 'Java developer'
        },
        currentEducation: {
          school: 'School Of Programming',
          joiningDate: new Date('2023-08-01'),
          currentModule: 'Python Fundamentals'
        },
        hometown: {
          pincode: '110001',
          village: 'Connaught Place',
          district: 'New Delhi',
          state: 'Delhi'
        },
        tenthGrade: {
          percentage: 78,
          board: 'State Board',
          yearOfPassing: 2019
        },
        twelfthGrade: {
          percentage: 75,
          board: 'State Board',
          stream: 'Science',
          yearOfPassing: 2021
        },
        technicalSkills: [
          { name: 'Python', proficiency: 'intermediate', selfAssessed: true },
          { name: 'HTML/CSS', proficiency: 'beginner', selfAssessed: true }
        ],
        englishProficiency: {
          reading: 'B1',
          writing: 'A2',
          speaking: 'B1',
          listening: 'B1'
        },
        softSkills: ['Problem Solving', 'Adaptability'],
        rolePreferences: ['Backend Developer', 'Intern - BE'],
        profileStatus: 'draft'
      },
      {
        email: 'priya.sharma@student.edu',
        password: hashedPassword,
        firstName: 'Priya',
        lastName: 'Sharma',
        role: 'student',
        campus: campuses[0]._id,
        phone: '9876543223',
        studentProfile: {
          enrollmentNumber: 'STU2024004',
          department: 'Culinary Arts',
          batch: '2024',
          cgpa: 8.0,
          skills: [],
          about: 'Aspiring chef with passion for Indian cuisine'
        },
        currentEducation: {
          school: 'School of Second Chance',
          specialization: 'Master Chef',
          joiningDate: new Date('2023-09-01'),
          currentModule: 'Master Chef'
        },
        hometown: {
          pincode: '302001',
          village: 'Jaipur City',
          district: 'Jaipur',
          state: 'Rajasthan'
        },
        tenthGrade: {
          percentage: 65,
          board: 'State Board',
          yearOfPassing: 2020
        },
        technicalSkills: [
          { name: 'Culinary Arts', proficiency: 'intermediate', selfAssessed: true },
          { name: 'Food Safety', proficiency: 'beginner', selfAssessed: true }
        ],
        englishProficiency: {
          reading: 'A2',
          writing: 'A2',
          speaking: 'A2',
          listening: 'B1'
        },
        softSkills: ['Creativity', 'Attention to Detail', 'Time Management'],
        rolePreferences: ['Chef'],
        profileStatus: 'pending_approval'
      }
    ]);
    console.log('Created users');

    // Create jobs
    await Job.insertMany([
      {
        title: 'Software Engineer',
        company: {
          name: 'TechCorp India',
          website: 'https://techcorp.com',
          description: 'Leading technology company'
        },
        description: 'We are looking for talented software engineers to join our team.',
        requirements: ['BS in Computer Science', '0-2 years experience', 'Strong programming skills'],
        responsibilities: ['Develop web applications', 'Write clean code', 'Collaborate with team'],
        location: 'Bangalore',
        jobType: 'full_time',
        salary: { min: 600000, max: 1000000, currency: 'INR' },
        requiredSkills: [
          { skill: skills[0]._id, required: true },
          { skill: skills[2]._id, required: true },
          { skill: skills[3]._id, required: false }
        ],
        eligibility: {
          minCgpa: 7.0,
          departments: ['Computer Science', 'Information Technology'],
          batches: ['2024', '2025'],
          campuses: [campuses[0]._id, campuses[1]._id]
        },
        applicationDeadline: new Date('2026-03-01'),
        maxPositions: 10,
        status: 'active',
        interviewRounds: [
          { name: 'Online Aptitude Test', type: 'aptitude' },
          { name: 'Technical Interview', type: 'technical' },
          { name: 'HR Interview', type: 'hr' }
        ],
        createdBy: coordinator._id
      },
      {
        title: 'Data Scientist',
        company: {
          name: 'DataMinds Analytics',
          website: 'https://dataminds.com',
          description: 'Analytics and AI company'
        },
        description: 'Join our data science team to work on cutting-edge ML projects.',
        requirements: ['BS/MS in Computer Science or related field', 'Experience with Python', 'Knowledge of ML algorithms'],
        responsibilities: ['Build ML models', 'Analyze data', 'Present insights'],
        location: 'Mumbai',
        jobType: 'full_time',
        salary: { min: 800000, max: 1400000, currency: 'INR' },
        requiredSkills: [
          { skill: skills[1]._id, required: true },
          { skill: skills[12]._id, required: true }
        ],
        eligibility: {
          minCgpa: 8.0,
          departments: ['Computer Science', 'Information Technology', 'Mathematics'],
          batches: ['2024']
        },
        applicationDeadline: new Date('2026-02-15'),
        maxPositions: 5,
        status: 'active',
        interviewRounds: [
          { name: 'Coding Test', type: 'coding' },
          { name: 'ML Case Study', type: 'technical' },
          { name: 'Final Interview', type: 'hr' }
        ],
        createdBy: coordinator._id
      },
      {
        title: 'Java Developer Intern',
        company: {
          name: 'Enterprise Solutions Ltd',
          website: 'https://enterprise.com',
          description: 'Enterprise software company'
        },
        description: '6-month internship opportunity for Java developers.',
        requirements: ['Currently pursuing BS in CS/IT', 'Basic Java knowledge'],
        responsibilities: ['Assist in development', 'Learn enterprise practices', 'Write unit tests'],
        location: 'Delhi',
        jobType: 'internship',
        salary: { min: 25000, max: 35000, currency: 'INR' },
        requiredSkills: [
          { skill: skills[6]._id, required: true },
          { skill: skills[4]._id, required: false }
        ],
        eligibility: {
          minCgpa: 6.5,
          departments: ['Computer Science', 'Information Technology'],
          batches: ['2025', '2026'],
          campuses: [campuses[1]._id, campuses[2]._id]
        },
        applicationDeadline: new Date('2026-01-31'),
        maxPositions: 15,
        status: 'active',
        interviewRounds: [
          { name: 'Technical Interview', type: 'technical' }
        ],
        createdBy: coordinator._id
      }
    ]);
    console.log('Created jobs');

    // Create Placement Cycles (Global - managed by Manager)
    const placementCycles = await PlacementCycle.insertMany([
      {
        name: 'October 2025',
        month: 10,
        year: 2025,
        status: 'completed',
        description: 'October 2025 placements',
        targetPlacements: 100,
        createdBy: manager._id
      },
      {
        name: 'November 2025',
        month: 11,
        year: 2025,
        status: 'completed',
        description: 'November 2025 placements',
        targetPlacements: 100,
        createdBy: manager._id
      },
      {
        name: 'December 2025',
        month: 12,
        year: 2025,
        status: 'completed',
        description: 'December 2025 placements',
        targetPlacements: 100,
        createdBy: manager._id
      },
      {
        name: 'January 2026',
        month: 1,
        year: 2026,
        status: 'active',
        description: 'Current active placement cycle',
        targetPlacements: 150,
        createdBy: manager._id
      },
      {
        name: 'February 2026',
        month: 2,
        year: 2026,
        status: 'active',
        description: 'February 2026 placements',
        targetPlacements: 120,
        createdBy: manager._id
      },
      {
        name: 'March 2026',
        month: 3,
        year: 2026,
        status: 'active',
        description: 'March 2026 placements',
        targetPlacements: 100,
        createdBy: manager._id
      }
    ]);
    console.log('Created placement cycles');

    // Assign students to placement cycles
    await User.updateMany(
      { _id: { $in: students.map(s => s._id).slice(0, 2) } },
      { 
        placementCycle: placementCycles[3]._id, // January 2026
        placementCycleAssignedAt: new Date(),
        placementCycleAssignedBy: manager._id
      }
    );
    await User.updateMany(
      { _id: { $in: students.map(s => s._id).slice(2, 4) } },
      { 
        placementCycle: placementCycles[4]._id, // February 2026
        placementCycleAssignedAt: new Date(),
        placementCycleAssignedBy: manager._id
      }
    );
    console.log('Assigned students to placement cycles');

    console.log('\n=== Seed Data Complete ===');
    console.log('\nTest Accounts:');
    console.log('Manager: manager@placement.edu / password123');
    console.log('Coordinator: coordinator@placement.edu / password123');
    console.log('Campus POC (Jashpur): poc.jashpur@placement.edu / password123');
    console.log('Campus POC (Dharamshala): poc.dharamshala@placement.edu / password123');
    console.log('Student (Approved): john.doe@student.edu / password123');
    console.log('Student (Pending): jane.smith@student.edu / password123');
    console.log('Student (Draft): mike.wilson@student.edu / password123');
    console.log('Student (Second Chance): priya.sharma@student.edu / password123');

    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
