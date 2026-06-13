const fs = require('fs');
const content = fs.readFileSync('../models/User.js', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(670, 770).join('\n'));
