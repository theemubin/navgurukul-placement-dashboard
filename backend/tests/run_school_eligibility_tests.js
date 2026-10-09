const assert = require('assert');
const {
  normalizeSchoolName,
  studentSchoolMatches,
  getSchoolQueryValues
} = require('../utils/schoolEligibility');
const { calculateEligibilityMatch } = require('../services/matchService');

function student(school) {
  return { studentProfile: { currentSchool: school } };
}

function jobForSchools(schools) {
  return { eligibility: { schools } };
}

function run() {
  assert.strictEqual(
    normalizeSchoolName('Bachelor of Computer Application 24-27'),
    'Bachelor of Computer Application'
  );
  assert.strictEqual(
    normalizeSchoolName('Bachelor of Computer Application 25–28'),
    'Bachelor of Computer Application'
  );
  assert.strictEqual(
    normalizeSchoolName('Bachelor of Computer Application 26-29'),
    'Bachelor of Computer Application'
  );

  const bcaBatches = [
    'Bachelor of Computer Application 24-27',
    'Bachelor of Computer Application 25-28',
    'Bachelor of Computer Application 26-29'
  ];

  for (const batch of bcaBatches) {
    assert.strictEqual(
      studentSchoolMatches(batch, ['School of Programming']),
      true,
      `${batch} should be eligible for School of Programming`
    );
    assert.strictEqual(
      calculateEligibilityMatch(student(batch), jobForSchools(['School of Programming'])).details.school.meets,
      true,
      `matchService should treat ${batch} as SoP-eligible`
    );
  }

  assert.strictEqual(
    studentSchoolMatches('School of Programming', ['School of Programming']),
    true
  );
  assert.strictEqual(
    studentSchoolMatches('School of Business', ['School of Programming']),
    false,
    'other schools must not inherit SoP eligibility'
  );
  assert.strictEqual(
    calculateEligibilityMatch(
      student('School of Business'),
      jobForSchools(['School of Programming'])
    ).details.school.meets,
    false
  );

  assert.strictEqual(
    studentSchoolMatches('Bachelor of Computer Application 24-27', ['School of Business']),
    false,
    'BCA batches must not match unrelated school jobs'
  );

  assert.strictEqual(
    studentSchoolMatches('Bachelor of Computer Application 24-27', []),
    true,
    'empty school list means all schools'
  );

  const campusJob = {
    eligibility: {
      schools: ['School of Programming'],
      campuses: ['campus-a']
    }
  };
  const campusStudent = {
    campus: 'campus-b',
    studentProfile: { currentSchool: 'Bachelor of Computer Application 25-28' }
  };
  const campusDetails = calculateEligibilityMatch(campusStudent, campusJob).details;
  assert.strictEqual(campusDetails.school.meets, true);
  assert.strictEqual(campusDetails.campus.meets, false, 'campus eligibility must still be enforced');

  const queryValues = getSchoolQueryValues('Bachelor of Computer Application 24-27');
  assert.ok(queryValues.includes('School of Programming'));
  assert.ok(queryValues.includes('Bachelor of Computer Application'));

  console.log('All school eligibility tests passed.');
}

run();
