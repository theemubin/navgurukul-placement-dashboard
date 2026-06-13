const fs = require('fs');
const path = require('path');

async function testUpload() {
  try {
    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await fetch('http://localhost:5006/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john.doe@student.edu',
        password: 'password123'
      })
    });
    
    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status} - ${errText}`);
    }
    
    const { token, user } = await loginRes.json();
    console.log('Logged in successfully. Token received:', user.email);

    // 2. Upload resume
    console.log('Uploading resume PDF...');
    const pdfPath = path.join(__dirname, 'john_doe_resume.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('resume', blob, 'john_doe_resume.pdf');
    // Also send standard profile fields so it doesn't fail validation
    formData.append('firstName', 'John');
    formData.append('lastName', 'Doe');
    formData.append('email', 'john.doe@student.edu');
    
    const uploadRes = await fetch('http://localhost:5006/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed: ${uploadRes.status} - ${errText}`);
    }

    const uploadData = await uploadRes.json();
    console.log('Upload result user profile resume field values:');
    console.log('resume:', uploadData.user?.studentProfile?.resume);
    console.log('resumeLink:', uploadData.user?.studentProfile?.resumeLink);

    // 3. Check ATS score
    console.log('Checking ATS Score...');
    const atsRes = await fetch('http://localhost:5006/api/utils/resume-ats/check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!atsRes.ok) {
      const errText = await atsRes.text();
      throw new Error(`ATS check failed: ${atsRes.status} - ${errText}`);
    }

    const atsData = await atsRes.json();
    console.log('ATS Result:', JSON.stringify(atsData, null, 2));
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testUpload();
