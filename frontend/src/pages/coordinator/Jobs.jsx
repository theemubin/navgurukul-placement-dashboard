import { useState, useEffect } from 'react';
import { jobReadinessAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { jobAPI, settingsAPI, applicationAPI, userAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, ConfirmModal } from '../../components/common/UIComponents';
import { Briefcase, Plus, Search, Edit, Trash2, MapPin, Calendar, Users, GraduationCap, Clock, LayoutGrid, List, Download, Settings, X, CheckCircle, XCircle, Pause, ChevronDown, ChevronUp, AlertCircle, Share2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import JobsKanban from './JobsKanban';
import ApplicantTriageModal from './ApplicantTriageModal';

const CoordinatorJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', jobType: '', sortBy: 'newest' });
  const [deleteModal, setDeleteModal] = useState({ show: false, jobId: null });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('jobsViewMode') || 'list';
  });
  const [pipelineStages, setPipelineStages] = useState([]);
  const [jobReadinessSummaries, setJobReadinessSummaries] = useState({});
  const [exportModal, setExportModal] = useState({ show: false, jobId: null, jobTitle: '' });
  const [exportData, setExportData] = useState({ fields: [], allSelected: true });
  const [availableFields, setAvailableFields] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportLayout, setExportLayout] = useState('resume'); // 'resume' or 'table'
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(['Student Info', 'Campus Info']);

  // Applicant modal state
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [modalJob, setModalJob] = useState(null);
  const [modalApplicants, setModalApplicants] = useState([]);

  const navigate = useNavigate();
  const { user } = useAuth();

  const canManageJob = (job) => {
    if (!user) return false;
    if (user.role === 'manager') return true;
    // guard against missing user._id or missing job fields
    const uid = user && (user._id || user.id || null);
    if (!uid) return false;
    try {
      if (job?.coordinator && job.coordinator.toString() === uid.toString()) return true;
      if (job?.createdBy && job.createdBy.toString() === uid.toString()) return true;
    } catch (e) {
      // defensive: any unexpected shape, deny permission
      return false;
    }
    return false;
  };

  const fetchApplicantsForJob = async (jobId) => {
    try {
      const res = await applicationAPI.getApplications({ job: jobId, limit: 1000 });
      setModalApplicants(res.data.applications || []);
    } catch (err) {
      console.error('Error fetching applicants', err);
      toast.error('Error fetching applicants for job');
    }
  };

  const openManageApplicants = async (job) => {
    if (!canManageJob(job)) {
      toast.error("Only the job's assigned coordinator or a manager may manage applicants for this job");
      return;
    }
    setModalJob(job);
    setModalNewStatus(null);
    await fetchApplicantsForJob(job._id);
    // initialize per-app overrides
    setModalApplicants(prev => (prev || []).map(a => ({ ...a, _target: a._target || undefined, _comment: a._comment || '' })));
    // reset section UI
    setSectionComments({ selected: '', notMoving: '', noAction: '' });
    setCollapsedSections({ selected: false, notMoving: false, noAction: false });
    setSectionStatus({ selected: 'selected', notMoving: 'rejected', noAction: 'no_change' });
    setShowApplicantModal(true);
  };

  // -- Modal helpers and state for managing applicants
  const [sectionComments, setSectionComments] = useState({ selected: '', notMoving: '', noAction: '' });
  const [collapsedSections, setCollapsedSections] = useState({ selected: false, notMoving: false, noAction: false });
  const [sectionStatus, setSectionStatus] = useState({ selected: 'selected', notMoving: 'rejected', noAction: 'no_change' });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [applyingModalChanges, setApplyingModalChanges] = useState(false);

  const toggleSectionCollapse = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const selectAllInSection = (sectionKey) => {
    setModalApplicants(prev => prev.map(a => ({ ...a, _target: sectionKey })));
  };

  const copySectionComment = (sectionKey) => {
    const comment = sectionComments[sectionKey] || '';
    setModalApplicants(prev => prev.map(a => {
      const inSection = a._target === sectionKey || (sectionKey === 'selected' && a.status === 'selected') || (sectionKey === 'notMoving' && ['rejected', 'withdrawn'].includes(a.status)) || (sectionKey === 'noAction' && !['selected', 'rejected', 'withdrawn'].includes(a.status));
      if (inSection) return { ...a, _comment: comment };
      return a;
    }));
  };

  const copyRowCommentToCategory = (sectionKey, comment) => {
    if (!comment) return;
    setSectionComments(prev => ({ ...prev, [sectionKey]: prev[sectionKey] ? `${prev[sectionKey]}\n${comment}` : comment }));
  };

  const updateApplicantComment = (appId, value) => {
    setModalApplicants(prev => prev.map(a => a._id === appId ? { ...a, _comment: value } : a));
  };

  const handleModalSetTarget = (appId, target) => {
    setModalApplicants(prev => prev.map(a => a._id === appId ? { ...a, _target: target } : a));
  };

  const openPreview = () => {
    if (!modalJob) return;
    const groups = { selected: [], notMoving: [], feedbackOnly: [] };
    const perAppFeedbacks = {};

    modalApplicants.forEach(a => {
      const target = a._target || 'noAction';
      if (target === 'selected') groups.selected.push(a);
      else if (target === 'notMoving') groups.notMoving.push(a);
      else groups.feedbackOnly.push(a);

      if (a._comment) perAppFeedbacks[a._id] = a._comment;
    });

    setPreviewData({
      counts: { selected: groups.selected.length, notMoving: groups.notMoving.length, feedbackOnly: groups.feedbackOnly.length },
      sectionComments,
      perAppFeedbacks,
      sampleStudents: {
        selected: groups.selected.slice(0, 3),
        notMoving: groups.notMoving.slice(0, 3),
        feedbackOnly: groups.feedbackOnly.slice(0, 3)
      }
    });

    setShowPreviewModal(true);
  };

  const handleModalApplyConfirmed = async () => {
    if (!modalJob) return;
    setApplyingModalChanges(true);

    try {
      const perAppFeedbackMap = {};
      const groupsByStatus = {};

      modalApplicants.forEach(a => {
        const target = a._target || 'noAction';
        let statusValue = undefined;
        if (target === 'selected') statusValue = sectionStatus.selected === 'no_change' ? undefined : sectionStatus.selected;
        else if (target === 'notMoving') statusValue = sectionStatus.notMoving === 'no_change' ? undefined : sectionStatus.notMoving;
        // noAction stays undefined (feedback only)

        const groupKey = statusValue || 'feedback_only';
        groupsByStatus[groupKey] = groupsByStatus[groupKey] || [];
        groupsByStatus[groupKey].push(a._id);

        if (a._comment) perAppFeedbackMap[a._id] = a._comment;
      });

      // Execute grouped updates
      for (const [groupKey, ids] of Object.entries(groupsByStatus)) {
        if (ids.length === 0) continue;

        const subset = ids.reduce((acc, id) => { if (perAppFeedbackMap[id]) acc[id] = perAppFeedbackMap[id]; return acc; }, {});

        if (groupKey === 'feedback_only') {
          // feedback-only group: send general feedback from noAction section
          if (ids.length > 0 && (sectionComments.noAction || Object.keys(subset).length > 0)) {
            const payload = { applicationIds: ids, action: 'set_status', generalFeedback: sectionComments.noAction };
            if (Object.keys(subset).length > 0) payload.perApplicationFeedbacks = subset;
            await jobAPI.bulkUpdate(modalJob._id, payload);
          }
        } else {
          const defaultFeedback = (groupKey === sectionStatus.selected ? sectionComments.selected : (groupKey === sectionStatus.notMoving ? sectionComments.notMoving : ''));
          const payload = { applicationIds: ids, action: 'set_status', status: groupKey, generalFeedback: defaultFeedback };
          if (Object.keys(subset).length > 0) payload.perApplicationFeedbacks = subset;
          await jobAPI.bulkUpdate(modalJob._id, payload);
        }
      }

      // After bulk updates, check if the job became 'filled' due to placements
      const latestJobRes = await jobAPI.getJob(modalJob._id);
      const latestJob = latestJobRes.data.job;

      // If backend didn't already mark job filled and caller intended a new status, apply it
      if (modalNewStatus && latestJob.status !== 'filled') {
        await jobAPI.updateJob(modalJob._id, { status: modalNewStatus });
        toast.success('Job status updated');
      }

      toast.success('Applicants updated');
      setShowPreviewModal(false);
      setShowApplicantModal(false);
      setModalApplicants([]);
      setModalNewStatus(null);
      await fetchJobs();
    } catch (error) {
      console.error('Modal apply error', error);
      const msg = error?.response?.data?.message || error?.message || 'Failed to apply changes';
      toast.error(msg);
    } finally {
      setApplyingModalChanges(false);
    }
  };

  const handleTriageConfirm = async (triageApplicants, metadata = {}) => {
    if (!modalJob) return;
    setApplyingModalChanges(true);

    try {
      // 0. Update Job Metadata (Discord Thread ID) if provided
      if (metadata.discordThreadId && metadata.discordThreadId !== modalJob.discordThreadId) {
        await jobAPI.updateJob(modalJob._id, { discordThreadId: metadata.discordThreadId });
      }

      // Group by action/status
      const grouped = {
        promote: triageApplicants.filter(a => a.bucket === 'promote'),
        exit: triageApplicants.filter(a => a.bucket === 'exit'),
        hold: triageApplicants.filter(a => a.bucket === 'hold' && a.comment.trim()) // Only process hold if there's feedback
      };

      // 1. Handle Promoted (Advance to target status or update current round)
      if (grouped.promote.length > 0) {
        const payload = {
          applicationIds: grouped.promote.map(a => a._id),
          action: 'set_status',
          status: modalNewStatus || modalJob.status, // Use job's current status if not advancing
          perApplicationFeedbacks: grouped.promote.reduce((acc, a) => {
            if (a.comment) acc[a._id] = a.comment;
            return acc;
          }, {})
        };

        // If promoting to interviewing stage, include round info
        if ((payload.status === 'interviewing' || payload.status?.includes('interview')) && metadata.roundIndex !== undefined) {
          payload.targetRound = metadata.roundIndex;
          payload.roundName = metadata.roundName;
        }

        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // 2. Handle Exited (Reject)
      if (grouped.exit.length > 0) {
        const payload = {
          applicationIds: grouped.exit.map(a => a._id),
          action: 'set_status',
          status: 'rejected',
          perApplicationFeedbacks: grouped.exit.reduce((acc, a) => {
            acc[a._id] = a.comment; // Mandatory in triage
            return acc;
          }, {})
        };
        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // 3. Handle Hold (Feedback only)
      if (grouped.hold.length > 0) {
        const payload = {
          applicationIds: grouped.hold.map(a => a._id),
          action: 'set_status', // Use set_status without 'status' to just add feedback
          perApplicationFeedbacks: grouped.hold.reduce((acc, a) => {
            acc[a._id] = a.comment;
            return acc;
          }, {})
        };
        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // After bulk updates, check if the job became 'filled'
      const latestJobRes = await jobAPI.getJob(modalJob._id);
      const latestJob = latestJobRes.data;

      // If job is advancing and not already filled, update it
      if (modalNewStatus && latestJob.status !== 'filled') {
        await jobAPI.updateJob(modalJob._id, { status: modalNewStatus });
        toast.success('Job status updated');
      }

      toast.success('Batch processing completed successfully!');
      setShowApplicantModal(false);
      setModalApplicants([]);
      setModalNewStatus(null);
      await fetchJobs();
    } catch (error) {
      console.error('Triage apply error', error);
      toast.error(error?.response?.data?.message || 'Failed to apply changes');
    } finally {
      setApplyingModalChanges(false);
    }
  };

  useEffect(() => {
    fetchPipelineStages();
    fetchJobReadinessSummaries();
    fetchExportFields();
  }, []);

  // Fetch export fields
  const fetchExportFields = async () => {
    try {
      const response = await applicationAPI.getExportFields();
      setAvailableFields(response.data);
      // Default to all fields selected
      setExportData({
        fields: response.data.map(f => f.key),
        allSelected: true
      });
    } catch (error) {
      console.error('Error fetching export fields:', error);
    }
  };
  // Fetch job readiness summary for all jobs (School of Programming or if criteria exist)
  const fetchJobReadinessSummaries = async () => {
    try {
      // For demo, fetch config for School of Programming (or all jobs if needed)
      const res = await jobReadinessAPI.getConfig();
      if (Array.isArray(res.data)) {
        const summaries = {};
        res.data.forEach(cfg => {
          if (cfg.school === 'School of Programming' && cfg.criteria && cfg.criteria.length > 0) {
            summaries[cfg.school] = cfg.criteria.length;
          }
        });
        setJobReadinessSummaries(summaries);
      }
    } catch (err) {
      setJobReadinessSummaries({});
    }
  };

  useEffect(() => {
    if (viewMode === 'list') {
      fetchJobs();
    }
  }, [pagination.current, filters, viewMode]);

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('jobsViewMode', viewMode);
  }, [viewMode]);

  const fetchPipelineStages = async () => {
    try {
      const response = await settingsAPI.getPipelineStages();
      setPipelineStages(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pipeline stages:', error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: pagination.current,
        limit: 10,
        search: filters.search || undefined,
        status: filters.status || undefined,
        jobType: filters.jobType || undefined,
        sortBy: filters.sortBy || undefined
      });
      setJobs(response.data.jobs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.jobId) return;

    try {
      await jobAPI.deleteJob(deleteModal.jobId);
      toast.success('Job deleted successfully');
      setDeleteModal({ show: false, jobId: null });
      fetchJobs();
    } catch (error) {
      toast.error('Error deleting job');
    }
  };

  const [modalNewStatus, setModalNewStatus] = useState(null);

  const handleCopyLink = (jobId) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/student/jobs/${jobId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Shareable student link copied to clipboard!');
  };

  const handleBroadcast = async (jobId) => {
    try {
      await jobAPI.broadcastJob(jobId);
      toast.success('Job broadcasted to Discord!');
    } catch (err) {
      toast.error('Failed to broadcast job');
      console.error(err);
    }
  };

  const handleStatusChange = async (jobId, newStatus) => {
    // statuses that should trigger applicant review modal
    const reviewStatuses = ['hr_shortlisting', 'interviewing', 'application_stage'];

    if (reviewStatuses.includes(newStatus)) {
      // Open modal and set up for review flow instead of directly updating the job
      const job = jobs.find(j => j._id === jobId);
      if (!canManageJob(job)) {
        toast.error("Only the job's assigned coordinator or a manager may manage applicants for this job");
        return;
      }
      setModalJob(job);
      setModalNewStatus(newStatus);
      await fetchApplicantsForJob(jobId);
      // Only show applicants who are still 'in process' (not rejected/withdrawn/placed)
      setModalApplicants(prev => (prev || []).filter(a => !['rejected', 'withdrawn', 'selected', 'placed'].includes(a.status)).map(a => ({ ...a, _target: a._target || undefined, _comment: a._comment || '' })));
      setSectionComments({ selected: '', notMoving: '', noAction: '' });
      setCollapsedSections({ selected: false, notMoving: false, noAction: false });
      setSectionStatus({ selected: 'selected', notMoving: 'rejected', noAction: 'no_change' });
      setShowApplicantModal(true);
      return;
    }

    try {
      await jobAPI.updateJob(jobId, { status: newStatus });
      toast.success('Job status updated');
      fetchJobs();
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const openExportModal = (jobId, jobTitle) => {
    setExportModal({ show: true, jobId, jobTitle });
    setExportFormat('pdf');
    setExportLayout('resume');
    setSelectedPresetId(null);
    fetchPresets();
  };

  // Preset helpers
  const fetchPresets = async () => {
    try {
      const res = await userAPI.getExportPresets();
      setPresets(res.data.presets || []);
    } catch (err) {
      console.error('Error fetching presets:', err);
    }
  };

  const applyPreset = (preset) => {
    setExportData({ fields: preset.fields, allSelected: false });
    setExportFormat(preset.format || 'pdf');
    setExportLayout(preset.layout || 'resume');
    setSelectedPresetId(preset._id);
  };

  const savePreset = async () => {
    if (!presetName) {
      const name = window.prompt('Preset name (short)');
      if (!name) return;
      setPresetName(name);
    }

    try {
      const payload = { name: presetName || window.prompt('Preset name') || 'My Preset', fields: exportData.fields, format: exportFormat, layout: exportLayout };
      const res = await userAPI.createExportPreset(payload);
      setPresets(res.data.presets || []);
      setPresetName('');
      toast.success('Preset saved');
    } catch (err) {
      console.error('Error saving preset:', err);
      toast.error(err?.response?.data?.message || 'Error saving preset');
    }
  };

  const deletePreset = async (presetId) => {
    if (!window.confirm('Delete this preset?')) return;
    try {
      const res = await userAPI.deleteExportPreset(presetId);
      setPresets(res.data.presets || []);
      if (selectedPresetId === presetId) setSelectedPresetId(null);
      toast.success('Preset deleted');
    } catch (err) {
      console.error('Error deleting preset:', err);
      toast.error('Error deleting preset');
    }
  };


  const closeExportModal = () => {
    setExportModal({ show: false, jobId: null, jobTitle: '' });
  };

  const handleFieldToggle = (fieldKey) => {
    setExportData(prev => {
      const newFields = prev.fields.includes(fieldKey)
        ? prev.fields.filter(f => f !== fieldKey)
        : [...prev.fields, fieldKey];

      return {
        fields: newFields,
        allSelected: newFields.length === availableFields.length
      };
    });
  };

  const handleSelectAll = () => {
    if (exportData.allSelected) {
      setExportData({ fields: [], allSelected: false });
    } else {
      setExportData({
        fields: availableFields.map(f => f.key),
        allSelected: true
      });
    }
  };

  const handleExport = async () => {
    if (exportData.fields.length === 0) {
      toast.error('Please select at least one field to export');
      return;
    }

    setExporting(true);
    try {
      const response = await jobAPI.exportJobApplications(exportModal.jobId, {
        fields: exportData.fields,
        format: exportFormat,
        layout: exportLayout
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const fileExtension = exportFormat === 'pdf' ? 'pdf' : 'csv';
      const fileName = `${exportModal.jobTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_applications.${fileExtension}`;

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Export completed successfully as ${exportFormat.toUpperCase()}!`);
      closeExportModal();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error exporting data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
          <p className="text-gray-600">Create and manage job postings</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'kanban'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
          </div>
          <Link to="/coordinator/jobs/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Job
          </Link>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <JobsKanban onExportJob={openExportModal} />
      ) : (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
              <select
                value={filters.jobType}
                onChange={(e) => setFilters({ ...filters, jobType: e.target.value })}
                className="w-full md:w-40"
              >
                <option value="">All Types</option>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full md:w-48"
              >
                <option value="">All Status</option>
                {pipelineStages.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full md:w-48"
              >
                <option value="newest">Newest First</option>
                <option value="deadline_asc">Deadline (Soonest)</option>
                <option value="deadline_desc">Deadline (Latest)</option>
                <option value="placements">Most Placements</option>
              </select>
            </div>
          </div>

          {/* Jobs List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : jobs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4">
                {jobs.map((job) => (
                  <div key={job._id} className="job-card group">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-4">
                          <div className="job-card-icon">
                            {job.company?.logo ? (
                              <img src={job.company.logo} alt={job.company.name} className="w-8 h-8 object-contain" />
                            ) : (
                              <Briefcase className={`w-6 h-6 ${job.jobType === 'internship' ? 'text-purple-500' : 'text-primary-500'}`} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-lg font-bold text-gray-900 truncate hover:text-primary-600 transition-colors">
                                {job.title}
                              </h3>
                              <div className="flex gap-1.5">
                                {job.jobType === 'internship' && (
                                  <span className="badge bg-purple-50 text-purple-600 border border-purple-100">Internship</span>
                                )}
                                {job.eligibility?.openForAll && (
                                  <span className="badge bg-green-50 text-green-600 border border-green-100">Open for All</span>
                                )}
                              </div>
                            </div>

                            <p className="text-gray-500 font-medium flex items-center gap-1 mb-3">
                              {job.company?.name}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {job.location || 'Remote'}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-gray-400" />
                                {job.maxPositions} positions
                              </div>
                              <div className={`flex items-center gap-1.5 font-medium ${new Date(job.applicationDeadline) < new Date() ? 'text-red-500' : 'text-primary-600'
                                }`}>
                                <Calendar className="w-4 h-4" />
                                {format(new Date(job.applicationDeadline), 'MMM dd, yyyy')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 lg:border-l lg:pl-6 border-gray-100">
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <Link
                            to={`/coordinator/applications?job=${job._id}`}
                            className="flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-primary-50 hover:text-primary-700 rounded-xl transition-all group/link"
                          >
                            <span className="text-sm font-semibold">View Applicants</span>
                            <span className="bg-white border rounded-full px-2 py-0.5 text-xs shadow-sm group-hover/link:border-primary-200">
                              {job.totalApplications || 0}
                            </span>
                          </Link>
                          <button
                            onClick={() => openManageApplicants(job)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm"
                          >
                            Manage Triage
                          </button>
                        </div>

                        <div className="flex flex-col gap-2">
                          <select
                            value={job.status}
                            onChange={(e) => handleStatusChange(job._id, e.target.value)}
                            className="text-xs font-bold border-2 border-gray-100 rounded-xl px-3 py-2 focus:border-primary-500 transition-colors uppercase bg-white cursor-pointer"
                          >
                            {pipelineStages.map(stage => (
                              <option key={stage.id} value={stage.id}>{stage.label}</option>
                            ))}
                          </select>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleCopyLink(job._id)}
                              className="job-action-btn bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              title="Copy Shareable Link"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBroadcast(job._id)}
                              className="job-action-btn bg-purple-50 text-purple-600 hover:bg-purple-100"
                              title="Broadcast to Discord"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openExportModal(job._id, job.title)}
                              className="job-action-btn bg-green-50 text-green-600 hover:bg-green-100"
                              title="Export Data"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/coordinator/jobs/${job._id}/edit`}
                              className="job-action-btn bg-blue-50 text-blue-600 hover:bg-blue-100"
                              title="Edit Job"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => setDeleteModal({ show: true, jobId: job._id })}
                              className="job-action-btn bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete Job"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-50 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="job-stat-pill">
                          <span className="text-gray-400">Placements:</span>
                          <span className="text-green-600 font-bold">{job.placementsCount || 0}</span>
                        </div>
                        <div className="job-stat-pill">
                          <span className="text-gray-400">Applications:</span>
                          <span className="text-primary-600 font-bold">{job.totalApplications || 0}</span>
                        </div>
                        {job.school === 'School of Programming' && (
                          <div className="relative group cursor-help">
                            <div className="job-stat-pill bg-yellow-50 text-yellow-700 border-yellow-100">
                              <GraduationCap className="w-3.5 h-3.5" />
                              Readiness Required
                            </div>
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-[10px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-2xl">
                              Job Readiness required for this job. Only students who have completed at least 1 criterion will be considered "In Progress".
                            </div>
                          </div>
                        )}
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                current={pagination.current}
                total={pagination.pages}
                onPageChange={(page) => setPagination({ ...pagination, current: page })}
              />
            </>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description="Create your first job posting to get started"
              action={
                <Link to="/coordinator/jobs/new" className="btn btn-primary">
                  Create Job
                </Link>
              }
            />
          )}
        </>
      )}

      <ApplicantTriageModal
        isOpen={showApplicantModal}
        onClose={() => { setShowApplicantModal(false); setModalNewStatus(null); }}
        job={modalJob}
        applicants={modalApplicants}
        targetStatus={modalNewStatus}
        pipelineStages={pipelineStages}
        onConfirm={handleTriageConfirm}
        isApplying={applyingModalChanges}
      />

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => setShowPreviewModal(false)} />
          <div className="bg-white rounded-lg max-w-xl w-full p-6 z-10 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Preview Changes</h3>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>Back</button>
                <button className="btn btn-primary" onClick={handleModalApplyConfirmed} disabled={applyingModalChanges}>{applyingModalChanges ? 'Applying...' : 'Confirm & Apply'}</button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Selected</div>
                    <div className="font-medium text-lg">{previewData.counts.selected}</div>
                  </div>
                  <div className="text-sm text-gray-500">Message: <span className="font-medium">{previewData.sectionComments.selected || '(none)'}</span></div>
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Not moving ahead</div>
                    <div className="font-medium text-lg">{previewData.counts.notMoving}</div>
                  </div>
                  <div className="text-sm text-gray-500">Message: <span className="font-medium">{previewData.sectionComments.notMoving || '(none)'}</span></div>
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">No action / Feedback only</div>
                    <div className="font-medium text-lg">{previewData.counts.feedbackOnly}</div>
                  </div>
                  <div className="text-sm text-gray-500">Message: <span className="font-medium">{previewData.sectionComments.noAction || '(none)'}</span></div>
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-gray-600 mb-2">Sample individual comments (first 3 per group)</div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div>
                    <div className="font-medium">Selected:</div>
                    {previewData.sampleStudents.selected.map(s => <div key={s._id}>- {s.student?.firstName} {s.student?.lastName}: "{s._comment || previewData.sectionComments.selected || '-'}"</div>)}
                  </div>
                  <div>
                    <div className="font-medium">Not moving ahead:</div>
                    {previewData.sampleStudents.notMoving.map(s => <div key={s._id}>- {s.student?.firstName} {s.student?.lastName}: "{s._comment || previewData.sectionComments.notMoving || '-'}"</div>)}
                  </div>
                  <div>
                    <div className="font-medium">Feedback only:</div>
                    {previewData.sampleStudents.feedbackOnly.map(s => <div key={s._id}>- {s.student?.firstName} {s.student?.lastName}: "{s._comment || previewData.sectionComments.noAction || '-'}"</div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteModal.show}
        title="Delete Job"
        message="Are you sure you want to delete this job? All associated applications will also be affected."
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ show: false, jobId: null })}
        danger
      />

      {/* Export Modal - Premium Redesign */}
      {exportModal.show && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn text-left">
          <div className="bg-white rounded-[2rem] max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-white/20">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 shadow-inner">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Export Applications</h3>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-500 font-medium">
                        Configure your report for <span className="text-primary-600">{exportModal.jobTitle}</span>
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 font-bold uppercase tracking-wider w-fit">
                        <AlertCircle className="w-3 h-3" />
                        Logic: Name, School & Links are pinned first. Rest follow Selection Order.
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeExportModal}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Left Sidebar - Configuration */}
              <div className="w-full lg:w-80 bg-gray-50/50 border-r border-gray-100 p-6 overflow-y-auto space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-left">Export Format</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                    {['csv', 'pdf'].map(format => (
                      <label key={format} className={`relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border-2 ${exportFormat === format ? 'bg-white border-primary-500 shadow-md ring-4 ring-primary-50' : 'bg-white/50 border-transparent hover:border-gray-200'
                        }`}>
                        <input
                          type="radio"
                          name="exportFormat"
                          value={format}
                          checked={exportFormat === format}
                          onChange={(e) => setExportFormat(e.target.value)}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <div className="text-left">
                          <p className="font-bold text-sm uppercase">{format === 'csv' ? 'Excel / CSV' : 'PDF Report'}</p>
                          <p className="text-[10px] text-gray-500 leading-tight">
                            {format === 'csv' ? 'Best for data analysis' : 'Ready for printing'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* PDF Specific Layout */}
                {exportFormat === 'pdf' && (
                  <div className="animate-fadeIn">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-left">PDF Layout Style</h4>
                    <div className="space-y-3">
                      {[
                        { id: 'resume', label: 'Resume Grid', desc: 'Visual cards, 2 per page' },
                        { id: 'table', label: 'Compact Table', desc: 'Detailed list, dense layout' }
                      ].map(layout => (
                        <label key={layout.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${exportLayout === layout.id ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-100'
                          }`}>
                          <input
                            type="radio"
                            name="exportLayout"
                            value={layout.id}
                            checked={exportLayout === layout.id}
                            onChange={(e) => setExportLayout(e.target.value)}
                            className="hidden"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${exportLayout === layout.id ? 'border-primary-600' : 'border-gray-300'}`}>
                            {exportLayout === layout.id && <div className="w-2 h-2 bg-primary-600 rounded-full" />}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-xs">{layout.label}</p>
                            <p className="text-[9px] opacity-70">{layout.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Presets & Management */}
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-left">Saved Presets</h4>
                  <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                    <select
                      value={selectedPresetId || ''}
                      onChange={(e) => {
                        const p = presets.find(pp => pp._id === e.target.value);
                        if (p) applyPreset(p);
                        setSelectedPresetId(e.target.value || null);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="">-- Quick Load --</option>
                      {presets.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={savePreset} className="flex-1 py-2 text-[10px] font-black bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors uppercase">Save Selection</button>
                      {selectedPresetId && (
                        <button onClick={() => deletePreset(selectedPresetId)} className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Smart Selection Buttons */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 text-left">Smart Select</h4>
                  <button
                    onClick={() => {
                      const esFields = ['studentName', 'email', 'phone', 'campus', 'currentSchool', 'currentModule', 'attendance', 'status', 'appliedDate', 'profileStatus'];
                      setExportData({ fields: esFields.filter(f => availableFields.some(af => af.key === f)), allSelected: false });
                    }}
                    className="w-full text-left px-4 py-2 text-[10px] font-bold bg-white border border-gray-100 text-gray-600 rounded-xl hover:bg-primary-50 hover:text-primary-600 hover:border-primary-100 transition-all flex items-center justify-between"
                  >
                    <span>Essential Data</span>
                    <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded text-[8px]">Recommended</span>
                  </button>
                  <button
                    onClick={() => {
                      const profFields = availableFields.filter(f => ['Student Info', 'Campus Info', 'Navgurukul Education', 'Skills', 'Soft Skills'].includes(f.category)).map(f => f.key);
                      setExportData({ fields: profFields, allSelected: false });
                    }}
                    className="w-full text-left px-4 py-2 text-[10px] font-bold bg-white border border-gray-100 text-gray-600 rounded-xl hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition-all"
                  >
                    Detailed Profiles
                  </button>
                </div>
              </div>

              {/* Main Area - Field Grid */}
              <div className="flex-1 flex flex-col bg-white">
                <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search available fields..."
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-2 text-sm bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-primary-50 focus:bg-white transition-all font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSelectAll} className="text-xs font-bold text-primary-600 hover:text-primary-700 px-3 py-2 bg-primary-50 rounded-xl transition-colors">
                      {exportData.allSelected ? 'Deselect Everything' : 'Select All Fields'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {[
                      'Student Info', 'Campus Info', 'Navgurukul Education', 'Job Info', 'Application', 'Academic Background', 'Personal Info', 'Skills', 'Soft Skills', 'Language Skills', 'Learning & Development', 'Career Preferences', 'Profile Links', 'Profile Status', 'Job Readiness'
                    ].map(category => {
                      const categoryFields = availableFields.filter(f =>
                        f.category === category && (fieldSearch === '' || f.label.toLowerCase().includes(fieldSearch.toLowerCase()))
                      );

                      if (categoryFields.length === 0) return null;

                      const allCatSelected = categoryFields.every(f => exportData.fields.includes(f.key));

                      return (
                        <div key={category} className="bg-gray-50/50 rounded-[2rem] p-6 border border-gray-100/50 transition-all hover:bg-white hover:shadow-xl group/cat flex flex-col h-fit">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest text-left">{category}</h5>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const catKeys = categoryFields.map(f => f.key);
                                  setExportData(prev => ({
                                    ...prev,
                                    fields: allCatSelected ? prev.fields.filter(k => !catKeys.includes(k)) : [...new Set([...prev.fields, ...catKeys])]
                                  }));
                                }}
                                className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-colors ${allCatSelected ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600 opacity-0 group-hover/cat:opacity-100'
                                  }`}
                              >
                                {allCatSelected ? 'Deselect Category' : 'Select Category'}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5 overflow-hidden">
                            {categoryFields.map(field => (
                              <label key={field.key} className={`group flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all border ${exportData.fields.includes(field.key) ? 'bg-white border-primary-100 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-100'
                                }`}>
                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${exportData.fields.includes(field.key) ? 'bg-primary-500 border-primary-500' : 'bg-white border-gray-200 group-hover:border-primary-300'
                                  }`}>
                                  {exportData.fields.includes(field.key) && <CheckCircle className="w-3 h-3 text-white" />}
                                </div>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={exportData.fields.includes(field.key)}
                                  onChange={() => handleFieldToggle(field.key)}
                                />
                                <span className={`text-xs font-semibold text-left truncate ${exportData.fields.includes(field.key) ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                  {field.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Footer */}
            <div className="px-8 py-6 border-t border-gray-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-primary-100 border-2 border-white flex items-center justify-center text-primary-600 font-black text-xs">
                      {exportData.fields.length}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-gray-900 leading-none">Selected Data Points</p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                      Export as {exportFormat.toUpperCase()} • {exportFormat === 'pdf' ? exportLayout.replace('_', ' ') : 'Standard Sheet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={closeExportModal}
                    className="flex-1 sm:flex-none px-8 py-3 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportData.fields.length === 0 || exporting}
                    className="flex-1 sm:flex-none px-10 py-3 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary-200 hover:bg-primary-700 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 transition-all flex items-center justify-center gap-3"
                  >
                    {exporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export as {exportFormat.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorJobs;
