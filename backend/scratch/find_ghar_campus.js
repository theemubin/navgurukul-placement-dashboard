const fs = require('fs');
const content = fs.readFileSync('../routes/gharIntegration.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('campus') || line.includes('Campus')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
