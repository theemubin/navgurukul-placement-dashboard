/**
 * Resume Parser Service
 * Extracts and normalizes unstructured text into a structured internal representation.
 * Supports technical & non-technical roles (HR, Marketing, Finance, Sales, Ops, Design, etc.)
 */

const DOMAIN_KEYWORDS = {
  'Software Development': [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin',
    'react', 'angular', 'vue', 'node', 'express', 'next.js', 'django', 'flask', 'spring', 'html', 'css',
    'sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'aws', 'docker', 'kubernetes', 'git', 'api', 'rest',
    'full stack', 'frontend', 'backend', 'developer', 'software engineer', 'web development'
  ],
  'HR': [
    'hr', 'human resources', 'recruitment', 'talent acquisition', 'onboarding', 'offboarding', 'payroll',
    'employee relations', 'hris', 'performance management', 'talent management', 'compliance', 'sourcing',
    'screening', 'interviewing', 'workplace culture', 'hr policies', 'labor laws'
  ],
  'Digital Marketing': [
    'marketing', 'digital marketing', 'seo', 'sem', 'social media', 'google analytics', 'content marketing',
    'email marketing', 'copywriting', 'lead generation', 'ppc', 'brand management', 'campaigns', 'conversion rate',
    'meta ads', 'google ads', 'content strategy', 'growth marketing'
  ],
  'Finance': [
    'finance', 'accounting', 'financial analysis', 'budgeting', 'auditing', 'general ledger', 'taxation',
    'financial modeling', 'quickbooks', 'tally', 'excel', 'balance sheet', 'cash flow', 'forecasting',
    'accounts payable', 'accounts receivable', 'cost analysis', 'compliance'
  ],
  'Sales': [
    'sales', 'business development', 'b2b', 'b2c', 'crm', 'salesforce', 'hubspot', 'lead generation',
    'cold calling', 'negotiation', 'account management', 'deal closing', 'pipeline management', 'revenue growth',
    'client relations', 'territory management'
  ],
  'Operations': [
    'operations', 'supply chain', 'logistics', 'inventory management', 'process improvement', 'workflow',
    'vendor management', 'quality control', 'procurement', 'resource allocation', 'operations management',
    'standard operating procedures', 'sop'
  ],
  'Business': [
    'project management', 'agile', 'scrum', 'business analysis', 'stakeholder management', 'strategy',
    'product management', 'business strategy', 'data analysis', 'kpis', 'risk management', 'requirements gathering'
  ],
  'Design': [
    'ui/ux', 'user experience', 'user interface', 'figma', 'adobe xd', 'photoshop', 'illustrator',
    'graphic design', 'user research', 'wireframing', 'prototyping', 'design system', 'typography', 'visual design'
  ]
};

const COMMON_SKILLS = {
  technical: [
    'javascript', 'python', 'java', 'react', 'node', 'sql', 'html', 'css', 'git', 'c++', 'aws', 'mongodb',
    'express', 'typescript', 'django', 'flutter', 'docker', 'mysql', 'postgresql', 'figma', 'excel', 'word', 'powerpoint'
  ],
  nonTechnical: [
    'communication', 'teamwork', 'leadership', 'problem solving', 'time management', 'critical thinking',
    'public speaking', 'negotiation', 'customer service', 'organization', 'adaptability', 'project management',
    'analytical skills', 'creativity', 'conflict resolution', 'multitasking'
  ],
  domainSpecific: [
    'recruitment', 'sourcing', 'payroll', 'seo', 'content strategy', 'financial modeling', 'taxation',
    'budgeting', 'lead generation', 'cold calling', 'salesforce', 'vendor management', 'inventory control',
    'ui/ux design', 'wireframing', 'user research', 'copywriting', 'market research'
  ]
};

function normalizeWhitespace(text) {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/ +/g, ' ').trim();
}

function extractContactInfo(text) {
  const contact = {
    name: '',
    email: '',
    phone: '',
    linkedin: '',
    github: '',
    portfolio: '',
    location: ''
  };

  if (!text) return contact;

  // Email regex
  const emailMatch = text.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/);
  if (emailMatch) contact.email = emailMatch[0].toLowerCase();

  // Phone regex
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,4}/);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) {
    contact.phone = phoneMatch[0].trim();
  }

  // LinkedIn
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) contact.linkedin = linkedinMatch[0];

  // GitHub
  const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  if (githubMatch) contact.github = githubMatch[0];

  // Portfolio / Website
  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|io|me|dev|org|net)(?:\/[^\s]*)?/gi);
  if (websiteMatch) {
    const portfolio = websiteMatch.find(url => !url.includes('linkedin.com') && !url.includes('github.com'));
    if (portfolio) contact.portfolio = portfolio;
  }

  // First line or header heuristics for name
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length > 0) {
    const candidate = lines[0];
    if (candidate.length < 50 && !candidate.includes('@') && !/resume|cv|curriculum/i.test(candidate)) {
      contact.name = candidate;
    }
  }

  return contact;
}

