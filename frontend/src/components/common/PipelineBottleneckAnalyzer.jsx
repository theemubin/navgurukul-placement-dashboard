import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSchools } from '../../context/SchoolsContext';
import { applicationAPI, campusAPI } from '../../services/api';
import { Card, LoadingSpinner, Badge, Button } from './UIComponents';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  AlertTriangle, Filter, Search, UserCheck, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronUp, AlertCircle, Sparkles, Briefcase,
  Layers, User, ArrowRight, Phone, Mail, Award, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

const PipelineBottleneckAnalyzer = ({ defaultStudentId = null, embedded = false }) => {
  const { user } = useAuth();
  const { schools } = useSchools();
  const isPoC = user?.role === 'campus_poc';
  const isManager = user?.role === 'manager';

  // Navigation & Sub-tab state
  const [activeView, setActiveView] = useState(defaultStudentId ? 'student360' : 'overall'); // 'overall' | 'student360'

  // Global Filters
  const [campuses, setCampuses] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState(isPoC ? (user?.campus?._id || user?.campus || '') : '');
  const [minDays, setMinDays] = useState(7);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');

  // Macro Bottleneck Data State
  const [bottleneckData, setBottleneckData] = useState(null);
  const [bottleneckLoading, setBottleneckLoading] = useState(false);

  // Micro Stagnant Students Data State
  const [stagnantStudents, setStagnantStudents] = useState([]);
  const [stagnantLoading, setStagnantLoading] = useState(false);

  // Selected Student 360 State
  const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId);
  const [student360Report, setStudent360Report] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedAppIds, setExpandedAppIds] = useState({});
  const [appDetailMap, setAppDetailMap] = useState({});
  const [loadingAppDetails, setLoadingAppDetails] = useState({});

  const DESIRED_STAGE_ORDER = [
    'applied',
    'interested',
    'application_stage',
    'withdrawn',
    'hr_shortlisting',
    'interviewing',
    'rejected',
    'filled'
  ];

  const getStageOrderIndex = (stage) => {
    const lower = (stage || '').toLowerCase().trim();
    let idx = DESIRED_STAGE_ORDER.indexOf(lower);
    if (idx !== -1) return idx;

    if (lower.includes('reject')) return DESIRED_STAGE_ORDER.indexOf('rejected');
    if (lower.includes('hr') || lower.includes('shortlist')) return DESIRED_STAGE_ORDER.indexOf('hr_shortlisting');
    if (lower.includes('interest')) return DESIRED_STAGE_ORDER.indexOf('interested');
    if (lower === 'applied') return DESIRED_STAGE_ORDER.indexOf('applied');
    if (lower.includes('stage') || lower.includes('pending') || lower.includes('review')) return DESIRED_STAGE_ORDER.indexOf('application_stage');
    if (lower.includes('withdraw')) return DESIRED_STAGE_ORDER.indexOf('withdrawn');
    if (lower.includes('fill') || lower.includes('select') || lower.includes('offer') || lower.includes('place')) return DESIRED_STAGE_ORDER.indexOf('filled');
    if (lower.includes('interview')) return DESIRED_STAGE_ORDER.indexOf('interviewing');

    return 999;
  };

  const getSortedStageBreakdown = () => {
    if (!bottleneckData?.stageBreakdown) return [];
    return [...bottleneckData.stageBreakdown].sort((a, b) => getStageOrderIndex(a.stage) - getStageOrderIndex(b.stage));
  };

  // Intervention Modal State
  const [interventionModal, setInterventionModal] = useState({ open: false, appId: null, jobTitle: '' });
  const [interventionForm, setInterventionForm] = useState({
    actionType: 'mock_interview_scheduled',
    note: '',
    remedialTag: ''
  });
  const [submittingIntervention, setSubmittingIntervention] = useState(false);

  // Company Role Breakdown Modal State
  const [companyDetailModal, setCompanyDetailModal] = useState({ open: false, company: null });

  // ESC key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (companyDetailModal.open) {
          setCompanyDetailModal({ open: false, company: null });
        }
        if (interventionModal.open) {
          setInterventionModal({ open: false, appId: null, jobTitle: '' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [companyDetailModal.open, interventionModal.open]);

  const formatDateString = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const getMonthsSpent = (student) => {
    const sourceDate = student?.joiningDate || student?.createdAt;
    if (!sourceDate) return null;
    const startDate = new Date(sourceDate);
    if (isNaN(startDate.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  };

  // Load Campuses on Mount
  useEffect(() => {
    fetchCampuses();
  }, []);

  // Fetch Macro Bottleneck Data when filters change
  useEffect(() => {
    if (activeView === 'overall') {
      fetchBottlenecks();
    }
  }, [activeView, selectedCampus, minDays]);

  // Fetch Stagnant Students list only after the user applies the search or changes a filter
  useEffect(() => {
    if (activeView === 'student360') {
      fetchStagnantStudents();
    }
  }, [activeView, selectedCampus, minDays, selectedStatus, selectedSchool, appliedSearch]);

  // Fetch Student 360 report when student selected
  useEffect(() => {
    if (selectedStudentId) {
      fetchStudent360Report(selectedStudentId);
    }
  }, [selectedStudentId]);

  const fetchCampuses = async () => {
    try {
      const res = await campusAPI.getCampuses();
      setCampuses(res.data || []);
    } catch (err) {
      console.error('Failed to load campuses:', err);
    }
  };

  const fetchBottlenecks = async () => {
    setBottleneckLoading(true);
    try {
      const res = await applicationAPI.getPipelineBottlenecks({
        campus: selectedCampus || undefined,
        minDays
      });
      setBottleneckData(res.data);
    } catch (err) {
      toast.error('Failed to load pipeline bottlenecks data');
      console.error(err);
    } finally {
      setBottleneckLoading(false);
    }
  };

  const fetchStagnantStudents = async () => {
    setStagnantLoading(true);
    try {
      const res = await applicationAPI.getStagnantStudents({
        campus: selectedCampus || undefined,
        minDays,
        stage: selectedStatus || undefined,
        school: selectedSchool || undefined,
        search: appliedSearch || undefined,
        limit: 12
      });

      const nextStudents = res.data.students || [];
      setStagnantStudents(nextStudents);

      if (selectedStudentId && !nextStudents.some(item => item.student?._id === selectedStudentId)) {
        setSelectedStudentId(null);
        setStudent360Report(null);
        setExpandedAppIds({});
      }
    } catch (err) {
      console.error('Failed to fetch stagnant students:', err);
    } finally {
      setStagnantLoading(false);
    }
  };

  const applyStudentSearch = () => {
    setAppliedSearch(searchQuery.trim());
    setSelectedStudentId(null);
    setStudent360Report(null);
    setExpandedAppIds({});
  };

  const handleStudentSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyStudentSearch();
    }
  };

  const fetchStudent360Report = async (sId) => {
    setReportLoading(true);
    try {
      const res = await applicationAPI.getStudent360Report(sId, { detailLevel: 'summary' });
      setStudent360Report(res.data);
      setAppDetailMap({});

      // Auto expand stagnant applications by default
      const initialExpanded = {};
      (res.data.applications || []).forEach(app => {
        if (app.isStagnant) {
          initialExpanded[app._id] = true;
        }
      });
      setExpandedAppIds(initialExpanded);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Student 360 report');
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchApplicationDetail = async (appId) => {
    if (!appId || appDetailMap[appId] || loadingAppDetails[appId]) return;

    setLoadingAppDetails(prev => ({ ...prev, [appId]: true }));
    try {
      const res = await applicationAPI.getApplication(appId);
      setAppDetailMap(prev => ({ ...prev, [appId]: res.data }));
    } catch (err) {
      toast.error('Failed to load application details');
      console.error(err);
    } finally {
      setLoadingAppDetails(prev => ({ ...prev, [appId]: false }));
    }
  };

  const toggleExpandApp = (appId) => {
    setExpandedAppIds(prev => {
      const nextExpanded = !prev[appId];
      if (nextExpanded) {
        fetchApplicationDetail(appId);
      }
      return { ...prev, [appId]: nextExpanded };
    });
  };

  const handleOpenInterventionModal = (appId, jobTitle) => {
    setInterventionModal({ open: true, appId, jobTitle });
    setInterventionForm({ actionType: 'mock_interview_scheduled', note: '', remedialTag: '' });
  };

  const handleSaveIntervention = async (e) => {
    e.preventDefault();
    if (!interventionForm.note.trim()) {
      toast.error('Please enter an intervention note');
      return;
    }
    setSubmittingIntervention(true);
    try {
      await applicationAPI.logIntervention(interventionModal.appId, interventionForm);
      toast.success('Intervention note logged successfully');
      setInterventionModal({ open: false, appId: null, jobTitle: '' });
      if (selectedStudentId) {
        fetchStudent360Report(selectedStudentId);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log intervention');
    } finally {
      setSubmittingIntervention(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & VIEW TOGGLE SWITCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Placement Bottleneck & Stagnation Analyzer
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Identify stage drop-offs, stagnant applications, and student-centered 360° interview histories.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 self-start md:self-auto">
          <button
            onClick={() => setActiveView('overall')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
              activeView === 'overall'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart className="w-4 h-4" />
            Overall Funnel Analytics
          </button>
          <button
            onClick={() => setActiveView('student360')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${
              activeView === 'student360'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Student 360° Stagnation Tracker
          </button>
        </div>
      </div>

      {/* GLOBAL FILTERS BAR */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span>Filters:</span>
        </div>

        {/* Campus Filter */}
        {!isPoC && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Campus:</label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3 bg-white border"
            >
              <option value="">All Campuses</option>
              {campuses.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Days Threshold Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Stagnant Threshold:</label>
          <select
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
            className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3 bg-white border"
          >
            <option value={5}>&gt; 5 Days Inactive</option>
            <option value={7}>&gt; 7 Days Inactive (Default)</option>
            <option value={14}>&gt; 14 Days Inactive (Critical)</option>
            <option value={21}>&gt; 21 Days Inactive</option>
          </select>
        </div>

        {activeView === 'student360' && (
          <>
            {/* School Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">School:</label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3 bg-white border"
              >
                <option value="">All Schools</option>
                {schools.map((school) => (
                  <option key={school} value={school}>{school}</option>
                ))}
              </select>
            </div>

            {/* Name Search */}
            <div className="flex-1 min-w-[320px] flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Search Student Name:</label>
              <div className="flex flex-1 min-w-0 items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm focus-within:border-indigo-500">
                <span className="pointer-events-none flex items-center pl-3 pr-2 text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Type a student name, then press Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleStudentSearchKeyDown}
                  className="w-full min-w-0 border-0 bg-transparent py-2.5 pr-3 pl-0 text-sm focus:outline-none focus:ring-0"
                />
              </div>
              <Button type="button" size="sm" variant="primary" onClick={applyStudentSearch}>
                Search
              </Button>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3 bg-white border"
              >
                <option value="">All Statuses</option>
                <option value="applied">Applied</option>
                <option value="interested">Interested</option>
                <option value="application_stage">Application Stage</option>
                <option value="hr_shortlisting">HR Shortlisting</option>
                <option value="interviewing">Interviewing</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="rejected">Rejected</option>
                <option value="filled">Filled</option>
              </select>
            </div>
          </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* VIEW A: OVERALL FUNNEL ANALYTICS (MACRO VIEW) */}
      {/* ========================================================================= */}
      {activeView === 'overall' && (
        <>
          {bottleneckLoading ? (
            <div className="flex justify-center p-12"><LoadingSpinner /></div>
          ) : bottleneckData ? (
            <div className="space-y-6">
              {/* TOP STAT CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Total Applications</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{bottleneckData.totalApplications}</p>
                </div>
                <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm">
                  <p className="text-xs font-semibold text-red-600 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Stagnant Applications
                  </p>
                  <p className="text-3xl font-bold text-red-700 mt-2">{bottleneckData.totalStagnant}</p>
                  <p className="text-xs text-red-600 mt-1">&gt; {minDays} days without update</p>
                </div>
                <div className="bg-green-50 p-5 rounded-xl border border-green-200 shadow-sm">
                  <p className="text-xs font-semibold text-green-600 uppercase flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Offers / Placed
                  </p>
                  <p className="text-3xl font-bold text-green-700 mt-2">{bottleneckData.totalOffered}</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Total Rejections</p>
                  <p className="text-3xl font-bold text-gray-700 mt-2">{bottleneckData.totalRejected}</p>
                </div>
              </div>

              {/* FUNNEL & DWELL TIME CHART */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  Pipeline Stage Dwell Times & Volume
                </h3>
                <p className="text-xs text-gray-500 mb-6">
                  Bar height shows active candidate volume per stage. Numbers above bars represent average days candidates remain in that stage.
                </p>
                <div className="h-72 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={288}>
                    <BarChart data={getSortedStageBreakdown()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" stroke="#6B7280" />
                      <YAxis stroke="#6B7280" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-900 text-white p-3 rounded-lg text-xs space-y-1 shadow-lg">
                                <p className="font-bold text-indigo-300">{data.stage}</p>
                                <p>Candidates: <span className="font-bold">{data.count}</span></p>
                                <p>Avg Days in Stage: <span className="font-bold text-amber-300">{data.avgDaysInStage} days</span></p>
                                <p>Stagnant (&gt;{minDays}d): <span className="font-bold text-red-400">{data.stagnantCount}</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* STAGE BREAKDOWN CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getSortedStageBreakdown().map((stageItem) => (
                  <div key={stageItem.stage} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800 capitalize">{stageItem.stage}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {stageItem.count} candidate(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-indigo-600">{stageItem.avgDaysInStage}d avg</p>
                      {stageItem.stagnantCount > 0 ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {stageItem.stagnantCount} stagnant
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">
                          Smooth
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* TOP BOTTLENECK COMPANIES */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-amber-600" />
                  Companies with Slowest Response Times (&gt;{minDays} Days Stagnant)
                </h3>
                {bottleneckData.companyBottlenecks?.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No company response bottlenecks detected for current filter.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                        <tr>
                          <th className="py-3 px-4">Company Name</th>
                          <th className="py-3 px-4">Posting Date</th>
                          <th className="py-3 px-4">Pending Candidates</th>
                          <th className="py-3 px-4">Avg Days Pending</th>
                          <th className="py-3 px-4">Associated Roles</th>
                          <th className="py-3 px-4 text-right">Role Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {bottleneckData.companyBottlenecks.map((c, idx) => {
                          const formattedDates = (c.postingDates || [])
                            .map(formatDateString)
                            .filter(Boolean);
                          const postingDateDisplay = formattedDates.length > 0 ? formattedDates.join(', ') : 'N/A';

                          return (
                            <tr
                              key={idx}
                              onClick={() => setCompanyDetailModal({ open: true, company: c })}
                              className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4 font-bold text-gray-900">{c.company}</td>
                              <td className="py-3 px-4 text-xs font-medium text-gray-700 whitespace-nowrap">
                                {postingDateDisplay}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                                  {c.stagnantCount} candidate(s) pending
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3" /> {c.avgDaysStagnant || 'N/A'} days avg
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-gray-500">
                                {(c.jobTitles || []).join(', ')}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCompanyDetailModal({ open: true, company: c });
                                  }}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1"
                                >
                                  Role Info &rarr;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: STUDENT-CENTERED 360° REPORT & STAGNATION TRACKER (MICRO VIEW) */}
      {/* ========================================================================= */}
      {activeView === 'student360' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: STUDENT SELECTOR LIST (4 cols) */}
          <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Stagnant Students ({stagnantStudents.length})
            </h3>

            {/* Students List */}
            {stagnantLoading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 animate-pulse">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  Updating stagnant results...
                </div>
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-gray-200 bg-gray-50 animate-pulse space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-3/4 rounded bg-gray-200" />
                        <div className="h-3 w-1/2 rounded bg-gray-200" />
                      </div>
                      <div className="h-5 w-16 rounded-full bg-gray-200" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-16 rounded bg-gray-200" />
                      <div className="h-3 w-16 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stagnantStudents.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6 italic">No stagnant students found for this filter.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {stagnantStudents.map((item) => {
                  const s = item.student;
                  const isSelected = selectedStudentId === s._id;
                  return (
                    <div
                      key={s._id}
                      onClick={() => setSelectedStudentId(s._id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.campus} • {s.department || 'Student'}</p>
                        </div>
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                          {item.maxDaysStuck}d stuck
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span>Apps: {item.totalApplications}</span>
                        <span>Rejections: {item.rejectionCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: 360° REPORT FOR SELECTED STUDENT (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedStudentId ? (
              <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-500">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-lg text-gray-700">Select a student from the left panel</p>
                <p className="text-xs text-gray-500 mt-1">Select a student to view their complete 360° placement report and interview history.</p>
              </div>
            ) : reportLoading ? (
              <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-1/3 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="h-20 rounded-xl bg-gray-100 border border-gray-200" />
                  ))}
                </div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} className="h-16 rounded-xl bg-gray-100 border border-gray-200" />
                  ))}
                </div>
              </div>
            ) : student360Report ? (
              <div className="space-y-6">
                {/* 1. STUDENT HEADER PROFILE CARD */}
                <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white p-6 rounded-xl shadow-md space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xl text-white">
                          {student360Report.student.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{student360Report.student.name}</h3>
                          <p className="text-xs text-indigo-200">
                            {student360Report.student.campus} Campus • {student360Report.student.monthsSpent !== null && student360Report.student.monthsSpent !== undefined
                              ? `${student360Report.student.monthsSpent} months spent`
                              : getMonthsSpent(student360Report.student) !== null
                                ? `${getMonthsSpent(student360Report.student)} months spent`
                                : 'Tenure unavailable'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      {student360Report.student.phone && (
                        <span className="flex items-center gap-1 bg-indigo-800/80 px-3 py-1.5 rounded-lg border border-indigo-600">
                          <Phone className="w-3.5 h-3.5" /> {student360Report.student.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1 bg-indigo-800/80 px-3 py-1.5 rounded-lg border border-indigo-600">
                        <Mail className="w-3.5 h-3.5" /> {student360Report.student.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. AUTOMATED BOTTLENECK DIAGNOSTIC ALERT BOX */}
                {student360Report.diagnosticAlert && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    student360Report.diagnosticAlert.riskLevel === 'high'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : student360Report.diagnosticAlert.riskLevel === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-green-50 border-green-200 text-green-800'
                  }`}>
                    <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">
                        Rule-based Diagnostic Insight: {student360Report.diagnosticAlert.bottleneckStage}
                      </h4>
                      <p className="text-xs mt-0.5 leading-relaxed">
                        {student360Report.diagnosticAlert.message}
                      </p>
                      <p className="text-[10px] mt-1 opacity-80">
                        Generated from application timing and stage history, not AI.
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. STUDENT SUMMARY COUNTS AT A GLANCE */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Total Drives</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{student360Report.summaryStats.totalApplications}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Active / Stagnant</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">
                      {student360Report.summaryStats.activeApplications}
                      {student360Report.summaryStats.stagnantApplications > 0 && (
                        <span className="text-xs font-bold text-red-600 ml-1">
                          ({student360Report.summaryStats.stagnantApplications} stuck)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Tech Round Pass/Fail</p>
                    <p className="text-2xl font-bold mt-1">
                      <span className="text-green-600">{student360Report.summaryStats.roundStats.techPassed}</span>
                      <span className="text-gray-400 font-normal text-sm mx-1">/</span>
                      <span className="text-red-600">{student360Report.summaryStats.roundStats.techFailed}</span>
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Avg Dwell Time</p>
                    <p className="text-2xl font-bold text-gray-700 mt-1">{student360Report.summaryStats.avgDaysInPipeline}d</p>
                  </div>
                </div>

                {/* 4. COLLAPSIBLE UNIFIED APPLICATION HISTORY */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-bold text-gray-900 flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                      Complete Application & Interview History ({student360Report.applications.length})
                    </h3>
                  </div>

                  {student360Report.applications.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4">No applications submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {student360Report.applications.map((app) => {
                        const isExpanded = !!expandedAppIds[app._id];
                        const detailApp = appDetailMap[app._id];
                        const mergedApp = detailApp ? { ...app, ...detailApp, job: detailApp.job || app.job } : app;
                        const isDetailLoading = !!loadingAppDetails[app._id];
                        return (
                          <div
                            key={app._id}
                            className={`border rounded-xl transition-all overflow-hidden ${
                              app.isStagnant ? 'border-red-300 bg-red-50/20' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {/* COLLAPSED ROW HEADER */}
                            <div
                              onClick={() => toggleExpandApp(app._id)}
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs uppercase">
                                  {app.job?.company?.name?.slice(0, 3) || 'JOB'}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-gray-900">{app.job?.title || 'Job Application'}</h4>
                                  <p className="text-xs text-gray-500">
                                    {app.job?.company?.name} • Applied: {new Date(app.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-700 capitalize">
                                  Stage: {app.status}
                                </span>
                                {app.isStagnant && (
                                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {app.daysInStage} days stuck
                                  </span>
                                )}
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                              </div>
                            </div>

                            {/* EXPANDED CONTENT AREA */}
                            {isExpanded && (
                              <div className="p-4 border-t border-gray-200 bg-gray-50/50 space-y-4 text-xs text-gray-700">
                                {/* STATUS CHANGE HISTORY */}
                                <div>
                                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-indigo-600" /> Status Change Timeline
                                  </h5>
                                  {isDetailLoading ? (
                                    <div className="py-4 flex justify-center">
                                      <LoadingSpinner />
                                    </div>
                                  ) : mergedApp.statusHistory?.length > 0 ? (
                                    <div className="space-y-2">
                                        {mergedApp.statusHistory
                                        .slice()
                                        .sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0))
                                        .map((entry, historyIdx) => (
                                          <div key={historyIdx} className="bg-white p-3 rounded-lg border border-gray-200">
                                            <div className="flex items-center justify-between gap-3">
                                              <p className="font-bold text-gray-900 capitalize">
                                                {entry.status?.replace(/_/g, ' ')}
                                              </p>
                                              <span className="text-[11px] font-bold text-gray-500">
                                                {formatDateString(entry.changedAt) || 'Date unavailable'}
                                              </span>
                                            </div>
                                            {entry.comment && (
                                              <p className="text-gray-500 mt-1 italic">{entry.comment}</p>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 italic">No status history available yet.</p>
                                  )}
                                </div>

                                {/* ROUND-BY-ROUND INTERVIEW TIMELINE */}
                                <div>
                                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-indigo-600" /> Interview Rounds Timeline
                                  </h5>
                                  {isDetailLoading ? (
                                    <div className="py-4 flex justify-center">
                                      <LoadingSpinner />
                                    </div>
                                  ) : mergedApp.roundResults?.length === 0 ? (
                                    <p className="text-gray-500 italic">No individual interview rounds recorded yet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                        {mergedApp.roundResults.map((r, rIdx) => (
                                        <div key={rIdx} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                                          <div>
                                            <p className="font-bold text-gray-900">
                                              Round {r.round}: {r.roundName}
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
                                              {r.status ? `Stage: ${r.status.replace(/_/g, ' ')}` : 'Stage unavailable'}
                                              {r.scheduledDate && ` • Scheduled ${formatDateString(r.scheduledDate)}`}
                                              {r.completedAt && ` • Completed ${formatDateString(r.completedAt)}`}
                                            </p>
                                            {r.feedback && (
                                              <p className="text-gray-500 mt-1 italic font-sans">"{r.feedback}"</p>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full uppercase ${
                                              r.status === 'passed'
                                                ? 'bg-green-100 text-green-700'
                                                : r.status === 'failed'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>
                                              {r.status}
                                            </span>
                                            {r.score !== undefined && (
                                              <p className="text-xs text-gray-500 mt-0.5">Score: {r.score}</p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* COMPANY ROLE BREAKDOWN MODAL */}
      {companyDetailModal.open && companyDetailModal.company && (
        <div
          onClick={() => setCompanyDetailModal({ open: false, company: null })}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-xl max-h-[85vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-indigo-600" />
                  {companyDetailModal.company.company}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Response Bottleneck Breakdown • {companyDetailModal.company.stagnantCount} total pending candidate(s) across {(companyDetailModal.company.roles || []).length} role(s)
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-full flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {companyDetailModal.company.avgDaysStagnant}d avg pending
              </span>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Role-Wise Breakdown
              </h4>

              {(companyDetailModal.company.roles || []).map((role, rIdx) => (
                <div key={rIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-sm text-gray-900">{role.jobTitle}</h5>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {role.stagnantCount} candidate(s) pending • Avg {role.avgDaysStagnant} days stuck
                        {role.postingDate && ` • Posted: ${formatDateString(role.postingDate)}`}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                      {role.stagnantCount} Pending
                    </span>
                  </div>

                  {/* Stage Distribution Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-semibold">Stage Distribution:</span>
                    {(role.stages || []).map((st, sIdx) => (
                      <span key={sIdx} className="px-2 py-0.5 text-xs bg-white text-gray-700 border rounded-md font-medium capitalize">
                        {st.stage}: <strong>{st.count}</strong>
                      </span>
                    ))}
                  </div>

                  {/* Candidate list under this role */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Affected Candidates:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(role.candidates || []).map((cand, cIdx) => (
                        <div
                          key={cIdx}
                          onClick={() => {
                            if (cand.studentId) {
                              setCompanyDetailModal({ open: false, company: null });
                              setSelectedStudentId(cand.studentId);
                              setActiveView('student360');
                            }
                          }}
                          className="bg-white p-2.5 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <p className="font-bold text-gray-900">{cand.name}</p>
                            <p className="text-[11px] text-gray-500 capitalize">Stage: {cand.stage}</p>
                          </div>
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            {cand.daysStuck}d
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCompanyDetailModal({ open: false, company: null })}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineBottleneckAnalyzer;