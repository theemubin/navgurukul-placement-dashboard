const fs = require('fs');
const content = fs.readFileSync('../models/User.js', 'utf8');
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

lines.forEach((line, idx) => {
  if (line.includes('syncGharData')) {
    startLine = idx;
  }
  if (startLine !== -1 && endLine === -1 && line.includes('return ') && lines[idx+1]?.includes('};')) {
    endLine = idx + 2;
  }
});

if (startLine !== -1) {
  console.log(`syncGharData starts at line ${startLine + 1}`);
  console.log(lines.slice(startLine, startLine + 120).join('\n'));
} else {
  console.log('syncGharData not found');
}
