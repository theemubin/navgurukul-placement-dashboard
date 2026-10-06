const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/placement_db')
  .then(async () => {
    console.log('Connected');
    const count = await User.countDocuments({ role: 'student' });
    console.log('Students:', count);
    
    const allCount = await User.countDocuments({});
    console.log('All users:', allCount);
    
    const sample = await User.findOne().select('firstName role');
    console.log('Sample:', sample);
    
    mongoose.connection.close();
  })
  .catch(err => console.error('Error:', err.message));
