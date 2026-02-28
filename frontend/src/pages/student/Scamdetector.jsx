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
  MessageSquare,
  ThumbsUp,
  ChevronUp,
  ChevronDown,
  ArrowUpRight,
  ArrowLeft,
  Image as ImageIcon
} from 'lucide-react';
import { utilsAPI, userAPI, scamReportsAPI } from '../../services/api';
import { TrustScoreCircle, MiniCircularProgress } from '../../components/CircularProgress';
import toast from 'react-hot-toast';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRef } from 'react';

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
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-600';
};

const verdictClass = (verdict) => {
  if (verdict === 'SAFE') return 'bg-white border-emerald-100/50 shadow-emerald-500/5 shadow-2xl';
  if (verdict === 'CAUTION') return 'bg-white border-amber-100/50 shadow-amber-500/5 shadow-2xl';
  if (verdict === 'WARNING') return 'bg-white border-orange-100/50 shadow-orange-500/5 shadow-2xl';
  return 'bg-white border-red-100/50 shadow-red-500/5 shadow-2xl';
};

const timeAgo = (date) => {
  if (!date) return 'Recently';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "just now";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userInput, setUserInput] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [publicReports, setPublicReports] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 1, totalReports: 0 });
  const [loadingPublic, setLoadingPublic] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll logic for horizontal layout
  // Fetch public reports for the "Recent Feed"
  const fetchRecentScans = async (page = 1) => {
    try {
      setLoadingPublic(true);
      const response = await scamReportsAPI.getPublicReports({ page, limit: 5 });
      setPublicReports(response.data.reports || []);
      setPagination(response.data.pagination || { totalPages: 1, totalReports: 0 });
    } catch (error) {
      console.error('Failed to fetch public reports:', error);
    } finally {
      setLoadingPublic(false);
    }
  };

  useEffect(() => {
    fetchRecentScans(currentPage);
  }, [currentPage]);

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
    if (userInput.trim().length < 30) return [];
    return PRESCREEN_PATTERNS.filter((rule) => rule.pattern.test(userInput)).map((rule) => rule.label);
  }, [userInput]);

  useEffect(() => {
    // Initial fetch of public reports
    fetchRecentScans(1);
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
    // Refresh the feed after a new analysis
    fetchRecentScans(1);
    setCurrentPage(1);
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
    setResult({ ...item.result, isHistory: true });
  };

  const buildPayload = () => {
    if (!userInput.trim() && !imageBase64) {
      throw new Error('Please provide offer details or a screenshot.');
    }

    return {
      input: userInput.trim() || 'Analyze this uploaded screenshot for job scam signals.',
      imageBase64: imageBase64 || undefined,
      imageMimeType: imageBase64 ? imageMimeType : undefined,
      sourceType: imageBase64 ? 'image' : 'text'
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
    setUserInput(EXAMPLES[key]);
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
          originalText: userInput,
          sourceType: imageBase64 ? 'image' : 'text'
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

  const getDashboardPath = () => {
    const role = user?.role;
    const dashboardMap = {
      student: '/student',
      campus_poc: '/campus-poc',
      coordinator: '/coordinator',
      manager: '/manager'
    };
    return dashboardMap[role] || '/student';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 min-h-screen">
      <header className="pb-16 text-center relative">
        <div className="absolute left-0 -top-4 hidden md:block">
          <button
            onClick={() => navigate(getDashboardPath())}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-100 opacity-50 hover:opacity-100 text-gray-400 hover:text-gray-900 transition-all group font-bold text-xs"
          >
            <ArrowLeft size={14} />
            DASHBOARD
          </button>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-4">
            <h1 className="text-7xl sm:text-9xl font-black tracking-tighter text-gray-900 leading-[0.8] select-none">
              Search
            </h1>
            <div className="flex flex-col text-left justify-center pt-2">
              <span className="text-3xl sm:text-5xl font-black text-primary-600 leading-[0.7] uppercase tracking-[0.24em] -mb-1">that</span>
              <span className="text-3xl sm:text-5xl font-black text-red-600 leading-[0.7] uppercase tracking-tighter">scam.</span>
            </div>
          </div>
          <p className="text-gray-400 text-[10px] sm:text-xs mt-10 font-black uppercase tracking-[0.4em]">
            Investigating truth in <span className="text-gray-900 italic font-medium">Recruitment & Job Offers</span>
          </p>
        </div>

        <div className="mt-16 max-w-3xl mx-auto relative group">
          <div className={`bg-white rounded-[2rem] border border-gray-200 shadow-xl shadow-gray-200/50 overflow-hidden transition-all duration-500 focus-within:ring-4 focus-within:ring-primary-500/5 focus-within:border-primary-400 focus-within:shadow-2xl ${userInput.length > 0 || imagePreview ? 'p-3' : 'p-2'}`}>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Paste details or recruiter message..."
                  className={`w-full p-4 bg-transparent border-none focus:ring-0 text-gray-700 resize-none outline-none leading-relaxed font-bold placeholder:text-gray-300 transition-all duration-300 ${userInput.length === 0 && !imagePreview ? 'h-14 py-3.5' : 'h-auto min-h-[56px]'}`}
                  rows={userInput.includes('\n') || userInput.length > 50 ? 5 : 1}
                />

                {(userInput.length === 0 && !imagePreview) && (
                  <div className="flex items-center gap-2 pr-2">
                    <label className="p-3 rounded-full hover:bg-gray-50 text-gray-300 hover:text-primary-600 cursor-pointer transition-all">
                      <ImageIcon size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <button
                      onClick={handleAnalyze}
                      disabled={loading || (!userInput.trim() && !imageBase64)}
                      className="bg-primary-600 hover:bg-primary-700 disabled:opacity-20 text-white px-6 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-primary-500/30 transition-all active:scale-95"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <>Scan <Search size={16} /></>}
                    </button>
                  </div>
                )}
              </div>

              {(userInput.length > 0 || imagePreview) && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2 pl-2">
                    <label className="p-3 rounded-full bg-gray-50 border border-gray-100 text-gray-400 hover:text-primary-600 cursor-pointer transition-all">
                      <ImageIcon size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {imagePreview && (
                      <div className="flex items-center gap-2 bg-primary-50/50 px-3 py-2 rounded-xl border border-primary-100/50">
                        <img src={imagePreview} className="w-8 h-8 rounded-lg object-cover shadow-sm" />
                        <span className="text-[10px] font-black text-primary-700 uppercase tracking-tighter">Image Loaded</span>
                        <button onClick={removeImage} className="p-1 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={loading || (!userInput.trim() && !imageBase64)}
                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-10 py-3.5 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-primary-500/20 transition-all hover:-translate-y-0.5"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <>Start Analysis <Search size={20} /></>}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => fillExample('advance')} className="text-[11px] font-bold text-gray-400 hover:text-primary-600 transition-colors uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 italic">"Advance Payment trap"</button>
            <button onClick={() => fillExample('equipment')} className="text-[11px] font-bold text-gray-400 hover:text-primary-600 transition-colors uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 italic">"Equipment Reimbursement"</button>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => setShowKeyModal(true)}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-primary-600 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <Settings size={14} /> API Config
          </button>
          <Link
            to="/scam-education"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <HelpCircle size={14} /> How it works
          </Link>
        </div>
      </header>

      <main className="mt-10">
        {!result ? (
          <div className="max-w-3xl mx-auto pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 shadow-inner">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-none">Community Feed</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Real-time Scam Intel</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loadingPublic}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-primary-600 disabled:opacity-20 transition-all"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="px-3 h-8 flex items-center bg-gray-50 rounded-lg">
                  <span className="text-[10px] font-black text-gray-600 uppercase">Page {currentPage} of {pagination.totalPages}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages || loadingPublic}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-primary-600 disabled:opacity-20 transition-all"
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {loadingPublic ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-50 rounded-3xl animate-pulse border border-gray-100" />
                ))
              ) : publicReports.map((report) => (
                <div
                  key={report._id}
                  className="group bg-white p-4 rounded-[2rem] border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/scam-reports/${report._id}`)}
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>

                      <h3 className="text-lg font-black text-gray-900 group-hover:text-primary-600 transition-colors mb-1.5 tracking-tight leading-tight">
                        {report.companyName}
                      </h3>

                      <div className="bg-gray-50/50 rounded-xl p-2.5 border border-gray-100/50 mb-2.5 line-clamp-1">
                        <p className="text-[11px] text-gray-500 italic">"{report.scamText || report.originalMessage || report.summary}"</p>
                      </div>

                      <p className="text-gray-500 text-[13px] leading-relaxed line-clamp-1 mb-2.5">
                        {report.summary}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <ThumbsUp size={12} className="group-hover:text-primary-500" />
                            <span className="text-[9px] font-bold">{report.votes?.up || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <MessageSquare size={12} className="group-hover:text-primary-500" />
                            <span className="text-[9px] font-bold">{report.comments?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center text-[8px] font-black text-primary-600">
                              {report.reporterName?.[0] || 'U'}
                            </div>
                            <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">
                              {report.reporterName || 'Someone'} <span className="font-medium text-gray-300 hidden sm:inline">submitted {timeAgo(report.createdAt)}</span>
                            </span>
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] font-black text-primary-600 uppercase tracking-widest">
                          View <ArrowUpRight size={12} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0 p-2 bg-gray-50 rounded-2xl border border-gray-100 h-fit">
                      <div className="relative">
                        <ChevronUp size={12} className="text-gray-300" />
                        <div className="my-1 flex items-center justify-center">
                          <TrustScoreCircle score={report.trustScore} size={40} showLabel={false} />
                        </div>
                        <ChevronDown size={12} className="text-gray-300" />
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-wider ${scoreClass(report.trustScore)}`}>
                        {report.trustScore >= 80 ? 'SAFE' : report.trustScore >= 60 ? 'CAUTION' : report.trustScore >= 40 ? 'WARNING' : 'DANGER'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {!loadingPublic && publicReports.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                  <Shield className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest">The Feed is empty.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`p-8 rounded-[3rem] border-2 ${verdictClass(result.verdict)} bg-white relative`}>
              <div className="relative flex flex-col lg:flex-row lg:items-start gap-12">
                <div className="flex justify-center lg:block">
                  <TrustScoreCircle score={result.trustScore} size={160} showLabel={true} className="lg:sticky lg:top-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-2 leading-none">{result.company}</h2>
                      <p className="text-xl text-gray-600 font-medium italic">{result.role}</p>
                    </div>

                    <div className="flex gap-2">
                      {!result.isHistory && (!companyStats || companyStats.stats.totalReports === 0) && !loadingStats && (
                        !reportSaved ? (
                          <button onClick={handleSaveReport} disabled={savingReport} className="px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] hover:bg-green-700 disabled:opacity-50 transition-all flex items-center gap-2">
                            {savingReport ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} SAVE REPORT
                          </button>
                        ) : (
                          <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-2 font-black text-[10px]">
                            <Check size={16} /> SAVED
                          </div>
                        )
                      )}
                      <button onClick={() => setResult(null)} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <MessageSquare size={12} /> Original Submission
                    </div>
                    <p className="text-sm text-gray-600 italic leading-relaxed">"{userInput}"</p>
                  </div>

                  <p className="text-gray-700 leading-relaxed mb-6 font-medium">{result.summary}</p>

                  {companyStats && companyStats.stats.totalReports > 0 && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 mb-6">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-blue-600" />
                        <span className="font-black text-blue-900 uppercase text-xs tracking-tight">Community Intelligence</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                        <div className="p-2 bg-white rounded-2xl border border-blue-100">
                          <span className="text-xl font-black text-blue-900">{companyStats.stats.totalReports}</span>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Reports</p>
                        </div>
                        <div className="p-2 bg-white rounded-2xl border border-red-100">
                          <span className="text-xl font-black text-red-600">{companyStats.stats.dangerCount}</span>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Danger</p>
                        </div>
                        <div className="p-2 bg-white rounded-2xl border border-amber-100">
                          <span className="text-xl font-black text-amber-600">{companyStats.stats.warningCount}</span>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Warning</p>
                        </div>
                        <div className="p-2 bg-white rounded-2xl border border-emerald-100">
                          <span className="text-xl font-black text-green-600">{companyStats.stats.safeCount}</span>
                          <p className="text-[9px] font-black text-gray-400 uppercase">Safe</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(result.subScores).map(([key, value]) => (
                <div key={key} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
                  <MiniCircularProgress value={value} size={64} />
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-3 text-center leading-tight">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl border border-gray-100 p-6">
                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={14} /> Red Flags</h3>
                <div className="space-y-3">
                  {result.redFlags.map((f, i) => (
                    <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-3xl border border-gray-100 p-6">
                <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle2 size={14} /> Safety Signals</h3>
                <div className="space-y-3">
                  {result.greenFlags.map((f, i) => (
                    <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {result.communityFindings.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 p-8">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Deep Web Context</h3>
                <div className="space-y-4">
                  {result.communityFindings.map((f, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-gray-50 flex gap-4">
                      <div className="p-3 bg-white rounded-xl border border-gray-100 text-gray-400 shrink-0 h-fit">
                        {getIcon(f.icon, "w-5 h-5")}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 mb-1">{f.source}</p>
                        <p className="text-sm text-gray-600 leading-relaxed mb-3">{f.finding}</p>
                        {f.links?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {f.links.map((l, li) => (
                              <a key={li} href={l.url} target="_blank" rel="noopener" className="text-[10px] font-black text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all">
                                {l.title} <ArrowUpRight size={12} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {analysisAnimation.visible && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-10 max-w-md w-full mx-auto text-center shadow-2xl">
            <div className="mb-8">
              <Brain className="w-20 h-20 mx-auto text-primary-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Analyzing Data</h3>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-8">{analysisAnimation.currentStep}</p>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner mb-2">
              <div className="h-full bg-primary-600 rounded-full transition-all duration-500 shadow-lg shadow-primary-500/40" style={{ width: `${analysisAnimation.progress}%` }} />
            </div>
            <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{Math.round(analysisAnimation.progress)}% Complete</div>
          </div>
        </div>
      )}

      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] max-w-lg w-full mx-auto shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-8 border-b border-gray-50">
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase">AI Engine</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Configure your Scanning Key</p>
              </div>
              <button onClick={() => setShowKeyModal(false)} className="p-3 hover:bg-gray-50 rounded-2xl transition-all">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {aiKeys.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Network Keys</label>
                  <div className="space-y-3">
                    {aiKeys.map((k, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-900 truncate">{k.label || 'Standard Engine'}</p>
                          <p className="text-[10px] text-gray-400 font-medium tracking-tight mt-0.5">{k.keyPreview}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {k.isActive && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase">Active</span>}
                          <button onClick={() => removeAiKey(k._id || i)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Register New Key</label>
                <div className="space-y-4">
                  <input type="password" placeholder="GEMINI_API_KEY" value={newKey.key} onChange={(e) => setNewKey(p => ({ ...p, key: e.target.value }))} className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono text-sm" />
                  <input type="text" placeholder="KEY_LABEL" value={newKey.label} onChange={(e) => setNewKey(p => ({ ...p, label: e.target.value }))} className="w-full h-14 px-6 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 transition-all font-black text-xs uppercase tracking-widest" />
                  <div className="flex gap-4">
                    <button onClick={handleTestKey} className="flex-1 h-12 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Test Engine</button>
                    <button onClick={handleSaveKey} className="flex-1 h-12 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-500/20 transition-all">Deploy Key</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-8 right-6 md:hidden z-40">
        <button
          onClick={() => {
            setResult(null);
            setUserInput('');
            setImagePreview('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center justify-center w-16 h-16 bg-primary-600 shadow-2xl shadow-primary-500/40 text-white rounded-full transition-all border-4 border-white"
        >
          <Plus size={28} />
          <div className="absolute top-0 right-0 -mr-1 -mt-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        </button>
      </div>
    </div >
  );
};

export default ScamDetector;
