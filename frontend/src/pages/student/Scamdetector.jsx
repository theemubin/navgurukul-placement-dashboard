import { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Search,
  Upload,
  Mail,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Loader,
  RefreshCw,
  ExternalLink,
  Key,
  Plus,
  Trash2,
  Save,
  Users,
  TrendingUp,
  Eye,
  X,
  Settings,
  XCircle,
  Brain,
  HelpCircle,
  Building2,
  Phone,
  BarChart3,
  Target,
  DollarSign,
  Laptop,
  Coins,
  ClipboardList,
  Check,
  User,
  Image as ImageIcon,
  Link as LinkIcon,
  ArrowUpRight
} from 'lucide-react';
import { utilsAPI, userAPI, scamReportsAPI } from '../../services/api';
import { TrustScoreCircle, MiniCircularProgress } from '../../components/CircularProgress';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const HISTORY_KEY = 'scamradar_history_v2';
const REPORTS_KEY = 'scamradar_reports_v2';

const EXAMPLES = {
  advance: `Got a remote job offer from GlobalPay Digital Agency. They are paying $3500/month for data entry from home. They are sending a $4500 check for equipment setup, and I keep $1000 as signing bonus. But I need to wire $3000 to their equipment vendor via Zelle within 24 hours. No interview. HR is reachable only on WhatsApp.`,
  equipment: `TechBridge Solutions offered me a frontend developer internship, $4000/month, fully remote. They said to buy a MacBook Pro and they will reimburse in first paycheck. Offer came from hr.techbridge2024@gmail.com and they need answer in 2 hours.`,
  crypto: `CryptoNexus Ventures is hiring Blockchain Analysts for $8000/month in USDT. No experience needed. Need to make a $500 verification deposit first. Company website was made 3 weeks ago. Contact only on Telegram.`,
  unpaid: `Received internship from InnovateLab — unpaid, 6 months, 40 hrs/week. They asked for $150 background check fee, want social media account access, and included a strict 3-year non-compete clause.`
};

const PRESCREEN_PATTERNS = [
  { pattern: /buy.*?(laptop|macbook|equipment|device)/i, label: 'Buy equipment upfront' },
  { pattern: /reimburse|reimbursement/i, label: 'Promises reimbursement' },
  { pattern: /send.*?(check|cheque|zelle|cashapp|venmo|crypto|bitcoin|usdt)/i, label: 'Unusual payment method' },
  { pattern: /no interview|without interview|skip.*?interview/i, label: 'No interview required' },
  { pattern: /verification.*?(deposit|fee|payment)|upfront.*?(fee|payment|deposit)/i, label: 'Verification/upfront fee required' },
  { pattern: /whatsapp|telegram/i, label: 'Recruiter on WhatsApp/Telegram' },
  { pattern: /ssn|social security|bank.*?detail|account.*?number|aadhaar/i, label: 'Sensitive info requested early' },
  { pattern: /wire transfer|western union|moneygram/i, label: 'Wire transfer requested' }
];

const STEPS = [
  'Extracting details',
  'Checking domain age',
  'Searching Reddit mentions',
  'Scanning review sources',
  'Checking forum discussions',
  'Detecting scam patterns',
  'Running salary sanity check',
  'Evaluating email/domain signals',
  'Scoring trust signals',
  'Generating final verdict'
];

const defaultResources = [
  { icon: 'Shield', title: 'Cyber Crime Portal', desc: 'Report to Indian authorities', url: 'https://www.cybercrime.gov.in/' },
  { icon: 'Phone', title: 'National Helpline 1930', desc: 'Call for cyber fraud help', url: 'tel:1930' },
  { icon: 'BarChart3', title: 'AmbitionBox Reviews', desc: 'Check Indian company reviews', url: 'https://www.ambitionbox.com/' },
  { icon: 'Target', title: 'Naukri Fraud Alert', desc: 'Official job portal warnings', url: 'https://www.naukri.com/fraud-alert' }
];

