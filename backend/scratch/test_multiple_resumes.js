const fs = require('fs');
const path = require('path');

async function runTests() {
  try {
    console.log('--- STARTING MULTIPLE RESUME TESTS ---');

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
    
    const { token, user: loggedInUser } = await loginRes.json();
    console.log('Logged in successfully. Student email:', loggedInUser.email);

    // Get initial profile state
    const profileRes = await fetch('http://localhost:5006/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profileData = await profileRes.json();
    let resumes = profileData.studentProfile?.resumes || [];
    console.log(`Initial resumes count: ${resumes.length}`);

    // Clean up existing resumes if any, to start with a fresh slate
    if (resumes.length > 0) {
      console.log('Cleaning up existing resumes...');
      for (const r of resumes) {
        const delRes = await fetch(`http://localhost:5006/api/users/profile/resumes/${r._id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (delRes.ok) {
          console.log(`Deleted existing resume: ${r._id}`);
        }
      }
    }

    // 2. Upload first resume
    console.log('Uploading first resume...');
    const pdfPath = path.join(__dirname, 'john_doe_resume.pdf');
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`Test resume PDF not found at ${pdfPath}. Run generate_pdf.js first?`);
    }
    const pdfBuffer = fs.readFileSync(pdfPath);
    let blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    let formData = new FormData();
    formData.append('resume', blob, 'resume_one.pdf');
    formData.append('firstName', 'John');
    formData.append('lastName', 'Doe');
    formData.append('email', 'john.doe@student.edu');

    let uploadRes = await fetch('http://localhost:5006/api/users/profile', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload 1 failed: ${uploadRes.status} - ${errText}`);
    }

    let uploadData = await uploadRes.json();
    resumes = uploadData.user?.studentProfile?.resumes || [];
    console.log(`Uploaded first resume. Current resumes count: ${resumes.length}`);
    if (resumes.length !== 1) {
      throw new Error('Resumes count should be 1');
    }
    console.log('First resume info:', JSON.stringify(resumes[0], null, 2));
    if (!resumes[0].isPrimary) {
      throw new Error('First uploaded resume should automatically be marked primary');
    }

    // Verify mirroring of first resume to legacy fields
    console.log('Legacy resume field:', uploadData.user?.studentProfile?.resume);
    console.log('Legacy resumeLink field:', uploadData.user?.studentProfile?.resumeLink);
    if (uploadData.user?.studentProfile?.resume !== resumes[0].resume) {
      throw new Error('Legacy field does not match primary resume path');
    }

    // 3. Upload second resume
    console.log('Uploading second resume...');
    formData = new FormData();
    formData.append('resume', blob, 'resume_two.pdf');
    formData.append('firstName', 'John');
    formData.append('lastName', 'Doe');
    formData.append('email', 'john.doe@student.edu');

    uploadRes = await fetch('http://localhost:5006/api/users/profile', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload 2 failed: ${uploadRes.status} - ${errText}`);
    }

    uploadData = await uploadRes.json();
    resumes = uploadData.user?.studentProfile?.resumes || [];
    console.log(`Uploaded second resume. Current resumes count: ${resumes.length}`);
    if (resumes.length !== 2) {
      throw new Error('Resumes count should be 2');
    }
    console.log('Second resume info:', JSON.stringify(resumes[1], null, 2));
    if (resumes[1].isPrimary) {
      throw new Error('Second uploaded resume should not be primary by default');
    }

    // 4. Switch primary status to the second resume
    const firstResumeId = resumes[0]._id;
    const secondResumeId = resumes[1]._id;
    console.log(`Setting second resume (${secondResumeId}) as primary...`);

    const primaryRes = await fetch(`http://localhost:5006/api/users/profile/resumes/${secondResumeId}/primary`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!primaryRes.ok) {
      const errText = await primaryRes.text();
      throw new Error(`Setting primary failed: ${primaryRes.status} - ${errText}`);
    }

    const primaryData = await primaryRes.json();
    resumes = primaryData.user?.studentProfile?.resumes || [];
    console.log('Primary updated. Resumes primary flags:');
    resumes.forEach(r => console.log(`- ${r.fileName}: isPrimary = ${r.isPrimary}`));

    const newPrimary = resumes.find(r => r._id === secondResumeId);
    const oldPrimary = resumes.find(r => r._id === firstResumeId);
    if (!newPrimary?.isPrimary || oldPrimary?.isPrimary) {
      throw new Error('Primary flags were not switched correctly');
    }

    // Verify legacy field mirroring
    if (primaryData.user?.studentProfile?.resume !== newPrimary.resume) {
      throw new Error('Legacy field does not match the new primary resume path');
    }
    console.log('Legacy field successfully mirrored to new primary resume!');

    // 5. Check ATS score for a specific resume
    console.log(`Running ATS check for the first resume (${firstResumeId})...`);
    const atsRes = await fetch('http://localhost:5006/api/utils/resume-ats/check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resumeId: firstResumeId })
    });

    if (!atsRes.ok) {
      const errText = await atsRes.text();
      console.warn(`ATS check failed or returned warning (expected if AI key not configured): ${atsRes.status} - ${errText}`);
    } else {
      const atsData = await atsRes.json();
      console.log('ATS Check successful. First resume ATS score updated.');
    }

    // 6. Delete the old primary resume (firstResumeId)
    console.log(`Deleting first resume (${firstResumeId})...`);
    const delRes = await fetch(`http://localhost:5006/api/users/profile/resumes/${firstResumeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!delRes.ok) {
      const errText = await delRes.text();
      throw new Error(`Delete failed: ${delRes.status} - ${errText}`);
    }

    const delData = await delRes.json();
    resumes = delData.user?.studentProfile?.resumes || [];
    console.log(`First resume deleted. Current resumes count: ${resumes.length}`);
    if (resumes.length !== 1) {
      throw new Error('Resumes count should be 1 after deletion');
    }
    if (resumes[0]._id !== secondResumeId) {
      throw new Error('The remaining resume should be the second one');
    }
    if (!resumes[0].isPrimary) {
      throw new Error('The remaining resume should be primary');
    }

    console.log('--- ALL MULTIPLE RESUME TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

runTests();
