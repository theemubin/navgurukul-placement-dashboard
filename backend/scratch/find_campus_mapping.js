const fs = require('fs');
const path = require('path');

const routesDir = '../routes';
const files = fs.readdirSync(routesDir);

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('resolvedProfile') || content.includes('syncStudent') || content.includes('Ghar')) {
      console.log(`File: ${file}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('campus') || line.includes('Campus')) {
          console.log(`  L${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
