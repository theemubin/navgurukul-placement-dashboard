/**
 * Match Calculation Service
 * Calculates compatibility between a student's profile and job requirements
 */

// Module hierarchy for School of Programming (order matters for comparison)
const MODULE_HIERARCHY = [
  'Foundation',
  'Basics of Programming',
  'DSA',
  'Backend',
  'Full Stack',
  'Interview Prep'
];

// Proficiency level labels
const PROFICIENCY_LABELS = ['None', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

/**
 * Calculate overall match percentage between student and job
 * @param {Object} student - Student user object with studentProfile
 * @param {Object} job - Job object with eligibility and requirements
 * @returns {Object} Match details with percentage and breakdown
 */
function calculateMatch(student, job) {
  const breakdown = {
    skills: calculateSkillMatch(student, job),
    eligibility: calculateEligibilityMatch(student, job),
    requirements: calculateRequirementsMatch(student, job)
  };

  // Weighted calculation: Skills 40%, Eligibility 40%, Requirements 20%
  const weights = {
    skills: 0.4,
    eligibility: 0.4,
    requirements: 0.2
  };

  // If any mandatory eligibility fails, cap at 59%
  const eligibilityAllPassed = Object.values(breakdown.eligibility.details)
    .every(detail => !detail.required || detail.meets);

  let overallPercentage =
    (breakdown.skills.percentage * weights.skills) +
    (breakdown.eligibility.percentage * weights.eligibility) +
    (breakdown.requirements.percentage * weights.requirements);

  // Cap at 59% if mandatory eligibility not met
  if (!eligibilityAllPassed) {
    overallPercentage = Math.min(overallPercentage, 59);
  }

  return {
    overallPercentage: Math.round(overallPercentage),
    canApply: overallPercentage >= 60,
    breakdown,
    summary: generateSummary(breakdown, overallPercentage)
  };
}

/**
 * Calculate skill match between student and job
 */
function calculateSkillMatch(student, job) {
  const requiredSkills = job.requiredSkills || [];
  if (requiredSkills.length === 0) {
    return { matched: 0, required: 0, percentage: 100, details: [] };
  }

  const studentSkills = student.studentProfile?.technicalSkills || [];
  const studentSoftSkills = student.studentProfile?.softSkills || {};

  // Create map of student skills by name (case-insensitive) and by skill ID
  const studentSkillByName = new Map();
  const studentSkillById = new Map();

  // Add technical skills
  studentSkills.forEach(s => {
    const skillNameLower = (s.skillName || '').toLowerCase();
    const skillId = s.skillId?.toString() || '';

    if (skillNameLower) {
      studentSkillByName.set(skillNameLower, s.selfRating || 0);
    }
    if (skillId) {
      studentSkillById.set(skillId, s.selfRating || 0);
    }
  });

  // Add soft skills (from softSkills object)
  // Soft skills are stored as: { communication: 3, collaboration: 2, ... }
  Object.entries(studentSoftSkills).forEach(([skillKey, level]) => {
    if (skillKey && typeof level === 'number') {
      studentSkillByName.set(skillKey.toLowerCase(), level);
    }
  });

  // Also check legacy skills (approved ones) - populate the maps
  const approvedSkills = (student.studentProfile?.skills || [])
    .filter(s => s.status === 'approved')
    .map(s => s.skill);

  approvedSkills.forEach(skill => {
    if (skill) {
      const skillId = skill._id?.toString() || skill.toString();
      const skillName = skill.name?.toLowerCase() || '';

      // Only set to 1 if not already in map (self-rated skills take precedence)
      if (skillId && !studentSkillById.has(skillId)) {
        studentSkillById.set(skillId, 1); // Has the skill, assume beginner
      }
      if (skillName && !studentSkillByName.has(skillName)) {
        studentSkillByName.set(skillName, 1);
      }
    }
  });

  let matchedCount = 0;
  let totalWeight = 0;
  let matchedWeight = 0;
  const details = [];

  for (const reqSkill of requiredSkills) {
    const skillId = reqSkill.skill?._id?.toString() || reqSkill.skill?.toString();
    const skillName = (reqSkill.skill?.name || '').toLowerCase();
    const requiredLevel = reqSkill.proficiencyLevel || 1;
    const weight = reqSkill.required ? 2 : 1; // Required skills have double weight
    totalWeight += weight;

    // Check if student has this skill - try ID first (most reliable), then name
    let studentLevel = 0;

    if (skillId) {
      studentLevel = studentSkillById.get(skillId) || 0;
    }

    // If not found by ID, try by name
    if (studentLevel === 0 && skillName) {
      studentLevel = studentSkillByName.get(skillName) || 0;
    }

    const meets = studentLevel >= requiredLevel;
    if (meets) {
      matchedCount++;
      matchedWeight += weight;
    }

    details.push({
      skillId,
      skillName: reqSkill.skill?.name || 'Unknown',
      required: reqSkill.required,
      requiredLevel,
      requiredLevelLabel: PROFICIENCY_LABELS[requiredLevel],
      studentLevel,
      studentLevelLabel: PROFICIENCY_LABELS[studentLevel] || 'None',
      meets,
      gap: meets ? 0 : requiredLevel - studentLevel
    });
  }

  return {
    matched: matchedCount,
    required: requiredSkills.length,
    percentage: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 100,
    details
  };
}

/**
 * Calculate eligibility match
 */
function calculateEligibilityMatch(student, job) {
  const profile = student.studentProfile || {};
  const eligibility = job.eligibility || {};
  const details = {};
  let passedCount = 0;
  let totalRequired = 0;

  // 10th Grade
  if (eligibility.tenthGrade?.required) {
    totalRequired++;
    const studentPct = profile.tenthGrade?.percentage || 0;
    const minPct = eligibility.tenthGrade.minPercentage || 0;
    const meets = studentPct >= minPct;
    if (meets) passedCount++;
    details.tenthGrade = {
      required: true,
      meets,
      studentValue: studentPct,
      jobRequirement: minPct,
      message: meets
        ? `10th: ${studentPct}% (meets ${minPct}% requirement)`
        : `10th: ${studentPct}% (requires ${minPct}%)`
    };
  } else {
    details.tenthGrade = { required: false, meets: true };
  }

  // 12th Grade
  if (eligibility.twelfthGrade?.required) {
    totalRequired++;
    const studentPct = profile.twelfthGrade?.percentage || 0;
    const minPct = eligibility.twelfthGrade.minPercentage || 0;
    const meets = studentPct >= minPct;
    if (meets) passedCount++;
    details.twelfthGrade = {
      required: true,
      meets,
      studentValue: studentPct,
      jobRequirement: minPct,
      message: meets
        ? `12th: ${studentPct}% (meets ${minPct}% requirement)`
        : `12th: ${studentPct}% (requires ${minPct}%)`
    };
  } else {
    details.twelfthGrade = { required: false, meets: true };
  }

  // Higher Education
  if (eligibility.higherEducation?.required) {
    totalRequired++;
    const acceptedDegrees = eligibility.higherEducation.acceptedDegrees || [];
    const studentDegrees = (profile.higherEducation || []).map(h => h.degree?.toLowerCase());

    let meets = false;
    if (acceptedDegrees.includes('Any Graduate') && studentDegrees.length > 0) {
      meets = true;
    } else {
      meets = acceptedDegrees.some(deg =>
        studentDegrees.some(sd => sd?.includes(deg.toLowerCase()))
      );
    }

    if (meets) passedCount++;
    details.higherEducation = {
      required: true,
      meets,
      studentValue: studentDegrees.join(', ') || 'None',
      jobRequirement: acceptedDegrees.join(', '),
      message: meets
        ? `Education: Matches requirement`
        : `Education: Requires ${acceptedDegrees.join('/')}`
    };
  } else {
    details.higherEducation = { required: false, meets: true };
  }

  // School
  const requiredSchools = eligibility.schools || [];
  if (requiredSchools.length > 0) {
    totalRequired++;
    const studentSchool = (profile.currentSchool || '').trim();
    // Normalize for comparison
    const normalizedStudentSchool = studentSchool.toLowerCase();
    const normalizedRequiredSchools = requiredSchools.map(s => (s || '').trim().toLowerCase());

    const meets = normalizedRequiredSchools.includes(normalizedStudentSchool);
    if (meets) passedCount++;
    details.school = {
      required: true,
      meets,
      studentValue: studentSchool || 'Not specified',
      jobRequirement: requiredSchools.join(', '),
      message: meets
        ? `School: ${studentSchool} (eligible)`
        : `School: Requires ${requiredSchools.join('/')}`
    };
  } else {
    details.school = { required: false, meets: true };
  }

  // Campus
  const requiredCampuses = eligibility.campuses || [];
  if (requiredCampuses.length > 0) {
    totalRequired++;
    const studentCampus = student.campus?.toString() || '';
    const meets = requiredCampuses.some(c => c?.toString() === studentCampus);
    if (meets) passedCount++;
    details.campus = {
      required: true,
      meets,
      studentValue: studentCampus,
      jobRequirement: `${requiredCampuses.length} campuses`,
      message: meets
        ? `Campus: Eligible`
        : `Campus: Not in eligible list`
    };
  } else {
    details.campus = { required: false, meets: true };
  }

  // Module (for School of Programming)
  if (eligibility.minModule) {
    totalRequired++;
    const studentModule = profile.currentModule || '';
    const studentModuleIndex = MODULE_HIERARCHY.indexOf(studentModule);
    const requiredModuleIndex = MODULE_HIERARCHY.indexOf(eligibility.minModule);
    const meets = studentModuleIndex >= requiredModuleIndex;
    if (meets) passedCount++;
    details.module = {
      required: true,
      meets,
      studentValue: studentModule || 'Not specified',
      jobRequirement: eligibility.minModule,
      message: meets
        ? `Module: ${studentModule} (meets ${eligibility.minModule} requirement)`
        : `Module: Requires ${eligibility.minModule} or higher`
    };
  } else {
    details.module = { required: false, meets: true };
  }

  // Legacy CGPA
  if (eligibility.minCgpa) {
    totalRequired++;
    // Check if student has any CGPA equivalent
    const avgPct = ((profile.tenthGrade?.percentage || 0) + (profile.twelfthGrade?.percentage || 0)) / 2;
    const estimatedCgpa = avgPct / 10; // Rough conversion
    const meets = estimatedCgpa >= eligibility.minCgpa;
    if (meets) passedCount++;
    details.cgpa = {
      required: true,
      meets,
      studentValue: estimatedCgpa.toFixed(1),
      jobRequirement: eligibility.minCgpa,
      message: meets
        ? `CGPA: Meets requirement`
        : `CGPA: Requires ${eligibility.minCgpa}`
    };
  } else {
    details.cgpa = { required: false, meets: true };
  }

  // Gender (Female-only jobs)
  if (eligibility.femaleOnly) {
    totalRequired++;
    const studentGender = student.gender || '';
    const meets = studentGender === 'female';
    if (meets) passedCount++;
    details.gender = {
      required: true,
      meets,
      studentValue: studentGender || 'Not specified',
      jobRequirement: 'Female only',
      message: meets
        ? `Gender: Eligible (Female-only job)`
        : `Gender: This job is for female candidates only`
    };
  } else {
    details.gender = { required: false, meets: true };
  }

  // Minimum Attendance
  if (eligibility.minAttendance) {
    totalRequired++;
    const studentAttendance = profile.attendancePercentage || 0;
    const meets = studentAttendance >= eligibility.minAttendance;
    if (meets) passedCount++;
    details.attendance = {
      required: true,
      meets,
      studentValue: studentAttendance,
      jobRequirement: eligibility.minAttendance,
      message: meets
        ? `Attendance: ${studentAttendance}% (meets ${eligibility.minAttendance}% requirement)`
        : `Attendance: ${studentAttendance}% (requires ${eligibility.minAttendance}%)`
    };
  } else {
    details.attendance = { required: false, meets: true };
  }

  // Minimum Months at Navgurukul
  if (eligibility.minMonthsAtNavgurukul) {
    totalRequired++;
    const joiningDate = profile.dateOfJoining || profile.joiningDate;
    let monthsAtNavgurukul = 0;

    if (joiningDate) {
      const joinDate = new Date(joiningDate);
      const now = new Date();
      monthsAtNavgurukul = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24 * 30));
    }

    const meets = monthsAtNavgurukul >= eligibility.minMonthsAtNavgurukul;
    if (meets) passedCount++;
    details.monthsAtNavgurukul = {
      required: true,
      meets,
      studentValue: monthsAtNavgurukul,
      jobRequirement: eligibility.minMonthsAtNavgurukul,
      message: meets
        ? `Time at Navgurukul: ${monthsAtNavgurukul} months (meets ${eligibility.minMonthsAtNavgurukul} months requirement)`
        : `Time at Navgurukul: ${monthsAtNavgurukul} months (requires ${eligibility.minMonthsAtNavgurukul} months)`
    };
  } else {
    details.monthsAtNavgurukul = { required: false, meets: true };
  }

  return {
    passed: passedCount,
    total: totalRequired,
    percentage: totalRequired > 0 ? Math.round((passedCount / totalRequired) * 100) : 100,
    details
  };
}