function detectSections(text) {
  const sections = new Set();
  const lower = text.toLowerCase();

  const sectionPatterns = {
    summary: /\b(summary|professional summary|profile|about me|objective|career objective|executive summary)\b/i,
    experience: /\b(experience|work experience|professional experience|employment history|work history|internships)\b/i,
    education: /\b(education|academic background|qualifications|academic details)\b/i,
    skills: /\b(skills|technical skills|key skills|core competencies|functional skills|areas of expertise|competencies)\b/i,
    projects: /\b(projects|key projects|academic projects|side projects|personal projects)\b/i,
    certifications: /\b(certifications|certificates|licenses|courses|trainings)\b/i,
    achievements: /\b(achievements|accomplishments|awards|honors|recognition)\b/i,
    languages: /\b(languages|languages known)\b/i
  };

  Object.entries(sectionPatterns).forEach(([sectionKey, pattern]) => {
    if (pattern.test(lower)) {
      sections.add(sectionKey);
    }
  });

  return Array.from(sections);
}

function detectDomain(text) {
  const lower = text.toLowerCase();
  const scores = {};

  Object.entries(DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
    let count = 0;
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        count++;
      }
    });
    scores[domain] = count;
  });

  let topDomain = 'General';
  let maxCount = 0;

  Object.entries(scores).forEach(([domain, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topDomain = domain;
    }
  });

  return topDomain;
}

function detectFresher(text, experienceCount) {
  const lower = text.toLowerCase();
  if (experienceCount === 0) return true;
  if (/\b(fresher|recent graduate|student|currently studying|pursuing|entry-level)\b/i.test(lower) && experienceCount <= 1) {
    return true;
  }
  return false;
}

function detectSkills(text) {
  const lower = text.toLowerCase();
  const detected = [];
  const seen = new Set();

  const allCategories = [
    { cat: 'technical', list: COMMON_SKILLS.technical },
    { cat: 'soft', list: COMMON_SKILLS.nonTechnical },
    { cat: 'domain', list: COMMON_SKILLS.domainSpecific }
  ];

  allCategories.forEach(({ cat, list }) => {
    list.forEach(skill => {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower) && !seen.has(skill)) {
        seen.add(skill);
        // Check if skill appears in multiple contexts (e.g. in experience/projects bullet points)
        const occurrences = (lower.match(new RegExp(regex.source, 'gi')) || []).length;
        detected.push({
          name: skill.charAt(0).toUpperCase() + skill.slice(1),
          category: cat,
          hasEvidence: occurrences > 1,
          evidenceContext: occurrences > 1 ? `Found in ${occurrences} places` : 'Mentioned in resume'
        });
      }
    });
  });

  return detected;
}

function parseResume(rawText, metadata = {}) {
  const text = normalizeWhitespace(rawText || '');
  const wordCount = text ? text.split(/\s+/).length : 0;
  const charCount = text ? text.length : 0;

  const contact = extractContactInfo(text);
  const detectedSectionsList = detectSections(text);
  const detectedDomain = detectDomain(text);
  const skillsList = detectSkills(text);

  // Estimate experience & projects count by bullet line heuristics
  const lines = text.split('\n').map(l => l.trim());
  const bulletLines = lines.filter(l => /^[\bullet\-*•]\s+|^\d+\.\s+/.test(l));

  // Count experience blocks by date pattern matches
  const dateRanges = text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?\.?\s*\d{4}\s*(?:-|–|to)\s*(?:present|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\.?\s*\d{4})?/gi) || [];
  const experienceCount = Math.max(0, dateRanges.length > 0 ? Math.floor(dateRanges.length / 2) : 0);
  const projectsCount = (text.match(/\b(project|built|created|designed|developed)\b/gi) || []).length > 2 ? 1 : 0;
  const isFresher = detectFresher(text, experienceCount);

  return {
    rawText: text,
    wordCount,
    charCount,
    contact,
    detectedSections: detectedSectionsList,
    detectedDomain,
    isFresher,
    skills: skillsList,
    experienceCount,
    projectsCount,
    bulletLinesCount: bulletLines.length,
    metadata
  };
}

module.exports = {
  parseResume,
  normalizeWhitespace,
  extractContactInfo,
  detectSections,
  detectDomain,
  detectFresher,
  detectSkills
};
