#!/usr/bin/env node
/**
 * Switch from Mock to Real Backend
 * This script helps you switch from the in-memory mock server
 * to the real backend connected to your production MongoDB
 */

console.log(`
╔═══════════════════════════════════════════════════════╗
║  🔄 Switching to Real Backend (Production MongoDB)   ║
╚═══════════════════════════════════════════════════════╝

📝 Steps to follow:

1. ✋ STOP the current mock server:
   - Press Ctrl+C in the backend terminal

2. 🚀 START the real backend:
   Terminal 1:
   $ cd backend
   $ npm run dev
   
   Terminal 2 (separate):
   $ cd frontend
   $ npm run dev

3. ✅ VERIFY connection:
   - Backend logs should show: ✅ MongoDB Connected
   - NOT "Mock server" message
   - Visit: http://localhost:3002
   - Try to login

4. 📊 CHECK real database:
   - You should see your production data
   - NOT mock in-memory data
   - User data persists across restarts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Backend Port: 5005
ℹ️  Frontend Port: 3002
ℹ️  MongoDB: Production (placementngops)
ℹ️  Status: Ready to switch

⚠️  Important:
- Your .env already has the connection string
- Just restart the backend
- The real backend will connect to MongoDB

🎯 Next Command:
   1. Kill current terminal: Ctrl+C
   2. Run: npm run dev (from backend folder)
   3. Wait for "✅ MongoDB Connected"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
