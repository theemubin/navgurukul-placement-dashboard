const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const cheerio = require('cheerio');
const axios = require('axios');

class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  // Extract text from PDF buffer
  async extractTextFromPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Extract text from URL
  async extractTextFromURL(url) {
    try {
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
      throw new Error('Failed to extract content from URL. The page might be protected or unavailable.');
    }
  }

  // Parse JD using Google Gemini AI
  async parseJobDescription(text, existingSkills = []) {
    if (!this.genAI) {
      throw new Error('AI service not configured. Please add your Google AI API key in Settings.');
    }

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

    try {
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
        jobType: ['full_time', 'part_time', 'internship', 'contract'].includes(parsed.jobType) 
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
      console.error('AI parsing error:', error);
      
      if (error.message?.includes('API key')) {
        throw new Error('Invalid API key. Please check your Google AI API key in Settings.');
      }
      
      if (error instanceof SyntaxError) {
        throw new Error('AI returned invalid response. Please try again.');
      }
      
      throw new Error('Failed to parse job description with AI. Please try again or fill manually.');
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
    if (/\b(internship|intern)\b/i.test(text)) result.jobType = 'internship';
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
