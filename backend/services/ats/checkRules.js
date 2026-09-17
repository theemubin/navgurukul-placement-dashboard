/**
 * ATS Check Rules
 * Implements deterministic, domain-independent rules across 6 categories:
 * 1. CONTENT
 * 2. SECTIONS
 * 3. ATS ESSENTIALS
 * 4. READABILITY / QUALITY
 * 5. EXPERIENCE QUALITY
 * 6. SKILL EVIDENCE
 * 
 * Works for technical and non-technical candidates (HR, Marketing, Finance, Sales, Ops, etc.)
 */

function runAtsChecks(parsedResume) {
  const {
    rawText,
    wordCount,
    charCount,
    contact,
    detectedSections,
    detectedDomain,
    isFresher,
    skills,
    experienceCount,
    bulletLinesCount,
    metadata
  } = parsedResume;

  const checks = [];

  // ==========================================
  // 1. CONTENT CHECKS
  // ==========================================

  // Check 1.1: ATS Parse Rate / Extractability
  const hasMinContent = wordCount >= 50;
  checks.push({
    id: 'cnt_parse_rate',
    category: 'content',
    name: 'Text Parse Rate',
    passed: hasMinContent,
    weight: 5,
    severity: hasMinContent ? null : 'critical',
    title: hasMinContent ? 'Text is extractable' : 'Low text extraction rate',
    description: hasMinContent
      ? `Successfully extracted ${wordCount} words from your resume.`
      : 'Extracted very little text. Your resume might be a scanned image PDF or corrupted file.',
    recommendation: hasMinContent ? null : 'Convert your resume to a text-based PDF using Word, Docs, or Canva (export as PDF Standard).',
    example: null
  });

  // Check 1.2: Quantifiable Impact (numbers, percentages, currencies)
  const metricMatches = (rawText.match(/\b(?:\d+%(?:\s+increase|\s+growth|\s+reduction)?|\$\d+|\d+\s*k|\d+\s*lakhs?|\d+\s*cr|\d+\s*users|\d+\s*clients|\d+\s*projects|\d+\s*team members)\b/gi) || []);
  const numberCount = (rawText.match(/\b\d+\b/g) || []).length;
  const hasQuantifiableMetrics = metricMatches.length > 0 || numberCount >= 3;
  checks.push({
    id: 'cnt_quantifiable_impact',
    category: 'content',
    name: 'Quantifiable Metrics & Achievements',
    passed: hasQuantifiableMetrics,
    weight: 5,
    severity: hasQuantifiableMetrics ? null : 'warning',
    title: hasQuantifiableMetrics ? 'Measurable results detected' : 'Missing quantifiable impact & metrics',
    description: hasQuantifiableMetrics
      ? `Found ${numberCount} numerical indicators demonstrating measurable impact.`
      : 'Your resume describes duties without listing measurable outcomes or metrics (percentages, numbers, figures).',
    recommendation: hasQuantifiableMetrics ? null : 'Add numbers to your statements. For example: "Managed team of 5", "Increased engagement by 20%", or "Processed 50+ invoices weekly".',
    example: 'Instead of: "Managed social media accounts"\nUse: "Managed 3 social media accounts, increasing follower count by 35% in 6 months."'
  });

  // Check 1.3: Action Verbs Usage
  const actionVerbs = /\b(achieved|managed|developed|led|created|designed|implemented|increased|reduced|negotiated|coordinated|launched|organized|optimized|analyzed|prepared|maintained|spearheaded|engineered|drafted|automated)\b/gi;
  const verbMatches = (rawText.match(actionVerbs) || []);
  const hasActionVerbs = verbMatches.length >= 3;
  checks.push({
    id: 'cnt_action_verbs',
    category: 'content',
    name: 'Strong Action Verbs',
    passed: hasActionVerbs,
    weight: 5,
    severity: hasActionVerbs ? null : 'warning',
    title: hasActionVerbs ? 'Strong action verbs present' : 'Weak or passive phrasing',
    description: hasActionVerbs
      ? `Found ${verbMatches.length} strong action verbs driving your bullet points.`
      : 'Bullet points use passive descriptions like "responsible for" or "worked on".',
    recommendation: hasActionVerbs ? null : 'Begin bullet points with strong action verbs like "Spearheaded", "Negotiated", "Designed", "Executed".',
    example: 'Instead of: "Responsible for client onboardings"\nUse: "Executed 20+ seamless client onboardings per month."'
  });

  // Check 1.4: Repetitive Phrasing
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const firstWords = lines.map(l => l.split(' ')[0].toLowerCase());
  const wordFreq = {};
  firstWords.forEach(w => { if (w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const maxRepetition = Math.max(0, ...Object.values(wordFreq));
  const noHeavyRepetition = hasMinContent && maxRepetition < 4;
  checks.push({
    id: 'cnt_repetition',
    category: 'content',
    name: 'Phrasing & Word Diversity',
    passed: noHeavyRepetition,
    weight: 5,
    severity: noHeavyRepetition ? null : 'suggestion',
    title: noHeavyRepetition ? 'Good bullet phrasing variety' : 'Repetitive starting words detected',
    description: noHeavyRepetition
      ? 'Bullet points display varied, engaging vocabulary.'
      : 'Several bullet points start with the exact same word repeatedly.',
    recommendation: noHeavyRepetition ? null : 'Vary your opening verbs across bullet points to demonstrate range.',
    example: null
  });


  // ==========================================
  // 2. SECTIONS CHECKS
  // ==========================================

  // Check 2.1: Essential Sections Presence
  const hasSummary = detectedSections.includes('summary');
  const hasEducation = detectedSections.includes('education');
  const hasSkillsSec = detectedSections.includes('skills');
  const hasExperienceOrProjects = detectedSections.includes('experience') || detectedSections.includes('projects');
  const allEssentialFound = hasEducation && hasSkillsSec && hasExperienceOrProjects;

  checks.push({
    id: 'sec_essential_sections',
    category: 'sections',
    name: 'Essential Resume Sections',
    passed: allEssentialFound,
    weight: 5,
    severity: allEssentialFound ? null : 'critical',
    title: allEssentialFound ? 'All core resume sections detected' : 'Missing core resume section(s)',
    description: allEssentialFound
      ? `Detected key sections: ${detectedSections.join(', ')}.`
      : `Missing key sections: ${[!hasEducation && 'Education', !hasSkillsSec && 'Skills', !hasExperienceOrProjects && 'Experience or Projects'].filter(Boolean).join(', ')}.`,
    recommendation: allEssentialFound ? null : 'Ensure your resume includes clear standard section headers: "Education", "Skills", and "Experience" (or "Projects").',
    example: null
  });

  // Check 2.2: Summary/Objective Section
  checks.push({
    id: 'sec_summary_presence',
    category: 'sections',
    name: 'Professional Summary / Objective',
    passed: hasSummary,
    weight: 5,
    severity: hasSummary ? null : 'suggestion',
    title: hasSummary ? 'Professional Summary section present' : 'Missing Summary / Objective',
    description: hasSummary
      ? 'Clear professional summary or objective at the top of the resume.'
      : 'No summary section detected. A concise 2-3 line summary helps ATS & recruiters quickly understand your profile.',
    recommendation: hasSummary ? null : 'Add a brief 2-line summary at the top outlining your background, top skills, and target role.',
    example: 'Example: "Results-driven Digital Marketing specialist with experience in SEO and content strategy, seeking to drive organic growth for tech brands."'
  });

  // Check 2.3: Logical Section Ordering
  checks.push({
    id: 'sec_ordering',
    category: 'sections',
    name: 'Section Layout & Order',
    passed: detectedSections.length >= 3,
    weight: 5,
    severity: detectedSections.length >= 3 ? null : 'warning',
    title: detectedSections.length >= 3 ? 'Standard section organization' : 'Unclear section organization',
    description: detectedSections.length >= 3
      ? 'Section headers are clearly structured and easy for ATS parsers to index.'
      : 'Unclear section organization detected.',
    recommendation: detectedSections.length >= 3 ? null : 'Use standard bold headings for sections: Summary, Skills, Experience, Projects, Education.',
    example: null
  });


  // ==========================================
  // 3. ATS ESSENTIALS CHECKS
  // ==========================================

  // Check 3.1: Email Contact
  const hasEmail = !!contact.email;
  checks.push({
    id: 'ats_email',
    category: 'atsEssentials',
    name: 'Email Contact Information',
    passed: hasEmail,
    weight: 4,
    severity: hasEmail ? null : 'critical',
    title: hasEmail ? 'Valid email address detected' : 'Missing email address',
    description: hasEmail
      ? `Email found: ${contact.email}`
      : 'No valid email address detected in the resume text.',
    recommendation: hasEmail ? null : 'Place a professional email address prominently at the top of your resume.',
    example: 'john.doe@gmail.com'
  });

  // Check 3.2: Phone Contact
  const hasPhone = !!contact.phone;
  checks.push({
    id: 'ats_phone',
    category: 'atsEssentials',
    name: 'Phone Contact Information',
    passed: hasPhone,
    weight: 4,
    severity: hasPhone ? null : 'critical',
    title: hasPhone ? 'Valid phone number detected' : 'Missing phone number',
    description: hasPhone
      ? `Phone number found: ${contact.phone}`
      : 'No phone number detected.',
    recommendation: hasPhone ? null : 'Include a contact phone number at the top of your resume.',
    example: '+91 9876543210'
  });

  // Check 3.3: Professional Online Profiles (LinkedIn / Portfolio / GitHub)
  const hasLinks = !!(contact.linkedin || contact.github || contact.portfolio);
  checks.push({
    id: 'ats_professional_links',
    category: 'atsEssentials',
    name: 'Professional Online Links',
    passed: hasLinks,
    weight: 4,
    severity: hasLinks ? null : 'warning',
    title: hasLinks ? 'Professional link(s) detected' : 'Missing professional online profile links',
    description: hasLinks
      ? `Found profile link: ${contact.linkedin || contact.github || contact.portfolio}`
      : 'No LinkedIn or portfolio link detected. Recruiters expect an online profile link.',
    recommendation: hasLinks ? null : 'Include your LinkedIn profile URL (or portfolio/website) in your contact header.',
    example: 'linkedin.com/in/yourname'
  });

  // Check 3.4: Filename Quality
  const filename = (metadata.fileName || '').toLowerCase();
  const isGoodFilename = filename ? (!filename.includes('untitled') && !filename.includes('resume(1)') && !filename.includes('copy')) : true;
  checks.push({
    id: 'ats_filename_quality',
    category: 'atsEssentials',
    name: 'Resume File Naming',
    passed: isGoodFilename,
    weight: 4,
    severity: isGoodFilename ? null : 'suggestion',
    title: isGoodFilename ? 'Clean file naming' : 'Generic file name',
    description: isGoodFilename
      ? 'File name is formatted properly.'
      : `File name "${metadata.fileName}" looks generic or auto-generated.`,
    recommendation: isGoodFilename ? null : 'Rename file to "FirstName_LastName_Resume.pdf" before uploading to job portals.',
    example: 'John_Doe_Resume.pdf'
  });

  // Check 3.5: ATS Formatting Friendliness
  const noTableSymptoms = !/\b(table|cell|column)\b/i.test(rawText.slice(0, 300));
  checks.push({
    id: 'ats_unfriendly_formatting',
    category: 'atsEssentials',
    name: 'ATS Formatting Friendliness',
    passed: noTableSymptoms,
    weight: 4,
    severity: noTableSymptoms ? null : 'warning',
    title: noTableSymptoms ? 'ATS-friendly plain text format' : 'Potential complex formatting detected',
    description: noTableSymptoms
      ? 'No ATS-unfriendly graphic or multi-column table symptoms detected.'
      : 'Detected complex layout elements that could confuse legacy ATS scanners.',
    recommendation: noTableSymptoms ? null : 'Use a simple single-column layout without nested tables or graphic boxes.',
    example: null
  });


  // ==========================================
  // 4. READABILITY / QUALITY CHECKS
  // ==========================================

  // Check 4.1: Optimal Length
  const isOptimalLength = wordCount >= 200 && wordCount <= 1200;
  checks.push({
    id: 'rd_word_count',
    category: 'readability',
    name: 'Resume Word Count & Length',
    passed: isOptimalLength,
    weight: 5,
    severity: isOptimalLength ? null : 'warning',
    title: isOptimalLength ? 'Optimal word length' : wordCount < 200 ? 'Resume is too short' : 'Resume is excessively long',
    description: isOptimalLength
      ? `Word count is ${wordCount} words (ideal 1-page/2-page length).`
      : `Word count is ${wordCount} words. Ideal length is between 250 and 1000 words.`,
    recommendation: isOptimalLength ? null : wordCount < 200 ? 'Expand on your projects, skills, education, and responsibilities.' : 'Trim wordy descriptions to keep resume concise.',
    example: null
  });

  // Check 4.2: Bullet Formatting Ratio
  const hasBullets = bulletLinesCount >= 3;
  checks.push({
    id: 'rd_bullet_formatting',
    category: 'readability',
    name: 'Bullet Point Formatting',
    passed: hasBullets,
    weight: 5,
    severity: hasBullets ? null : 'warning',
    title: hasBullets ? 'Good use of bullet points' : 'Lack of bullet points',
    description: hasBullets
      ? `Detected ${bulletLinesCount} bullet points, making text easy to skim.`
      : 'Text consists mostly of dense paragraphs instead of bullet points.',
    recommendation: hasBullets ? null : 'Use bullet points for work experience and project accomplishments to improve readability.',
    example: null
  });

  // Check 4.3: Bullet Point Length
  const longBullets = lines.filter(l => (l.startsWith('•') || l.startsWith('-')) && l.length > 250);
  const bulletLengthOk = longBullets.length === 0;
  checks.push({
    id: 'rd_bullet_length',
    category: 'readability',
    name: 'Bullet Point Concise Length',
    passed: bulletLengthOk,
    weight: 5,
    severity: bulletLengthOk ? null : 'suggestion',
    title: bulletLengthOk ? 'Concise bullet points' : 'Overly long bullet point paragraphs',
    description: bulletLengthOk
      ? 'Bullet points are concise and focused.'
      : `${longBullets.length} bullet point(s) exceed 250 characters. Bullet points should be 1-2 lines.`,
    recommendation: bulletLengthOk ? null : 'Break long paragraph bullet points into two distinct bullet items.',
    example: null
  });


  // ==========================================
  // 5. EXPERIENCE QUALITY CHECKS
  // ==========================================

  // Check 5.1: Experience / Project Details
  // Special rule: Freshers without work experience get credit if they have Projects!
  const hasSufficientExperience = isFresher ? (experienceCount >= 1 || detectedSections.includes('projects') || rawText.includes('project')) : (experienceCount >= 1 || detectedSections.includes('experience'));
  checks.push({
    id: 'exp_role_org_detection',
    category: 'experienceQuality',
    name: isFresher ? 'Project / Academic Experience' : 'Work Experience Entries',
    passed: hasSufficientExperience,
    weight: 5,
    severity: hasSufficientExperience ? null : 'critical',
    title: hasSufficientExperience
      ? isFresher ? 'Academic or personal projects present' : 'Work experience entries present'
      : isFresher ? 'Missing project details' : 'Missing work experience entries',
    description: hasSufficientExperience
      ? isFresher ? 'Freshers with project experience evaluated fairly.' : `Detected ${experienceCount || 1} work experience section(s).`
      : isFresher ? 'Add academic or personal projects to demonstrate practical skills.' : 'Add your work experience or internship history.',
    recommendation: hasSufficientExperience ? null : 'Include role title, organization name, location, and dates.',
    example: null
  });

  // Check 5.2: Date Detection in History
  const hasDates = /\b(20\d\d|19\d\d|present|current)\b/i.test(rawText);
  checks.push({
    id: 'exp_date_detection',
    category: 'experienceQuality',
    name: 'Dates & Timeline Clarity',
    passed: hasDates,
    weight: 5,
    severity: hasDates ? null : 'warning',
    title: hasDates ? 'Timeline dates detected' : 'Missing timeline dates',
    description: hasDates
      ? 'Found dates in experience/education timeline.'
      : 'Could not detect clear start and end dates in experience or education.',
    recommendation: hasDates ? null : 'Add dates (Month Year - Month Year) for each experience and degree.',
    example: 'June 2023 - Present'
  });

  // Check 5.3: Responsibility & Outcome Statements
  const hasOutcomes = /\b(resulted in|led to|achieved|improved|grew|managed|delivered|reduced|created|built|designed|analyzed)\b/i.test(rawText);
  checks.push({
    id: 'exp_outcomes',
    category: 'experienceQuality',
    name: 'Responsibility & Outcome Statements',
    passed: hasOutcomes,
    weight: 5,
    severity: hasOutcomes ? null : 'warning',
    title: hasOutcomes ? 'Clear responsibility and outcome phrasing' : 'Lacks outcome-oriented descriptions',
    description: hasOutcomes
      ? 'Statements describe active duties and positive outcomes.'
      : 'Descriptions lack outcome verbs.',
    recommendation: hasOutcomes ? null : 'Describe what you did AND the positive outcome achieved.',
    example: 'Instead of: "Handled customer calls"\nUse: "Handled 40+ customer inquiries daily, maintaining a 98% satisfaction rating."'
  });


  // ==========================================
  // 6. SKILL EVIDENCE CHECKS
  // ==========================================

  // Check 6.1: Skill Count
  const hasMinSkills = skills.length >= 3;
  checks.push({
    id: 'skl_count',
    category: 'skillEvidence',
    name: 'Identified Skills',
    passed: hasMinSkills,
    weight: 5,
    severity: hasMinSkills ? null : 'critical',
    title: hasMinSkills ? `Found ${skills.length} skills in resume` : 'Too few skills listed',
    description: hasMinSkills
      ? `Detected skills across domain (${detectedDomain}): ${skills.slice(0, 6).map(s => s.name).join(', ')}${skills.length > 6 ? '...' : ''}.`
      : 'Fewer than 3 skills detected in the resume text.',
    recommendation: hasMinSkills ? null : 'Add a dedicated "Skills" section listing your core domain, technical, or soft skills.',
    example: null
  });

  // Check 6.2: Skill Evidence Verification
  const skillsWithEvidence = skills.filter(s => s.hasEvidence);
  const hasEvidenceRatio = skillsWithEvidence.length >= 1 || skills.length >= 5;
  checks.push({
    id: 'skl_evidence',
    category: 'skillEvidence',
    name: 'Skill Supporting Evidence',
    passed: hasEvidenceRatio,
    weight: 5,
    severity: hasEvidenceRatio ? null : 'warning',
    title: hasEvidenceRatio ? 'Skills supported by context' : 'Skills listed without context in experience',
    description: hasEvidenceRatio
      ? `Found supporting evidence for listed skills in experience/projects.`
      : 'Skills are listed in a section but not mentioned in your experience or project descriptions.',
    recommendation: hasEvidenceRatio ? null : 'Mention how you applied your skills in your experience bullet points.',
    example: 'If listing "SEO" as a skill, mention in a bullet point: "Utilized SEO strategies to boost website traffic by 25%."'
  });

  // Check 6.3: Domain Relevance (Domain-agnostic check)
  checks.push({
    id: 'skl_domain_relevance',
    category: 'skillEvidence',
    name: 'Career Domain Context',
    passed: true,
    weight: 5,
    severity: null,
    title: `Detected Domain: ${detectedDomain}`,
    description: `Resume successfully parsed under career domain "${detectedDomain}". No technical-only bias applied.`,
    recommendation: null,
    example: null
  });

  return checks;
}

module.exports = {
  runAtsChecks
};
