import { useState, useEffect } from 'react';
import { jobReadinessAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { jobAPI, settingsAPI, applicationAPI, userAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, ConfirmModal } from '../../components/common/UIComponents';
import { Briefcase, Plus, Search, Edit, Trash2, MapPin, Calendar, Users, GraduationCap, Clock, LayoutGrid, List, Download, Settings, X, CheckCircle, XCircle, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import JobsKanban from './JobsKanban';

const CoordinatorJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', jobType: '' });
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

  // Applicant modal state
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [modalJob, setModalJob] = useState(null);
  const [modalApplicants, setModalApplicants] = useState([]);

  const navigate = useNavigate();
  const { user } = useAuth();

  const canManageJob = (job) => {
    if (!user) return false;
    if (user.role === 'manager') return true;
    if (job.coordinator && job.coordinator.toString() === user._id.toString()) return true;
    if (job.createdBy && job.createdBy.toString() === user._id.toString()) return true;
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
      const inSection = a._target === sectionKey || (sectionKey === 'selected' && a.status === 'selected') || (sectionKey === 'notMoving' && ['rejected','withdrawn'].includes(a.status)) || (sectionKey === 'noAction' && !['selected','rejected','withdrawn'].includes(a.status));
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
        jobType: filters.jobType || undefined
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
      setModalApplicants(prev => (prev || []).filter(a => !['rejected','withdrawn','selected','placed'].includes(a.status)).map(a => ({ ...a, _target: a._target || undefined, _comment: a._comment || '' })));
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white shadow-sm text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban' 
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
            </div>
          </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : jobs.length > 0 ? (
        <>
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job._id} className="card">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                        job.jobType === 'internship' ? 'bg-purple-100' : 'bg-gray-100'
                      }`}>
                        {job.jobType === 'internship' 
                          ? <GraduationCap className="w-6 h-6 text-purple-500" />
                          : <Briefcase className="w-6 h-6 text-gray-400" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{job.title}</h3>
                          {job.jobType === 'internship' && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              Internship
                            </span>
                          )}
                          {job.eligibility?.openForAll && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              Open for All
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">{job.company?.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {job.maxPositions} positions
                          </span>
                          {job.jobType === 'internship' && job.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {job.duration}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Deadline: {format(new Date(job.applicationDeadline), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>

                      {/* Quick 'View applicants' and 'Manage applicants' actions (responsive: below title on small screens) */}
                      <div className="w-full lg:w-auto flex items-center gap-2 mt-2 lg:mt-0 justify-start lg:justify-end">
                        <Link className="btn btn-outline flex items-center" to={`/coordinator/applications?job=${job._id}`} title={`View ${job.totalApplications || 0} applications`}>
                          <span>View applicants</span>
                          <span className="ml-2 text-sm text-gray-600 px-2 py-1 bg-gray-100 rounded-full">{job.totalApplications || 0}</span>
                        </Link>
                        <button
                          className="btn"
                          title="Change status and manage applicants"
                          onClick={() => openManageApplicants(job)}
                        >
                          Manage Applicants
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job._id, e.target.value)}
                      className="text-sm border rounded-lg px-2 py-1"
                    >
                      {pipelineStages.map(stage => (
                        <option key={stage.id} value={stage.id}>{stage.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => openExportModal(job._id, job.title)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors border border-green-200"
                      title="Export Applications (CSV/PDF)"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm font-medium">Export</span>
                    </button>
                    <Link
                      to={`/coordinator/jobs/${job._id}/edit`}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit className="w-5 h-5 text-gray-600" />
                    </Link>
                    <button
                      onClick={() => setDeleteModal({ show: true, jobId: job._id })}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      Placements: <span className="font-medium text-green-600">{job.placementsCount || 0}</span>
                    </span>
                    <span className="text-gray-500">
                      Applications: <span className="font-medium">{job.totalApplications || 0}</span>
                    </span>
                    <span className="text-gray-500">
                      Skills: <span className="font-medium">{job.requiredSkills?.length || 0}</span>
                    </span>
                    {/* Job Readiness Tooltip (School of Programming only) */}
                    {job.school === 'School of Programming' && jobReadinessSummaries['School of Programming'] > 0 && (
                      <span className="ml-2 relative group cursor-pointer">
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">Job Readiness</span>
                        <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-gray-200 shadow-lg rounded p-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          Job Readiness required for this job (School of Programming). Only students who have completed at least 1 criterion will be considered "In Progress"; all must be completed for "Job Ready".
                        </span>
                      </span>
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

      {/* Applicants Modal (opened from 'Manage Applicants' button) */}
      {showApplicantModal && modalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-30" onClick={() => { setShowApplicantModal(false); setModalNewStatus(null); }} />
          <div className="bg-white rounded-lg max-w-4xl w-full p-4 z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">Manage Applicants — {modalJob.title}</h3>
                {modalNewStatus && (
                  <div className="text-sm text-gray-500">This action will set the job status to <span className="font-medium">{modalNewStatus}</span> when applied</div>
                )}
              </div>
              <div className="flex items-center gap-2 modal-actions">
                <button className="btn btn-secondary" onClick={() => { setShowApplicantModal(false); setModalNewStatus(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={openPreview}>Preview & Apply</button>
              </div>
            </div>

            <div className="applicant-columns">
              {/* Selected Column */}
              <div className="applicant-column">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">Selected</h4>
                    <button className="lg:hidden p-1 text-gray-500" title="Toggle" onClick={() => toggleSectionCollapse('selected')}>
                      {collapsedSections.selected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select className="text-sm border rounded px-2 py-1 hidden lg:inline" value={sectionStatus.selected} onChange={(e) => setSectionStatus(s => ({ ...s, selected: e.target.value }))}>
                      <option value="selected">Selected</option>
                      <option value="placed">Placed</option>
                      <option value="no_change">No change (feedback only)</option>
                    </select>
                    <button className="btn btn-sm" onClick={() => selectAllInSection('selected')}>Select all</button>
                    <button className="btn btn-sm" onClick={() => copySectionComment('selected')}>Copy comment</button>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-2">Students marked as selected will be moved to Selected status (or 'placed').</p>
                <div className={`${collapsedSections.selected ? 'hidden lg:block' : 'block'}`}>
                  <textarea rows={3} value={sectionComments.selected} onChange={(e) => setSectionComments(s => ({ ...s, selected: e.target.value }))} placeholder="General comment for selected students (visible to students)" className="w-full mb-3" />
                  <div className="column-body">
                    {modalApplicants.filter(a => a._target === 'selected' || a.status === 'selected').map(a => (
                      <div key={a._id} className="student-card">
                        <div className="flex flex-col items-start justify-between gap-4">
                          <div>
                            <div className="font-medium">{a.student?.firstName} {a.student?.lastName}</div>
                            <div className="student-email truncate-ellipsis">{a.student?.email}</div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <button aria-label="Selected" title="Selected" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='selected' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'selected')}><CheckCircle className="w-4 h-4" /> <span className="sr-only">Selected</span></button>
                            <button aria-label="Not moving ahead" title="Not moving ahead" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='notMoving' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'notMoving')}><XCircle className="w-4 h-4" /> <span className="sr-only">Not moving ahead</span></button>
                            <button aria-label="No action" title="No action" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='noAction' ? 'bg-gray-100 text-gray-900 border-gray-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'noAction')}><Pause className="w-4 h-4" /> <span className="sr-only">No action</span></button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <textarea rows={2} value={a._comment || ''} onChange={(e) => updateApplicantComment(a._id, e.target.value)} placeholder="Individual comment for this student (optional)" className="w-full text-sm border rounded p-2" />
                          <div className="flex justify-end mt-2 gap-2">
                            <button onClick={() => copyRowCommentToCategory('selected', a._comment || '')} className="btn btn-sm">Copy to category</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Not moving ahead */}
              <div className="applicant-column">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">Not moving ahead</h4>
                    <button className="lg:hidden p-1 text-gray-500" title="Toggle" onClick={() => toggleSectionCollapse('notMoving')}>
                      {collapsedSections.notMoving ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="text-sm border rounded px-2 py-1 hidden lg:inline" value={sectionStatus.notMoving} onChange={(e) => setSectionStatus(s => ({ ...s, notMoving: e.target.value }))}>
                      <option value="rejected">Rejected</option>
                      <option value="withdrawn">Withdrawn</option>
                      <option value="no_change">No change (feedback only)</option>
                    </select>
                    <button className="btn btn-sm" onClick={() => selectAllInSection('notMoving')}>Select all</button>
                    <button className="btn btn-sm" onClick={() => copySectionComment('notMoving')}>Copy comment</button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-2">Students here will be marked as rejected/not moving ahead.</p>
                <textarea rows={3} value={sectionComments.notMoving} onChange={(e) => setSectionComments(s => ({ ...s, notMoving: e.target.value }))} placeholder="General comment for not moving ahead students" className="w-full mb-3" />
                <div className="space-y-2">
                  {modalApplicants.filter(a => a._target === 'notMoving' || ['rejected','withdrawn'].includes(a.status)).map(a => (
                    <div key={a._id} className="p-2 rounded hover:bg-gray-50 border">
                      <div className="flex flex-col items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{a.student?.firstName} {a.student?.lastName} <span className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">{a.student?.email}</span></div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button aria-label="Selected" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='selected' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'selected')}><CheckCircle className="w-4 h-4" /><span className="sr-only">Selected</span></button>
                          <button aria-label="Not moving ahead" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='notMoving' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'notMoving')}><XCircle className="w-4 h-4" /><span className="sr-only">Not moving ahead</span></button>
                          <button aria-label="No action" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='noAction' ? 'bg-gray-100 text-gray-900 border-gray-200' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'noAction')}><Pause className="w-4 h-4" /><span className="sr-only">No action</span></button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <textarea rows={2} value={a._comment || ''} onChange={(e) => updateApplicantComment(a._id, e.target.value)} placeholder="Individual comment for this student (optional)" className="w-full text-sm border rounded p-2" />
                        <div className="flex justify-end mt-2 gap-2">
                          <button onClick={() => copyRowCommentToCategory('notMoving', a._comment || '')} className="btn btn-sm">Copy to category</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* No action yet */}
              <div className="applicant-column">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">No action yet</h4>
                    <button className="lg:hidden p-1 text-gray-500" title="Toggle" onClick={() => toggleSectionCollapse('noAction')}>
                      {collapsedSections.noAction ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="text-sm border rounded px-2 py-1 hidden lg:inline" value={sectionStatus.noAction} onChange={(e) => setSectionStatus(s => ({ ...s, noAction: e.target.value }))}>
                      <option value="no_change">No change (feedback only)</option>
                      <option value="in_progress">Mark In Progress</option>
                    </select>
                    <button className="btn btn-sm" onClick={() => selectAllInSection('noAction')}>Select all</button>
                    <button className="btn btn-sm" onClick={() => copySectionComment('noAction')}>Copy comment</button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-2">Students not yet acted upon. You can leave a general comment without changing their status.</p>
                <textarea rows={3} value={sectionComments.noAction} onChange={(e) => setSectionComments(s => ({ ...s, noAction: e.target.value }))} placeholder="General comment for remaining students" className="w-full mb-3" />
                <div className="column-body">
                  {modalApplicants.filter(a => (!['selected','rejected','withdrawn'].includes(a.status) && a._target !== 'selected' && a._target !== 'notMoving') || a._target === 'noAction').map(a => (
                    <div key={a._id} className="student-card">
                      <div className="flex flex-col items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{a.student?.firstName} {a.student?.lastName}</div>
                          <div className="student-email truncate-ellipsis">{a.student?.email}</div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button aria-label="Selected" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='selected' ? 'bg-green-100 text-green-700 border' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'selected')}><CheckCircle className="w-4 h-4" /><span className="sr-only">Selected</span></button>
                          <button aria-label="Not moving ahead" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='notMoving' ? 'bg-red-100 text-red-700 border' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'notMoving')}><XCircle className="w-4 h-4" /><span className="sr-only">Not</span></button>
                          <button aria-label="No action" className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${a._target==='noAction' ? 'bg-gray-100 text-gray-900 border' : 'bg-white text-gray-700 border'}`} onClick={() => handleModalSetTarget(a._id, 'noAction')}><Pause className="w-4 h-4" /><span className="sr-only">No action</span></button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <textarea rows={2} value={a._comment || ''} onChange={(e) => updateApplicantComment(a._id, e.target.value)} placeholder="Individual comment for this student (optional)" className="w-full text-sm border rounded p-2" />
                        <div className="flex justify-end mt-2 gap-2">
                          <button onClick={() => copyRowCommentToCategory('noAction', a._comment || '')} className="btn btn-sm">Copy to category</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Export Modal */}
      {exportModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Download className="w-6 h-6 text-blue-600" />
                    Export Applications
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">{exportModal.jobTitle}</span> - 
                    Select fields and format to export
                  </p>
                </div>
                <button
                  onClick={closeExportModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex h-[70vh]">
              {/* Left Panel - Format Selection */}
              <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Export Format</h4>
                <div className="space-y-2">
                  <label className="flex items-center p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">CSV Spreadsheet</div>
                      <div className="text-xs text-gray-500">Excel compatible format</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-sm">PDF Report</div>
                      <div className="text-xs text-gray-500">Formal document with company branding</div>
                    </div>
                  </label>
                </div>

                {/* Presets */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Presets</h4>
                  <div className="flex gap-2">
                    <select
                      value={selectedPresetId || ''}
                      onChange={(e) => {
                        const p = presets.find(pp => pp._id === e.target.value);
                        if (p) applyPreset(p);
                        setSelectedPresetId(e.target.value || null);
                      }}
                      className="flex-1 p-2 border rounded bg-white text-sm"
                    >
                      <option value="">-- Select Preset --</option>
                      {presets.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={savePreset}
                      className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => selectedPresetId && deletePreset(selectedPresetId)}
                      disabled={!selectedPresetId}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* PDF Layout */}
                {exportFormat === 'pdf' && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">PDF Layout</h4>
                    <label className="flex items-center gap-3 p-2 bg-white border rounded cursor-pointer">
                      <input
                        type="radio"
                        name="exportLayout"
                        value="resume"
                        checked={exportLayout === 'resume'}
                        onChange={(e) => setExportLayout(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-sm">Resume-style (2 per page)</div>
                        <div className="text-xs text-gray-500">Polished resume cards, 2 students per page</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-2 bg-white border rounded cursor-pointer mt-2">
                      <input
                        type="radio"
                        name="exportLayout"
                        value="table"
                        checked={exportLayout === 'table'}
                        onChange={(e) => setExportLayout(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-sm">Compact Table</div>
                        <div className="text-xs text-gray-500">Dense one-row-per-student table</div>
                      </div>
                    </label>
                  </div>
                )}
                
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Selection</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const essentialFields = ['studentName', 'email', 'phone', 'campus', 'currentSchool', 'currentModule', 'attendance', 'status', 'appliedDate', 'profileStatus'];
                        setExportData({
                          fields: essentialFields.filter(f => availableFields.some(af => af.key === f)),
                          allSelected: false
                        });
                      }}
                      className="w-full text-left px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      🎯 Essential Only
                    </button>
                    <button
                      onClick={() => {
                        const profileFields = availableFields.filter(f => 
                          ['Student Info', 'Campus Info', 'Navgurukul Education', 'Academic Background', 'Skills', 'Soft Skills'].includes(f.category)
                        ).map(f => f.key);
                        setExportData({
                          fields: profileFields,
                          allSelected: false
                        });
                      }}
                      className="w-full text-left px-3 py-2 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      👤 Profile + Skills
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className="w-full text-left px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      {exportData.allSelected ? '✖️ Deselect All' : '✅ Select All'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel - Field Selection */}
              <div className="flex-1 px-6 py-4 overflow-y-auto">
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Select Fields to Export
                  </h4>
                  <p className="text-sm text-gray-600">
                    Choose which student information fields to include in your export.
                  </p>
                </div>
                
                {/* Fields grouped by category */}
                {[
                  'Student Info', 
                  'Campus Info', 
                  'Navgurukul Education', 
                  'Academic Background', 
                  'Personal Info',
                  'Skills', 
                  'Soft Skills',
                  'Language Skills',
                  'Learning & Development',
                  'Career Preferences',
                  'Profile Links',
                  'Profile Status',
                  'Job Info', 
                  'Application',
                  'Job Readiness'
                ].map(category => {
                  const categoryFields = availableFields.filter(f => f.category === category);
                  
                  if (categoryFields.length === 0) return null;
                  
                  return (
                    <div key={category} className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                        {category}
                        <span className="ml-2 text-xs text-gray-500">({categoryFields.length} fields)</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {categoryFields.map(field => (
                          <label key={field.key} className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={exportData.fields.includes(field.key)}
                              onChange={() => handleFieldToggle(field.key)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-700 leading-5">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {exportData.fields.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700 mb-2">
                    <strong>{exportData.fields.length}</strong> field{exportData.fields.length !== 1 ? 's' : ''} selected for export
                  </p>
                  <p className="text-xs text-blue-600">
                    {exportFormat === 'pdf' 
                      ? 'PDF export will include formal layout with company branding and structured presentation.'
                      : 'CSV export will include comprehensive student data in spreadsheet format, compatible with Excel.'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{exportData.fields.length}</span> fields selected
                  {exportFormat === 'pdf' && (
                    <span className="ml-4 text-blue-600 font-medium">
                      📄 PDF will include company branding and formal layout
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeExportModal}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportData.fields.length === 0 || exporting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {exporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Exporting...
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
