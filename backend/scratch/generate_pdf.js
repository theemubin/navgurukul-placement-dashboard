const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument();
const outputPath = path.join(__dirname, 'john_doe_resume.pdf');
doc.pipe(fs.createWriteStream(outputPath));

doc.fontSize(25).text('John Doe', 100, 80);
doc.fontSize(14).text('Email: john.doe@student.edu', 100, 120);
doc.fontSize(14).text('Position: Software Engineer', 100, 140);
doc.moveDown();
doc.fontSize(16).text('Professional Summary', 100, 180);
doc.fontSize(12).text('Experienced developer skilled in building React applications and Node.js backend services. Experienced with MongoDB and Git.');
doc.moveDown();
doc.fontSize(16).text('Skills', 100, 240);
doc.fontSize(12).text('React, Node.js, JavaScript, MongoDB, CSS, HTML, Git, Python');
doc.moveDown();
doc.fontSize(16).text('Experience', 100, 300);
doc.fontSize(12).text('Software Engineer Intern at NavGurukul (2025 - Present)\n- Built placement tracking dashboards using React and Express.\n- Handled file uploads and integrated third party APIs.');

doc.end();
console.log('Valid resume PDF generated successfully.');
