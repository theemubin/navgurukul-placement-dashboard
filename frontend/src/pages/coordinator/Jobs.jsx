import { useState, useEffect } from 'react';
import { jobReadinessAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { jobAPI, settingsAPI, applicationAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, ConfirmModal } from '../../components/common/UIComponents';
import { Briefcase, Plus, Search, Edit, Trash2, MapPin, Calendar, Users, GraduationCap, Clock, LayoutGrid, List, Download, Settings, X } from 'lucide-react';
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

  const handleStatusChange = async (jobId, newStatus) => {
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
        fields: exportData.fields
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportModal.jobTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_applications.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully!');
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
                      className="p-2 hover:bg-green-50 rounded-lg text-green-600"
                      title="Export Applications"
                    >
                      <Download className="w-5 h-5" />
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
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Export Applications</h3>
                  <p className="text-sm text-gray-500 mt-1">{exportModal.jobTitle}</p>
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
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-medium text-gray-900">Select Fields to Export</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // Quick select: Essential fields only
                        const essentialFields = ['studentName', 'email', 'phone', 'campus', 'currentSchool', 'currentModule', 'attendance', 'status', 'appliedDate', 'profileStatus'];
                        setExportData({
                          fields: essentialFields.filter(f => availableFields.some(af => af.key === f)),
                          allSelected: false
                        });
                      }}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      Essential Only
                    </button>
                    <button
                      onClick={() => {
                        // Quick select: Profile + Skills
                        const profileFields = availableFields.filter(f => 
                          ['Student Info', 'Campus Info', 'Navgurukul Education', 'Academic Background', 'Skills', 'Soft Skills', 'Language Skills', 'Profile Links'].includes(f.category)
                        ).map(f => f.key);
                        setExportData({
                          fields: profileFields,
                          allSelected: false
                        });
                      }}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      Profile + Skills
                    </button>
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {exportData.allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
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
                    Export will include comprehensive student data including profile details, academic background, 
                    skills assessment, job readiness criteria, and application information in CSV format.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={closeExportModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exportData.fields.length === 0 || exporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export as CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorJobs;
