const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/placement_db')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Find students and mark them as approved
    const result = await User.updateMany(
      { role: 'student' },
      { $set: { 'studentProfile.profileStatus': 'approved' } }
    );
    
    console.log('Updated students:', result.modifiedCount);
    
    // Get count of approved students
    const count = await User.countDocuments({
      role: 'student',
      'studentProfile.profileStatus': 'approved',
      'studentProfile.currentStatus': 'Active'
    });
    
    console.log('Approved Active students:', count);
    
    // Also ensure they have some skills for the portfolio
    const skillResult = await User.updateMany(
      { role: 'student', 'studentProfile.skills': { $exists: true, $ne: [] } },
      { $set: { 'studentProfile.skills.$[].status': 'approved' } },
      { arrayFilters: [{ 'elem.status': { $ne: 'approved' } }] }
    );
    
    console.log('Approved skills:', skillResult.modifiedCount);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
