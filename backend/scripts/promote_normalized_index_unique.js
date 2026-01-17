require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/placement_dashboard';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const col = mongoose.connection.collection('skills');

  // Check duplicates
  const dups = await col.aggregate([
    { $group: { _id: '$normalizedName', count: { $sum: 1 }, docs: { $push: { _id: '$_id', name: '$name' } } } },
    { $match: { _id: { $ne: null }, count: { $gt: 1 } } }
  ]).toArray();

  if (dups.length > 0) {
    console.error('Aborting: Found duplicate normalizedName groups. Inspect and resolve before promoting index.');
    console.error(JSON.stringify(dups, null, 2));
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('No duplicates found. Proceeding to ensure unique index.');

  // List existing indexes
  const idxs = await col.indexes();
  console.log('Existing indexes:');
  idxs.forEach(i => console.log(JSON.stringify(i)));

  const existing = idxs.find(i => i.name === 'normalizedName_1');
  if (existing) {
    if (existing.unique) {
      console.log('normalizedName_1 already unique. No action needed.');
    } else {
      console.log('Dropping existing non-unique index normalizedName_1');
      await col.dropIndex('normalizedName_1');
      console.log('Dropped. Creating unique index on normalizedName in background...');
      await col.createIndex({ normalizedName: 1 }, { unique: true, background: true });
      console.log('Unique index created.');
    }
  } else {
    console.log('normalizedName_1 index does not exist. Creating unique index...');
    await col.createIndex({ normalizedName: 1 }, { unique: true, background: true });
    console.log('Unique index created.');
  }

  const newIdxs = await col.indexes();
  console.log('Indexes after change:');
  newIdxs.forEach(i => console.log(JSON.stringify(i)));

  await mongoose.disconnect();
  console.log('Done');
}

run().catch(err => {
  console.error('Error promoting index:', err);
  process.exit(1);
});