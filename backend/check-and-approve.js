const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/placement_db')
  .then(async () => {
    console.log('Checking students...');
    
    const students = await User.find({ role: 'student' }).select('firstName role studentProfile');
    console.log('Found students:', students.length);
    
    students.forEach(s => {
      console.log(`- ${s.firstName}: profile=${s.studentProfile?.profileStatus}, status=${s.studentProfile?.currentStatus}`);
    });
    
    // Update all to approved
    const result = await User.updateMany(
      { role: 'student' },
      { 
        $set: { 
          'studentProfile.profileStatus': 'approved',
          'studentProfile.currentStatus': 'Active'
        } 
      }
    );
    
    console.log('\nUpdated:', result.modifiedCount);
    
    // Check again
    const count = await User.countDocuments({
      role: 'student',
      'studentProfile.profileStatus': 'approved',
      'studentProfile.currentStatus': 'Active'
    });
    
    console.log('Approved Active students now:', count);
    
    mongoose.connection.close();
  })
  .catch(err => console.error('Error:', err.message));
