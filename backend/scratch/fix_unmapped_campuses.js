const mongoose = require('mongoose');
const Campus = require('../models/Campus');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to Database. Starting campus field fix for students...');
  
  const students = await User.find({ role: 'student' });
  console.log(`Analyzing ${students.length} students...`);
  
  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let noGharCampusCount = 0;
  let failedToMatchCount = 0;

  for (const student of students) {
    const gharCampus = student.studentProfile?.externalData?.ghar?.campus?.value || student.resolvedProfile?.campus;
    
    if (!gharCampus) {
      noGharCampusCount++;
      continue;
    }
    
    // Normalize campus name
    let searchName = gharCampus.trim();
    if (searchName.toLowerCase() === 'eternal campus') {
      searchName = 'Eternal BCA';
    } else if (searchName.toLowerCase() === 'sarjapura') {
      searchName = 'Sarjapur';
    }
    
    const matchedCampus = await Campus.findOne({ name: new RegExp(`^${searchName}$`, 'i') });
    
    if (matchedCampus) {
      if (student.campus && student.campus.toString() === matchedCampus._id.toString()) {
        alreadyCorrectCount++;
      } else {
        const oldCampus = student.campus;
        student.campus = matchedCampus._id;
        await student.save();
        console.log(`Updated Student: ${student.firstName} ${student.lastName} (${student.email})`);
        console.log(`  Ghar Campus: "${gharCampus}" -> DB Campus: "${matchedCampus.name}" (${matchedCampus._id})`);
        console.log(`  Old Campus ID: ${oldCampus || 'null'}\n`);
        updatedCount++;
      }
    } else {
      console.warn(`[Warning] No matching DB campus found for Student: ${student.firstName} ${student.lastName} (${student.email}), Ghar Campus: "${gharCampus}"`);
      failedToMatchCount++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total students updated: ${updatedCount}`);
  console.log(`Students with correct campus already: ${alreadyCorrectCount}`);
  console.log(`Students with no Ghar campus metadata: ${noGharCampusCount}`);
  console.log(`Students with Ghar campus metadata but no DB match: ${failedToMatchCount}`);
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error running script:', err);
});