/**
 * Calculate custom requirements match
 * Note: This is based on what student has acknowledged/selected
 */
function calculateRequirementsMatch(student, job, studentResponses = {}) {
  const customReqs = job.customRequirements || [];
  if (customReqs.length === 0) {
    return { met: 0, total: 0, percentage: 100, details: [] };
  }

  let metCount = 0;
  const details = [];

  for (let i = 0; i < customReqs.length; i++) {
    const req = customReqs[i];
    const studentResponse = studentResponses[i] || false;
    const meets = studentResponse === true;

    if (meets || !req.isMandatory) {
      metCount++;
    }

    details.push({
      requirement: req.requirement,
      isMandatory: req.isMandatory,
      studentResponse,
      meets
    });
  }

  return {
    met: metCount,
    total: customReqs.length,
    percentage: customReqs.length > 0 ? Math.round((metCount / customReqs.length) * 100) : 100,
    details
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(breakdown, overallPercentage) {
  const messages = [];

  // Skills summary - show specific missing skills
  if (breakdown.skills.required > 0) {
    if (breakdown.skills.matched === breakdown.skills.required) {
      messages.push(`✅ All ${breakdown.skills.required} required skills matched`);
    } else {
      const missingSkills = breakdown.skills.details
        .filter(s => !s.meets)
        .map(s => `${s.skillName} (need ${s.requiredLevelLabel})`)
        .slice(0, 3); // Show up to 3

      const missing = breakdown.skills.required - breakdown.skills.matched;
      if (missingSkills.length > 0) {
        messages.push(`⚠️ ${missing} skill${missing > 1 ? 's' : ''} need improvement: ${missingSkills.join(', ')}${breakdown.skills.details.filter(s => !s.meets).length > 3 ? '...' : ''}`);
      } else {
        messages.push(`⚠️ ${missing} of ${breakdown.skills.required} skills need improvement`);
      }
    }
  }

  // Eligibility summary
  const failedEligibility = Object.entries(breakdown.eligibility.details)
    .filter(([_, detail]) => detail.required && !detail.meets)
    .map(([key, detail]) => detail.message);

  if (failedEligibility.length > 0) {
    messages.push(`❌ Eligibility gaps: ${failedEligibility.join('; ')}`);
  } else if (breakdown.eligibility.total > 0) {
    messages.push(`✅ All eligibility criteria met`);
  }

  // Overall status
  if (overallPercentage >= 80) {
    messages.unshift('🎯 Excellent match!');
  } else if (overallPercentage >= 60) {
    messages.unshift('👍 Good match');
  } else {
    messages.unshift('💡 Some requirements not met - Consider showing interest');
  }

  return messages;
}

/**
 * Get all jobs with match percentage for a student
 */
async function getJobsWithMatch(student, jobs) {
  return jobs.map(job => ({
    ...job.toObject ? job.toObject() : job,
    matchDetails: calculateMatch(student, job)
  }));
}

module.exports = {
  calculateMatch,
  calculateSkillMatch,
  calculateEligibilityMatch,
  calculateRequirementsMatch,
  getJobsWithMatch,
  MODULE_HIERARCHY,
  PROFICIENCY_LABELS
};
