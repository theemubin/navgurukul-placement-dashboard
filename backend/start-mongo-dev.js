#!/usr/bin/env node
/**
 * MongoDB Memory Server Start Script
 * This starts an in-memory MongoDB instance for local development
 * Install: npm install mongodb-memory-server
 */

require('dotenv').config();

async function startMongoMemoryServer() {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoose = require('mongoose');

    console.log('Starting MongoDB Memory Server...');
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    console.log('✅ MongoDB Memory Server started');
    console.log('📍 URI:', mongoUri);

    // Connect mongoose
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Memory Server');

    // Seed the database
    const seedData = require('./seed');
    await seedData();
    console.log('✅ Database seeded with sample data');

    // Start the server
    const app = require('./server');
    const PORT = process.env.PORT || 5003;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}`);
      console.log(`📖 Docs: http://localhost:${PORT}/api-docs`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await mongoose.disconnect();
      await mongoServer.stop();
      server.close(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 To use this script, first install mongodb-memory-server:');
    console.log('   npm install --save-dev mongodb-memory-server');
    console.log('\n💡 Alternatively, use MongoDB Atlas (cloud):');
    console.log('   https://www.mongodb.com/cloud/atlas');
    console.log('\n💡 Or install MongoDB locally:');
    console.log('   https://www.mongodb.com/try/download/community');
    process.exit(1);
  }
}

startMongoMemoryServer();
