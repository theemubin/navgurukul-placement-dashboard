/**
 * Focused tests for post-placement document calculation logic.
 */

const assert = require('assert');
const {
  buildRequiredDocuments,
  buildDocumentCompletion,
  buildDocumentKey,
  DOCUMENT_TYPES
} = require('../utils/postPlacement');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(`   ${error.message}`);
    process.exitCode = 1;
  }
}

console.log('Running post-placement tracking tests...');

runTest('Full-time placement generates offer letter plus three salary slips', () => {
  const placement = {
    employmentType: 'Full-Time Placement',
    joiningDate: new Date('2026-09-01T00:00:00.000Z')
  };

  const required = buildRequiredDocuments(placement);
  assert.strictEqual(required.length, 4);
  assert.strictEqual(required[0].documentType, DOCUMENT_TYPES.OFFER_LETTER);
  assert.strictEqual(required[0].dueDate.toISOString(), '2026-09-16T00:00:00.000Z');
  assert.strictEqual(required[1].documentKey, `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:2026-09`);
  assert.strictEqual(required[1].dueDate.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.strictEqual(required[2].documentKey, `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:2026-10`);
  assert.strictEqual(required[2].dueDate.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.strictEqual(required[3].documentKey, `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:2026-11`);
  assert.strictEqual(required[3].dueDate.toISOString(), '2026-12-01T00:00:00.000Z');
});

runTest('Internship requires only an offer letter', () => {
  const placement = {
    employmentType: 'Internship',
    hasFullTimeConversion: true,
    fullTimeConversionDate: new Date('2026-09-01T00:00:00.000Z')
  };

  const required = buildRequiredDocuments(placement);
  assert.strictEqual(required.length, 1);
  assert.strictEqual(required[0].documentType, DOCUMENT_TYPES.OFFER_LETTER);
  assert.strictEqual(required[0].dueDate, null);
});

runTest('Paid internship requires an offer letter and three stipend slips', () => {
  const placement = {
    employmentType: 'Paid Internship',
    internshipStartDate: new Date('2026-06-01T00:00:00.000Z'),
    internshipEndDate: new Date('2026-12-31T00:00:00.000Z')
  };

  const required = buildRequiredDocuments(placement);
  assert.strictEqual(required.length, 4);
  assert.strictEqual(required[0].documentType, DOCUMENT_TYPES.OFFER_LETTER);
  assert.strictEqual(required[0].dueDate.toISOString(), '2026-06-16T00:00:00.000Z');
  assert.strictEqual(required[1].documentKey, `${DOCUMENT_TYPES.INTERNSHIP_STIPEND_SLIP}:2026-06`);
  assert.strictEqual(required[2].documentKey, `${DOCUMENT_TYPES.INTERNSHIP_STIPEND_SLIP}:2026-07`);
  assert.strictEqual(required[3].documentKey, `${DOCUMENT_TYPES.INTERNSHIP_STIPEND_SLIP}:2026-08`);
});

runTest('Document completion uses uploaded and verified items', () => {
  const placement = {
    employmentType: 'Full-Time Placement',
    joiningDate: new Date('2026-09-01T00:00:00.000Z')
  };

  const documents = [
    { documentKey: DOCUMENT_TYPES.OFFER_LETTER, verificationStatus: 'Uploaded' },
    { documentKey: `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:2026-09`, verificationStatus: 'Verified' }
  ];

  const summary = buildDocumentCompletion(placement, documents);
  assert.strictEqual(summary.completion.completed, 2);
  assert.strictEqual(summary.completion.total, 4);
  assert.strictEqual(summary.requiredDocuments[0].status, 'Uploaded');
  assert.strictEqual(summary.requiredDocuments[1].status, 'Verified');
});

runTest('Offer letter document key is stable and period-based slips require a period key', () => {
  assert.strictEqual(buildDocumentKey({ documentType: DOCUMENT_TYPES.OFFER_LETTER }), DOCUMENT_TYPES.OFFER_LETTER);
  assert.strictEqual(buildDocumentKey({ documentType: DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP, periodKey: '2026-09' }), `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:2026-09`);
  assert.strictEqual(buildDocumentKey({ documentType: DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP }), '');
});
