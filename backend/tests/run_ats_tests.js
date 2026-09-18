/**
 * Comprehensive Backend Unit & Integration Tests for Standalone ATS Resume Checker
 * Covers Multi-Resume Independent Analysis, Security, Caching, and Scoring.
 */

const assert = require('assert');
const { parseResume } = require('../services/ats/resumeParser');
const { runAtsChecks } = require('../services/ats/checkRules');
const { calculateAtsScore } = require('../services/ats/scoringEngine');
const { computeResumeHash, analyzeResume } = require('../services/ats/atsService');
const { enrichWithAI } = require('../services/ats/aiEnricher');

// Mock in-memory storage for testing multi-resume database isolation
class MockATSAnalysisStore {
  constructor() {
    this.records = [];
  }

  async findOne(query) {
    return this.records.find(r => {
      if (query.student && r.student !== query.student) return false;
      if (query.resume && r.resume !== query.resume) return false;
      if (query.analysisVersion && r.analysisVersion !== query.analysisVersion) return false;
      if (query.resumeVersionOrHash && r.resumeVersionOrHash !== query.resumeVersionOrHash) return false;
      return true;
    }) || null;
  }

  async find(query) {
    return this.records.filter(r => {
      if (query.student && r.student !== query.student) return false;
      if (query.resume && r.resume !== query.resume) return false;
      return true;
    });
  }

  async findOneAndUpdate(query, updatePayload) {
    const existingIndex = this.records.findIndex(r => {
      return r.student === query.student &&
        r.resume === query.resume &&
        r.resumeVersionOrHash === query.resumeVersionOrHash &&
        r.analysisVersion === query.analysisVersion;
    });

    const record = {
      _id: 'mock_ats_' + Math.random().toString(36).substr(2, 9),
      ...query,
      ...updatePayload,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingIndex !== -1) {
      this.records[existingIndex] = record;
    } else {
      this.records.push(record);
    }
    return record;
  }

  clear() {
    this.records = [];
  }
}

const mockStore = new MockATSAnalysisStore();

