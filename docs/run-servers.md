# Run & Debug — Local Dev Servers

Quick start (from repo root):

- Start both services (recommended):
  - npm run dev

- Start only the backend:
  - cd backend && npm install
  - cd backend && npm run dev

- Start only the frontend:
  - cd frontend && npm install
  - cd frontend && npm run dev
  - UI will be served by Vite (default: http://localhost:3000 or 5173)

Health checks
- Backend: curl http://localhost:5001/api/health
- Frontend: open http://localhost:3000/ in browser (or curl it)

Troubleshooting
- Port in use (common):
  - Find process: lsof -ti TCP:<port> -sTCP:LISTEN
  - Kill process: kill <PID> (or force: lsof -ti TCP:<port> -sTCP:LISTEN | xargs kill -9)
  - Or change port by setting PORT env var for backend: PORT=5002 npm run dev

- If frontend shows Vite deprecation warning about CJS Node API: add "type": "module" to `frontend/package.json` to remove the warning (optional).

- If `curl` returns no response or 000 status code, try verbose connect:
  - curl -v http://localhost:5001/api/health
  - curl -v http://localhost:3000

- If servers exit immediately after starting:
  - Check the terminal where the process started for errors.
  - Check `~/.npm/_logs/<timestamp>-debug-0.log` for npm errors.

Useful commands
- Check Node processes: ps aux | grep node | grep -v grep
- Show list of listening ports: lsof -i -P -n | grep LISTEN

Notes
- The backend uses port **5001** by default and requires MongoDB running at `mongodb://localhost:27017/placement_dashboard` (or set `MONGODB_URI` env var).
- The frontend uses Vite (default port 3000 or 5173 depending on environment).

If you want, I can add a one-click script (`scripts/start-local.sh`) that will check ports and start the servers safely. Let me know if you'd like that.