const getIcon = (name, className = "w-4 h-4") => {
  const icons = {
    Shield: Shield,
    Phone: Phone,
    BarChart3: BarChart3,
    Target: Target,
    User: User,
    Building2: Building2,
    AlertTriangle: AlertTriangle,
    CheckCircle2: CheckCircle2,
    Search: Search,
    ImageIcon: ImageIcon,
    Mail: Mail,
    Users: Users,
    DollarSign: DollarSign,
    Laptop: Laptop,
    Coins: Coins,
    ClipboardList: ClipboardList,
    FileText: FileText,
    Upload: Upload,
    ExternalLink: ExternalLink,
    Brain: Brain,
    Loader: Loader
  };
  const IconComponent = icons[name] || HelpCircle;
  return <IconComponent className={className} />;
};

const getStorage = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const scoreClass = (score) => {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
};

const verdictClass = (verdict) => {
  if (verdict === 'SAFE') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (verdict === 'DANGER') return 'bg-red-50 border-red-200 text-red-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
};

const normalizeResult = (raw = {}) => {
  const trustScore = Math.max(0, Math.min(100, Number(raw.trustScore || 0)));
  const verdict = ['SAFE', 'WARNING', 'DANGER'].includes(String(raw.verdict || '').toUpperCase())
    ? String(raw.verdict).toUpperCase()
    : (trustScore <= 39 ? 'DANGER' : trustScore >= 72 ? 'SAFE' : 'WARNING');

  const sub = raw.subScores || {};

  return {
    company: raw.company || 'Unknown Company',
    role: raw.role || 'Unknown Role',
    trustScore,
    verdict,
    summary: raw.summary || 'Scam analysis completed using available detection signals.',
    redFlags: Array.isArray(raw.redFlags) ? raw.redFlags : [],
    greenFlags: Array.isArray(raw.greenFlags) ? raw.greenFlags : [],
    communityFindings: Array.isArray(raw.communityFindings) ? raw.communityFindings : [],
    salaryCheck: raw.salaryCheck || null,
    domainAnalysis: raw.domainAnalysis || {},
    emailChecks: Array.isArray(raw.emailChecks) ? raw.emailChecks : [],
    subScores: {
      companyLegitimacy: Number(sub.companyLegitimacy || trustScore),
      offerRealism: Number(sub.offerRealism || Math.max(0, trustScore - 5)),
      processFlags: Number(sub.processFlags || Math.max(0, trustScore - 10)),
      communitySentiment: Number(sub.communitySentiment || trustScore)
    },
    resourceLinks: Array.isArray(raw.resourceLinks) && raw.resourceLinks.length > 0 ? raw.resourceLinks : defaultResources,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    finalVerdict: raw.finalVerdict || raw.summary || 'Proceed only after independent verification.',
    actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
    analysisMode: raw.analysisMode || 'ai',
    analysisWarning: raw.analysisWarning || ''
  };
};

