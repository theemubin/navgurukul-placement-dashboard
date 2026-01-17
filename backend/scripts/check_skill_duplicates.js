require('dotenv').config();
const mongoose = require('mongoose');
(async function() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/placement_dashboard';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected for duplicate check');
    const col = mongoose.connection.collection('skills');
    const total = await col.countDocuments();
    console.log('Total skills: ', total);
    const dups = await col.aggregate([
      { $group: { _id: '$normalizedName', count: { $sum: 1 }, names: { $push: { id: '$_id', name: '$name' } } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } }
    ]).toArray();
    console.log('Duplicate groups count: ', dups.length);
    if (dups.length > 0) {
      console.log('Duplicates:', JSON.stringify(dups, null, 2));
    }
    await mongoose.disconnect();
    console.log('Done');
  } catch (err) {
    console.error('Error in duplicate check:', err);
    process.exit(1);
  }
})();