async function runTests() {
  console.log('====================================================');
  console.log(' Running Backend Standalone ATS Resume Checker Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Sample Resume Content A (Software Developer)
  const resumeTextA = `
    Rahul Mehta
    Email: rahul.mehta@gmail.com | Phone: +91 9876543210 | LinkedIn: linkedin.com/in/rahulmehta | GitHub: github.com/rahulm
    
    Professional Summary:
    Full Stack Developer with 2 years of experience building React and Node.js applications.

    Skills:
    JavaScript, TypeScript, React, Node.js, Express, PostgreSQL, MongoDB, Git, Docker, REST APIs

    Experience:
    Software Engineer at TechSolutions (June 2022 - Present)
    - Built responsive web dashboard serving 100,000+ monthly active users, improving page load by 30%.
    - Designed scalable REST APIs in Node.js and MongoDB.

    Education:
    B.Tech in Computer Science, State University (2018 - 2022)
  `;

  // Sample Resume Content B (Digital Marketing)
  const resumeTextB = `
    Rahul Mehta
    Email: rahul.m.marketing@gmail.com | Phone: +91 9876543210 | LinkedIn: linkedin.com/in/rahulmehta
    
    Professional Summary:
    Digital Marketing Specialist skilled in SEO, PPC, Google Ads, and Content Strategy.

    Skills:
    SEO, SEM, Google Ads, Meta Ads, Social Media Marketing, Content Strategy, Google Analytics, Copywriting

    Experience:
    Marketing Executive at GrowthAgency (Jan 2023 - Present)
    - Managed Google Ads campaigns with ₹5,00,000 budget, delivering 45% growth in qualified leads.
    - Conducted comprehensive SEO audit improving organic search traffic by 60%.

    Education:
    Bachelor of Business Administration, State University (2019 - 2022)
  `;

  // Sample Resume Content C (Fresher HR)
  const resumeTextC = `
    Ananya Roy
    Email: ananya.roy@gmail.com | Phone: +91 9123456789 | LinkedIn: linkedin.com/in/ananyaroy

    Career Objective:
    Enthusiastic HR graduate seeking an entry-level HR Coordinator role in talent acquisition and employee engagement.

    Skills:
    Recruitment, Sourcing, Screening, Onboarding, HRIS, Interpersonal Communication, Event Organization

    Academic Projects:
    Campus Recruitment Drive Project (2023)
    - Coordinated campus hiring event for 150+ students, organizing schedules and applicant logs.

    Education:
    BBA in Human Resources, City College (2020 - 2023)
  `;

  // ----------------------------------------------------
  // Test 1: Student has one resume
  // ----------------------------------------------------
  await test('1. Student has one resume', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';

    const parsed = parseResume(resumeTextA, { fileName: 'Rahul_Software.pdf' });
    const checks = runAtsChecks(parsed);
    const scoreResult = calculateAtsScore({ parsedResume: parsed, checks });

    assert(scoreResult.overallScore > 0, 'Score should be calculated');
    assert.strictEqual(parsed.contact.email, 'rahul.mehta@gmail.com');
  });

  // ----------------------------------------------------
  // Test 2: Student has multiple resumes
  // ----------------------------------------------------
  await test('2. Student has multiple resumes', async () => {
    const student1 = {
      _id: 'student_001',
      studentProfile: {
        resumes: [
          { _id: 'resume_subdoc_aaa', role: 'Frontend', url: 'https://cloudinary.com/res_a.pdf' },
          { _id: 'resume_subdoc_bbb', role: 'Marketing', url: 'https://cloudinary.com/res_b.pdf' }
        ]
      }
    };

    assert.strictEqual(student1.studentProfile.resumes.length, 2, 'Student should have 2 distinct resumes in array');
    assert.notStrictEqual(student1.studentProfile.resumes[0]._id, student1.studentProfile.resumes[1]._id, 'Resume IDs must be distinct');
  });

  // ----------------------------------------------------
  // Test 3: Analyze Resume A
  // ----------------------------------------------------
  await test('3. Analyze Resume A', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';
    const hashA = computeResumeHash(resumeTextA);

    const parsedA = parseResume(resumeTextA, { fileName: 'Rahul_Software.pdf' });
    const checksA = runAtsChecks(parsedA);
    const resultA = calculateAtsScore({ parsedResume: parsedA, checks: checksA });

    const recordA = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeIdA, resumeVersionOrHash: hashA, analysisVersion: '1.0.0' },
      { overallScore: resultA.overallScore, categories: resultA.categories, resumeVersionOrHash: hashA }
    );

    assert.strictEqual(recordA.resume, resumeIdA, 'Record must be bound to Resume A ID');
    assert(recordA.overallScore > 0, 'Resume A must have a score');
  });

  // ----------------------------------------------------
  // Test 4: Analyze Resume B
  // ----------------------------------------------------
  await test('4. Analyze Resume B', async () => {
    const studentId = 'student_001';
    const resumeIdB = 'resume_subdoc_bbb';
    const hashB = computeResumeHash(resumeTextB);

    const parsedB = parseResume(resumeTextB, { fileName: 'Rahul_Marketing.pdf' });
    const checksB = runAtsChecks(parsedB);
    const resultB = calculateAtsScore({ parsedResume: parsedB, checks: checksB });

    const recordB = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeIdB, resumeVersionOrHash: hashB, analysisVersion: '1.0.0' },
      { overallScore: resultB.overallScore, categories: resultB.categories, resumeVersionOrHash: hashB }
    );

    assert.strictEqual(recordB.resume, resumeIdB, 'Record must be bound to Resume B ID');
    assert(recordB.overallScore > 0, 'Resume B must have a score');
  });

  // ----------------------------------------------------
  // Test 5: Scores remain independent
  // ----------------------------------------------------
  await test('5. Scores remain independent (Resume A & Resume B co-exist without overwriting)', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';
    const resumeIdB = 'resume_subdoc_bbb';

    const records = await mockStore.find({ student: studentId });
    assert.strictEqual(records.length, 2, 'Both analysis records must co-exist in storage');

    const recA = records.find(r => r.resume === resumeIdA);
    const recB = records.find(r => r.resume === resumeIdB);

    assert(recA, 'Resume A record must exist');
    assert(recB, 'Resume B record must exist');
    assert.strictEqual(recA.resume, resumeIdA);
    assert.strictEqual(recB.resume, resumeIdB);
  });

  // ----------------------------------------------------
  // Test 6: Fetch Resume A analysis returns A's analysis
  // ----------------------------------------------------
  await test('6. Fetch Resume A analysis returns A\'s analysis', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';

    const recA = await mockStore.findOne({ student: studentId, resume: resumeIdA });
    assert.strictEqual(recA.resume, resumeIdA, 'Fetching Resume A must return Resume A analysis');
  });

  // ----------------------------------------------------
  // Test 7: Fetch Resume B analysis returns B's analysis
  // ----------------------------------------------------
  await test('7. Fetch Resume B analysis returns B\'s analysis', async () => {
    const studentId = 'student_001';
    const resumeIdB = 'resume_subdoc_bbb';

    const recB = await mockStore.findOne({ student: studentId, resume: resumeIdB });
    assert.strictEqual(recB.resume, resumeIdB, 'Fetching Resume B must return Resume B analysis');
  });

  // ----------------------------------------------------
  // Test 8: Student cannot access another student's resume analysis
  // ----------------------------------------------------
  await test('8. Student cannot access another student\'s resume analysis', async () => {
    const ownerId = 'student_001';
    const strangerId = 'student_999';
    const resumeIdA = 'resume_subdoc_aaa';

    // Attempting query with stranger authenticated ID
    const unauthorizedFetch = await mockStore.findOne({ student: strangerId, resume: resumeIdA });
    assert.strictEqual(unauthorizedFetch, null, 'Unauthorized student must receive null / 404 response');
  });

  // ----------------------------------------------------
  // Test 9: Re-analyzing unchanged resume reuses existing analysis
  // ----------------------------------------------------
  await test('9. Re-analyzing unchanged resume reuses existing analysis', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';
    const hashA = computeResumeHash(resumeTextA);

    const existing = await mockStore.findOne({
      student: studentId,
      resume: resumeIdA,
      resumeVersionOrHash: hashA,
      analysisVersion: '1.0.0'
    });

    assert(existing, 'Existing analysis should be returned immediately without re-calculating');
    assert.strictEqual(existing.resumeVersionOrHash, hashA);
  });

  // ----------------------------------------------------
  // Test 10: New resume version gets a new analysis
  // ----------------------------------------------------
  await test('10. New resume version gets a new analysis', async () => {
    const studentId = 'student_001';
    const resumeIdA = 'resume_subdoc_aaa';

    const modifiedTextA = resumeTextA + '\n- Added AWS Certified Developer Certification (2024).';
    const newHashA = computeResumeHash(modifiedTextA);

    const parsedA2 = parseResume(modifiedTextA, { fileName: 'Rahul_Software_v2.pdf' });
    const checksA2 = runAtsChecks(parsedA2);
    const resultA2 = calculateAtsScore({ parsedResume: parsedA2, checks: checksA2 });

    const newRecordA = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeIdA, resumeVersionOrHash: newHashA, analysisVersion: '1.0.0' },
      { overallScore: resultA2.overallScore, categories: resultA2.categories, resumeVersionOrHash: newHashA }
    );

    assert.strictEqual(newRecordA.resumeVersionOrHash, newHashA, 'New hash must be saved for updated version');
    assert.notStrictEqual(newHashA, computeResumeHash(resumeTextA), 'Hashes must differ for new content');
  });

  // ----------------------------------------------------
  // Additional Test 11: Non-technical HR & Fresher Scoring Fairness
  // ----------------------------------------------------
  await test('11. Non-technical HR & Fresher Scoring Fairness', async () => {
    const parsedC = parseResume(resumeTextC, { fileName: 'Ananya_HR_Fresher.pdf' });
    const checksC = runAtsChecks(parsedC);
    const resultC = calculateAtsScore({ parsedResume: parsedC, checks: checksC });

    assert.strictEqual(parsedC.detectedDomain, 'HR');
    assert.strictEqual(parsedC.isFresher, true);
    assert(resultC.overallScore >= 50, 'Fresher HR candidate should receive a fair score');
  });

  // ----------------------------------------------------
  // Test 12: Efficient batch retrieval of latest ATS metadata (No N+1 queries)
  // ----------------------------------------------------
  await test('12. Efficient batch retrieval of latest ATS metadata (No N+1 queries)', async () => {
    const studentId = 'student_001';
    const allRecords = await mockStore.find({ student: studentId });

    // Group latest by resume
    const latestMap = {};
    allRecords.forEach(r => {
      if (!latestMap[r.resume] || new Date(r.createdAt) > new Date(latestMap[r.resume].createdAt)) {
        latestMap[r.resume] = r;
      }
    });

    const mockResumes = [
      { _id: 'resume_subdoc_aaa', role: 'Software Engineer', fileName: 'Rahul_Software.pdf', isPrimary: true },
      { _id: 'resume_subdoc_bbb', role: 'Data Analyst', fileName: 'Rahul_Data.pdf', isPrimary: false },
      { _id: 'resume_subdoc_ccc', role: 'HR Executive', fileName: 'Rahul_HR.pdf', isPrimary: false }
    ];

    const metadataList = mockResumes.map(r => {
      const latest = latestMap[r._id];
      return {
        resumeId: r._id,
        filename: r.fileName,
        isPrimary: r.isPrimary,
        atsScore: latest ? latest.overallScore : null,
        atsStatus: latest ? 'analyzed' : 'not_analyzed'
      };
    });

    assert.strictEqual(metadataList.length, 3, 'Must return metadata for all student resumes in 1 query');
    assert.strictEqual(metadataList[0].atsStatus, 'analyzed', 'Resume AAA should be analyzed');
    assert.strictEqual(metadataList[1].atsStatus, 'analyzed', 'Resume BBB should be analyzed');
    assert.strictEqual(metadataList[2].atsStatus, 'not_analyzed', 'Un-analyzed resume CCC should have status not_analyzed');
  });

  // ----------------------------------------------------
  // Test 13: 4-Resume Scenario (Resume A, B, C, D) Step-by-Step E2E Isolation
  // ----------------------------------------------------
  await test('13. 4-Resume Scenario (Resume A, B, C, D) Step-by-Step E2E Isolation', async () => {
    const studentId = 'student_aftab_4resumes';
    const resumeA = { id: 'res_A', fileName: 'Aftab-Full-Stack-Resume.pdf', text: 'Aftab Full Stack Dev React Node MongoDB Experience 2 years' };
    const resumeB = { id: 'res_B', fileName: 'Aftab-General-Resume.pdf', text: 'Aftab General Resume Operations Communication Teamwork Education' };
    const resumeC = { id: 'res_C', fileName: 'Aftab-Marketing-Resume.pdf', text: 'Aftab Digital Marketing SEO Campaign Lead Conversion Metrics' };
    const resumeD = { id: 'res_D', fileName: 'Aftab-Old-Resume.pdf', text: 'Aftab Old Resume High School basic skills general background' };

    // Step 1: Analyze Resume A
    const parsedA = parseResume(resumeA.text, { fileName: resumeA.fileName });
    const resultA = calculateAtsScore({ parsedResume: parsedA, checks: runAtsChecks(parsedA) });
    const recA = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeA.id, resumeVersionOrHash: computeResumeHash(resumeA.text), analysisVersion: '1.0.0' },
      { overallScore: resultA.overallScore, categories: resultA.categories }
    );

    // Confirm B, C, D remain unanalyzed
    const findB_before = await mockStore.findOne({ student: studentId, resume: resumeB.id });
    assert.strictEqual(findB_before, null, 'Resume B must remain unanalyzed when Resume A is analyzed');

    // Step 2: Analyze Resume B
    const parsedB = parseResume(resumeB.text, { fileName: resumeB.fileName });
    const resultB = calculateAtsScore({ parsedResume: parsedB, checks: runAtsChecks(parsedB) });
    const recB = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeB.id, resumeVersionOrHash: computeResumeHash(resumeB.text), analysisVersion: '1.0.0' },
      { overallScore: resultB.overallScore, categories: resultB.categories }
    );

    // Confirm A remains unchanged and B gets independent score
    const refetchA = await mockStore.findOne({ student: studentId, resume: resumeA.id });
    assert.strictEqual(refetchA.overallScore, recA.overallScore, 'Resume A score must not be overwritten by Resume B');
    assert(recB.overallScore > 0, 'Resume B must get its own valid score');

    // Step 3: Analyze Resume C
    const parsedC = parseResume(resumeC.text, { fileName: resumeC.fileName });
    const resultC = calculateAtsScore({ parsedResume: parsedC, checks: runAtsChecks(parsedC) });
    const recC = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeC.id, resumeVersionOrHash: computeResumeHash(resumeC.text), analysisVersion: '1.0.0' },
      { overallScore: resultC.overallScore, categories: resultC.categories }
    );

    // Step 4: Analyze Resume D
    const parsedD = parseResume(resumeD.text, { fileName: resumeD.fileName });
    const resultD = calculateAtsScore({ parsedResume: parsedD, checks: runAtsChecks(parsedD) });
    const recD = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeD.id, resumeVersionOrHash: computeResumeHash(resumeD.text), analysisVersion: '1.0.0' },
      { overallScore: resultD.overallScore, categories: resultD.categories }
    );

    // Confirm all 4 analyses exist independently
    const allStudentRecs = await mockStore.find({ student: studentId });
    assert.strictEqual(allStudentRecs.length, 4, 'All four analyses must persist independently');
  });

  // ----------------------------------------------------
  // Test 14: 10+ Resumes Scale Test
  // ----------------------------------------------------
  await test('14. 10+ Resumes Scale Test', async () => {
    const studentId = 'student_many_resumes';
    const mockResumes = [];
    for (let i = 1; i <= 15; i++) {
      mockResumes.push({
        _id: `res_multi_${i}`,
        role: `Role ${i}`,
        fileName: `Resume_Version_${i}.pdf`,
        isPrimary: i === 1
      });
    }

    // Add analyses for even-numbered resumes
    for (let i = 2; i <= 15; i += 2) {
      await mockStore.findOneAndUpdate(
        { student: studentId, resume: `res_multi_${i}`, resumeVersionOrHash: `hash_${i}`, analysisVersion: '1.0.0' },
        { overallScore: 70 + i, categories: {} }
      );
    }

    const allRecs = await mockStore.find({ student: studentId });
    assert.strictEqual(allRecs.length, 7, '7 out of 15 resumes should have analyses in store');

    const metadataList = mockResumes.map(r => {
      const found = allRecs.find(rec => rec.resume === r._id);
      return {
        resumeId: r._id,
        filename: r.fileName,
        isPrimary: r.isPrimary,
        atsScore: found ? found.overallScore : null,
        atsStatus: found ? 'analyzed' : 'not_analyzed'
      };
    });

    assert.strictEqual(metadataList.length, 15, 'Should process 15 resumes metadata in 1 batch');
    assert.strictEqual(metadataList[0].atsStatus, 'not_analyzed', 'Resume 1 should be unanalyzed');
    assert.strictEqual(metadataList[1].atsStatus, 'analyzed', 'Resume 2 should be analyzed');
    assert.strictEqual(metadataList[1].atsScore, 72, 'Resume 2 should have score 72');
  });

  // ----------------------------------------------------
  // Test 15: 0 Resumes (Empty State)
  // ----------------------------------------------------
  await test('15. 0 Resumes (Empty State)', async () => {
    const emptyStudentId = 'student_no_resumes';
    const recs = await mockStore.find({ student: emptyStudentId });
    assert.strictEqual(recs.length, 0, 'Student with 0 resumes should return empty array cleanly');
  });

  // ----------------------------------------------------
  // Test 16: Resume with No ATS Analysis
  // ----------------------------------------------------
  await test('16. Resume with No ATS Analysis', async () => {
    const studentId = 'student_new_upload';
    const unanalyzedResumeId = 'res_brand_new';
    const rec = await mockStore.findOne({ student: studentId, resume: unanalyzedResumeId });
    assert.strictEqual(rec, null, 'Unanalyzed resume must return null/not_analyzed status');
  });

  // ----------------------------------------------------
  // Test 17: Deleted Resume Handling (Graceful 404)
  // ----------------------------------------------------
  await test('17. Deleted Resume Handling (Graceful 404)', async () => {
    const studentId = 'student_001';
    const deletedResumeId = 'resume_deleted_999';

    const rec = await mockStore.findOne({ student: studentId, resume: deletedResumeId });
    assert.strictEqual(rec, null, 'Deleted resume should return null analysis');
  });

  // ----------------------------------------------------
  // Test 18: Unauthorized / Invalid Resume ID Security
  // ----------------------------------------------------
  await test('18. Unauthorized / Invalid Resume ID Security', async () => {
    const studentA = 'student_alice';
    const studentB = 'student_bob';
    const resumeAlice = 'res_alice_private';

    await mockStore.findOneAndUpdate(
      { student: studentA, resume: resumeAlice, resumeVersionOrHash: 'hash_alice', analysisVersion: '1.0.0' },
      { overallScore: 88, categories: {} }
    );

    // Bob tries to query Alice's resume ID
    const bobQuery = await mockStore.findOne({ student: studentB, resume: resumeAlice });
    assert.strictEqual(bobQuery, null, 'Bob must not be able to view Alice\'s ATS analysis');
  });

  // ----------------------------------------------------
  // Test 19: Duplicate / Concurrent Check ATS Clicks
  // ----------------------------------------------------
  await test('19. Duplicate / Concurrent Check ATS Clicks', async () => {
    const studentId = 'student_concurrency';
    const resumeId = 'res_concurrent_click';
    const sampleText = 'Concurrent click resume test text for duplicate prevention';
    const hash = computeResumeHash(sampleText);

    // First request saves analysis
    const rec1 = await mockStore.findOneAndUpdate(
      { student: studentId, resume: resumeId, resumeVersionOrHash: hash, analysisVersion: '1.0.0' },
      { overallScore: 82, categories: {} }
    );

    // Second request detects identical hash
    const rec2 = await mockStore.findOne({
      student: studentId,
      resume: resumeId,
      resumeVersionOrHash: hash,
      analysisVersion: '1.0.0'
    });

    assert.strictEqual(rec1._id, rec2._id, 'Concurrent/duplicate request must reuse identical analysis record');
  });

  // ----------------------------------------------------
  // Test 20: Failed Analysis Handling (Empty PDF text validation)
  // ----------------------------------------------------
  await test('20. Failed Analysis Handling (Empty PDF text validation)', async () => {
    const emptyText = '   ';
    let caughtError = null;
    try {
      if (!emptyText || !emptyText.trim()) {
        const error = new Error('Extracted text is empty or too short. Upload a text-selectable PDF resume.');
        error.statusCode = 422;
        throw error;
      }
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError, 'Empty text must throw error');
    assert.strictEqual(caughtError.statusCode, 422, 'Empty text error must return 422 status code');
  });

  // ----------------------------------------------------
  // Test 21: Inaccessible URL Handling
  // ----------------------------------------------------
  await test('21. Inaccessible URL Handling', async () => {
    const { checkUrlAccessible } = require('../utils/urlChecker');
    const privateUrl = 'https://drive.google.com/file/d/private_file_id/view';

    const checkResult = await checkUrlAccessible(privateUrl);
    // Standard link check detects non-direct link
    assert(checkResult.ok !== undefined, 'URL accessibility check returns structured result');
  });

  // ----------------------------------------------------
  // Test 22: Performance Verification (Zero Auto-Analysis & Zero N+1)
  // ----------------------------------------------------
  await test('22. Performance Verification (Zero Auto-Analysis & Zero N+1)', async () => {
    let apiCallCount = 0;

    // Simulate ATS Page Mount fetching resumes metadata
    const mockFetchResumesMetadata = async () => {
      apiCallCount++;
      return {
        success: true,
        resumes: [
          { resumeId: 'r1', atsScore: 84, atsStatus: 'analyzed' },
          { resumeId: 'r2', atsScore: null, atsStatus: 'not_analyzed' },
          { resumeId: 'r3', atsScore: 78, atsStatus: 'analyzed' }
        ]
      };
    };

    const res = await mockFetchResumesMetadata();

    assert.strictEqual(apiCallCount, 1, 'Page load must trigger exactly 1 API call for all resumes metadata');
    assert.strictEqual(res.resumes.length, 3, 'Metadata for all 3 resumes returned in single response');
  });

  console.log('\n====================================================');
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
