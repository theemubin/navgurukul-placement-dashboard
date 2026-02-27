const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule && (pdfParseModule.default || pdfParseModule);
const cheerio = require('cheerio');
const axios = require('axios');

class AIService {
  constructor(apiKeys) {
    // Support both single key (string) and multiple keys (array)
    if (typeof apiKeys === 'string') {
      this.apiKeys = apiKeys ? [apiKeys] : [];
    } else if (Array.isArray(apiKeys)) {
      this.apiKeys = apiKeys.filter(k => k);
    } else {
      this.apiKeys = [];
    }
    this.currentKeyIndex = 0;
    this.apiKey = this.apiKeys[0] || null;
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  // Rotate to next available API key
  rotateKey() {
    if (this.apiKeys.length <= 1) return false;

    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    this.apiKey = this.apiKeys[this.currentKeyIndex];
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    console.log(`Rotated to API key #${this.currentKeyIndex + 1}`);
    return true;
  }

  // Extract text from PDF buffer
  async extractTextFromPDF(buffer) {
    try {
      if (!pdfParse) {
        throw new Error('PDF parsing library not available');
      }
      // Support new pdf-parse API (PDFParse class) and old function API
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(buffer);
        return data.text;
      }
      if (pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text;
      }
      throw new Error('Unsupported pdf-parse API');
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Extract file ID from Google Drive URL
  extractGoogleDriveFileId(url) {
    // Patterns for Google Drive URLs
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,           // /file/d/FILE_ID/
      /id=([a-zA-Z0-9_-]+)/,                    // ?id=FILE_ID
      /\/d\/([a-zA-Z0-9_-]+)/,                  // /d/FILE_ID/
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/ // /open?id=FILE_ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  // Check if URL is a Google Drive link
  isGoogleDriveUrl(url) {
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  }

  // Extract PDF from Google Drive
  async extractFromGoogleDrive(url) {
    const fileId = this.extractGoogleDriveFileId(url);

    if (!fileId) {
      throw new Error('Invalid Google Drive URL. Please make sure you\'re sharing a valid Drive link.');
    }

    // Convert to direct download URL
    // Support both Drive file links and Google Docs/export links
    let downloadUrl;
    if (url.includes('docs.google.com')) {
      // Export Google Docs to PDF
      downloadUrl = `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
    } else {
      downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000,
        maxRedirects: 5
      });

      // Check if we got a PDF or HTML (Drive might return a confirmation page for large files)
      const contentType = response.headers['content-type'] || '';

      if (contentType.includes('text/html')) {
        // Try to extract confirmation link from HTML response
        const html = response.data.toString();

        // Check if it's an access denied page
        if (html.includes('Sign in') || html.includes('Request access')) {
          throw new Error('This Google Drive file is not publicly accessible. Please set sharing to "Anyone with the link can view".');
        }

        // Check for virus scan warning (large files)
        const confirmMatch = html.match(/confirm=([^&"]+)/);
        if (confirmMatch) {
          const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
          const confirmedResponse = await axios.get(confirmUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
          });
          return await this.extractTextFromPDF(Buffer.from(confirmedResponse.data));
        }

        throw new Error('Could not download the file from Google Drive. Please ensure the file is a PDF and is publicly shared.');
      }

      // Parse PDF
      return await this.extractTextFromPDF(Buffer.from(response.data));
    } catch (error) {
      if (error.message.includes('Google Drive')) {
        throw error;
      }
      console.error('Google Drive extraction error:', error);
      throw new Error('Failed to download from Google Drive. Please ensure the file is publicly shared and is a valid PDF.');
    }
  }

  // Extract text from URL
  async extractTextFromURL(url) {
    try {
      // Check if it's a Google Drive URL
      if (this.isGoogleDriveUrl(url)) {
        return await this.extractFromGoogleDrive(url);
      }

      // Check for blocked domains
      const blockedDomains = ['linkedin.com', 'glassdoor.com'];
      const urlLower = url.toLowerCase();

      for (const domain of blockedDomains) {
        if (urlLower.includes(domain)) {
          throw new Error(`${domain} blocks direct access. Please download the job description as PDF and upload it instead.`);
        }
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);

      // Remove scripts, styles, nav, footer, etc.
      $('script, style, nav, footer, header, aside, iframe, noscript').remove();

      // Try to find job description content
      // Common job posting selectors
      const selectors = [
        '[class*="job-description"]',
        '[class*="jobDescription"]',
        '[class*="description"]',
        '[id*="job-description"]',
        '[id*="jobDescription"]',
        'article',
        '.content',
        'main',
        '.job-details',
        '.posting-content'
      ];

      let text = '';
      for (const selector of selectors) {
        const content = $(selector).text();
        if (content && content.length > 200) {
          text = content;
          break;
        }
      }

      // Fallback to body text
      if (!text || text.length < 200) {
        text = $('body').text();
      }

      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();

      return text;
    } catch (error) {
      console.error('URL extraction error:', error);
      // Re-throw custom errors
      if (error.message.includes('Google Drive') || error.message.includes('blocks direct access')) {
        throw error;
      }
      throw new Error('Failed to extract content from URL. The page might be protected or unavailable.');
    }
  }

  // Code-based fallback extraction to conserve AI quota
  async parseJobDescriptionWithCode(text) {
    try {
      const result = {
        title: '',
        company: { name: '', website: '', description: '' },
        description: '',
        requirements: [],
        responsibilities: [],
        location: '',
        jobType: 'full_time',
        duration: '',
        salary: { min: null, max: null, currency: 'INR' },
        suggestedSkills: [],
        experienceLevel: 'entry',
        maxPositions: 1,
        eligibility: {}
      };

      // Clean text lines for analysis
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      // Extract job title 
      // Look for role-like words, avoid IDs (alphanumeric with slashes/dashes)
      const roleKeywords = /\b(developer|engineer|manager|lead|intern|designer|analyst|executive|associate|specialist|officer|coordinator|assistant)\b/i;
      const idPattern = /^[A-Z0-9\/\._-]+$/i; // Pattern for metadata IDs like KDK/Policy/HR/25.0

      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i];
        if (roleKeywords.test(line) && !idPattern.test(line) && line.length > 5 && line.length < 80) {
          result.title = line.replace(/^(job\s+)?title[:\s]+/i, '').trim();
          break;
        }
      }

      // Fallback for title if no role keyword found
      if (!result.title) {
        const titleMatch = text.match(/(?:job\s+)?title[:\s]+([^\n]+)/i);
        if (titleMatch && !idPattern.test(titleMatch[1].trim())) {
          result.title = titleMatch[1].trim().substring(0, 100);
        }
      }

      // Extract location
      const locationMatch = text.match(/(?:location|based\s+in|office|work\s+from)[:\s]+([^,\n]{3,50})/i);
      if (locationMatch) result.location = locationMatch[1].trim();

      // Extract Company Name - look for "About [Company]" or "Company: [Company]"
      const companyMatch = text.match(/(?:company|employer|about|hiring\s+at)[:\s]+([^,\n\r]{3,60})/i);
      if (companyMatch) result.company.name = companyMatch[1].trim();

      // Extract salary
      const salaryMatch = text.match(/(?:salary|compensation|ctc|lpa|stipend)[:\s]*(?:inr\s*)?([0-9.,]+)\s*(?:l|lakh|k)?[-–]?\s*([0-9.,]+)?/i);
      if (salaryMatch) {
        let minStr = salaryMatch[1].replace(/,/g, '');
        let maxStr = salaryMatch[2] ? salaryMatch[2].replace(/,/g, '') : minStr;
        let min = parseFloat(minStr);
        let max = parseFloat(maxStr);
        if (!isNaN(min)) {
          // Convert to annual if in lakhs
          if (min < 100) { min *= 100000; max *= 100000; }
          result.salary = { min: Math.round(min), max: Math.round(max), currency: 'INR' };
        }
      }

      // Detect job type
      if (/paid\s*project|paid\s*projects/i.test(text)) result.jobType = 'paid_project';
      else if (/intern|internship/i.test(text)) result.jobType = 'internship';
      else if (/part.?time|freelance/i.test(text)) result.jobType = 'part_time';
      else if (/contract/i.test(text)) result.jobType = 'contract';

      // Extract internship duration
      if (result.jobType === 'internship') {
        const durationMatch = text.match(/(?:duration|period)[:\s]*([0-9]+)\s*(?:months?|weeks?)/i);
        if (durationMatch) result.duration = `${durationMatch[1]} ${durationMatch[0].includes('week') ? 'weeks' : 'months'}`;
      }

      // Extract experience level
      if (/senior|lead|principal|10\+|expert/i.test(text)) result.experienceLevel = 'senior';
      else if (/mid|3-7|5-7|mid.level/i.test(text)) result.experienceLevel = 'mid';
      else if (/junior|1-3|entry/i.test(text)) result.experienceLevel = 'entry';

      // Extract common tech skills via regex
      const commonSkills = ['java', 'python', 'javascript', 'typescript', 'react', 'node', 'sql', 'aws', 'html', 'css', 'php', 'c++', 'go', 'ruby', 'android', 'ios', 'swift', 'kotlin', 'flutter', 'dart', 'django', 'flask', 'spring', 'mongodb', 'postgresql', 'mysql', 'docker', 'kubernetes', 'figma', 'excel', 'word'];
      const foundSkills = new Set();
      commonSkills.forEach(skill => {
        if (new RegExp(`\\b${skill}\\b`, 'i').test(text)) {
          foundSkills.add(skill);
        }
      });
      result.suggestedSkills = Array.from(foundSkills);

      return result;
    } catch (error) {
      console.log('Code-based parsing failed:', error.message);
      return null;
    }
  }

  // Parse JD using Google Gemini AI
  async parseJobDescription(text, existingSkills = []) {
    if (!this.genAI) {
      throw new Error('AI service not configured. Please add your Google AI API key in Settings.');
    }

    const maxRetries = this.apiKeys.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use gemini-2.0-flash-exp or gemini-pro as fallback (gemini-1.5-flash deprecated)
        let model;
        try {
          model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        } catch (e) {
          // Fallback to gemini-pro if 2.0 not available
          model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        }

        const skillsList = existingSkills.length > 0
          ? `Available skills in our system: ${existingSkills.join(', ')}`
          : '';

        const prompt = `
You are an expert technical recruiter assistant. Your mission is to analyze the following Job Description (JD) and extract perfectly structured information that precisely maps to our recruitment database.

CONTEXT:
We are "Navgurukul", an organization that provides free technical education. We need to parse JDs to help our coordinators post jobs quickly.

${skillsList}

JOB DESCRIPTION TEXT:
"""
${text.substring(0, 10000)}
"""

YOUR TASK:
Extract and return ONLY a valid JSON object (no markdown blocks, no commentary) with the following specific rules:

1. TITLE: Identify the human-readable job role (e.g., "Full Stack Developer", "UX Designer"). 
   - CRITICAL: Ignore document IDs, policy numbers, file codes, or internal metadata (e.g., "KDK/Policy/HR/25.0"). If the first lines look like IDs, skip them.
2. SALARY: Convert all salary/stipend information to ANNUAL INR. 
   - Monthly stipend for interns? Multiply by 12. 
   - Lakhs Per Annum (LPA)? e.g., "5-8 LPA" -> min: 500000, max: 800000.
3. JOB TYPE: Must be one of: "full_time", "part_time", "internship", "contract", "paid_project".
4. ELIGIBILITY: Extract all constraints mentioned.
   - Academic: Look for 10th/12th percentages (e.g., "60% in 10th").
   - Degree: Look for degree levels (bachelor, master) and specific fields (B.Tech, BCA, etc.).
   - Gender: If it mentions "Female candidates preferred" or similar, set "femaleOnly" to true.
5. SKILLS: Identify all technical tools, languages, and frameworks. Map them to the "Available skills" list if provided.

JSON STRUCTURE:
{
  "title": "Clean Role Title",
  "company": {
    "name": "Company Name",
    "website": "URL if found, else empty string",
    "description": "Short summary of company, max 200 chars"
  },
  "description": "Job summary, max 500 chars",
  "requirements": ["point 1", "point 2", ...],
  "responsibilities": ["point 1", "point 2", ...],
  "location": "City or Remote",
  "jobType": "full_time" | "part_time" | "internship" | "contract" | "paid_project",
  "duration": "Duration if internship (e.g. 6 months), else null",
  "salary": {
    "min": number or null,
    "max": number or null,
    "currency": "INR"
  },
  "suggestedSkills": ["Skill Name 1", "Skill Name 2", ...],
  "experienceLevel": "entry" | "junior" | "mid" | "senior",
  "maxPositions": number (default 1),
  "eligibility": {
    "tenthGrade": { "required": boolean, "minPercentage": number or null },
    "twelfthGrade": { "required": boolean, "minPercentage": number or null },
    "higherEducation": { 
        "required": boolean, 
        "level": "bachelor" | "master" | "any" | "", 
        "acceptedDegrees": ["B.Tech", "BCA", etc.] 
    },
    "femaleOnly": boolean,
    "englishProficiency": {
        "writing": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"", 
        "speaking": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|""
    }
  },
  "roleCategory": "Engineering" | "Design" | "Sales" | "HR" | "Other"
}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        // Clean up response - remove markdown code blocks if present
        responseText = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const parsed = JSON.parse(responseText);

        // Helper to clean up strings from bullets and special characters
        const cleanStr = (str) => {
          if (!str) return '';
          // Remove various bullet points, special characters, and numbering from the beginning
          return str
            .replace(/^[\s\-*o+•●▪▫◦■□✓✔✕✖📄📘|–—†‡⬚⬚\d\.]+\s+/, '')
            .trim();
        };

        // Validate and clean the response
        return {
          title: cleanStr(parsed.title),
          company: {
            name: cleanStr(parsed.company?.name),
            website: parsed.company?.website || '',
            description: cleanStr(parsed.company?.description)
          },
          description: cleanStr(parsed.description),
          requirements: Array.isArray(parsed.requirements)
            ? parsed.requirements.map(r => cleanStr(r)).filter(r => r)
            : [],
          responsibilities: Array.isArray(parsed.responsibilities)
            ? parsed.responsibilities.map(r => cleanStr(r)).filter(r => r)
            : [],
          location: cleanStr(parsed.location),
          jobType: ['full_time', 'part_time', 'internship', 'contract', 'paid_project'].includes(parsed.jobType)
            ? parsed.jobType
            : 'full_time',
          duration: parsed.duration || '',
          salary: {
            min: typeof parsed.salary?.min === 'number' ? parsed.salary.min : null,
            max: typeof parsed.salary?.max === 'number' ? parsed.salary.max : null,
            currency: parsed.salary?.currency || 'INR'
          },
          suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills : [],
          experienceLevel: parsed.experienceLevel || 'entry',
          maxPositions: typeof parsed.maxPositions === 'number' ? parsed.maxPositions : 1,
          eligibility: {
            tenthGrade: {
              required: !!parsed.eligibility?.tenthGrade?.required,
              minPercentage: typeof parsed.eligibility?.tenthGrade?.minPercentage === 'number' ? parsed.eligibility.tenthGrade.minPercentage : null
            },
            twelfthGrade: {
              required: !!parsed.eligibility?.twelfthGrade?.required,
              minPercentage: typeof parsed.eligibility?.twelfthGrade?.minPercentage === 'number' ? parsed.eligibility.twelfthGrade.minPercentage : null
            },
            higherEducation: {
              required: !!parsed.eligibility?.higherEducation?.required,
              level: parsed.eligibility?.higherEducation?.level || '',
              acceptedDegrees: Array.isArray(parsed.eligibility?.higherEducation?.acceptedDegrees) ? parsed.eligibility.higherEducation.acceptedDegrees : []
            },
            femaleOnly: !!parsed.eligibility?.femaleOnly,
            englishProficiency: {
              writing: parsed.eligibility?.englishProficiency?.writing || '',
              speaking: parsed.eligibility?.englishProficiency?.speaking || ''
            }
          },
          roleCategory: parsed.roleCategory || ''
        };

      } catch (error) {
        console.error(`AI parsing error (attempt ${attempt + 1}/${maxRetries}):`, error);

        // Map common errors to codes and clearer messages
        const message = error?.message || String(error);
        let code = 'AI_PARSE_FAILED';
        let shouldRetry = false;

        if (/quota|quota exceeded|limit/i.test(message)) {
          code = 'QUOTA_EXCEEDED';
          shouldRetry = true;
        } else if (/rate limit|429/i.test(message)) {
          code = 'RATE_LIMITED';
          shouldRetry = true;
        } else if (/billing|payment/i.test(message)) {
          code = 'BILLING_ISSUE';
          shouldRetry = true;
        } else if (/invalid|key|credential/i.test(message)) {
          code = 'INVALID_API_KEY';
          shouldRetry = true;
        } else if (/permission|not authorized|403/i.test(message)) {
          code = 'FORBIDDEN';
          shouldRetry = true;
        } else if (/timeout|timed out/i.test(message)) {
          code = 'TIMEOUT';
          shouldRetry = false; // Don't rotate on timeout
        } else if (error instanceof SyntaxError) {
          code = 'INVALID_RESPONSE';
          shouldRetry = false;
        }

        // Store error with code for potential retry or final throw
        lastError = error;
        lastError.code = code;

        // If this is a quota/rate limit/auth error and we have more keys, try next key
        if (shouldRetry && attempt < maxRetries - 1 && this.rotateKey()) {
          console.log(`Retrying with next API key...`);
          continue;
        }

        // No more keys to try or not a retryable error
        const err = new Error(`AI parse failed: ${message}`);
        err.code = code;
        err.originalError = error;
        throw err;
      }
    }

    // If we get here, all keys failed
    const err = new Error(`AI parse failed after trying ${maxRetries} key(s): ${lastError?.message || 'Unknown error'}`);
    err.code = lastError?.code || 'AI_PARSE_FAILED';
    err.originalError = lastError;
    throw err;
  }

  // Health check for AI service
  async getStatus() {
    if (!this.apiKey || !this.genAI) {
      return { configured: false, enabled: false, working: false, message: 'AI key not configured' };
    }

    try {
      // A lightweight check: try to get model instance (does not consume tokens)
      this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      return { configured: true, enabled: true, working: true };
    } catch (error) {
      return { configured: true, enabled: true, working: false, message: error.message || 'AI model unavailable' };
    }
  }

  // Fallback: Basic regex-based parsing (when AI is not available)
  parseJobDescriptionFallback(text) {
    const result = {
      title: '',
      company: { name: '', website: '', description: '' },
      description: '',
      requirements: [],
      responsibilities: [],
      location: '',
      jobType: 'full_time',
      duration: '',
      salary: { min: null, max: null, currency: 'INR' },
      suggestedSkills: [],
      experienceLevel: 'entry',
      maxPositions: 1
    };

    // Extract job title (usually first prominent text or after "Position:")
    const titleMatch = text.match(/(?:Job Title|Position|Role)[:\s]*([^\n]+)/i) ||
      text.match(/^([A-Z][^.!\n]{10,60})/);
    if (titleMatch) result.title = titleMatch[1].trim();

    // Extract company name
    const companyMatch = text.match(/(?:Company|Organization|Employer)[:\s]*([^\n]+)/i);
    if (companyMatch) result.company.name = companyMatch[1].trim();

    // Extract location
    const locationMatch = text.match(/(?:Location|City|Based in|Work from)[:\s]*([^\n]+)/i);
    if (locationMatch) result.location = locationMatch[1].trim();

    // Detect job type
    if (/\b(paid\s*project|paid\s*projects)\b/i.test(text)) result.jobType = 'paid_project';
    else if (/\b(internship|intern)\b/i.test(text)) result.jobType = 'internship';
    else if (/\b(contract|freelance|contractor)\b/i.test(text)) result.jobType = 'contract';
    else if (/\b(part[\s-]?time)\b/i.test(text)) result.jobType = 'part_time';

    // Extract salary (basic pattern)
    const salaryMatch = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)\s*(?:[-–to]+\s*(?:₹|INR|Rs\.?)?\s*([\d,]+))?/i);
    if (salaryMatch) {
      result.salary.min = parseInt(salaryMatch[1].replace(/,/g, ''));
      if (salaryMatch[2]) {
        result.salary.max = parseInt(salaryMatch[2].replace(/,/g, ''));
      }
    }

    // Extract common skills
    const skillPatterns = [
      'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'MongoDB',
      'HTML', 'CSS', 'AWS', 'Docker', 'Git', 'TypeScript', 'Angular', 'Vue',
      'Express', 'Django', 'Flask', 'PostgreSQL', 'MySQL', 'Redis', 'Linux',
      'REST API', 'GraphQL', 'Kubernetes', 'CI/CD', 'Agile', 'Scrum'
    ];

    result.suggestedSkills = skillPatterns.filter(skill =>
      new RegExp(`\\b${skill}\\b`, 'i').test(text)
    );

    // Extract requirements (lines after "Requirements" header)
    const reqSection = text.match(/(?:Requirements|Qualifications|Must Have)[:\s]*([^]*?)(?=Responsibilities|About|Benefits|$)/i);
    if (reqSection) {
      const lines = reqSection[1].split(/[\n•·-]+/).filter(l => l.trim().length > 10);
      result.requirements = lines.slice(0, 8).map(l => l.trim());
    }

    // Extract responsibilities
    const respSection = text.match(/(?:Responsibilities|What you'll do|Duties)[:\s]*([^]*?)(?=Requirements|Qualifications|Benefits|$)/i);
    if (respSection) {
      const lines = respSection[1].split(/[\n•·-]+/).filter(l => l.trim().length > 10);
      result.responsibilities = lines.slice(0, 8).map(l => l.trim());
    }

    // Use first paragraph as description if not extracted
    if (!result.description) {
      const firstPara = text.substring(0, 500).split('\n\n')[0];
      result.description = firstPara?.trim() || '';
    }

    return result;
  }
}

module.exports = AIService;
