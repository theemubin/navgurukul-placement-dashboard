import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { applicationAPI, jobAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, Modal } from '../../components/common/UIComponents';
import { Search, Filter, Eye, CheckCircle, XCircle, Clock, MessageSquare, Download, Users } from 'lucide-react';
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

  useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, [filters.status, filters.job, pagination.page]);

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

    const jobObj = jobs.find(j => j._id === jobId);
    if (!canManageJob(jobObj)) {
      toast.error("Only the job's assigned coordinator or a manager may perform bulk actions for this job");
      return;
    }

    try {
      if (action === 'set_status') {
        await jobAPI.bulkUpdate(jobId, { applicationIds: selectedIds, action: 'set_status', status: bulkStatus, generalFeedback: feedback });
      } else if (action === 'advance_round') {
        await jobAPI.bulkUpdate(jobId, { applicationIds: selectedIds, action: 'advance_round', advanceBy: 1, generalFeedback: feedback });
      }

      toast.success('Bulk update completed');
      setSelectedIds([]);
      setShowBulkModal(false);
      setFeedback('');
      setBulkStatus('');
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

  const renderApplicationsTable = (apps) => {
    const selectedApps = applications.filter(a => selectedIds.includes(a._id));
    const uniqueJobIds = [...new Set(selectedApps.map(a => a.job?._id))];

    return (
      <div>
        {selectedIds.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-700">{selectedIds.length} selected</div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline"
                onClick={() => setShowBulkModal(true)}
                disabled={selectedIds.length === 0 || uniqueJobIds.length > 1}
                title={uniqueJobIds.length > 1 ? 'Select applications from a single job to perform bulk actions' : 'Bulk change status'}
              >
                Bulk Change Status
              </button>
              <button
                className="btn btn-outline"
                onClick={() => { setShowBulkModal(true); setNewStatus('advance'); }}
                disabled={selectedIds.length === 0 || uniqueJobIds.length > 1}
                title={uniqueJobIds.length > 1 ? 'Select applications from a single job to perform bulk actions' : 'Advance round for selected'}
              >
                Advance Round
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedIds([])}>Clear Selection</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
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
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name, email, or job..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-full"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="md:w-48"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filters.job}
            onChange={(e) => handleJobSelect(e.target.value)}
            className="md:w-64"
          >
            <option value="">All Jobs</option>
            {jobs.map(job => (
              <option key={job._id} value={job._id}>
                {job.title} - {job.company?.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm ml-4">
            <input type="checkbox" checked={filters.myLeads} onChange={(e) => setFilters({ ...filters, myLeads: e.target.checked })} />
            My Leads
          </label>
          <label className="flex items-center gap-2 text-sm ml-4">
            <input type="checkbox" checked={groupByCompany} onChange={(e) => setGroupByCompany(e.target.checked)} />
            Group by Company
          </label>
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
      </div>

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
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        round.status === 'passed' ? 'bg-green-50' :
                        round.status === 'failed' ? 'bg-red-50' :
                        round.status === 'scheduled' ? 'bg-yellow-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        round.status === 'passed' ? 'bg-green-500 text-white' :
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

      {/* Bulk Action Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setFeedback('');
          setBulkStatus('');
        }}
        title={`Bulk Action`}
      >
        <div className="space-y-4">
          <p className="text-gray-600">Change status or advance rounds for selected applications. This will send the same message to all selected students.</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="w-full">
              <option value="">Select action</option>
              <option value="shortlisted">Shortlist</option>
              <option value="in_progress">Mark In Progress</option>
              <option value="selected">Select (Placed)</option>
              <option value="rejected">Reject</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">General Comment (visible to students)</label>
            <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} className="w-full" placeholder="A short note that will be sent to all selected students" />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowBulkModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={() => handleBulkUpdate('set_status')} className="btn btn-primary">Confirm</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Applications;
