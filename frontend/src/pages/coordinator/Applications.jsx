import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { applicationAPI, jobAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, Modal } from '../../components/common/UIComponents';
import { Search, Filter, Eye, CheckCircle, XCircle, Clock, MessageSquare, Download, Users, ExternalLink, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const Applications = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const canManageJob = (job) => {
    if (!user) return false;
    if (user.role === 'manager') return true;
    const userId = String(user._id || user.id || '');
    if (!job) return false;
    const coordId = job.coordinator?._id ? String(job.coordinator._id) : String(job.coordinator || '');
    const creatorId = job.createdBy?._id ? String(job.createdBy._id) : String(job.createdBy || '');
    if (coordId && coordId === userId) return true;
    if (creatorId && creatorId === userId) return true;
    return false;
  };

  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    job: '',
    search: '',
    myLeads: false
  });
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [discordThreadId, setDiscordThreadId] = useState('');
  const [pipelineStages, setPipelineStages] = useState([]);

  useEffect(() => {
    fetchJobs();
    fetchApplications();
    fetchPipelineStages();
  }, [filters.status, filters.job, pagination.page]);

  const fetchPipelineStages = async () => {
    try {
      const response = await settingsAPI.getPipelineStages();
      const stages = response.data?.data || [];
      if (stages.length > 0) {
        setPipelineStages(stages);
      } else {
        // Fallback to defaults if no stages configured
        setPipelineStages([
          { id: 'applied', label: 'Applied' },
          { id: 'under_review', label: 'Under Review' },
          { id: 'shortlisted', label: 'Shortlisted' },
          { id: 'interviewing', label: 'Interviewing' },
          { id: 'hired', label: 'Hired' },
          { id: 'rejected', label: 'Rejected' },
        ]);
      }
    } catch (e) {
      console.error('Error fetching pipeline stages:', e);
    }
  };

  // Apply job filter from URL query ?job=<id> so links like "View applicants" open a filtered view
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const jobParam = params.get('job') || '';
    if (jobParam && jobParam !== filters.job) {
      setFilters(prev => ({ ...prev, job: jobParam }));
      setPagination(prev => ({ ...prev, page: 1 }));
    }
    // If job param is cleared in URL, remove filter
    if (!jobParam && filters.job) {
      setFilters(prev => ({ ...prev, job: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Handle appId from URL for deep linking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const appId = params.get('appId');
    if (appId) {
      const fetchAndOpenDetails = async () => {
        try {
          const response = await applicationAPI.getApplication(appId);
          setSelectedApplication(response.data);
          setShowDetailModal(true);
        } catch (error) {
          console.error('Error fetching application for deep link:', error);
        }
      };
      fetchAndOpenDetails();
    }
  }, [location.search]);

  // Keep selected job title in sync when filters.job changes; fetch job if necessary
  useEffect(() => {
    if (!filters.job) {
      setSelectedJobTitle('');
      return;
    }

    const found = jobs.find(j => String(j._id) === String(filters.job));
    if (found) {
      setSelectedJobTitle(`${found.title} - ${found.company?.name || ''}`);
      // Also update URL if not present
      const params = new URLSearchParams(location.search);
      if (params.get('job') !== String(filters.job)) {
        params.set('job', filters.job);
        navigate({ search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
      }
      return;
    }

    // If job not in list yet, fetch it directly
    const fetchJobTitle = async () => {
      try {
        const res = await jobAPI.getJob(filters.job);
        setSelectedJobTitle(`${res.data.job.title} - ${res.data.job.company?.name || ''}`);
      } catch (err) {
        setSelectedJobTitle('');
      }
    };

    fetchJobTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.job, jobs]);

  const clearJobFilter = () => {
    setFilters(prev => ({ ...prev, job: '' }));
    setPagination(prev => ({ ...prev, page: 1 }));
    const params = new URLSearchParams(location.search);
    params.delete('job');
    navigate({ search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
  };

  const handleJobSelect = (jobId) => {
    setFilters(prev => ({ ...prev, job: jobId }));
    setPagination(prev => ({ ...prev, page: 1 }));
    const params = new URLSearchParams(location.search);
    if (jobId) params.set('job', jobId);
    else params.delete('job');
    navigate({ search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
  };

  const fetchJobs = async () => {
    try {
      const response = await jobAPI.getJobs({ limit: 100 });
      const fetched = response.data.jobs || [];
      setJobs(fetched);

      // If a job filter is active, try to resolve its title for the filter pill
      if (filters.job) {
        const found = fetched.find(j => String(j._id) === String(filters.job));
        if (found) setSelectedJobTitle(`${found.title} - ${found.company?.name || ''}`);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: 10,
        ...(filters.status && { status: filters.status }),
        ...(filters.job && { job: filters.job }),
        ...(filters.myLeads && { myLeads: 'true' })
      };
      const response = await applicationAPI.getApplications(params);
      setApplications(response.data.applications || []);
      setPagination({
        page: response.data.page || 1,
        totalPages: response.data.totalPages || 1,
        total: response.data.total || 0
      });
    } catch (error) {
      toast.error('Error fetching applications');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status, withFeedback = false) => {
    if (!selectedApplication) return;

    try {
      await applicationAPI.updateStatus(selectedApplication._id, status, withFeedback ? feedback : undefined);
      toast.success(`Application ${status}`);
      setShowDetailModal(false);
      setShowFeedbackModal(false);
      setFeedback('');
      fetchApplications();
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const handleBulkUpdate = async (action = 'set_status') => {
    if (selectedIds.length === 0) return;

    const selectedApps = applications.filter(a => selectedIds.includes(a._id));
    const uniqueJobIds = [...new Set(selectedApps.map(a => a.job?._id))];

    if (uniqueJobIds.length > 1) {
      toast.error('Please select applications from a single job for bulk actions');
      return;
    }

    const jobId = uniqueJobIds[0];
    const jobObj = jobs.find(j => String(j._id) === String(jobId));

    if (!canManageJob(jobObj)) {
      toast.error("Only the job's assigned coordinator or a manager may perform bulk actions for this job");
      return;
    }

    try {
      // Logic mirrored from handleTriageConfirm in Jobs.jsx
      if (action === 'set_status') {
        const payload = {
          applicationIds: selectedIds,
          action: 'set_status',
          status: bulkStatus,
          generalFeedback: feedback
        };

        // Handle interview rounds if target status is interviewing
        const isInterviewing = bulkStatus === 'interviewing' || bulkStatus === 'shortlisted' || (pipelineStages.find(s => s.id === bulkStatus)?.label?.toLowerCase().includes('interview'));
        if (isInterviewing && jobObj?.interviewRounds?.length > 0) {
          payload.targetRound = selectedRoundIndex;
          payload.roundName = jobObj.interviewRounds[selectedRoundIndex]?.name;
        }

        await jobAPI.bulkUpdate(jobId, payload);
      } else if (action === 'advance_round') {
        await jobAPI.bulkUpdate(jobId, {
          applicationIds: selectedIds,
          action: 'advance_round',
          advanceBy: 1,
          generalFeedback: feedback
        });
      }

      toast.success('Bulk update completed successfully');
      setSelectedIds([]);
      setShowBulkModal(false);
      setFeedback('');
      setBulkStatus('');
      setSelectedRoundIndex(0);
      fetchApplications();
    } catch (error) {
      console.error('Bulk update error', error);
      const msg = error?.response?.data?.message || error?.message || 'Bulk update failed';
      toast.error(msg);
    }
  };

  const openFeedbackModal = (status) => {
    setNewStatus(status);
    setShowDetailModal(false);
    setShowFeedbackModal(true);
  };

  const filteredApplications = applications.filter(app => {
    // Enforce server-side filters client-side as a safety net
    if (filters.job && String(app.job?._id || app.job) !== String(filters.job)) return false;
    if (filters.status && app.status !== filters.status) return false;

    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      app.student?.name?.toLowerCase().includes(searchLower) ||
      app.student?.email?.toLowerCase().includes(searchLower) ||
      app.job?.title?.toLowerCase().includes(searchLower) ||
      app.job?.company?.name?.toLowerCase().includes(searchLower)
    );
  });

  // Group applications by company when requested
  const appsGroupedByCompany = filteredApplications.reduce((acc, app) => {
    const companyName = app.job?.company?.name || 'Unknown';
    acc[companyName] = acc[companyName] || [];
    acc[companyName].push(app);
    return acc;
  }, {});

  const renderApplicationsCards = (apps) => {
    return (
      <div className="md:hidden space-y-4">
        {apps.map((app) => (
          <div key={app._id} className="card p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(app._id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(prev => [...new Set([...prev, app._id])]);
                    else setSelectedIds(prev => prev.filter(id => id !== app._id));
                  }}
                  className="mt-1 sticky top-0"
                />
                <div>
                  <p className="font-bold text-gray-900">{app.student?.name}</p>
                  <p className="text-sm text-gray-500">{app.student?.email}</p>
                </div>
              </div>
              <StatusBadge status={app.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-50">
              <div className="col-span-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Job</p>
                <p className="text-sm font-medium text-gray-900 truncate">{app.job?.title}</p>
                <p className="text-xs text-gray-500 truncate">{app.job?.company?.name}</p>
              </div>
              <div className="col-span-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applied On</p>
                <p className="text-sm text-gray-600">{new Date(app.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="col-span-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Round</p>
                <p className="text-sm text-gray-600">{app.currentRound !== undefined ? `Round ${app.currentRound + 1}` : '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedApplication(app); setShowDetailModal(true); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
              >
                <Eye className="w-4 h-4" />
                Details
              </button>
              {app.student?.profile?.resume && (
                <a
                  href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${app.student.profile.resume}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderApplicationsTable = (apps) => {
    const selectedApps = applications.filter(a => selectedIds.includes(a._id));
    const uniqueJobIds = [...new Set(selectedApps.map(a => a.job?._id))];

    return (
      <div className="space-y-4">
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-primary-50 rounded-xl border border-primary-100">
            <div className="text-sm font-bold text-primary-900">{selectedIds.length} applicants selected</div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                className="flex-1 sm:flex-none btn btn-primary text-xs py-2"
                onClick={() => setShowBulkModal(true)}
                disabled={selectedIds.length === 0 || uniqueJobIds.length > 1}
                title={uniqueJobIds.length > 1 ? 'Select applications from a single job to perform bulk actions' : 'Bulk change status'}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Change Status
              </button>
              <button
                className="flex-1 sm:flex-none btn btn-outline bg-white text-xs py-2"
                onClick={() => { setShowBulkModal(true); setNewStatus('advance'); }}
                disabled={selectedIds.length === 0 || uniqueJobIds.length > 1}
                title={uniqueJobIds.length > 1 ? 'Select applications from a single job to perform bulk actions' : 'Advance round for selected'}
              >
                Advance Round
              </button>
              <button className="flex-1 sm:flex-none btn btn-secondary text-xs py-2" onClick={() => setSelectedIds([])}>Clear</button>
            </div>
          </div>
        )}

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === apps.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(apps.map(a => a._id));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Job</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Applied On</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Current Round</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map((app) => (
                <tr key={app._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(app._id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(prev => [...new Set([...prev, app._id])]);
                        else setSelectedIds(prev => prev.filter(id => id !== app._id));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{app.student?.name}</p>
                      <p className="text-sm text-gray-500">{app.student?.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{app.job?.title}</p>
                      <p className="text-sm text-gray-500">{app.job?.company?.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{app.currentRound !== undefined ? `Round ${app.currentRound + 1}` : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedApplication(app); setShowDetailModal(true); }}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {app.student?.profile?.resume && (
                        <a
                          href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${app.student.profile.resume}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Download Resume"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderApplicationsCards(apps)}
      </div>
    );
  };

  const applicationsContent = loading ? (
    <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
  ) : filteredApplications.length === 0 ? (
    <EmptyState icon={Users} title="No applications found" description="No applications match your current filters" />
  ) : groupByCompany ? (
    <div className="space-y-4">
      {Object.entries(appsGroupedByCompany).map(([company, apps]) => (
        <div key={company} className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{company}</h3>
              <p className="text-sm text-gray-500">{apps.length} applications</p>
            </div>
          </div>
          {renderApplicationsTable(apps)}
        </div>
      ))}
    </div>
  ) : (
    renderApplicationsTable(filteredApplications)
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'under_review': return <Eye className="w-4 h-4" />;
      case 'shortlisted': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'selected': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-600">Manage and review student applications</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          <span>{pagination.total} total applications</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-none shadow-sm bg-gray-50/50">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-600 transition-colors" />
            <input
              type="text"
              placeholder="Search student, email, or job..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-full bg-white border-gray-200 focus:border-primary-500 transition-all rounded-xl"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full bg-white border-gray-200 focus:border-primary-500 rounded-xl"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={filters.job}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="w-full bg-white border-gray-200 focus:border-primary-500 rounded-xl"
            >
              <option value="">All Job Postings</option>
              {jobs.map(job => (
                <option key={job._id} value={job._id}>
                  {job.title} ({job.company?.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-4 px-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${filters.myLeads ? 'bg-primary-600' : 'bg-gray-300'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={filters.myLeads}
                onChange={(e) => setFilters({ ...filters, myLeads: e.target.checked })}
              />
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${filters.myLeads ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">My Leads Only</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${groupByCompany ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={groupByCompany}
                onChange={(e) => setGroupByCompany(e.target.checked)}
              />
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${groupByCompany ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">Group by Company</span>
          </label>

          {/* New Active Filters Count */}
          {(filters.status !== '' || filters.job !== '' || filters.myLeads) && (
            <button
              onClick={() => {
                setFilters({ search: '', status: '', job: '', myLeads: false });
                setGroupByCompany(false);
              }}
              className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider ml-auto"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>
      {/* Filter pill for active job filter */}
      {filters.job && selectedJobTitle && (
        <div className="mt-3 flex items-center gap-2">
          <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-sm flex items-center gap-3">
            <span className="text-sm text-blue-700">Filtered by: <strong className="ml-1">{selectedJobTitle}</strong></span>
            <button className="px-2 py-1 text-xs text-blue-600 bg-blue-100 rounded" onClick={clearJobFilter} aria-label="Clear job filter">Clear</button>
          </div>
        </div>
      )}
      {applicationsContent}

      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setPagination({ ...pagination, page })}
        />
      )}

      {/* Application Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Application Details"
        size="lg"
      >
        {selectedApplication && (
          <div className="space-y-6">
            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
              {selectedApplication.student?.profile?.resume && (
                <a
                  href={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${selectedApplication.student.profile.resume}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-primary-600 border border-primary-100 rounded-lg hover:bg-primary-50 transition shadow-sm text-xs font-bold uppercase tracking-tight"
                >
                  <Download className="w-4 h-4" />
                  Resume
                </a>
              )}
              {selectedApplication.student?.profile?.portfolioLinks?.filter(l => l.url).map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition shadow-sm text-xs font-bold uppercase tracking-tight"
                >
                  <ExternalLink className="w-4 h-4" />
                  {link.platform || 'Portfolio'}
                </a>
              ))}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedApplication.student?.email);
                  toast.success('Email copied!');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-gray-600 border border-gray-100 rounded-lg hover:bg-gray-50 transition shadow-sm text-xs font-bold uppercase tracking-tight"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>

            {/* Student Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Student Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-medium">{selectedApplication.student?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{selectedApplication.student?.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">School</p>
                  <p className="font-medium">{selectedApplication.student?.profile?.currentSchool || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Module</p>
                  <p className="font-medium">{selectedApplication.student?.profile?.currentModule || '-'}</p>
                </div>
              </div>
            </div>

            {/* Job Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Job Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Position</p>
                  <p className="font-medium">{selectedApplication.job?.title}</p>
                </div>
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium">{selectedApplication.job?.company?.name}</p>
                </div>
              </div>
            </div>

            {/* Application Status */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Current Status</h3>
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedApplication.status)}
                <StatusBadge status={selectedApplication.status} />
                <span className="text-sm text-gray-500">
                  Applied on {new Date(selectedApplication.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Cover Letter */}
            {selectedApplication.coverLetter && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Cover Letter</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                  {selectedApplication.coverLetter}
                </p>
              </div>
            )}

            {/* POC Recommendation */}
            {selectedApplication.pocRecommendation?.recommended && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">POC Recommendation</h3>
                <p className="text-sm text-green-700">{selectedApplication.pocRecommendation.comments}</p>
              </div>
            )}

            {/* Previous Feedback */}
            {(selectedApplication.feedback || selectedApplication.coordinatorFeedback) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Previous Feedback</h3>
                <p className="text-sm text-blue-700">{selectedApplication.feedback || selectedApplication.coordinatorFeedback}</p>
              </div>
            )}

            {/* Interview Rounds Progress */}
            {selectedApplication.interviewRounds?.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Interview Progress</h3>
                <div className="space-y-2">
                  {selectedApplication.interviewRounds.map((round, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg ${round.status === 'passed' ? 'bg-green-50' :
                        round.status === 'failed' ? 'bg-red-50' :
                          round.status === 'scheduled' ? 'bg-yellow-50' : 'bg-gray-50'
                        }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${round.status === 'passed' ? 'bg-green-500 text-white' :
                        round.status === 'failed' ? 'bg-red-500 text-white' :
                          round.status === 'scheduled' ? 'bg-yellow-500 text-white' : 'bg-gray-300 text-gray-600'
                        }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{round.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{round.type?.replace('_', ' ')}</p>
                      </div>
                      <span className="text-xs capitalize">{round.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!['selected', 'rejected', 'withdrawn'].includes(selectedApplication.status) && (
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                {selectedApplication.status === 'pending' && (
                  <button
                    onClick={() => handleStatusUpdate('under_review')}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Mark Under Review
                  </button>
                )}
                {['pending', 'under_review'].includes(selectedApplication.status) && (
                  <>
                    <button
                      onClick={() => openFeedbackModal('shortlisted')}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Shortlist
                    </button>
                    <button
                      onClick={() => openFeedbackModal('rejected')}
                      className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
                {selectedApplication.status === 'shortlisted' && (
                  <button
                    onClick={() => handleStatusUpdate('interviewing')}
                    className="btn btn-primary"
                  >
                    Move to Interview
                  </button>
                )}
                {selectedApplication.status === 'interviewing' && (
                  <>
                    <button
                      onClick={() => openFeedbackModal('selected')}
                      className="btn bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Select
                    </button>
                    <button
                      onClick={() => openFeedbackModal('rejected')}
                      className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Feedback Modal */}
      <Modal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          setFeedback('');
        }}
        title={`${newStatus === 'rejected' ? 'Rejection' : 'Status Update'} Feedback`}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Add feedback for the student regarding this decision (optional but recommended).
          </p>
          <textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter feedback for the student..."
            className="w-full"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowFeedbackModal(false);
                setFeedback('');
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => handleStatusUpdate(newStatus, true)}
              className={`btn ${newStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'btn-primary'} text-white`}
            >
              Confirm {newStatus === 'rejected' ? 'Rejection' : newStatus}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Action Modal - Prioritized Triage Logic */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setFeedback('');
          setBulkStatus('');
          setSelectedRoundIndex(0);
        }}
        title={`Bulk Multi-Stage Triage`}
        size="md"
      >
        <div className="space-y-5">
          <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 flex items-start gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary-600 shadow-sm shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary-900 leading-tight">Batch Movement for {selectedIds.length} Applicants</p>
              <p className="text-xs text-primary-700 mt-1">This will update status and rounds for all selected candidates from <strong>{selectedIds.length > 0 && applications.find(a => a._id === selectedIds[0])?.job?.title}</strong>.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target Pipeline Stage</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full text-sm font-medium border-2 border-gray-100 focus:border-primary-500 rounded-xl"
              >
                <option value="">-- Choose New Stage --</option>
                {pipelineStages.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
            </div>

            {/* Sub-selection for interview rounds if the selected stage is interviewing */}
            {(() => {
              const selectedApp = applications.find(a => a._id === selectedIds[0]);
              const jobObj = jobs.find(j => String(j._id) === String(selectedApp?.job?._id));
              const isInterviewing = bulkStatus === 'interviewing' || (pipelineStages.find(s => s.id === bulkStatus)?.label?.toLowerCase().includes('interview'));

              if (isInterviewing && jobObj?.interviewRounds?.length > 0) {
                return (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target Interview Round</label>
                    <select
                      value={selectedRoundIndex}
                      onChange={(e) => setSelectedRoundIndex(parseInt(e.target.value))}
                      className="w-full text-sm font-bold border-2 border-primary-200 focus:border-primary-500 rounded-xl bg-primary-50/30"
                    >
                      {jobObj.interviewRounds.map((round, idx) => (
                        <option key={idx} value={idx}>Round {idx + 1}: {round.name}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Internal Notes / Student Feedback</label>
              <textarea
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full text-sm border-2 border-gray-100 focus:border-primary-500 rounded-xl p-3"
                placeholder="A personalized note that will be sent to ALL selected students..."
              />
              <p className={`text-[10px] mt-1 font-medium ${bulkStatus === 'rejected' ? 'text-red-500' : 'text-gray-400'}`}>
                {bulkStatus === 'rejected' ? '* Feedback is mandatory for rejections in triage.' : 'Note: This feedback will be visible in the candidate dashboard.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowBulkModal(false)}
              className="flex-1 btn btn-secondary text-gray-600 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => handleBulkUpdate('set_status')}
              disabled={!bulkStatus || (bulkStatus === 'rejected' && !feedback.trim())}
              className="flex-[2] btn btn-primary font-bold rounded-xl shadow-lg shadow-primary-200 disabled:opacity-50"
            >
              Confirm Bulk Decision
            </button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

export default Applications;
