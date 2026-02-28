const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule && (pdfParseModule.default || pdfParseModule);
const cheerio = require('cheerio');
const axios = require('axios');
const { searchWeb } = require('../utils/searchHelper');

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
    const keyPreview = this.apiKey ? `...${this.apiKey.slice(-8)}` : 'NONE';
    console.log(`[AIService] Initialized with ${this.apiKeys.length} key(s), using key #1 (${keyPreview})`);
  }

  // Rotate to next available API key
  rotateKey() {
    if (this.apiKeys.length <= 1) return false;

    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    this.apiKey = this.apiKeys[this.currentKeyIndex];
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    const keyPreview = `...${this.apiKey.slice(-8)}`;
    console.log(`[AIService] Rotated to API key #${this.currentKeyIndex + 1} (${keyPreview})`);
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
        // Try models in order of preference with proper model names
        const availableModels = [
          'models/gemini-flash-latest',
          'models/gemini-pro-latest',
          'models/gemini-2.5-flash',
          'models/gemini-2.0-flash'
        ];
        let model = null;
        let modelUsed = null;

        for (const modelName of availableModels) {
          try {
            model = this.genAI.getGenerativeModel({ model: modelName });
            modelUsed = modelName;
            console.log(`[AIService] Using model: ${modelName}`);
            break;
          } catch (e) {
            console.log(`Model ${modelName} not available, trying next...`);
            continue;
          }
        }

        if (!model) {
          throw new Error('No compatible Gemini models available for this API key');
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

  // Specialized entity extraction for scam analysis search queries
  async extractEntities(text) {
    if (!this.genAI) return { company: '', manager: '', domain: '' };

    try {
      const model = this.genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });
      const prompt = `
        Extract the following entities from this job offer/email text for web searching. 
        Return ONLY valid JSON:
        {
          "company": "Company Name",
          "manager": "Hiring Manager Name (Full Name if available)",
          "domain": "Company domain if mentioned (e.g. google.com)"
        }
        
        TEXT:
        ${text.substring(0, 3000)}
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let responseText = response.text()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Entity extraction error:', error);
      return { company: '', manager: '', domain: '' };
    }
  }

  // Analyze for scam signals using Gemini with optional screenshot/email context
  async analyzeScam(payload) {
    if (!this.genAI) {
      throw new Error('AI service not configured. Please add your Google AI API key in Settings.');
    }

    const normalized = typeof payload === 'string'
      ? { input: payload }
      : (payload || {});

    const safeInput = typeof normalized.input === 'string' ? normalized.input.trim() : '';
    const safeEmailHeader = typeof normalized.emailHeader === 'string' ? normalized.emailHeader.trim() : '';
    const safeSenderEmail = typeof normalized.senderEmail === 'string' ? normalized.senderEmail.trim() : '';
    const safeCompanyUrl = typeof normalized.companyUrl === 'string' ? normalized.companyUrl.trim() : '';
    const safeImageBase64 = typeof normalized.imageBase64 === 'string' ? normalized.imageBase64.trim() : '';
    const imageMimeType = normalized.imageMimeType || 'image/jpeg';

    const compositeText = [
      safeInput,
      safeEmailHeader ? `Email Header/Body:\n${safeEmailHeader}` : '',
      safeSenderEmail ? `Sender Email: ${safeSenderEmail}` : '',
      safeCompanyUrl ? `Company URL: ${safeCompanyUrl}` : ''
    ].filter(Boolean).join('\n\n');

    if (!compositeText && !safeImageBase64) {
      throw new Error('Offer details are required');
    }

    // 1. EXTRACT ENTITIES & SEARCH WEB
    let searchContext = '';
    const sourcesFound = [];

    try {
      console.log('[ScamAnalysis] Extracting entities for search...');
      // If we have an image but no text, we might need to extract text from image first for entities
      // but let's assume compositeText has some info or the image is analyzed later.
      const entities = await this.extractEntities(compositeText || 'New Job Offer');

      const searchQueries = [];
      if (entities.company) {
        searchQueries.push(`${entities.company} company scam OR warning`);
        searchQueries.push(`${entities.company} glassdoor OR ambitionbox reviews`);
        searchQueries.push(`${entities.company} reddit internship scam`);
        searchQueries.push(`${entities.company} quora reviews`);
      }
      if (entities.manager) {
        searchQueries.push(`${entities.manager} ${entities.company || ''} linkedin`);
      }
      if (entities.domain) {
        searchQueries.push(`whois ${entities.domain} registration date`);
      }

      if (searchQueries.length > 0) {
        console.log(`[ScamAnalysis] Performing ${searchQueries.length} web searches...`);
        const searchPromises = searchQueries.map(q => searchWeb(q, 3));
        const searchResults = await Promise.all(searchPromises);

        const flattened = searchResults.flat();
        flattened.forEach(res => {
          if (!sourcesFound.some(s => s.link === res.link)) {
            sourcesFound.push(res);
          }
        });

        searchContext = "WEB SEARCH RESULTS (FOR CONTEXT):\n" +
          flattened.map(res => `SOURCE: ${res.title}\nLINK: ${res.link}\nCONTENT: ${res.snippet}`).join('\n---\n');
      }
    } catch (searchErr) {
      console.warn('[ScamAnalysis] Search phase failed, proceeding with text-only analysis:', searchErr.message);
    }

    const maxRetries = this.apiKeys.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const modelConfigs = [
          { model: 'models/gemini-flash-latest' },
          { model: 'models/gemini-pro-latest' },
          { model: 'models/gemini-2.5-flash' },
          { model: 'models/gemini-2.0-flash' }
        ];

        const prompt = `
You are ScamRadar, an expert at detecting job scams, fake internships, and fraudulent offers. 

CURRENT DATE: ${new Date().toLocaleDateString()}
CONTEXT: You are auditing a job offer for a student in India. 2024 was about 2 years ago, which is generally enough time for a legitimate small business to establish itself, though still "young". 

CRITICAL INSTRUCTION: Only include SPECIFIC VERIFIED FINDINGS. 
When providing links, use the ACTUAL LINKS provided in the search context if they are relevant.

YOUR MISSION:
1. Extract exact company name, domain, sender email, hiring manager name.
2. RESEARCH: Analyze the provided Web Search Results. 
   - Check if the LinkedIn profile found matches the hiring manager.
   - Check the domain registration info.
   - Look for reviews on Glassdoor/AmbitionBox/etc.
3. BE FAIR ABOUT SALARY: Low internship stipend (even ₹10-15k) or unpaid roles are common in India and NOT necessarily a scam. Judge based on bait (uncharacteristically HIGH salary) rather than low pay.
4. DOMAIN AGE: A domain from 2024 is NOT necessarily a red flag in 2026. It's a red flag only if it's < 6 months old or registered just days before the offer.
5. Be HONEST & SKEPTICAL. If you cannot verify something, SAY SO clearly.

SEARCH CONTEXT PROVIDED:
${searchContext || 'No real-time search results available.'}

INPUT DETAILS FROM USER:
"""
${compositeText || 'Image provided without extra text'}
"""

You MUST respond with ONLY valid JSON in exactly this structure:
{
  "company": "Company name",
  "role": "Job title/role",
  "trustScore": <number 0-100>,
  "verdict": "SAFE" | "WARNING" | "DANGER",
  "summary": "2-3 sentence honest summary of findings",
  "subScores": {
    "companyLegitimacy": <0-100>,
    "offerRealism": <0-100>,
    "processFlags": <0-100>,
    "communitySentiment": <0-100>
  },
  "redFlags": ["flag1", "flag2", ...],
  "greenFlags": ["flag1", "flag2", ...],
  "communityFindings": [
    {
      "source": "Reddit / Student Communities",
      "icon": "Users",
      "finding": "E.g. 'Multiple Reddit users reported this as a fake internship asking for enrollment fees.'",
      "sentiment": "negative",
      "links": [{"title": "Reddit Discussion", "url": "url from context"}]
    },
    {
      "source": "Glassdoor / AmbitionBox / Reviews",
      "icon": "BarChart3",
      "finding": "E.g. 'Company has a 1.2 star rating. Reviews warn about advance payments.'",
      "sentiment": "negative",
      "links": [{"title": "Glassdoor Reviews", "url": "url"}]
    },
    {
      "source": "LinkedIn Verification",
      "icon": "User",
      "finding": "E.g. 'Found Manager Name on LinkedIn' or 'Widespread scam warnings on LinkedIn'",
      "sentiment": "positive" | "negative",
      "links": [{"title": "LinkedIn Profile/Post", "url": "url"}]
    },
    {
      "source": "Domain Age / General Web Search",
      "icon": "Globe",
      "finding": "E.g. 'Domain registered recently. No official presence found.'",
      "sentiment": "neutral",
      "links": []
    }
    // You can add more findings like Quora, Google Reviews, FTC Complaints, etc. based on search context.
  ],
  "salaryCheck": {
    "offered": "String salary",
    "marketRate": "Comparison",
    "verdict": "Realistic" | "Slightly High" | "Unrealistically High" | "Too Low" | "Unknown",
    "explanation": "Brief explanation"
  },
  "domainAnalysis": {
    "companyDomain": "e.g. company.com",
    "domainAge": "Year",
    "domainRisk": "Low | Medium | High",
    "senderDomainMatch": "Match | Mismatch | Unknown",
    "explanation": "Details"
  },
  "emailChecks": [
    { "check": "Domain Match", "status": "pass|fail", "detail": "Details" }
  ],
  "resourceLinks": [
    { "icon": "ExternalLink", "title": "Glassdoor Review", "url": "Actual URL if found", "desc": "Check company feedback" }
  ],
  "sources": [
    { "title": "Source Title", "url": "Actual URL from context" }
  ],
  "finalVerdict": "Detailed 3-4 sentence verdict",
  "actionItems": ["Action 1"]
}
`;

        let parsed = null;
        let modelError = null;

        for (const config of modelConfigs) {
          const keyPreview = this.apiKey ? `...${this.apiKey.slice(-8)}` : 'NONE';
          try {
            console.log(`[ScamAnalysis] Trying model: ${config.model} with key #${this.currentKeyIndex + 1} (${keyPreview})`);
            const model = this.genAI.getGenerativeModel(config);
            const parts = [{ text: prompt }];
            if (safeImageBase64) {
              parts.unshift({
                inlineData: {
                  data: safeImageBase64,
                  mimeType: imageMimeType
                }
              });
            }

            const result = await model.generateContent(parts);
            const response = await result.response;
            let responseText = response.text();

            responseText = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim();

            parsed = JSON.parse(responseText);
            console.log(`[ScamAnalysis] ✅ SUCCESS with model: ${config.model} (key #${this.currentKeyIndex + 1}: ${keyPreview})`);
            break;
          } catch (err) {
            const errorMsg = err?.message || 'Unknown error';
            console.error(`[ScamAnalysis] ❌ Model ${config.model} failed with key #${this.currentKeyIndex + 1} (${keyPreview}):`, errorMsg.substring(0, 200));
            modelError = err;
            continue;
          }
        }

        if (parsed) {
          return parsed;
        }

        throw modelError || new Error('AI model unavailable for scam analysis');

      } catch (error) {
        console.error(`Scam analysis error (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;

        if (attempt < maxRetries - 1 && this.rotateKey()) {
          continue;
        }
        const errorMessage = error?.message || '';
        const normalizedMessage = /supported methods|not found|invalid|permission|access|quota|429|403|404/i.test(errorMessage)
          ? 'AI request failed. Please verify your Google AI Studio key has Gemini access, then try again.'
          : errorMessage;
        throw new Error(normalizedMessage || 'Failed to analyze for scam signals');
      }
    }

    throw new Error(lastError?.message || 'Failed to analyze for scam signals');
  }

  // Fallback: heuristic scam analysis when AI/web search is unavailable
  analyzeScamFallback(payload, reason = '') {
    const normalized = typeof payload === 'string' ? { input: payload } : (payload || {});
    const safeInput = typeof normalized.input === 'string' ? normalized.input : '';
    const safeEmailHeader = typeof normalized.emailHeader === 'string' ? normalized.emailHeader : '';
    const safeSenderEmail = typeof normalized.senderEmail === 'string' ? normalized.senderEmail : '';
    const safeCompanyUrl = typeof normalized.companyUrl === 'string' ? normalized.companyUrl : '';

    const baseText = [safeInput, safeEmailHeader, safeSenderEmail, safeCompanyUrl]
      .filter(Boolean)
      .join(' ')
      .trim();

    const text = baseText.toLowerCase();

    const redRules = [
      { regex: /pay|fee|deposit|verification fee|background check.*\$|registration fee|security amount/, flag: 'Asked to pay money upfront before onboarding.' },
      { regex: /zelle|gift card|crypto|usdt|bitcoin|wire transfer/, flag: 'Requests payment through high-risk or irreversible channels.' },
      { regex: /send.*bank details|ssn|aadhaar|otp|password|upi pin/, flag: 'Sensitive personal/financial data requested too early.' },
      { regex: /whatsapp|telegram.*(offer|interview)|dm me/, flag: 'Recruitment appears to happen via informal channels.' },
      { regex: /too good to be true|easy money|guaranteed salary|no interview/, flag: 'Offer language indicates unrealistic promises.' },
      { regex: /check.*equipment|equipment reimbursement|advance check/, flag: 'Classic fake check / equipment reimbursement pattern detected.' },
      { regex: /unpaid.*40 hours|free work|no salary/, flag: 'Heavy unpaid workload with weak employer assurances.' }
    ];

    const greenRules = [
      { regex: /official website|careers page|company email|@/, flag: 'Some signs of formal company communication are present.' },
      { regex: /offer letter|interview round|hr round|joining date/, flag: 'Structured hiring process indicators are present.' },
      { regex: /no payment required|background check by company|on payroll/, flag: 'No upfront payment requirement is stated.' }
    ];

    const redFlags = redRules.filter(rule => rule.regex.test(text)).map(rule => rule.flag);
    const greenFlags = greenRules.filter(rule => rule.regex.test(text)).map(rule => rule.flag);

    let trustScore = 62;
    trustScore -= redFlags.length * 12;
    trustScore += greenFlags.length * 6;

    if (/urgent|immediately|within 1 hour|today only/.test(text)) {
      redFlags.push('Urgency pressure detected in communication style.');
      trustScore -= 8;
    }

    if (/company website was created|new website|domain.*new|no linkedin/.test(text)) {
      redFlags.push('Low company credibility signals (new/weak web presence).');
      trustScore -= 10;
    }

    trustScore = Math.max(5, Math.min(95, trustScore));

    let verdict = 'WARNING';
    if (trustScore >= 72 && redFlags.length <= 1) verdict = 'SAFE';
    if (trustScore <= 39 || redFlags.length >= 3) verdict = 'DANGER';

    const companyMatch = baseText.match(/from\s+([A-Za-z0-9\s&.-]{2,60})/i) || baseText.match(/company[:\s]+([^\n,]+)/i);
    const roleMatch = baseText.match(/role[:\s]+([^\n,]+)/i) || baseText.match(/for\s+a?n?\s+([A-Za-z0-9\s-]{2,60})/i);

    const company = companyMatch ? companyMatch[1].trim() : 'Unknown Company';
    const role = roleMatch ? roleMatch[1].trim() : 'Unknown Role';

    const domainFromEmail = safeSenderEmail.includes('@') ? safeSenderEmail.split('@')[1].toLowerCase() : '';
    const domainFromUrl = (() => {
      try {
        return safeCompanyUrl ? new URL(safeCompanyUrl).hostname.replace(/^www\./, '').toLowerCase() : '';
      } catch {
        return '';
      }
    })();

    const domainMatch = domainFromEmail && domainFromUrl
      ? (domainFromEmail === domainFromUrl || domainFromEmail.endsWith(`.${domainFromUrl}`) ? 'Match' : 'Mismatch')
      : 'Unknown';

    const subScores = {
      companyLegitimacy: Math.max(5, Math.min(95, trustScore + (greenFlags.length * 2) - (redFlags.length * 3))),
      offerRealism: Math.max(5, Math.min(95, trustScore + (greenFlags.length * 3) - (redFlags.length * 4))),
      processFlags: Math.max(5, Math.min(95, trustScore + (greenFlags.length * 1) - (redFlags.length * 5))),
      communitySentiment: Math.max(5, Math.min(95, trustScore + (greenFlags.length * 2) - (redFlags.length * 2)))
    };

    const summary = verdict === 'DANGER'
      ? 'Multiple high-risk scam indicators were detected in this offer text.'
      : verdict === 'SAFE'
        ? 'No major scam pattern was detected from the provided details, but verification is still recommended.'
        : 'Some suspicious indicators were found; verify independently before sharing documents or money.';

    const actionItems = [
      'Do not pay any upfront fee for onboarding, verification, or equipment.',
      'Verify company domain, LinkedIn presence, and official careers page.',
      'Ask for a formal offer letter from an official company email domain.',
      'Confirm role legitimacy with at least one public company contact channel.'
    ];

    if (redFlags.some(flag => /payment|money|fee|check/i.test(flag))) {
      actionItems.unshift('Pause all money transfers immediately until independent verification is complete.');
    }

    return {
      company,
      role,
      trustScore,
      verdict,
      summary,
      subScores,
      redFlags: redFlags.length ? redFlags : ['No explicit red flags detected from text-only heuristic scan.'],
      greenFlags: greenFlags.length ? greenFlags : ['No strong legitimacy indicators were found in provided details.'],
      communityFindings: [
        {
          source: 'Heuristic Analysis',
          icon: '🧠',
          finding: 'This result is generated from deterministic scam-pattern rules because AI web analysis was unavailable.',
          sentiment: 'neutral'
        },
        {
          source: 'Payment Risk Patterns',
          icon: '🚨',
          finding: redFlags.filter(flag => /pay|fee|deposit|check|money|crypto|zelle/i.test(flag)).join(' ') || 'No direct payment scam pattern detected.',
          sentiment: redFlags.some(flag => /pay|fee|deposit|check|money|crypto|zelle/i.test(flag)) ? 'negative' : 'neutral'
        },
        {
          source: 'Identity & Data Safety',
          icon: '🔐',
          finding: redFlags.filter(flag => /Sensitive|personal|financial/i.test(flag)).join(' ') || 'No direct credential-harvesting pattern detected.',
          sentiment: redFlags.some(flag => /Sensitive|personal|financial/i.test(flag)) ? 'negative' : 'neutral'
        },
        {
          source: 'Reliability Note',
          icon: 'ℹ️',
          finding: reason ? `AI unavailable reason: ${reason}` : 'AI web-grounded mode unavailable; using fallback scoring.',
          sentiment: 'neutral'
        }
      ],
      salaryCheck: {
        offered: /\$|inr|rs\.?|lpa|stipend/i.test(baseText) ? 'Detected in input' : 'Not specified',
        marketRate: 'Unknown',
        verdict: trustScore <= 39 ? 'Unrealistically High' : trustScore >= 72 ? 'Realistic' : 'Unknown',
        explanation: 'Fallback mode cannot verify live salary benchmarks without external web-grounding.'
      },
      domainAnalysis: {
        companyDomain: domainFromUrl || domainFromEmail || 'Unknown',
        domainAge: 'Unknown',
        domainRisk: domainMatch === 'Mismatch' ? 'High' : domainMatch === 'Match' ? 'Low' : 'Unknown',
        senderDomainMatch: domainMatch,
        explanation: domainMatch === 'Mismatch'
          ? 'Sender email domain does not match the provided company domain.'
          : domainMatch === 'Match'
            ? 'Sender domain appears to align with the provided company domain.'
            : 'Insufficient domain information for full forensic verification.'
      },
      emailChecks: [
        {
          check: 'Sender domain matches company',
          status: domainMatch === 'Match' ? 'pass' : domainMatch === 'Mismatch' ? 'fail' : 'unknown',
          detail: domainMatch === 'Unknown' ? 'Missing sender email or company URL.' : `Result: ${domainMatch}`
        },
        {
          check: 'No personal email used for hiring',
          status: /@gmail\.com|@yahoo\.com|@hotmail\.com/i.test(safeSenderEmail) ? 'warn' : safeSenderEmail ? 'pass' : 'unknown',
          detail: safeSenderEmail || 'Sender email not provided.'
        }
      ],
      resourceLinks: [
        { icon: '🏛️', title: 'Cyber Crime Portal', desc: 'Report to Indian authorities', url: 'https://www.cybercrime.gov.in/' },
        { icon: '📱', title: 'National Helpline 1930', desc: 'Call for cyber fraud help', url: 'tel:1930' },
        { icon: '📊', title: 'AmbitionBox Reviews', desc: 'Check Indian company reviews', url: 'https://www.ambitionbox.com/' },
        { icon: '💬', title: 'Reddit r/DevelopersIndia', desc: 'Indian developer community', url: 'https://reddit.com/r/developersIndia' },
        { icon: '🎯', title: 'Naukri Fraud Alert', desc: 'Official job portal warnings', url: 'https://www.naukri.com/fraud-alert' }
      ],
      finalVerdict: verdict === 'DANGER'
        ? 'This offer appears high risk based on known scam patterns. Do not share money or sensitive documents until independently verified through official company channels.'
        : verdict === 'SAFE'
          ? 'This offer looks relatively safer from text-level checks, but you should still verify recruiter identity and company channels before proceeding.'
          : 'Proceed cautiously. The offer includes suspicious signals that require manual verification before you accept or share sensitive information.',
      actionItems: Array.from(new Set(actionItems)).slice(0, 5),
      analysisMode: 'fallback',
      analysisWarning: reason || 'AI web-grounded analysis unavailable. Returned heuristic result.'
    };
  }

  // Health check for AI service
  async getStatus() {
    if (!this.apiKey || !this.genAI) {
      return { configured: false, enabled: false, working: false, message: 'AI key not configured' };
    }

    try {
      // Actually try to call the API briefly to verify key validity
      const model = this.genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });
      const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'Hello' }] }], generationConfig: { maxOutputTokens: 1 } });
      await result.response;
      return { configured: true, enabled: true, working: true };
    } catch (error) {
      console.log('AI Health Check failed:', error.message);
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
