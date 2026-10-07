require('dotenv').config();
const mongoose = require('mongoose');
const { Job, User, Campus, Skill } = require('./models');

/**
 * Seed script to import realistic and comprehensive job postings into MongoDB.
 * Usage:
 *   node seed-job.js          # Upserts or replaces seeded jobs cleanly
 *   node seed-job.js --clean  # Drops all existing jobs before importing
 */

async function seedJobs() {
  const isCleanRun = process.argv.includes('--clean') || process.argv.includes('-c');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_dashboard';

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB successfully.');

  try {
    // 1. Find or create an admin/coordinator user for createdBy & coordinator references
    let creator = await User.findOne({ role: { $in: ['coordinator', 'manager', 'admin'] } });
    if (!creator) {
      creator = await User.findOne();
    }
    if (!creator) {
      console.log('⚠️ No existing user found. Creating a default Placement Coordinator...');
      creator = await User.create({
        email: 'coordinator@placement.edu',
        password: 'password123',
        firstName: 'Placement',
        lastName: 'Coordinator',
        role: 'coordinator',
        phone: '9876543211'
      });
      console.log(`✅ Created default coordinator: ${creator.email} (ID: ${creator._id})`);
    } else {
      console.log(`👤 Using user for createdBy/coordinator: ${creator.firstName} ${creator.lastName} (${creator.role}, ID: ${creator._id})`);
    }

    // 2. Ensure all relevant skills exist in DB
    const skillDefinitions = [
      { name: 'JavaScript', category: 'technical', description: 'JavaScript programming language' },
      { name: 'Python', category: 'technical', description: 'Python programming language' },
      { name: 'React', category: 'technical', description: 'React.js frontend library' },
      { name: 'Node.js', category: 'technical', description: 'Node.js backend runtime' },
      { name: 'SQL', category: 'technical', description: 'Structured Query Language & relational DBs' },
      { name: 'MongoDB', category: 'technical', description: 'MongoDB NoSQL database' },
      { name: 'Java', category: 'technical', description: 'Java programming language' },
      { name: 'Communication', category: 'soft_skill', description: 'Verbal and written communication' },
      { name: 'Teamwork', category: 'soft_skill', description: 'Collaboration and team work' },
      { name: 'Problem Solving', category: 'soft_skill', description: 'Critical thinking and problem solving' },
      { name: 'English', category: 'language', description: 'English language proficiency' },
      { name: 'AWS Certified', category: 'certification', description: 'Amazon Web Services Cloud' },
      { name: 'Machine Learning', category: 'domain', description: 'Machine learning algorithms and data science' },
      { name: 'HTML/CSS', category: 'technical', description: 'Web markup and styling' },
      { name: 'Git/GitHub', category: 'technical', description: 'Version control with Git' }
    ];

    const skillMap = {};
    for (const s of skillDefinitions) {
      const normalized = s.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let skillDoc = await Skill.findOne({ name: s.name });
      if (!skillDoc) {
        skillDoc = await Skill.create({ ...s, normalizedName: normalized });
      }
      skillMap[s.name] = skillDoc._id;
    }
    console.log(`🛠️ Ensured ${Object.keys(skillMap).length} skills are available in the database.`);

    // 3. Fetch campuses to link campus-specific eligibility where appropriate
    const campuses = await Campus.find().lean();
    const campusMap = {};
    campuses.forEach(c => {
      campusMap[c.name] = c._id;
    });
    console.log(`🏫 Loaded ${campuses.length} campuses from the database.`);

    // 4. Handle clean flag if requested
    if (isCleanRun) {
      const delResult = await Job.deleteMany({});
      console.log(`🧹 --clean flag passed: Removed ${delResult.deletedCount} existing jobs from collection.`);
    }

    // Helper dates relative to execution time
    const inDays = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(23, 59, 59, 999);
      return d;
    };

    // 5. Job dataset definition
    const jobTemplates = [
      {
        title: 'Full Stack Developer (MERN)',
        company: {
          name: 'TechNova Innovations',
          logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
          website: 'https://technova-innovations.in',
          description: 'Fast-growing software product firm engineering modern web, cloud, and AI solutions.',
          pocName: 'Rohan Verma',
          pocContact: '9876501234',
          pocEmail: 'careers@technova-innovations.in'
        },
        description: 'We are seeking passionate Full Stack Developers with strong foundations in React, Node.js, Express, and MongoDB. You will join an agile product squad building high-throughput consumer web platforms.',
        requirements: [
          'Proficiency in JavaScript (ES6+), React.js, and Node.js',
          'Understanding of RESTful API architecture and MongoDB database design',
          'Familiarity with Git/GitHub version control workflows',
          'Good analytical and debugging capabilities'
        ],
        responsibilities: [
          'Develop reusable UI components using React.js',
          'Architect and maintain secure, scalable RESTful microservices in Node.js',
          'Write clean, modular code with unit tests and code documentation',
          'Collaborate closely with UI/UX designers and product managers'
        ],
        location: 'Bangalore',
        roleCategory: 'Full Stack Developer',
        jobType: 'full_time',
        salary: { min: 450000, max: 700000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['React'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Node.js'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['MongoDB'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Comfortable working in a hybrid environment (3 days in office, 2 days remote)', isMandatory: true },
          { requirement: 'Available to join within 30 days of receiving the offer', isMandatory: false }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          tenthGrade: { required: false, minPercentage: null },
          twelfthGrade: { required: false, minPercentage: null },
          higherEducation: { required: false, level: '', acceptedDegrees: [] },
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(30),
        maxPositions: 6,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Online Coding Challenge', type: 'coding', description: 'Data structures & problem solving test' },
          { name: 'Technical System & Code Interview', type: 'technical', description: 'Deep-dive into React and Node.js projects' },
          { name: 'Culture & HR Discussion', type: 'hr', description: 'Team fit, compensation and onboarding' }
        ],
        questions: [
          { question: 'Will the company provide a laptop?', answer: 'Yes, modern development laptops are provided on day one.', isPublic: true },
          { question: 'Is there a probation period?', answer: 'Yes, standard 3-month probation period applies.', isPublic: true }
        ]
      },
      {
        title: 'Frontend Developer (React.js)',
        company: {
          name: 'CloudScale Systems',
          logo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=128&auto=format&fit=crop&q=80',
          website: 'https://cloudscalesystems.io',
          description: 'Enterprise cloud infrastructure monitoring SaaS company serving global clients.',
          pocName: 'Pooja Hegde',
          pocContact: '9876502345',
          pocEmail: 'hiring@cloudscale.io'
        },
        description: 'Join our Frontend team to create responsive, highly interactive cloud dashboards. You will work with modern React, Tailwind CSS, state management libraries, and real-time data streaming.',
        requirements: [
          'Strong command of HTML5, CSS3, modern JavaScript, and React hooks',
          'Experience building responsive layouts and state management (Redux / Context)',
          'Understanding of frontend performance optimization and browser APIs',
          'Good team communication skills'
        ],
        responsibilities: [
          'Build and optimize complex analytics dashboards and data visualization charts',
          'Integrate frontend components with backend GraphQL and REST APIs',
          'Ensure cross-browser compatibility and responsive performance',
          'Participate in agile sprint ceremonies and code reviews'
        ],
        location: 'Remote',
        roleCategory: 'Frontend Developer',
        jobType: 'full_time',
        salary: { min: 400000, max: 650000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['React'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['HTML/CSS'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Problem Solving'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Have a stable broadband connection and quiet remote work setup', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(25),
        maxPositions: 4,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Frontend Coding Assignment', type: 'coding', description: 'Build a dynamic dashboard widget in React' },
          { name: 'Technical Architecture Round', type: 'technical', description: 'Reviewing code submission and core React concepts' },
          { name: 'HR & Values Fit', type: 'hr', description: 'Remote work readiness and cultural discussion' }
        ],
        questions: [
          { question: 'Are work hours flexible?', answer: 'Yes, core collaboration hours are 11 AM - 4 PM IST.', isPublic: true }
        ]
      },
      {
        title: 'Backend Engineer (Node.js & Databases)',
        company: {
          name: 'FinEdge Technologies',
          logo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=128&auto=format&fit=crop&q=80',
          website: 'https://finedge-tech.com',
          description: 'Next-generation fintech startup building compliant payment orchestration software.',
          pocName: 'Vikram Malhotra',
          pocContact: '9876503456',
          pocEmail: 'jobs@finedge-tech.com'
        },
        description: 'FinEdge is hiring backend engineers to scale transaction processing pipelines. You will design resilient APIs, implement database transactions, and ensure robust security practices.',
        requirements: [
          'Solid understanding of Node.js asynchronous architecture and Express.js',
          'Experience with SQL (PostgreSQL/MySQL) or MongoDB databases',
          'Good knowledge of database indexing, transactions, and caching',
          'Keen focus on security best practices (JWT, encryption, rate limiting)'
        ],
        responsibilities: [
          'Design and implement high-availability payment backend APIs',
          'Optimize database queries and schema designs for high transaction volume',
          'Implement automated unit and integration tests',
          'Monitor application performance and resolve production bottlenecks'
        ],
        location: 'Pune',
        roleCategory: 'Backend Developer',
        jobType: 'full_time',
        salary: { min: 500000, max: 800000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Node.js'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['SQL'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['MongoDB'], required: false, proficiencyLevel: 1 },
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 2 }
        ],
        customRequirements: [
          { requirement: 'Willingness to work from our Pune innovation center', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(20),
        maxPositions: 5,
        status: 'application_stage',
        interviewRounds: [
          { name: 'API Design & Logic Test', type: 'coding', description: 'Design a RESTful banking endpoint with validation' },
          { name: 'Backend System Interview', type: 'technical', description: 'Database indexing, concurrency, and Node.js event loop' },
          { name: 'Director & HR Round', type: 'hr', description: 'Leadership evaluation and compensation package' }
        ],
        questions: []
      },
      {
        title: 'Junior Python & Data Analyst',
        company: {
          name: 'DataMinds Analytics',
          logo: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=128&auto=format&fit=crop&q=80',
          website: 'https://dataminds.com',
          description: 'Data consultancy transforming business operations through advanced analytics and BI.',
          pocName: 'Ananya Roy',
          pocContact: '9876504567',
          pocEmail: 'talent@dataminds.com'
        },
        description: 'Looking for enthusiastic Python & Data Analysts to analyze large business datasets, generate automated business reports, and deliver data-backed insights to stakeholders.',
        requirements: [
          'Hands-on expertise in Python, Pandas, and NumPy',
          'Proficiency with SQL querying (aggregations, joins, window functions)',
          'Familiarity with data visualization tools (Matplotlib, Seaborn, Tableau, or Power BI)',
          'Analytical mindset with strong problem-solving skills'
        ],
        responsibilities: [
          'Clean, transform, and validate messy datasets for reporting pipelines',
          'Write optimized SQL queries for daily metrics and executive dashboards',
          'Create intuitive visual summaries and presentations for business teams',
          'Automate routine reporting workflows using Python scripts'
        ],
        location: 'Hyderabad',
        roleCategory: 'Data Analyst',
        jobType: 'full_time',
        salary: { min: 420000, max: 680000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Python'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['SQL'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 2 }
        ],
        customRequirements: [
          { requirement: 'Basic knowledge of statistics and data interpretation', isMandatory: false }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming', 'School of Business'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(28),
        maxPositions: 4,
        status: 'application_stage',
        interviewRounds: [
          { name: 'SQL & Python Assignment', type: 'coding', description: 'Data transformation and analytical query task' },
          { name: 'Case Study & Technical Review', type: 'technical', description: 'Walkthrough of data cleaning & visualization insights' },
          { name: 'HR Discussion', type: 'hr', description: 'Fitment and joining details' }
        ],
        questions: []
      },
      {
        title: 'Full Stack Development Intern (6 Months)',
        company: {
          name: 'CodeCraft Innovations',
          logo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=128&auto=format&fit=crop&q=80',
          website: 'https://codecraftlabs.org',
          description: 'Software innovation studio mentoring promising junior engineers into senior product architects.',
          pocName: 'Neha Kulkarni',
          pocContact: '9876506789',
          pocEmail: 'interns@codecraftlabs.org'
        },
        description: 'Exciting 6-month full-time internship for students eager to build production applications under senior engineering mentorship. Top performers will receive full-time PPOs (Pre-Placement Offers).',
        requirements: [
          'Good foundational understanding of JavaScript, HTML, and CSS',
          'Experience building at least 1-2 personal or capstone web projects',
          'Willingness to learn new frameworks, libraries, and coding patterns',
          'Curiosity, humility, and positive attitude towards constructive code feedback'
        ],
        responsibilities: [
          'Work on assigned feature modules under the direct mentorship of senior engineers',
          'Write clean frontend and backend code following team conventions',
          'Participate in daily standups and weekly sprint demos',
          'Document technical designs and contribute to code reviews'
        ],
        location: 'Remote',
        roleCategory: 'Intern - Full Stack',
        jobType: 'internship',
        duration: '6 months',
        salary: { min: 20000, max: 30000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['React'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Node.js'], required: false, proficiencyLevel: 1 },
          { skill: skillMap['Teamwork'], required: true, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Have at least one deployed project link or GitHub repository to showcase', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'A2',
          englishSpeaking: 'A2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(21),
        maxPositions: 10,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Fundamental Web Concepts Quiz', type: 'aptitude', description: 'Basic JavaScript, HTML, CSS logic' },
          { name: 'Project Walkthrough & Discussion', type: 'technical', description: 'Reviewing your portfolio or student projects' },
          { name: 'Culture & Motivation Interview', type: 'hr', description: 'Internship expectations and mentorship goals' }
        ],
        questions: [
          { question: 'Can this internship convert to a full-time role?', answer: 'Yes! High performers will receive full-time offers with competitive packages.', isPublic: true }
        ]
      },
      {
        title: 'Junior Java Developer',
        company: {
          name: 'Enterprise Global Solutions',
          logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=128&auto=format&fit=crop&q=80',
          website: 'https://enterprisegs.in',
          description: 'Tier-1 IT consultancy delivering mission-critical enterprise systems worldwide.',
          pocName: 'Suresh Menon',
          pocContact: '9876505678',
          pocEmail: 'careers@enterprisegs.in'
        },
        description: 'We are hiring entry-level Java Developers to work on enterprise microservices, Spring Boot backends, and relational databases. Extensive on-the-job training and certification support provided.',
        requirements: [
          'Strong core Java fundamentals (OOP concepts, Collections framework, Exception handling)',
          'Understanding of relational databases and basic SQL queries',
          'Good logical reasoning and problem-solving skills',
          'Clear verbal and written communication'
        ],
        responsibilities: [
          'Develop and maintain Java REST microservices using Spring Boot',
          'Write database access objects and unit tests using JUnit',
          'Diagnose and remediate software bugs identified in QA testing',
          'Follow agile enterprise coding guidelines and version control standards'
        ],
        location: 'Bangalore',
        roleCategory: 'Backend Developer',
        jobType: 'full_time',
        salary: { min: 400000, max: 600000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Java'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['SQL'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 2 }
        ],
        customRequirements: [
          { requirement: 'Ready to work from our Bangalore electronic city office', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(35),
        maxPositions: 8,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Core Java Technical Test', type: 'coding', description: 'Java OOP, Collections, and problem solving' },
          { name: 'Technical Interview', type: 'technical', description: 'Spring Boot basics, SQL queries, and project discussion' },
          { name: 'HR Round', type: 'hr', description: 'Background checks and offer finalization' }
        ],
        questions: []
      },
      {
        title: 'Frontend Engineering Intern (3 Months)',
        company: {
          name: 'WebNest Digital',
          logo: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=128&auto=format&fit=crop&q=80',
          website: 'https://webnestdigital.com',
          description: 'Creative digital agency engineering interactive web experiences and modern web applications.',
          pocName: 'Karan Johar',
          pocContact: '9876507890',
          pocEmail: 'internships@webnestdigital.com'
        },
        description: 'Join WebNest for a 3-month focused internship designing responsive web layouts, micro-interactions, and React components. Stipend paid monthly with certificate and placement consideration.',
        requirements: [
          'Strong command of HTML5, CSS3, Flexbox, Grid, and responsive design',
          'Basic familiarity with React and modern JavaScript',
          'Eye for aesthetic details, typography, and spacing',
          'Self-motivated with good time management'
        ],
        responsibilities: [
          'Convert Figma designs into pixel-perfect responsive HTML/CSS/React code',
          'Implement subtle web animations and transitions',
          'Optimize images and assets for web performance',
          'Assist frontend developers with bug fixes and feature updates'
        ],
        location: 'Bangalore',
        roleCategory: 'Intern - FE',
        jobType: 'internship',
        duration: '3 months',
        salary: { min: 18000, max: 25000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['HTML/CSS'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['React'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming', 'School of Design'],
          campuses: [],
          englishWriting: 'A2',
          englishSpeaking: 'A2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(18),
        maxPositions: 6,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Figma to Code Practical Task', type: 'other', description: 'Slice a given Figma section into HTML/CSS' },
          { name: 'Design & Code Review', type: 'technical', description: 'Reviewing CSS architecture and responsive design' }
        ],
        questions: []
      },
      {
        title: 'Digital Marketing & Growth Associate',
        company: {
          name: 'GrowthCatalyst Media',
          logo: 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=128&auto=format&fit=crop&q=80',
          website: 'https://growthcatalyst.io',
          description: 'Performance marketing and brand growth agency scaling D2C and consumer internet brands.',
          pocName: 'Deepak Sharma',
          pocContact: '9876508901',
          pocEmail: 'careers@growthcatalyst.io'
        },
        description: 'We are looking for a Digital Marketing Associate to run social media campaigns, execute SEO strategies, monitor analytics dashboards, and write engaging copy.',
        requirements: [
          'Clear understanding of social media platforms (LinkedIn, Instagram, YouTube) and advertising',
          'Familiarity with Google Analytics, Search Console, and keyword research basics',
          'Excellent written communication and copywriting skills',
          'Proficiency in Google Sheets / Excel for tracking conversion metrics'
        ],
        responsibilities: [
          'Plan and publish high-quality content across company social media channels',
          'Monitor campaign metrics, CTR, and conversion rates across paid ads',
          'Assist in basic on-page SEO optimization and blog publication',
          'Prepare weekly performance summary reports for client accounts'
        ],
        location: 'Delhi NCR',
        roleCategory: 'Digital Marketing',
        jobType: 'full_time',
        salary: { min: 350000, max: 550000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Communication'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['English'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Teamwork'], required: true, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Basic experience with Canva or graphic design tools is a plus', isMandatory: false }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Business'],
          campuses: [],
          englishWriting: 'B2',
          englishSpeaking: 'B2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(24),
        maxPositions: 3,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Content & Copywriting Task', type: 'other', description: 'Write 2 social media posts and 1 email newsletter sample' },
          { name: 'Campaign Strategy Interview', type: 'technical', description: 'Discussion on audience targeting and growth techniques' },
          { name: 'HR Conversation', type: 'hr', description: 'Cultural fit and compensation' }
        ],
        questions: []
      },
      {
        title: 'CRM & Business Operations Executive',
        company: {
          name: 'Nexus Solutions India',
          logo: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=128&auto=format&fit=crop&q=80',
          website: 'https://nexussolutions.co.in',
          description: 'Business process transformation firm enabling sales acceleration and CRM integration.',
          pocName: 'Meera Nair',
          pocContact: '9876509012',
          pocEmail: 'hr@nexussolutions.co.in'
        },
        description: 'Managing customer pipelines, maintaining CRM systems (HubSpot/Salesforce/Zoho), coordinating lead workflows, and assisting account managers with daily operations.',
        requirements: [
          'Understanding of sales pipelines, customer lifecycles, and CRM concepts',
          'Strong organizational skills and meticulous attention to detail',
          'Proficiency with spreadsheets (Google Sheets, Microsoft Excel)',
          'Professional written and spoken English communication'
        ],
        responsibilities: [
          'Update and maintain customer records in the CRM database',
          'Track lead progression from initial inquiry through qualification to close',
          'Generate weekly pipeline summaries and executive reports',
          'Coordinate between the marketing and sales teams for smooth handover'
        ],
        location: 'Bangalore',
        roleCategory: 'CRM Executive',
        jobType: 'full_time',
        salary: { min: 360000, max: 500000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Communication'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['English'], required: true, proficiencyLevel: 2 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: ['School of Business'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(32),
        maxPositions: 4,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Aptitude & Communication Test', type: 'aptitude', description: 'Business correspondence & data verification' },
          { name: 'Managerial Round', type: 'technical', description: 'Scenario-based CRM operations interview' },
          { name: 'HR Interview', type: 'hr', description: 'Onboarding process and expectations' }
        ],
        questions: []
      },
      {
        title: 'Business Development Associate',
        company: {
          name: 'EduBridge Learning Services',
          logo: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=128&auto=format&fit=crop&q=80',
          website: 'https://edubridgelearning.org',
          description: 'EdTech and skill development provider bridging the talent gap across corporate India.',
          pocName: 'Aditya Roy',
          pocContact: '9876510123',
          pocEmail: 'talent@edubridgelearning.org'
        },
        description: 'Exciting client-facing opportunity to connect with academic institutions, understand skill requirements, and present customized educational programs. High incentives on performance.',
        requirements: [
          'Exceptional interpersonal, negotiation, and presentation skills',
          'Self-motivated, target-driven, and proactive approach',
          'Fluent in English and Hindi',
          'Ability to build lasting professional relationships'
        ],
        responsibilities: [
          'Identify and reach out to prospective institutional clients via email, calls, and meetings',
          'Deliver compelling presentations demonstrating the value of our training programs',
          'Manage client relationships and negotiate contract renewals',
          'Collaborate with delivery teams to ensure high client satisfaction'
        ],
        location: 'Mumbai',
        roleCategory: 'Business Developer',
        jobType: 'full_time',
        salary: { min: 380000, max: 600000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Communication'], required: true, proficiencyLevel: 3 },
          { skill: skillMap['English'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Teamwork'], required: true, proficiencyLevel: 2 }
        ],
        customRequirements: [
          { requirement: 'Comfortable with local travel for client meetings when required', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Business', 'School of Education'],
          campuses: [],
          englishWriting: 'B2',
          englishSpeaking: 'B2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(27),
        maxPositions: 5,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Extempore & Pitch Presentation', type: 'other', description: 'Present a 5-minute pitch on an educational product' },
          { name: 'Sales Head Interview', type: 'technical', description: 'Objection handling and consultative selling questions' },
          { name: 'HR Fitment Round', type: 'hr', description: 'Compensation and location confirmation' }
        ],
        questions: []
      },
      {
        title: 'Paid Web Development Project (3 Months)',
        company: {
          name: 'AgileSprint Technologies',
          logo: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=128&auto=format&fit=crop&q=80',
          website: 'https://agilesprint.dev',
          description: 'Software development shop building custom portals and web tools for non-profits and SMBs.',
          pocName: 'Sameer Joshi',
          pocContact: '9876511234',
          pocEmail: 'contracts@agilesprint.dev'
        },
        description: 'Short-term 3-month paid project to implement a customer feedback portal and volunteer onboarding web interface. Deliverables-based milestone payouts with potential for ongoing contract extensions.',
        requirements: [
          'Experience building full stack or frontend web pages with React or HTML/JS',
          'Good knowledge of forms, state management, and API submission handling',
          'Ability to deliver independently within established milestone timelines'
        ],
        responsibilities: [
          'Build customer intake and registration forms with validation',
          'Connect forms with REST API endpoints and database storage',
          'Ensure modern, clean styling across mobile and desktop displays',
          'Participate in bi-weekly milestone reviews and progress demos'
        ],
        location: 'Remote',
        roleCategory: 'Low Code-No Code Developer',
        jobType: 'paid_project',
        duration: '3 months',
        salary: { min: 25000, max: 40000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['React'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Problem Solving'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: [],
          campuses: [],
          englishWriting: 'A2',
          englishSpeaking: 'A2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(15),
        maxPositions: 3,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Project Assessment', type: 'coding', description: 'Demonstrate a live project and review code implementation' },
          { name: 'Scope & Milestone Review', type: 'other', description: 'Timeline alignment and contract signing' }
        ],
        questions: []
      },
      {
        title: 'UI/UX & Web Design Associate',
        company: {
          name: 'PixelCraft Design Studio',
          logo: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=128&auto=format&fit=crop&q=80',
          website: 'https://pixelcraft.design',
          description: 'Boutique digital product studio crafting human-centered user experiences and brand identities.',
          pocName: 'Shruti Das',
          pocContact: '9876512345',
          pocEmail: 'hello@pixelcraft.design'
        },
        description: 'PixelCraft is seeking a UI/UX Designer who can translate complex user workflows into clean, intuitive, and delightful interfaces using Figma and modern design systems.',
        requirements: [
          'Solid grasp of visual hierarchy, typography, color theory, and responsive layout',
          'Proficiency in Figma (auto-layout, components, interactive prototyping)',
          'Basic understanding of web frontend limitations (HTML/CSS)',
          'Strong empathy for users and clear design rationale communication'
        ],
        responsibilities: [
          'Design wireframes, user flows, and high-fidelity mockups for web and mobile apps',
          'Maintain and evolve company design systems and UI component libraries',
          'Collaborate with developers during implementation handoff to ensure fidelity',
          'Conduct usability tests and iterate designs based on real feedback'
        ],
        location: 'Pune',
        roleCategory: 'Frontend Developer',
        jobType: 'full_time',
        salary: { min: 420000, max: 650000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['HTML/CSS'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Communication'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Please include a link to your design portfolio (Figma, Behance, or Website)', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming', 'School of Design'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(29),
        maxPositions: 2,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Portfolio Review', type: 'other', description: 'Walkthrough of past design case studies and methodology' },
          { name: 'Live Whiteboard Design Challenge', type: 'technical', description: 'Designing a simple workflow collaboratively' },
          { name: 'HR Conversation', type: 'hr', description: 'Culture fit and compensation' }
        ],
        questions: []
      },
      {
        title: 'Junior Finance Executive / Tally Associate',
        company: {
          name: 'FinValue Financial Services',
          logo: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=128&auto=format&fit=crop&q=80',
          website: 'https://finvalueadvisors.in',
          description: 'Taxation, bookkeeping, and accounting advisory firm catering to growing Indian startups.',
          pocName: 'Rajesh Singhania',
          pocContact: '9876513456',
          pocEmail: 'recruitment@finvalueadvisors.in'
        },
        description: 'Managing day-to-day accounts payable and receivable, recording journal vouchers in Tally, reconciling bank statements, and assisting senior chartered accountants with GST filings.',
        requirements: [
          'Sound knowledge of double-entry accounting principles',
          'Hands-on experience with Tally ERP 9 / Tally Prime',
          'Proficiency with MS Excel (VLOOKUP, Pivot tables, basic formulas)',
          'High integrity and accuracy with financial numbers'
        ],
        responsibilities: [
          'Record daily invoices, receipts, and expense vouchers in Tally',
          'Perform monthly bank and vendor account reconciliations',
          'Assist in the preparation of GST and TDS return calculation sheets',
          'Organize and file accounting documentation for internal audits'
        ],
        location: 'Mumbai',
        roleCategory: 'Finance Executive',
        jobType: 'full_time',
        salary: { min: 320000, max: 480000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Teamwork'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Communication'], required: true, proficiencyLevel: 1 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: ['School of Finance'],
          campuses: [],
          englishWriting: 'A2',
          englishSpeaking: 'A2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(31),
        maxPositions: 3,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Accounting & Tally Assessment', type: 'aptitude', description: 'Accounting journal entries and Excel problem' },
          { name: 'CA Partner Technical Round', type: 'technical', description: 'Taxation and reconciliation fundamentals' },
          { name: 'HR Discussion', type: 'hr', description: 'Joining schedule and onboarding' }
        ],
        questions: []
      },
      {
        title: 'Backend Engineering Intern (Node.js & APIs)',
        company: {
          name: 'ScaleMatrix Cloud',
          logo: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=128&auto=format&fit=crop&q=80',
          website: 'https://scalematrix.cloud',
          description: 'Developer tooling startup simplifying containerized microservice deployments.',
          pocName: 'Gaurav Sen',
          pocContact: '9876514567',
          pocEmail: 'interns@scalematrix.cloud'
        },
        description: '6-month backend engineering internship focused on building developer APIs, background worker jobs, and telemetry scrapers in Node.js. Generous stipend with full-time conversion track.',
        requirements: [
          'Strong command of JavaScript or TypeScript fundamentals',
          'Knowledge of how HTTP, REST APIs, and JSON data exchange work',
          'Basic familiarity with MongoDB or SQL queries',
          'Eager to learn backend architecture and cloud patterns'
        ],
        responsibilities: [
          'Assist in building REST microservices using Express.js',
          'Write automated tests with Jest / Supertest',
          'Implement data schema migrations and indexes',
          'Participate in agile sprints and engineering demos'
        ],
        location: 'Remote',
        roleCategory: 'Intern - BE',
        jobType: 'internship',
        duration: '6 months',
        salary: { min: 22000, max: 32000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Node.js'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['SQL'], required: false, proficiencyLevel: 1 },
          { skill: skillMap['MongoDB'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(22),
        maxPositions: 5,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Backend Logic Challenge', type: 'coding', description: 'Node.js async programming problem' },
          { name: 'Technical Discussion', type: 'technical', description: 'Reviewing code submission and backend concepts' }
        ],
        questions: []
      },
      {
        title: 'Women in Tech - Full Stack Developer (Diversity Initiative)',
        company: {
          name: 'InclusiTech Solutions',
          logo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&auto=format&fit=crop&q=80',
          website: 'https://inclusitech.org',
          description: 'Global technology solutions provider committed to gender diversity and women in technology careers.',
          pocName: 'Sunita Rao',
          pocContact: '9876515678',
          pocEmail: 'careers@inclusitech.org'
        },
        description: 'Dedicated diversity hiring drive for female graduates from Navgurukul. Join our software engineering teams in Bangalore building scalable enterprise applications with dedicated executive mentorship.',
        requirements: [
          'Strong passion for software development and web technologies',
          'Proficiency in React.js and Node.js or Python',
          'Good problem-solving mindset and collaborative spirit',
          'Active commitment to continuous technical learning'
        ],
        responsibilities: [
          'Design and build high-quality user-facing features and API services',
          'Participate in women in tech mentorship circles and leadership training',
          'Collaborate across cross-functional engineering and design squads',
          'Adhere to secure coding standards and modern DevOps CI/CD practices'
        ],
        location: 'Bangalore',
        roleCategory: 'Full Stack Developer',
        jobType: 'full_time',
        salary: { min: 480000, max: 750000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['React'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Node.js'], required: true, proficiencyLevel: 1 },
          { skill: skillMap['Teamwork'], required: true, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Ready to relocate or commute to Bangalore center upon joining', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          femaleOnly: true,
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no'
        },
        applicationDeadline: inDays(30),
        maxPositions: 8,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Coding & Algorithmic Problem Solving', type: 'coding', description: 'JavaScript logic and arrays/strings problem' },
          { name: 'Full Stack Project Evaluation', type: 'technical', description: 'Detailed review of student web projects' },
          { name: 'Mentorship & HR Interview', type: 'hr', description: 'Culture, onboarding, and mentorship matching' }
        ],
        questions: [
          { question: 'Is relocation allowance provided?', answer: 'Yes, a one-time relocation allowance and 2 weeks initial hotel stay are provided.', isPublic: true }
        ]
      },
      {
        title: 'Software Engineer (Job Ready Certified Only)',
        company: {
          name: 'Apex Prime Technologies',
          logo: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=128&auto=format&fit=crop&q=80',
          website: 'https://apexprimetech.com',
          description: 'High-growth fintech unicorn specializing in decentralized ledger technology and payment processing.',
          pocName: 'Arun Krishnan',
          pocContact: '9876516789',
          pocEmail: 'apex@prime.io'
        },
        description: 'Elite position for fully certified Job Ready students. High starting salary package with accelerated promotion opportunities. Working on distributed transaction engines and financial APIs.',
        requirements: [
          '100% completion of Navgurukul Job Readiness criteria',
          'Strong grasp of Algorithms, Data Structures, and System Design basics',
          'Proficiency in JavaScript or Python with clean code practices',
          'Demonstrated portfolio with at least 1 real-life and 1 AI-integrated project'
        ],
        responsibilities: [
          'Build low-latency financial transaction microservices',
          'Architect secure cryptographic data pipelines',
          'Participate in high-stakes code reviews and automated CI/CD deployments',
          'Contribute to open-source developer toolkits maintained by the company'
        ],
        location: 'Hyderabad',
        roleCategory: 'Full Stack Developer',
        jobType: 'full_time',
        salary: { min: 600000, max: 950000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['JavaScript'], required: true, proficiencyLevel: 3 },
          { skill: skillMap['Node.js'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['SQL'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 3 }
        ],
        customRequirements: [
          { requirement: 'Must have successfully completed all mock interviews and placement drive readiness', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B2',
          englishSpeaking: 'B2',
          readinessRequirement: 'yes',
          femaleOnly: false
        },
        applicationDeadline: inDays(35),
        maxPositions: 4,
        status: 'application_stage',
        interviewRounds: [
          { name: 'Advanced Coding Test', type: 'coding', description: 'Advanced DSA problems on trees, graphs, and dynamic programming' },
          { name: 'System Design & Code Architecture', type: 'technical', description: 'Design a scalable real-time notification or chat engine' },
          { name: 'Executive Leadership Interview', type: 'hr', description: 'Strategic alignment, compensation, and joining date' }
        ],
        questions: [
          { question: 'What is the required Job Readiness level?', answer: 'Applicants must be 100% Job Ready to be eligible for this position.', isPublic: true }
        ]
      },
      {
        title: 'Junior Cloud & DevOps Associate',
        company: {
          name: 'InfraOps Global',
          logo: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=128&auto=format&fit=crop&q=80',
          website: 'https://infraops.io',
          description: 'Cloud native consultancy specializing in AWS, Kubernetes, and automated deployment pipelines.',
          pocName: 'Divya Prakash',
          pocContact: '9876517890',
          pocEmail: 'jobs@infraops.io'
        },
        description: 'Currently in HR shortlisting stage. Managing cloud servers, automating deployment scripts, monitoring server health, and assisting senior DevOps architects with CI/CD pipelines.',
        requirements: [
          'Basic understanding of Linux commands, shell scripting, and networking',
          'Familiarity with AWS cloud services (EC2, S3, IAM) or Docker containers',
          'Knowledge of Git version control branching and pull request workflows',
          'Good problem-solving and diagnostic skills'
        ],
        responsibilities: [
          'Monitor cloud server infrastructure and respond to alerts',
          'Write bash scripts to automate repetitive maintenance tasks',
          'Assist developers with Docker container configurations and CI/CD pipelines',
          'Document infrastructure setups and security compliance logs'
        ],
        location: 'Remote',
        roleCategory: 'Backend Developer',
        jobType: 'full_time',
        salary: { min: 450000, max: 700000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['AWS Certified'], required: false, proficiencyLevel: 1 },
          { skill: skillMap['Problem Solving'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['Node.js'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B1',
          englishSpeaking: 'B1',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(12),
        maxPositions: 2,
        status: 'hr_shortlisting',
        interviewRounds: [
          { name: 'Linux & Networking Test', type: 'aptitude', description: 'Bash commands, file permissions, and networking questions' },
          { name: 'Cloud Architecture Interview', type: 'technical', description: 'Docker containerization and AWS basics' }
        ],
        questions: []
      },
      {
        title: 'Machine Learning & AI Associate',
        company: {
          name: 'Cognitive AI Labs',
          logo: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=128&auto=format&fit=crop&q=80',
          website: 'https://cognitiveai.in',
          description: 'Applied artificial intelligence research firm developing LLM fine-tuning and predictive models.',
          pocName: 'Dr. Tarun Sen',
          pocContact: '9876518901',
          pocEmail: 'talent@cognitiveai.in'
        },
        description: 'Currently in Interviewing stage. Work with senior research scientists to clean dataset corpora, evaluate open-source model embeddings, and fine-tune transformer models.',
        requirements: [
          'Solid proficiency with Python, Pandas, and Scikit-Learn or PyTorch',
          'Good mathematical grounding in linear algebra and statistics',
          'Experience building projects with HuggingFace, OpenAI APIs, or LLMs',
          'Curiosity to read AI research papers and replicate experimental results'
        ],
        responsibilities: [
          'Curate, preprocess, and tokenize domain-specific text datasets',
          'Run model benchmark evaluations and log accuracy metrics',
          'Deploy model inference endpoints using FastAPI and Docker',
          'Collaborate with product teams to integrate AI capabilities'
        ],
        location: 'Bangalore',
        roleCategory: 'Data Analyst',
        jobType: 'full_time',
        salary: { min: 650000, max: 1100000, currency: 'INR' },
        requiredSkills: [
          { skill: skillMap['Python'], required: true, proficiencyLevel: 3 },
          { skill: skillMap['Machine Learning'], required: true, proficiencyLevel: 2 },
          { skill: skillMap['SQL'], required: false, proficiencyLevel: 1 }
        ],
        customRequirements: [
          { requirement: 'Showcase at least 1 machine learning or LLM project on GitHub', isMandatory: true }
        ],
        eligibility: {
          openForAll: true,
          schools: ['School of Programming'],
          campuses: [],
          englishWriting: 'B2',
          englishSpeaking: 'B2',
          readinessRequirement: 'no',
          femaleOnly: false
        },
        applicationDeadline: inDays(8),
        maxPositions: 2,
        status: 'interviewing',
        interviewRounds: [
          { name: 'Python & Data Science Coding Test', type: 'coding', description: 'Pandas data manipulation and ML model evaluation' },
          { name: 'Machine Learning Technical Round', type: 'technical', description: 'Deep dive into transformers, embeddings, and loss functions' },
          { name: 'Final Research Director Interview', type: 'technical', description: 'Research mindset and project discussion' }
        ],
        questions: []
      }
    ];

    console.log(`\n📦 Prepared ${jobTemplates.length} job templates for importing.`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const tpl of jobTemplates) {
      // Build full job payload with timeline and status history
      const now = new Date();
      const jobData = {
        ...tpl,
        createdBy: creator._id,
        coordinator: creator._id,
        statusHistory: [
          {
            status: tpl.status,
            changedAt: now,
            changedBy: creator._id,
            notes: `Initial status set to ${tpl.status} during database seed.`
          }
        ],
        timeline: [
          {
            event: 'created',
            description: `Job "${tpl.title}" posted for ${tpl.company.name}`,
            changedBy: creator._id,
            changedAt: now,
            metadata: { title: tpl.title, company: tpl.company.name }
          },
          ...(tpl.status !== 'draft' ? [{
            event: 'status_changed',
            description: `Job moved to pipeline stage "${tpl.status}"`,
            changedBy: creator._id,
            changedAt: now,
            metadata: { newStatus: tpl.status }
          }] : [])
        ]
      };

      // Check if job with same title and company name already exists
      const existing = await Job.findOne({
        title: tpl.title,
        'company.name': tpl.company.name
      });

      if (existing) {
        // Update existing record
        Object.assign(existing, jobData);
        await existing.save();
        updatedCount++;
        console.log(`  🔄 Updated: "${tpl.title}" at ${tpl.company.name}`);
      } else {
        // Create new record
        await Job.create(jobData);
        insertedCount++;
        console.log(`  ✨ Inserted: "${tpl.title}" at ${tpl.company.name}`);
      }
    }

    const totalJobs = await Job.countDocuments();
    console.log('\n======================================================');
    console.log(`🎉 Job Seeding Complete!`);
    console.log(`   - New Jobs Inserted: ${insertedCount}`);
    console.log(`   - Existing Jobs Updated: ${updatedCount}`);
    console.log(`   - Total Jobs in Database: ${totalJobs}`);
    console.log('======================================================\n');

    // Display summary of currently active jobs in database
    const allJobs = await Job.find({}).select('title company.name roleCategory jobType status location applicationDeadline').lean();
    console.log('📋 Current Job Inventory:');
    allJobs.forEach((j, idx) => {
      const deadline = new Date(j.applicationDeadline).toLocaleDateString('en-IN');
      console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. [${j.status.padEnd(17, ' ')}] ${j.title.padEnd(38, ' ')} | ${j.company.name.padEnd(25, ' ')} | ${j.location.padEnd(10, ' ')} | Deadline: ${deadline}`);
    });
    console.log('');

  } catch (err) {
    console.error('❌ Error during job seeding:', err);
    throw err;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

// Execute if run directly from CLI
if (require.main === module) {
  seedJobs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedJobs;
