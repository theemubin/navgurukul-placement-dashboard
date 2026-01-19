// Wrapper to run scripts/smoke_language_and_soft.js using backend's node_modules
const path = require('path');
const scriptPath = path.resolve(__dirname, '../..', 'scripts', 'smoke_language_and_soft.js');
require(scriptPath);
