require('dotenv').config();
const mongoose = require('mongoose');
console.log('Starting list_skill_indexes.js');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/placement_dashboard';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const col = mongoose.connection.collection('skills');
  const idxCursor = col.listIndexes();
  const idxs = await idxCursor.toArray();
  console.log('Indexes on skills collection:');
  idxs.forEach(idx => console.log(JSON.stringify(idx, null, 2)));
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error listing indexes:', err);
  process.exit(1);
});