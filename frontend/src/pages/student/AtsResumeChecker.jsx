import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userAPI, atsAPI, resolveResumeUrl } from '../../services/api';
import {
  FileText, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  ExternalLink, Search, Plus, ArrowRight, ShieldCheck, Check, Info, ChevronRight, X, Copy, Award,
  Clock, History
} from 'lucide-react';
import toast from 'react-hot-toast';

const AtsResumeChecker = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialResumeId = searchParams.get('resume');

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-resume state maps
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analyses, setAnalyses] = useState({}); // { [resumeId]: ATSAnalysis }
  const [histories, setHistories] = useState({}); // { [resumeId]: ATSAnalysis[] }
  const [activeReportResume, setActiveReportResume] = useState(null); // Selected resume object for modal report
  const [selectedHistoryId, setSelectedHistoryId] = useState(null); // Selected historical analysis ID in modal

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadRole, setUploadRole] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Copied prompt feedback
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const [invalidResumeRequested, setInvalidResumeRequested] = useState(false);

  const [resumesList, setResumesList] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);

  // Fetch student resumes metadata & latest ATS summaries in 1 efficient API call (No N+1 queries)
  useEffect(() => {
    fetchResumesMetadata();
  }, []);

  const fetchResumesMetadata = async () => {
    setLoadingResumes(true);
    try {
      const res = await atsAPI.getResumes();
      if (res.data?.success && Array.isArray(res.data.resumes)) {
        const items = res.data.resumes;
        setResumesList(items);

        // Pre-populate analyses map with latest analysis summary returned by backend endpoint
        const preAnalyses = {};
        items.forEach(r => {
          if (r.latestAnalysis) {
            preAnalyses[r.resumeId || r._id] = r.latestAnalysis;
          }
        });
        setAnalyses(prev => ({ ...prev, ...preAnalyses }));
      }
    } catch (err) {
      console.error('Failed to load ATS resumes metadata:', err);
      fetchProfileFallback();
    } finally {
      setLoadingResumes(false);
    }
  };

  const fetchProfileFallback = async () => {
    try {
      const res = await userAPI.getStudent(user._id || user.id);
      const studentData = res.data?.student || res.data?.user || res.data;
      const list = studentData?.studentProfile?.resumes || [];
      setResumesList(list.map(r => ({
        ...r,
        resumeId: r._id,
        atsScore: r.resumeAts?.overallScore ?? null,
        atsStatus: r.resumeAts?.overallScore != null ? 'analyzed' : 'not_analyzed'
      })));
    } catch (err) {
      console.error('Fallback profile load error:', err);
      toast.error('Failed to load resumes. Please refresh.');
    }
  };

  useEffect(() => {
    if (resumesList && resumesList.length > 0 && initialResumeId) {
      const found = resumesList.find(r => r._id === initialResumeId || r.resumeId === initialResumeId || r._id?.toString() === initialResumeId);
      if (found) {
        setActiveReportResume(found);
        fetchHistoryOnDemand(found.resumeId || found._id);
        setInvalidResumeRequested(false);
      } else {
        setInvalidResumeRequested(true);
        setActiveReportResume(null);
      }
    } else {
      setInvalidResumeRequested(false);
    }
  }, [resumesList, initialResumeId]);

  // Filtered resumes based on search input
  const filteredResumes = useMemo(() => {
    if (!searchQuery.trim()) return resumesList;
    const q = searchQuery.toLowerCase();
    return resumesList.filter(r =>
      (r.role && r.role.toLowerCase().includes(q)) ||
      (r.fileName && r.fileName.toLowerCase().includes(q))
    );
  }, [resumesList, searchQuery]);

  // Run ATS Check ONLY when explicitly triggered for a specific resume
  const handleCheckAts = async (resumeItem, forceRefresh = false) => {
    const resumeId = resumeItem.resumeId || resumeItem._id;
    setAnalyzingId(resumeId);

    const checkToast = toast.loading(`Running ATS audit for ${resumeItem.role || 'resume'}...`);

    try {
      const res = await atsAPI.analyze(resumeId, forceRefresh);
      const data = res.data;

      if (data?.success && data.analysis) {
        setAnalyses(prev => ({
          ...prev,
          [resumeId]: data.analysis
        }));

        // Update score & status in resumesList for this single resume
        setResumesList(prev => prev.map(r => {
          if ((r.resumeId || r._id) === resumeId) {
            return {
              ...r,
              atsScore: data.analysis.overallScore,
              atsStatus: 'analyzed',
              latestAnalysis: data.analysis
            };
          }
          return r;
        }));

        // Refresh analysis history for this exact resume
        fetchHistoryOnDemand(resumeId);
        setSelectedHistoryId(data.analysis._id);

        toast.success(`ATS audit complete for ${resumeItem.role || 'resume'}!`, { id: checkToast });

        // Automatically open the report modal for this resume
        setActiveReportResume(resumeItem);
      } else {
        toast.error('ATS audit returned an invalid response', { id: checkToast });
      }
    } catch (err) {
      console.error('ATS audit error:', err);
      const msg = err.response?.data?.message || 'Failed to complete ATS audit';
      toast.error(msg, { id: checkToast });
    } finally {
      setAnalyzingId(null);
    }
  };

  // Fetch ATS analysis history ONLY on demand for a specific resume
  const fetchHistoryOnDemand = async (resumeId) => {
    if (!resumeId) return;
    try {
      const res = await atsAPI.getHistory(resumeId);
      if (res.data?.success && Array.isArray(res.data.history)) {
        setHistories(prev => ({
          ...prev,
          [resumeId]: res.data.history
        }));
      }
    } catch (err) {
      console.error('Failed to fetch ATS history:', err);
    }
  };

  // Open view report modal for a resume (loads history on demand)
  const handleViewReport = (resumeItem) => {
    setActiveReportResume(resumeItem);
    setSelectedHistoryId(null);
    const resumeId = resumeItem.resumeId || resumeItem._id;

    // Set search params URL without reload
    setSearchParams({ resume: resumeId });

    fetchHistoryOnDemand(resumeId);
  };

  // Close report modal
  const handleCloseReport = () => {
    setActiveReportResume(null);
    setSelectedHistoryId(null);
    setSearchParams({});
  };

  // Handle uploading a new resume
  const handleUploadNewResume = async (e) => {
    e.preventDefault();
    if (!uploadRole.trim()) {
      toast.error('Please specify a target role name');
      return;
    }
    if (!uploadFile) {
      toast.error('Please select a PDF file');
      return;
    }

    setUploading(true);
    const uploadToast = toast.loading('Uploading new resume...');

    try {
      const res = await userAPI.uploadRoleResume(uploadFile, uploadRole.trim());
      if (res.data?.success) {
        toast.success('Resume uploaded successfully!', { id: uploadToast });
        setShowUploadModal(false);
        setUploadRole('');
        setUploadFile(null);
        fetchProfile();
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload resume', { id: uploadToast });
    } finally {
      setUploading(false);
    }
  };

  // Get score color helper
  const getScoreBadge = (score) => {
    if (score == null) return { bg: 'bg-gray-100 text-gray-600 border-gray-200', text: 'Not Analyzed' };
    if (score >= 80) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: `${score}/100 - Strong` };
    if (score >= 60) return { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: `${score}/100 - Good` };
    return { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: `${score}/100 - Needs Work` };
  };

  // Active analysis object & history array for the opened modal
  const activeResumeHistories = activeReportResume ? (histories[activeReportResume._id] || []) : [];
  const latestAnalysis = activeReportResume ? (analyses[activeReportResume._id] || activeResumeHistories[0] || null) : null;
  const currentAnalysis = selectedHistoryId
    ? (activeResumeHistories.find(h => h._id === selectedHistoryId) || latestAnalysis)
    : latestAnalysis;
  const currentResumeAts = activeReportResume?.resumeAts;

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-indigo-100 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Standalone ATS Resume Checker
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                ATS Resume Checker
              </h1>
              <p className="text-indigo-100 text-sm sm:text-base font-normal leading-relaxed">
                Check your resumes for ATS compatibility and get actionable suggestions to improve them.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-indigo-50 text-indigo-900 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-xl transform active:scale-95"
              >
                <Plus className="w-4 h-4 text-indigo-700 stroke-[3]" />
                Add New Resume
              </button>
            </div>
          </div>
        </div>

        {/* Invalid Resume Query Warning Banner */}
        {invalidResumeRequested && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-amber-900 font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>The requested resume ID was not found or is unavailable. Choose a valid resume from your collection below.</span>
            </div>
            <button
              type="button"
              onClick={() => { setInvalidResumeRequested(false); setSearchParams({}); }}
              className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg font-bold shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter & Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-150">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter resumes by target role or file name..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span>Total Resumes:</span>
            <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-full border border-indigo-100">
              {resumesList.length}
            </span>
          </div>
        </div>

        {/* Resume Cards Collection Grid */}
        {loadingResumes ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-150 p-6 space-y-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                <div className="h-16 bg-gray-50 rounded-xl"></div>
                <div className="flex gap-2 pt-2">
                  <div className="h-9 bg-gray-200 rounded-xl flex-1"></div>
                  <div className="h-9 bg-gray-200 rounded-xl flex-1"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredResumes.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {searchQuery ? 'No matching resumes found' : 'No Resumes Uploaded Yet'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {searchQuery
                  ? 'Try clearing your search query to view all resumes.'
                  : 'Upload your tailored resumes to run independent ATS compatibility audits.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Upload Resume
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResumes.map((resume) => {
              const resumeId = resume.resumeId || resume._id;
              const isAnalyzing = analyzingId === resumeId;

              // Check if we have analysis stored in state or subdocument
              const savedAnalysis = analyses[resumeId];
              const score = savedAnalysis?.overallScore ?? resume.atsScore ?? resume.resumeAts?.overallScore;
              const badge = getScoreBadge(score);

              return (
                <div
                  key={resumeId}
                  className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg flex flex-col justify-between p-6 space-y-5 relative overflow-hidden ${
                    activeReportResume?._id === resumeId
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                      : 'border-gray-150 hover:border-gray-250'
                  }`}
                >
                  {/* Top Bar / Badges */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 truncate uppercase tracking-wider">
                          {resume.role || 'Target Role'}
                        </span>
                        {resume.isPrimary && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <a
                        href={resolveResumeUrl(resume.resumeLink || resume.url || resume.resume)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-indigo-650 transition-colors p-1 rounded-lg hover:bg-gray-100 shrink-0"
                        title="View raw PDF file"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <h4 className="text-base font-bold text-gray-900 leading-snug truncate" title={resume.fileName || resume.role}>
                      {resume.fileName || `${resume.role || 'Resume'}.pdf`}
                    </h4>
                    <p className="text-xs text-gray-400 font-medium">
                      Uploaded {resume.uploadedAt ? new Date(resume.uploadedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'recently'}
                    </p>
                  </div>

                  {/* ATS Score Display Card */}
                  <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Latest ATS Score</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </div>

                    {score != null ? (
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>
                        <p className="text-[11px] text-gray-500 text-right">
                          Score is unique to this resume
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic pt-1">
                        Run ATS check to generate compatibility analysis.
                      </p>
                    )}
                  </div>

                  {/* Analysis History Mini Timeline */}
                  {((histories[resumeId] || []).length > 0) && (
                    <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
                        <span className="flex items-center gap-1.5 text-indigo-900">
                          <History className="w-3.5 h-3.5 text-indigo-600" />
                          Analysis History ({histories[resumeId].length})
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">Individual resume timeline</span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                        {histories[resumeId].slice(0, 4).map((h, idx) => {
                          const dateStr = new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                          return (
                            <button
                              key={h._id || idx}
                              type="button"
                              onClick={() => {
                                handleViewReport(resume);
                                setSelectedHistoryId(h._id);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-extrabold border transition-all flex items-center gap-1 shrink-0 ${
                                h.overallScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                h.overallScore >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              }`}
                              title={`Audit on ${new Date(h.createdAt).toLocaleDateString()}: ${h.overallScore}/100`}
                            >
                              <span>{dateStr}:</span>
                              <span>{h.overallScore}/100</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleCheckAts(resume, true)}
                      disabled={isAnalyzing}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 ${
                        isAnalyzing
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                      {isAnalyzing ? 'Analyzing...' : score != null ? 'Recheck ATS' : 'Check ATS'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleViewReport(resume)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      <Info className="w-3.5 h-3.5 text-gray-500" />
                      View Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ATS Report Detail Drawer / Modal ── */}
      {activeReportResume && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-150">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-gray-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">
                    ATS Resume Analysis
                  </span>
                  {activeReportResume.isPrimary && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Primary
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black truncate">
                  {activeReportResume.fileName || `${activeReportResume.role || 'Resume'}.pdf`}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCloseReport}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {currentAnalysis || currentResumeAts ? (
                <>
                  {/* Analysis History Selection Timeline */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                          Analysis History ({activeResumeHistories.length} {activeResumeHistories.length === 1 ? 'audit' : 'audits'})
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Histories belong strictly to {activeReportResume.role || activeReportResume.fileName}
                      </span>
                    </div>

                    {activeResumeHistories.length > 0 ? (
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                        {activeResumeHistories.map((item, index) => {
                          const isSelected = currentAnalysis?._id === item._id || (!selectedHistoryId && index === 0);
                          const score = item.overallScore;
                          const auditDate = new Date(item.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          });
                          const auditTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <button
                              key={item._id || index}
                              type="button"
                              onClick={() => setSelectedHistoryId(item._id)}
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all border shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold ring-2 ring-indigo-300'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 font-medium'
                              }`}
                            >
                              <div className="text-left space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Clock className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`} />
                                  <span>{auditDate}</span>
                                  {index === 0 && (
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                      isSelected ? 'bg-indigo-800 text-white' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      Latest
                                    </span>
                                  )}
                                </div>
                                <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                                  {auditTime}
                                </div>
                              </div>

                              <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                                isSelected
                                  ? 'bg-white/20 text-white border-white/30'
                                  : score >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : score >= 60
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {score}/100
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No historical analysis records found for this resume yet.</p>
                    )}
                  </div>

                  {/* Historical Snapshot Warning Banner if viewing an older check */}
                  {selectedHistoryId && selectedHistoryId !== activeResumeHistories[0]?._id && currentAnalysis && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900 font-medium animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Viewing historical audit snapshot from {new Date(currentAnalysis.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ({currentAnalysis.overallScore}/100).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryId(null)}
                        className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-[11px] font-bold shrink-0"
                      >
                        View Latest Audit
                      </button>
                    </div>
                  )}

                  {/* Score & Summary Header */}
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 p-6 rounded-2xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-24 h-24 rounded-full bg-white shadow-md border-4 border-indigo-600 flex flex-col items-center justify-center shrink-0">
                        <span className="text-3xl font-black text-indigo-900 leading-none">
                          {currentAnalysis?.overallScore ?? currentResumeAts?.overallScore ?? 0}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 mt-0.5">out of 100</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-gray-900">
                          {currentAnalysis?.overallScore >= 80 ? 'Excellent ATS Score!' : currentAnalysis?.overallScore >= 60 ? 'Good ATS Score' : 'Action Required for ATS Optimization'}
                        </h4>
                        <p className="text-xs text-gray-600 leading-relaxed max-w-md">
                          {currentAnalysis?.suggestions?.[0]?.suggestion || currentResumeAts?.atsSummary || 'Report reflects independent analysis for this specific resume.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCheckAts(activeReportResume, true)}
                        disabled={analyzingId === activeReportResume._id}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${analyzingId === activeReportResume._id ? 'animate-spin' : ''}`} />
                        {analyzingId === activeReportResume._id ? 'Rechecking...' : 'Re-run Audit'}
                      </button>
                    </div>
                  </div>

                  {/* 6 Categories Score Grid */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Category Breakdown
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { label: 'Content Quality', key: 'content', max: 20 },
                        { label: 'Sections', key: 'sections', max: 15 },
                        { label: 'ATS Essentials', key: 'atsEssentials', max: 20 },
                        { label: 'Readability', key: 'readability', max: 15 },
                        { label: 'Experience Quality', key: 'experienceQuality', max: 15 },
                        { label: 'Skill Evidence', key: 'skillEvidence', max: 15 }
                      ].map(({ label, key, max }) => {
                        const catObj = currentAnalysis?.categories?.[key];
                        const score = catObj?.score ?? currentResumeAts?.breakdown?.[key] ?? 0;
                        const pct = Math.round((score / max) * 100);

                        return (
                          <div key={key} className="bg-white p-3 rounded-xl border border-gray-150 space-y-1.5">
                            <div className="flex justify-between font-semibold text-gray-700">
                              <span>{label}</span>
                              <span className="font-bold text-indigo-900">{score}/{max}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Issues & Recommendations */}
                  {(currentAnalysis?.issues?.length > 0 || currentResumeAts?.gaps?.length > 0) && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Identified Gaps & Action Items
                      </h4>
                      <div className="space-y-2.5">
                        {currentAnalysis?.issues ? (
                          currentAnalysis.issues.map((issue, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/70 space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-amber-900">{issue.title}</span>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-200/60 text-amber-800">
                                  {issue.severity || 'suggestion'}
                                </span>
                              </div>
                              {issue.description && <p className="text-amber-800">{issue.description}</p>}
                              {issue.recommendation && (
                                <p className="text-amber-950 font-medium pt-1">
                                  💡 <span className="font-bold">Fix:</span> {issue.recommendation}
                                </p>
                              )}
                              {issue.example && (
                                <pre className="text-[11px] bg-white/80 p-2 rounded border border-amber-200/50 text-gray-800 whitespace-pre-wrap font-mono mt-1">
                                  {issue.example}
                                </pre>
                              )}
                            </div>
                          ))
                        ) : (
                          currentResumeAts?.actionItems?.map((item, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs text-amber-900 font-medium">
                              • {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detected Skills */}
                  {currentAnalysis?.detectedSkills?.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Detected Skills in Resume ({currentAnalysis.detectedSkills.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {currentAnalysis.detectedSkills.map((sk, idx) => (
                          <span
                            key={idx}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                              sk.hasEvidence
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                            title={sk.evidenceContext || 'Mentioned'}
                          >
                            {sk.name} {sk.hasEvidence ? '✓' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
                  <div>
                    <h4 className="text-base font-bold text-gray-900">No ATS Audit Run Yet for This Resume</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Click below to generate a fresh, independent ATS analysis for this resume.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckAts(activeReportResume, true)}
                    disabled={analyzingId === activeReportResume._id}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md"
                  >
                    Run ATS Audit Now
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-400">
                Analysis is unique to {activeReportResume.fileName || activeReportResume.role}
              </span>
              <button
                type="button"
                onClick={handleCloseReport}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add New Resume Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-gray-150 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Upload Target Role Resume</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadNewResume} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  Target Role / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadRole}
                  onChange={(e) => setUploadRole(e.target.value)}
                  placeholder="e.g. Fullstack Developer, HR Executive, Marketing"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  Resume PDF File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                  {uploading ? 'Uploading...' : 'Upload & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtsResumeChecker;