const ScamDetector = () => {
  const [activeTab, setActiveTab] = useState('text');
  const [offerInput, setOfferInput] = useState('');
  const [emailHeaderInput, setEmailHeaderInput] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // API Key Modal State
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Analysis Animation State
  const [analysisAnimation, setAnalysisAnimation] = useState({
    visible: false,
    progress: 0,
    currentStep: '',
    steps: []
  });

  const [aiKeys, setAiKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [newKey, setNewKey] = useState({ key: '', label: '' });
  const [testingKey, setTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null);

  // New state for saving reports and company stats
  const [savingReport, setSavingReport] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [companyStats, setCompanyStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const prescreenHits = useMemo(() => {
    if (offerInput.trim().length < 30) return [];
    return PRESCREEN_PATTERNS.filter((rule) => rule.pattern.test(offerInput)).map((rule) => rule.label);
  }, [offerInput]);

  useEffect(() => {
    setHistory(getStorage(HISTORY_KEY, []));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1400);
    return () => clearInterval(timer);
  }, [loading]);

  const fetchAIKeys = async () => {
    try {
      setKeysLoading(true);
      const response = await userAPI.getAIKeys();
      setAiKeys(response.data.keys || []);
    } catch {
      setAiKeys([]);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchAIKeys();
  }, []);

  const handleAddKey = async (e) => {
    e.preventDefault();
    if (!newKey.key.trim()) {
      toast.error('API key is required');
      return;
    }

    try {
      setSavingKey(true);
      const response = await userAPI.addAIKey({
        key: newKey.key.trim(),
        label: newKey.label.trim() || `Key ${aiKeys.length + 1}`
      });
      setAiKeys(response.data.keys || []);
      setNewKey({ key: '', label: '' });
      toast.success('API key added successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleToggleKey = async (keyId, isActive) => {
    try {
      const response = await userAPI.updateAIKey(keyId, { isActive: !isActive });
      setAiKeys(response.data.keys || []);
    } catch {
      toast.error('Failed to update key status');
    }
  };

  const handleTestKey = async () => {
    try {
      setTestingKey(true);
      setKeyTestResult(null);
      const response = await utilsAPI.testAIKey();
      setKeyTestResult(response.data);

      if (response.data.success) {
        toast.success('API key works!');
      } else {
        toast.error(response.data.error || 'API key test failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to test API key';
      setKeyTestResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setTestingKey(false);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!confirm('Delete this API key?')) return;
    try {
      const response = await userAPI.deleteAIKey(keyId);
      setAiKeys(response.data.keys || []);
      toast.success('API key deleted');
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const [prefix, base64] = dataUrl.split(',');
      const mime = prefix?.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
      setImageBase64(base64 || '');
      setImageMimeType(mime);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageBase64('');
    setImagePreview('');
    setImageMimeType('image/jpeg');
  };

  const saveHistory = (entry) => {
    const latest = [entry, ...history].slice(0, 20);
    setHistory(latest);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(latest));
  };

  const getReports = (company) => {
    const reports = getStorage(REPORTS_KEY, {});
    return reports[company] || { scam: 0, legit: 0, unsure: 0 };
  };

  const submitReport = (company, type) => {
    const reports = getStorage(REPORTS_KEY, {});
    if (!reports[company]) reports[company] = { scam: 0, legit: 0, unsure: 0 };
    reports[company][type] = (reports[company][type] || 0) + 1;
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    toast.success('Thanks for reporting this offer.');
    if (result) {
      setResult({ ...result });
    }
  };

  const loadHistoryItem = (item) => {
    setResult(item.result);
  };

  const buildPayload = () => {
    if (activeTab === 'text') {
      if (!offerInput.trim()) {
        throw new Error('Please paste your offer details first.');
      }
      return {
        input: offerInput.trim(),
        sourceType: 'text'
      };
    }

    if (activeTab === 'image') {
      if (!imageBase64) {
        throw new Error('Please upload a screenshot first.');
      }
      return {
        input: 'Analyze this uploaded screenshot for job scam signals. Extract all visible text and detect fraud patterns.',
        imageBase64,
        imageMimeType,
        sourceType: 'image'
      };
    }

    if (!emailHeaderInput.trim() && !senderEmail.trim()) {
      throw new Error('Please enter email details first.');
    }

    return {
      input: `Email body/header:\n${emailHeaderInput || 'Not provided'}\nSender email: ${senderEmail || 'Not provided'}\nCompany URL: ${companyUrl || 'Not provided'}`,
      emailHeader: emailHeaderInput.trim(),
      senderEmail: senderEmail.trim(),
      companyUrl: companyUrl.trim(),
      sourceType: 'email'
    };
  };

  const handleAnalyze = async () => {
    try {
      // Check if API keys are configured
      if (aiKeys.length === 0) {
        toast.error('Please configure your AI API key first');
        setShowKeyModal(true);
        return;
      }

      const payload = buildPayload();

      setLoading(true);
      setStep(0);
      setResult(null);
      setReportSaved(false); // Reset save status

      // Start analysis animation
      setAnalysisAnimation({
        visible: true,
        progress: 0,
        currentStep: STEPS[0],
        steps: STEPS
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisAnimation(prev => {
          if (prev.progress >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          const newProgress = prev.progress + (Math.random() * 15) + 5;
          const stepIndex = Math.floor((newProgress / 100) * STEPS.length);
          return {
            ...prev,
            progress: Math.min(95, newProgress),
            currentStep: STEPS[stepIndex] || STEPS[STEPS.length - 1]
          };
        });
      }, 1000);

      const response = await utilsAPI.analyzeScam(payload);

      // Complete animation
      clearInterval(progressInterval);
      setAnalysisAnimation(prev => ({
        ...prev,
        progress: 100,
        currentStep: 'Analysis complete!'
      }));

      // Hide animation after a brief delay
      setTimeout(() => {
        setAnalysisAnimation(prev => ({
          ...prev,
          visible: false
        }));
      }, 1500);

      const normalized = normalizeResult(response.data || {});
      setResult(normalized);

      // Fetch company stats after getting result
      if (normalized.company && normalized.company !== 'Unknown Company') {
        fetchCompanyStats(normalized.company);
      }

      const vc = normalized.verdict === 'SAFE' ? 'safe' : normalized.verdict === 'DANGER' ? 'danger' : 'warning';
      saveHistory({
        company: normalized.company,
        score: normalized.trustScore,
        verdictClass: vc,
        date: new Date().toLocaleDateString(),
        result: normalized
      });
    } catch (error) {
      // Hide animation on error
      setAnalysisAnimation(prev => ({
        ...prev,
        visible: false
      }));

      const message = error?.response?.data?.message || error.message || 'Analysis failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fillExample = (key) => {
    setActiveTab('text');
    setOfferInput(EXAMPLES[key]);
  };

  // Fetch company stats
  const fetchCompanyStats = async (companyName) => {
    try {
      setLoadingStats(true);
      const response = await scamReportsAPI.getCompanyReports(companyName, { limit: 5 });
      setCompanyStats(response.data);
    } catch (error) {
      console.log('Failed to fetch company stats:', error);
      setCompanyStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  // Save report to public repository
  const handleSaveReport = async () => {
    if (!result) return;

    try {
      setSavingReport(true);

      // Prepare report data
      const reportData = {
        companyName: result.company,
        roleName: result.role,
        trustScore: result.trustScore,
        verdict: result.verdict,
        summary: result.summary,
        analysisData: {
          subScores: result.subScores,
          redFlags: result.redFlags,
          greenFlags: result.greenFlags,
          communityFindings: result.communityFindings,
          salaryCheck: result.salaryCheck,
          domainAnalysis: result.domainAnalysis,
          emailChecks: result.emailChecks,
          finalVerdict: result.finalVerdict,
          actionItems: result.actionItems,
          resourceLinks: result.resourceLinks
        },
        inputData: {
          originalText: activeTab === 'text' ? offerInput :
            activeTab === 'email' ? `${emailHeaderInput} ${senderEmail} ${companyUrl}` :
              'Screenshot analysis',
          emailHeader: emailHeaderInput,
          senderEmail: senderEmail,
          companyUrl: companyUrl,
          sourceType: activeTab
        },
        isPublic: true
      };

      await scamReportsAPI.saveReport(reportData);
      setReportSaved(true);
      toast.success('Report saved to community repository! Thank you for helping fellow students.');

      // Refresh company stats
      if (result.company && result.company !== 'Unknown Company') {
        fetchCompanyStats(result.company);
      }

    } catch (error) {
      console.error('Save report error:', error);
      toast.error('Failed to save report: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingReport(false);
    }
  };

  // API Key Management Functions
  const handleSaveKey = async () => {
    if (!newKey.key.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    try {
      setSavingKey(true);
      const response = await userAPI.addAIKey({
        key: newKey.key.trim(),
        label: newKey.label.trim() || `Key ${aiKeys.length + 1}`
      });

      setAiKeys(response.data.keys || []);
      setNewKey({ key: '', label: '' });
      setKeyTestResult(null);
      toast.success('API key saved successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const removeAiKey = async (keyId) => {
    if (!confirm('Delete this API key?')) return;
    try {
      const response = await userAPI.deleteAIKey(keyId);
      setAiKeys(response.data.keys || []);
      toast.success('API key removed');
    } catch (error) {
      toast.error('Failed to remove key: ' + (error.response?.data?.message || error.message));
    }
  };

  const currentReports = result ? getReports(result.company) : { scam: 0, legit: 0, unsure: 0 };
  const reportCount = currentReports.scam + currentReports.legit + currentReports.unsure;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <header className="pt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold uppercase tracking-wider">
          <Shield size={14} /> ScamRadar Pro (Beta)
        </div>
        <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">
          Verify Any Offer <span className="text-primary-600">Before You Accept</span>
        </h1>
        <p className="mt-3 text-gray-500 text-sm sm:text-base max-w-2xl mx-auto">
          Analyze text, screenshots, or email details to detect recruitment scams and risky job offers.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px]">
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center gap-1.5"><Search size={12} /> Web-grounded AI</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center gap-1.5"><ImageIcon size={12} /> Screenshot Analysis</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center gap-1.5"><Mail size={12} /> Email Forensics</span>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center gap-1.5"><Users size={12} /> Community Reports</span>
        </div>
        <button
          onClick={() => setShowKeyModal(true)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-primary-500 hover:text-primary-700 text-sm font-medium transition-colors"
          title="Manage API Keys"
        >
          <Settings size={16} />
          API Configuration
        </button>
        <Link
          to="/student/scam-education"
          className="mt-4 ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 text-sm font-medium transition-colors"
          title="Learn how the metrics are calculated"
        >
          <HelpCircle size={16} />
          How It Works
        </Link>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-5">
        <div className="space-y-5">
          {!result && (
            <>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                <div className="grid grid-cols-3 border-b border-gray-100">
                  <button type="button" onClick={() => setActiveTab('text')} className={`py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'text' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}>
                    <FileText size={14} /> Text / Email
                  </button>
                  <button type="button" onClick={() => setActiveTab('image')} className={`py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'image' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}>
                    <Upload size={14} /> Screenshot
                  </button>
                  <button type="button" onClick={() => setActiveTab('email')} className={`py-3 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'email' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}>
                    <Mail size={14} /> Email Header
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {activeTab === 'text' && (
                    <>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <FileText size={13} /> Paste Offer / Recruiter Message
                      </label>
                      <textarea
                        value={offerInput}
                        onChange={(e) => setOfferInput(e.target.value)}
                        className="w-full min-h-[180px] p-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none text-sm text-gray-700"
                        placeholder="Paste offer letter, recruiter message, internship details, or company + role details..."
                      />

                      {prescreenHits.length > 0 && (
                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                          <p className="text-xs font-semibold text-amber-700">Instant red flags detected:</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {prescreenHits.map((hit) => (
                              <span key={hit} className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <AlertTriangle size={12} /> {hit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => fillExample('advance')} className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:text-primary-700 hover:border-primary-200 flex items-center gap-1.5">
                          <DollarSign size={12} /> Advance payment trap
                        </button>
                        <button type="button" onClick={() => fillExample('equipment')} className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:text-primary-700 hover:border-primary-200 flex items-center gap-1.5">
                          <Laptop size={12} /> Equipment reimbursement
                        </button>
                        <button type="button" onClick={() => fillExample('crypto')} className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:text-primary-700 hover:border-primary-200 flex items-center gap-1.5">
                          <Coins size={12} /> Crypto offer
                        </button>
                        <button type="button" onClick={() => fillExample('unpaid')} className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:text-primary-700 hover:border-primary-200 flex items-center gap-1.5">
                          <ClipboardList size={12} /> Suspicious internship
                        </button>
                      </div>
                    </>
                  )}

                  {activeTab === 'image' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Upload size={13} /> Upload Screenshot (WhatsApp / Email / LinkedIn)
                      </label>
                      {!imagePreview ? (
                        <label className="block border-2 border-dashed border-primary-200 bg-primary-50/40 rounded-xl p-8 text-center cursor-pointer hover:bg-primary-50">
                          <Upload className="w-8 h-8 mx-auto text-primary-500" />
                          <p className="mt-3 text-sm font-semibold text-gray-700">Drop image or click to upload</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP supported</p>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                      ) : (
                        <div className="space-y-3">
                          <img src={imagePreview} alt="Offer preview" className="w-full max-h-80 object-contain rounded-xl border border-gray-200 bg-gray-50" />
                          <button type="button" onClick={removeImage} className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Remove image</button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'email' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Mail size={13} /> Email Header / Body
                      </label>
                      <textarea
                        value={emailHeaderInput}
                        onChange={(e) => setEmailHeaderInput(e.target.value)}
                        className="w-full min-h-[130px] p-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none text-sm text-gray-700"
                        placeholder="Paste full email header/body here..."
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="Sender email (e.g. hr@company.com)"
                          className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-500 outline-none text-sm"
                        />
                        <input
                          type="url"
                          value={companyUrl}
                          onChange={(e) => setCompanyUrl(e.target.value)}
                          placeholder="Company URL (optional)"
                          className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button type="button" onClick={handleAnalyze} disabled={loading} className="flex-1 py-4 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                      Analyze Now — Deep Scam Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowKeyModal(true)}
                      className="px-4 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
                      title="Manage API Keys"
                    >
                      <Key size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-extrabold text-gray-900">Deep scanning across signals...</h3>
                    <p className="text-xs text-gray-500 mt-1">Reddit, public reviews, domain/email risk, and scam patterns</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STEPS.map((label, index) => {
                      const isDone = index < step;
                      const isActive = index === step;
                      return (
                        <div key={label} className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isActive ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {isDone ? <CheckCircle2 size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : <span className="w-2 h-2 rounded-full bg-current" />}
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              {/* Main Result Card with Circular Progress */}
              <div className={`p-6 rounded-2xl border ${verdictClass(result.verdict)} bg-white relative overflow-hidden`}>
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="w-full h-full" style={{
                    backgroundImage: `radial-gradient(circle at 20% 80%, currentColor 1px, transparent 1px), 
                                     radial-gradient(circle at 80% 20%, currentColor 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>

                <div className="relative flex flex-col lg:flex-row lg:items-start gap-6">
                  {/* Trust Score Circle */}
                  <div className="flex justify-center lg:block">
                    <TrustScoreCircle
                      score={result.trustScore}
                      size={120}
                      className="lg:sticky lg:top-4"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Company & Role Header */}
                    <div className="flex flex-wrap items-start gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-2xl lg:text-3xl font-black text-gray-900 mb-2">
                          {result.company}
                        </h2>
                        <p className="text-lg text-gray-600 mb-3">{result.role}</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {!reportSaved ? (
                          <button
                            onClick={handleSaveReport}
                            disabled={savingReport}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
                          >
                            {savingReport ? (
                              <><Loader2 size={16} className="animate-spin" /> Saving...</>
                            ) : (
                              <><Save size={16} /> Save Report</>
                            )}
                          </button>
                        ) : (
                          <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg inline-flex items-center gap-2">
                            <CheckCircle2 size={16} /> Report Saved!
                          </div>
                        )}

                        <Link
                          to="/student/scam-reports"
                          className="px-4 py-2 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors inline-flex items-center gap-2"
                        >
                          <Users size={16} /> View All Reports
                        </Link>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-gray-700 leading-relaxed mb-4">{result.summary}</p>

                    {/* Company Stats */}
                    {companyStats && companyStats.stats.totalReports > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp size={16} className="text-blue-600" />
                          <span className="font-semibold text-blue-900">
                            Community Intelligence for {result.company}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                          <div>
                            <div className="text-lg font-bold text-blue-900">{companyStats.stats.totalReports}</div>
                            <div className="text-xs text-blue-600">Total Reports</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-red-600">{companyStats.stats.dangerCount}</div>
                            <div className="text-xs text-blue-600">Danger Alerts</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-amber-600">{companyStats.stats.warningCount}</div>
                            <div className="text-xs text-blue-600">Warnings</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">{companyStats.stats.safeCount}</div>
                            <div className="text-xs text-blue-600">Safe Reports</div>
                          </div>
                        </div>
                        {companyStats.stats.totalReports > 1 && (
                          <div className="mt-3 text-center">
                            <Link
                              to={`/student/scam-reports?company=${encodeURIComponent(result.company)}`}
                              className="text-sm text-blue-700 hover:text-blue-800 underline inline-flex items-center gap-1"
                            >
                              <Eye size={14} /> View all {companyStats.stats.totalReports} reports for this company
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {result.analysisWarning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-amber-800">⚠️ {result.analysisWarning}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-Scores with Circular Progress */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Detailed Analysis Breakdown</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <MiniCircularProgress
                    value={result.subScores.companyLegitimacy}
                    label="Company Legitimacy"
                  />
                  <MiniCircularProgress
                    value={result.subScores.offerRealism}
                    label="Offer Realism"
                  />
                  <MiniCircularProgress
                    value={result.subScores.processFlags}
                    label="Process Flags"
                  />
                  <MiniCircularProgress
                    value={result.subScores.communitySentiment}
                    label="Community Sentiment"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Red Flags</h3>
                  <div className="space-y-2">
                    {(result.redFlags.length ? result.redFlags : ['No explicit red flags detected.']).map((flag, idx) => (
                      <div key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2"><CheckCircle2 size={14} /> Legitimacy Signals</h3>
                  <div className="space-y-2">
                    {(result.greenFlags.length ? result.greenFlags : ['No strong legitimacy signal found.']).map((flag, idx) => (
                      <div key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Community Intelligence</h3>
                <div className="space-y-3">
                  {(result.communityFindings.length ? result.communityFindings : [{ source: 'System', icon: 'HelpCircle', finding: 'No community findings available.', sentiment: 'neutral', links: [] }]).map((finding, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gray-50 text-gray-500">
                          {getIcon(finding.icon, "w-5 h-5")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{finding.source}</p>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">{finding.sentiment || 'neutral'}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{finding.finding}</p>
                          {Array.isArray(finding.links) && finding.links.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {finding.links.map((link, liIdx) => link?.url ? (
                                <a
                                  key={liIdx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-blue-600 font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                                >
                                  <LinkIcon size={12} className="text-gray-400" />
                                  {link.title || 'Source'}
                                  <ArrowUpRight size={12} className="text-gray-400" />
                                </a>
                              ) : null)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {result.salaryCheck && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Salary Reality Check</h3>
                  <p className="text-sm text-gray-700"><span className="font-semibold">Offered:</span> {result.salaryCheck.offered || 'Not specified'}</p>
                  <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Market:</span> {result.salaryCheck.marketRate || 'Unknown'}</p>
                  <p className="text-sm text-gray-700 mt-1"><span className="font-semibold">Verdict:</span> {result.salaryCheck.verdict || 'Unknown'} — {result.salaryCheck.explanation || ''}</p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Domain & Email Forensics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg border border-gray-100 p-2"><span className="text-gray-400">Domain:</span> <span className="text-gray-700">{result.domainAnalysis.companyDomain || 'Unknown'}</span></div>
                  <div className="rounded-lg border border-gray-100 p-2"><span className="text-gray-400">Age:</span> <span className="text-gray-700">{result.domainAnalysis.domainAge || 'Unknown'}</span></div>
                  <div className="rounded-lg border border-gray-100 p-2"><span className="text-gray-400">Risk:</span> <span className="text-gray-700">{result.domainAnalysis.domainRisk || 'Unknown'}</span></div>
                </div>
                {result.emailChecks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {result.emailChecks.map((check, idx) => (
                      <div key={idx} className="text-sm rounded-lg border border-gray-100 p-2 text-gray-700">
                        <span className="font-semibold">{check.check}:</span> {check.detail || check.status}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Community Reports</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-gray-100 p-3"><p className="text-2xl font-black text-gray-900">{reportCount}</p><p className="text-[10px] text-gray-400 uppercase">Total</p></div>
                  <div className="rounded-lg border border-gray-100 p-3"><p className="text-2xl font-black text-red-600">{currentReports.scam}</p><p className="text-[10px] text-gray-400 uppercase">Scam</p></div>
                  <div className="rounded-lg border border-gray-100 p-3"><p className="text-2xl font-black text-emerald-600">{currentReports.legit}</p><p className="text-[10px] text-gray-400 uppercase">Legit</p></div>
                  <div className="rounded-lg border border-gray-100 p-3"><p className="text-2xl font-black text-amber-600">{currentReports.unsure}</p><p className="text-[10px] text-gray-400 uppercase">Unsure</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => submitReport(result.company, 'scam')} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Confirmed Scam
                  </button>
                  <button type="button" onClick={() => submitReport(result.company, 'legit')} className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Legitimate
                  </button>
                  <button type="button" onClick={() => submitReport(result.company, 'unsure')} className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1.5">
                    <HelpCircle size={14} /> Not Sure
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">ScamRadar Verdict</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{result.finalVerdict}</p>
                {result.actionItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {result.actionItems.map((item, idx) => (
                      <div key={idx} className="text-sm rounded-lg border border-gray-100 p-2 text-gray-700 flex items-start gap-2">
                        <span className="mt-0.5 px-1.5 py-0.5 text-[10px] rounded bg-primary-100 text-primary-700 font-bold">{idx + 1}</span>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {result.sources && result.sources.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Research Sources</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-primary-100 p-3 hover:border-primary-300 hover:bg-primary-50 transition-all group flex items-start gap-3"
                      >
                        <div className="p-2 rounded-lg bg-primary-50 text-primary-500 group-hover:bg-white group-hover:text-primary-600 transition-colors">
                          <Search size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-primary-700">{source.title}</p>
                          <p className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                            <ExternalLink size={10} /> {source.url ? (
                              (() => {
                                try {
                                  return new URL(source.url).hostname;
                                } catch (e) {
                                  return source.url.substring(0, 20) + '...';
                                }
                              })()
                            ) : 'Source'}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-3">Verify Further</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.resourceLinks.map((resource, idx) => (
                    <a key={idx} href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-100 p-3 hover:border-primary-200 hover:bg-primary-50/50 transition-colors flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                        {getIcon(resource.icon, "w-5 h-5")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{resource.title}</p>
                        <p className="text-xs text-gray-500 truncate">{resource.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => setResult(null)} className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 hover:text-primary-700 hover:border-primary-200 inline-flex justify-center items-center gap-2 font-semibold">
                <RefreshCw size={16} /> Analyze Another Offer
              </button>
            </div>
          )}
        </div>

        <aside className="hidden xl:block sticky top-4 h-fit bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Recent Scans</h3>
            {history.length > 7 && (
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
              >
                {showAllHistory ? 'Show less' : `See all (${history.length})`}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400">No scans yet</p>
          ) : (
            <div className="space-y-2">
              {(showAllHistory ? history : history.slice(0, 7)).map((item, idx) => (
                <button key={`${item.company}-${idx}`} type="button" onClick={() => loadHistoryItem(item)} className="w-full text-left rounded-lg border border-gray-100 p-3 hover:border-primary-200 hover:bg-primary-50/40 transition-colors">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.company}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{item.date}</p>
                  <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full ${item.verdictClass === 'safe' ? 'bg-emerald-50 text-emerald-700' : item.verdictClass === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.score}/100
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Analysis Animation Overlay */}
      {analysisAnimation.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-auto text-center animate-in fade-in duration-300">
            <div className="mb-6">
              <Brain className="w-16 h-16 mx-auto text-primary-600 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">AI Analysis in Progress</h3>
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${analysisAnimation.progress}%` }}
                />
              </div>
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-center gap-2 animate-pulse">
                  <Loader size={16} className="animate-spin" />
                  {analysisAnimation.currentStep}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {Math.round(analysisAnimation.progress)}% Complete
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-auto animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">API Configuration</h3>
                <p className="text-sm text-gray-500">Configure your AI API key for scam detection</p>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Keys */}
              {aiKeys.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Current Keys</label>
                  <div className="space-y-2">
                    {aiKeys.map((keyObj, idx) => (
                      <div key={keyObj._id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">
                            {keyObj.label || `Key ${idx + 1}`}
                          </span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {keyObj.keyPreview || `•••••••••••••${keyObj.key?.slice(-6) || ''}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {keyObj.isActive !== undefined && (
                            <button
                              onClick={() => handleToggleKey(keyObj._id, keyObj.isActive)}
                              className={`px-2 py-1 rounded-md text-xs font-semibold ${keyObj.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {keyObj.isActive ? 'Active' : 'Inactive'}
                            </button>
                          )}
                          <button
                            onClick={() => removeAiKey(keyObj._id || idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Key */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Add New API Key</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Enter Gemini API Key"
                    value={newKey.key}
                    onChange={(e) => setNewKey(prev => ({ ...prev, key: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={newKey.label}
                    onChange={(e) => setNewKey(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestKey}
                      disabled={!newKey.key || testingKey}
                      className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {testingKey ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Shield size={16} />
                          Test Key
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSaveKey}
                      disabled={!newKey.key || savingKey}
                      className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {savingKey ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Save Key
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test Result */}
              {keyTestResult && (
                <div className={`p-3 rounded-lg border ${keyTestResult.success
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {keyTestResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {keyTestResult.message}
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Get your free Gemini API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google AI Studio</a></p>
                <p>• Keys are stored securely and only used for scam analysis</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScamDetector;
