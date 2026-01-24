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
        maxPositions: 1
      };

      // Extract job title (usually first meaningful line)
      const titleMatch = text.match(/(?:job\s+)?title[:\s]+([^\n]+)/i) || text.match(/^([^\n]{10,100})/);
      if (titleMatch) result.title = titleMatch[1].trim().substring(0, 100);

      // Extract location
      const locationMatch = text.match(/(?:location|based\s+in|office)[:\s]+([^,\n]+)/i);
      if (locationMatch) result.location = locationMatch[1].trim();

      // Extract salary
      const salaryMatch = text.match(/(?:salary|compensation|ctc|lpa)[:\s]*(?:inr\s*)?([0-9.]+)\s*(?:l|lakh|k)?[-–]?\s*([0-9.]+)?/i);
      if (salaryMatch) {
        let min = parseFloat(salaryMatch[1]);
        let max = salaryMatch[2] ? parseFloat(salaryMatch[2]) : min;
        // Convert to annual if in lakhs
        if (min < 100) { min *= 100000; max *= 100000; }
        result.salary = { min: Math.round(min), max: Math.round(max), currency: 'INR' };
      }

      // Detect job type
      if (/paid\s*project|paid\s*projects/i.test(text)) result.jobType = 'paid_project';
      else if (/intern|internship/i.test(text)) result.jobType = 'internship';
      else if (/part.?time|freelance/i.test(text)) result.jobType = 'part_time';
      else if (/contract/i.test(text)) result.jobType = 'contract';

      // Extract internship duration
      if (result.jobType === 'internship') {
        const durationMatch = text.match(/(?:duration|period)[:\s]*([0-9]+)\s*(?:months?|weeks?)/i);
        if (durationMatch) result.duration = `${durationMatch[1]} months`;
      }

      // Extract experience level
      if (/senior|lead|principal|10\+|expert/i.test(text)) result.experienceLevel = 'senior';
      else if (/mid|3-7|5-7|mid.level/i.test(text)) result.experienceLevel = 'mid';
      else if (/junior|1-3|fresher|entry/i.test(text)) result.experienceLevel = 'entry';

      // Extract requirements (look for bullet points or numbered lists)
      const reqMatch = text.match(/(?:requirements|qualifications|required)[:\s]*\n([\s\S]*?)(?:\n\n|responsibilities|About|$)/i);
      if (reqMatch) {
        const reqs = reqMatch[1].split('\n').filter(r => r.trim());
        result.requirements = reqs.slice(0, 10).map(r => r.replace(/^[-•*\d.]+\s*/, '').trim()).filter(r => r.length > 5);
      }

      // Extract skills from text (common tech stack)
      const skillPatterns = [
        /(?:java|python|javascript|typescript|c\+\+|c#|go|rust|kotlin|scala|php|ruby)/gi,
        /(?:react|angular|vue|node|express|django|flask|spring)/gi,
        /(?:sql|mongodb|postgresql|mysql|redis|elasticsearch)/gi,
        /(?:aws|azure|gcp|docker|kubernetes|jenkins)/gi,
        /(?:html|css|rest|graphql|microservices|agile)/gi
      ];
      
      const foundSkills = new Set();
      skillPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(m => foundSkills.add(m.toLowerCase()));
        }
      });
      result.suggestedSkills = Array.from(foundSkills).slice(0, 15);

      // Extract short description
      const descMatch = text.match(/(?:about|description|overview)[:\s]*([^\n]+)/i);
      if (descMatch) result.description = descMatch[1].trim().substring(0, 500);

      return result;
    } catch (error) {
      console.log('Code-based parsing fallback failed:', error.message);
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
You are an expert HR assistant. Parse the following job description and extract structured information.

${skillsList}

Job Description Text:
"""
${text.substring(0, 8000)}
"""

Extract and return ONLY a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "title": "Job title",
  "company": {
    "name": "Company name",
    "website": "Company website URL if found, empty string otherwise",
    "description": "Brief company description if mentioned, max 200 chars"
  },
  "description": "Main job description/overview, max 500 chars",
  "requirements": ["requirement 1", "requirement 2", ...],
  "responsibilities": ["responsibility 1", "responsibility 2", ...],
  "location": "Job location(s)",
  "jobType": "full_time or part_time or internship or contract",
  "duration": "Duration for internship, e.g., '3 months' or empty string",
  "salary": {
    "min": null or number,
    "max": null or number,
    "currency": "INR"
  },
  "suggestedSkills": ["skill1", "skill2", ...],
  "experienceLevel": "entry or junior or mid or senior",
  "maxPositions": number or 1
}

Rules:
1. For salary, convert to annual INR if possible. Monthly salary * 12, hourly * 2000.
2. For jobType, infer from context. "Intern" means internship, "Contract" or "Freelance" means contract.
3. suggestedSkills should contain technical skills, tools, programming languages mentioned.
4. Keep requirements and responsibilities as separate, clear bullet points.
5. Return ONLY the JSON object, nothing else.
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
        
        // Validate and clean the response
        return {
          title: parsed.title || '',
          company: {
            name: parsed.company?.name || '',
            website: parsed.company?.website || '',
            description: parsed.company?.description || ''
          },
          description: parsed.description || '',
          requirements: Array.isArray(parsed.requirements) ? parsed.requirements.filter(r => r) : [],
          responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities.filter(r => r) : [],
          location: parsed.location || '',
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
          maxPositions: typeof parsed.maxPositions === 'number' ? parsed.maxPositions : 1
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
