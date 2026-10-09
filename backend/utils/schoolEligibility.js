/**
 * School hierarchy helpers for job eligibility.
 *
 * Batch/year suffixes (e.g. "24-27") are stripped so child programs can map to a
 * parent school in configuration — eligibility logic never hardcodes batch names.
 */

const DEFAULT_SCHOOL_PARENTS = {
  'Bachelor of Computer Application': 'School of Programming'
};

function normalizeSchoolName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim().replace(/\s+/g, ' ');
  // Strip trailing numeric ranges or years: " 24-27", " 25–28", " - 25"
  s = s.replace(/\s*[-–—:]?\s*\d+(\s*[-–—]\s*\d+)?\s*$/u, '').trim();
  s = s.replace(/[-–—:\s]+$/u, '').trim();
  return s;
}

function normalizeKey(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function toParentLookup(parentMap) {
  const lookup = {};
  for (const [child, parent] of Object.entries(DEFAULT_SCHOOL_PARENTS)) {
    if (child && parent) lookup[normalizeKey(child)] = parent;
  }

  const entries = parentMap instanceof Map
    ? parentMap.entries()
    : Object.entries(parentMap || {});

  for (const [child, parent] of entries) {
    if (child && parent) lookup[normalizeKey(child)] = parent;
  }

  return lookup;
}

function collectSchoolChain(school, parentMap) {
  const names = [];
  const seen = new Set();
  const lookup = toParentLookup(parentMap);

  const add = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  const raw = (school || '').trim();
  add(raw);
  const normalized = normalizeSchoolName(raw);
  add(normalized);

  let current = normalized || raw;
  while (current) {
    const parent = lookup[normalizeKey(current)] || lookup[normalizeKey(normalizeSchoolName(current))];
    if (!parent) break;
    add(parent);
    current = parent;
  }

  return names;
}

function studentSchoolMatches(studentSchool, requiredSchools, parentMap) {
  if (!Array.isArray(requiredSchools) || requiredSchools.length === 0) return true;

  const studentKeys = new Set(collectSchoolChain(studentSchool, parentMap).map(normalizeKey));

  return requiredSchools.some((required) => {
    if (!required) return false;
    const requiredKey = normalizeKey(required);
    const requiredNormalized = normalizeKey(normalizeSchoolName(required));
    return studentKeys.has(requiredKey) || (requiredNormalized && studentKeys.has(requiredNormalized));
  });
}

function getSchoolQueryValues(school, parentMap) {
  return collectSchoolChain(school, parentMap);
}

module.exports = {
  DEFAULT_SCHOOL_PARENTS,
  normalizeSchoolName,
  studentSchoolMatches,
  getSchoolQueryValues,
  collectSchoolChain
};
