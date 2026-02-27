import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { jobAPI, settingsAPI, applicationAPI } from '../../services/api';
import ApplicantTriageModal from './ApplicantTriageModal';
import { Badge, Button, Alert } from '../../components/common/UIComponents';
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  Pencil,
  Eye,
  IndianRupee,
  Clock,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  X,
  EyeOff,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

// Color configuration for stages
const STAGE_COLORS = {
  gray: { bg: 'bg-gray-100 border-gray-300', header: 'bg-gray-500' },
  yellow: { bg: 'bg-yellow-50 border-yellow-300', header: 'bg-yellow-500' },
  green: { bg: 'bg-green-50 border-green-300', header: 'bg-green-500' },
  orange: { bg: 'bg-orange-50 border-orange-300', header: 'bg-orange-500' },
  blue: { bg: 'bg-blue-50 border-blue-300', header: 'bg-blue-500' },
  red: { bg: 'bg-red-50 border-red-300', header: 'bg-red-500' },
  purple: { bg: 'bg-purple-50 border-purple-300', header: 'bg-purple-500' },
  pink: { bg: 'bg-pink-50 border-pink-300', header: 'bg-pink-500' },
  indigo: { bg: 'bg-indigo-50 border-indigo-300', header: 'bg-indigo-500' }
};

// Job Card component for Kanban
const JobCard = ({ job, index, onExportJob }) => {
  const formatSalary = (salary) => {
    if (!salary?.min && !salary?.max) return null;
    if (salary.min && salary.max) {
      return `₹${(salary.min / 1000).toFixed(0)}k - ₹${(salary.max / 1000).toFixed(0)}k`;
    }
    return salary.min ? `₹${(salary.min / 1000).toFixed(0)}k+` : `Up to ₹${(salary.max / 1000).toFixed(0)}k`;
  };

  const daysUntilDeadline = () => {
    const deadline = new Date(job.applicationDeadline);
    const today = new Date();
    const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const deadlineDays = daysUntilDeadline();
  const isUrgent = deadlineDays <= 3 && deadlineDays > 0;
  const isPast = deadlineDays < 0;

  return (
    <Draggable draggableId={job._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-sm border p-4 mb-3 cursor-grab active:cursor-grabbing transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary-500' : 'hover:shadow-md'
            }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {job.title}
            </h4>
          </div>

          {/* Company */}
          <div className="flex items-center text-gray-600 text-xs mb-2">
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            <span className="truncate">{job.company?.name}</span>
          </div>

          {/* Location & Job Type */}
          <div className="flex items-center gap-3 text-gray-500 text-xs mb-2">
            <span className="flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              {job.location}
            </span>
            <Badge variant={job.jobType === 'full_time' ? 'success' : 'info'} className="text-xs py-0">
              {job.jobType?.replace('_', ' ')}
            </Badge>
          </div>

          {/* Salary */}
          {formatSalary(job.salary) && (
            <div className="flex items-center text-gray-600 text-xs mb-2">
              <IndianRupee className="w-3.5 h-3.5 mr-1.5" />
              {formatSalary(job.salary)}
            </div>
          )}

          {/* Positions & Deadline */}
          <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-gray-100">
            <span className="flex items-center text-gray-500">
              <Users className="w-3.5 h-3.5 mr-1" />
              {job.maxPositions} {job.maxPositions === 1 ? 'position' : 'positions'}
            </span>
            <span className={`flex items-center ${isPast ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-gray-500'}`}>
              <Calendar className="w-3.5 h-3.5 mr-1" />
              {isPast ? 'Expired' : isUrgent ? `${deadlineDays}d left` : new Date(job.applicationDeadline).toLocaleDateString()}
            </span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-1 mt-3 pt-2 border-t border-gray-100">
            <Link
              to={`/coordinator/jobs/${job._id}`}
              className="flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-primary-600 py-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View
            </Link>
            {onExportJob && (
              <button
                onClick={() => onExportJob(job._id, job.title)}
                className="flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-green-600 py-1.5 rounded hover:bg-gray-50 transition-colors"
                title="Export Applications"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            )}
            <Link
              to={`/coordinator/jobs/${job._id}/edit`}
              className="flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-primary-600 py-1.5 rounded hover:bg-gray-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        </div>
      )}
    </Draggable>
  );
};

// Kanban Column component
const KanbanColumn = ({ stage, jobs, onEditStage, onExportJob }) => {
  const colorConfig = STAGE_COLORS[stage.color] || STAGE_COLORS.gray;

  return (
    <div className={`flex-shrink-0 w-72 rounded-lg border ${colorConfig.bg}`}>
      {/* Column Header */}
      <div className={`${colorConfig.header} text-white px-4 py-3 rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{stage.label}</h3>
            {!stage.visibleToStudents && (
              <EyeOff className="w-3.5 h-3.5 opacity-70" title="Hidden from students" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {jobs.length}
            </span>
            <button
              onClick={() => onEditStage(stage)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Edit stage"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-white/80 mt-1 truncate">{stage.description}</p>
      </div>

      {/* Column Body - Droppable */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-primary-50/50' : ''
              }`}
          >
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No jobs
              </div>
            ) : (
              jobs.map((job, index) => (
                <JobCard key={job._id} job={job} index={index} onExportJob={onExportJob} />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// Stage Management Modal
const StageManagementModal = ({ isOpen, onClose, stages, onSave }) => {
  const [localStages, setLocalStages] = useState([]);
  const [editingStage, setEditingStage] = useState(null);
  const [newStage, setNewStage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalStages([...stages]);
  }, [stages, isOpen]);

  const handleAddStage = () => {
    setNewStage({
      id: '',
      label: '',
      description: '',
      color: 'gray',
      visibleToStudents: true,
      studentLabel: ''
    });
  };

  const handleSaveNewStage = async () => {
    if (!newStage.label.trim()) {
      toast.error('Stage name is required');
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.createPipelineStage(newStage);
      toast.success('Stage created successfully');
      setNewStage(null);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create stage');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage.label.trim()) {
      toast.error('Stage name is required');
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.updatePipelineStage(editingStage.id, editingStage);
      toast.success('Stage updated successfully');
      setEditingStage(null);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stage');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStage = async (stageId) => {
    if (!confirm('Are you sure you want to delete this stage? Jobs in this stage may become inaccessible.')) {
      return;
    }
    setSaving(true);
    try {
      await settingsAPI.deletePipelineStage(stageId);
      toast.success('Stage deleted successfully');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete stage');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(localStages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setLocalStages(items);

    // Save new order
    try {
      await settingsAPI.reorderPipelineStages(items.map(s => s.id));
      toast.success('Stages reordered');
      onSave();
    } catch (err) {
      toast.error('Failed to reorder stages');
      setLocalStages([...stages]); // Revert
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Pipeline Stages</h2>
            <p className="text-sm text-gray-500">Customize your job workflow stages</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Editing Form */}
          {(editingStage || newStage) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-medium mb-4">{newStage ? 'New Stage' : 'Edit Stage'}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={(editingStage || newStage).label}
                      onChange={(e) => {
                        const setter = editingStage ? setEditingStage : setNewStage;
                        setter(prev => ({ ...prev, label: e.target.value }));
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Technical Interview"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <select
                      value={(editingStage || newStage).color}
                      onChange={(e) => {
                        const setter = editingStage ? setEditingStage : setNewStage;
                        setter(prev => ({ ...prev, color: e.target.value }));
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {Object.keys(STAGE_COLORS).map(color => (
                        <option key={color} value={color}>{color.charAt(0).toUpperCase() + color.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={(editingStage || newStage).description}
                    onChange={(e) => {
                      const setter = editingStage ? setEditingStage : setNewStage;
                      setter(prev => ({ ...prev, description: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Brief description of this stage"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student Label</label>
                    <input
                      type="text"
                      value={(editingStage || newStage).studentLabel}
                      onChange={(e) => {
                        const setter = editingStage ? setEditingStage : setNewStage;
                        setter(prev => ({ ...prev, studentLabel: e.target.value }));
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Label students see (optional)"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(editingStage || newStage).visibleToStudents}
                        onChange={(e) => {
                          const setter = editingStage ? setEditingStage : setNewStage;
                          setter(prev => ({ ...prev, visibleToStudents: e.target.checked }));
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-700">Visible to students</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setEditingStage(null); setNewStage(null); }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={newStage ? handleSaveNewStage : handleUpdateStage}
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stages List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="stages-list">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {localStages.map((stage, index) => (
                    <Draggable key={stage.id} draggableId={stage.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab">
                            <GripVertical className="w-5 h-5 text-gray-400" />
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full ${STAGE_COLORS[stage.color]?.header || 'bg-gray-500'}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{stage.label}</span>
                              {stage.isDefault && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Default</span>
                              )}
                              {!stage.visibleToStudents && (
                                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{stage.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingStage({ ...stage })}
                              className="p-1.5 hover:bg-gray-100 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </button>
                            {!stage.isDefault && (
                              <button
                                onClick={() => handleDeleteStage(stage.id)}
                                className="p-1.5 hover:bg-red-50 rounded text-red-500"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={handleAddStage}
            disabled={newStage !== null}
            className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Kanban Board component
const JobsKanban = ({ onExportJob }) => {
  const [jobs, setJobs] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [showStageModal, setShowStageModal] = useState(false);

  // Applicant Review / Triage Modal State
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [modalJob, setModalJob] = useState(null);
  const [modalApplicants, setModalApplicants] = useState([]);
  const [modalNewStatus, setModalNewStatus] = useState(null);
  const [applyingModalChanges, setApplyingModalChanges] = useState(false);

  // Organize jobs by status
  const jobsByStatus = stages.reduce((acc, stage) => {
    acc[stage.id] = jobs.filter(job => job.status === stage.id);
    return acc;
  }, {});

  // Fetch pipeline stages
  const fetchStages = async () => {
    try {
      const response = await settingsAPI.getPipelineStages();
      setStages(response.data.data || []);
    } catch (err) {
      console.error('Error fetching stages:', err);
      setError('Failed to load pipeline stages');
    }
  };

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const response = await jobAPI.getJobs({ limit: 100 });
      setJobs(response.data.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError('Failed to load jobs');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchStages(), fetchJobs()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const [activeStageId, setActiveStageId] = useState('');

  // Update activeStageId when stages load if not set
  useEffect(() => {
    if (stages.length > 0 && !activeStageId) {
      setActiveStageId(stages[0].id);
    }
  }, [stages, activeStageId]);

  const fetchApplicantsForJob = async (jobId) => {
    try {
      const res = await applicationAPI.getApplications({ job: jobId, limit: 1000 });
      // Only show applicants who are still 'in process' (not rejected/withdrawn/placed/selected/filled)
      const apps = (res.data.applications || []).filter(a => !['rejected', 'withdrawn', 'selected', 'placed', 'filled'].includes(a.status));
      setModalApplicants(apps.map(a => ({ ...a, _target: a._target || undefined, _comment: a._comment || '' })));
    } catch (error) {
      console.error('Error fetching applicants', error);
      toast.error('Failed to load applicants for review');
    }
  };

  const handleTriageConfirm = async (triageApplicants, metadata = {}) => {
    if (!modalJob) return;
    setApplyingModalChanges(true);

    try {
      // Group by action/status
      const grouped = {
        promote: triageApplicants.filter(a => a.bucket === 'promote'),
        exit: triageApplicants.filter(a => a.bucket === 'exit'),
        hold: triageApplicants.filter(a => a.bucket === 'hold' && a.comment.trim())
      };

      // 1. Handle Promoted
      if (grouped.promote.length > 0) {
        const payload = {
          applicationIds: grouped.promote.map(a => a._id),
          action: 'set_status',
          status: modalNewStatus || modalJob.status,
          perApplicationFeedbacks: grouped.promote.reduce((acc, a) => {
            if (a.comment) acc[a._id] = a.comment;
            return acc;
          }, {})
        };
        if ((payload.status === 'interviewing' || payload.status?.includes('interview')) && metadata.roundIndex !== undefined) {
          payload.targetRound = metadata.roundIndex;
          payload.roundName = metadata.roundName;
        }
        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // 2. Handle Exited
      if (grouped.exit.length > 0) {
        const payload = {
          applicationIds: grouped.exit.map(a => a._id),
          action: 'set_status',
          status: 'rejected',
          perApplicationFeedbacks: grouped.exit.reduce((acc, a) => {
            acc[a._id] = a.comment;
            return acc;
          }, {})
        };
        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // 3. Handle Hold
      if (grouped.hold.length > 0) {
        const payload = {
          applicationIds: grouped.hold.map(a => a._id),
          action: 'set_status',
          perApplicationFeedbacks: grouped.hold.reduce((acc, a) => {
            acc[a._id] = a.comment;
            return acc;
          }, {})
        };
        await jobAPI.bulkUpdate(modalJob._id, payload);
      }

      // After bulk updates, check if the job is already filled
      const latestJobRes = await jobAPI.getJob(modalJob._id);
      const latestJob = latestJobRes.data;

      if (modalNewStatus && latestJob.status !== 'filled') {
        await jobAPI.updateJob(modalJob._id, { status: modalNewStatus });
      }

      toast.success('Batch processing completed successfully!');
      setShowApplicantModal(false);
      setModalApplicants([]);
      setModalNewStatus(null);
      fetchData();
    } catch (error) {
      console.error('Triage apply error', error);
      toast.error(error?.response?.data?.message || 'Failed to apply changes');
    } finally {
      setApplyingModalChanges(false);
    }
  };

  // Handle drag end
  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // No destination or dropped in same place
    if (!destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)) {
      return;
    }

    const jobId = draggableId;
    const newStatus = destination.droppableId;
    const oldStatus = source.droppableId;

    // Define statuses that require applicant review before changing job status
    const reviewStatuses = ['hr_shortlisting', 'interviewing', 'application_stage', 'filled'];
    if (reviewStatuses.includes(newStatus)) {
      const job = jobs.find(j => j._id === jobId);
      setModalJob(job);
      setModalNewStatus(newStatus);
      await fetchApplicantsForJob(jobId);
      setShowApplicantModal(true);
      return;
    }

    // Optimistic update
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job._id === jobId ? { ...job, status: newStatus } : job
      )
    );

    // API call
    try {
      setUpdating(jobId);
      await jobAPI.updateJobStatus(jobId, newStatus);
    } catch (err) {
      console.error('Error updating job status:', err);
      // Revert on error
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job._id === jobId ? { ...job, status: oldStatus } : job
        )
      );
      setError('Failed to update job status. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const handleEditStage = (stage) => {
    setShowStageModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="md:hidden w-full overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setActiveStageId(stage.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${activeStageId === stage.id
                  ? `bg-primary-600 border-primary-600 text-white shadow-md`
                  : `bg-white border-gray-200 text-gray-500`
                  }`}
              >
                {stage.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeStageId === stage.id ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                  {jobsByStatus[stage.id]?.length || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowStageModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-auto sm:ml-0"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Manage Stages</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert type="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {/* Status Update Indicator */}
      {updating && (
        <div className="fixed top-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm">Updating status...</span>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Desktop View */}
        <div className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              jobs={jobsByStatus[stage.id] || []}
              onEditStage={handleEditStage}
              onExportJob={onExportJob}
            />
          ))}
        </div>

        {/* Mobile View - Only show active stage */}
        <div className="md:hidden">
          {stages.filter(s => s.id === activeStageId).map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              jobs={jobsByStatus[stage.id] || []}
              onEditStage={handleEditStage}
              onExportJob={onExportJob}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Legend / Help */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Guide</h4>
        <p className="text-xs text-gray-600">
          Drag and drop job cards between columns to update their status. Changes are saved automatically.
          Click <strong>Manage Stages</strong> to customize your pipeline - add new stages, edit names, colors, and visibility settings.
          Stages with <EyeOff className="w-3 h-3 inline" /> are hidden from students.
        </p>
      </div>

      {/* Stage Management Modal */}
      <StageManagementModal
        isOpen={showStageModal}
        onClose={() => setShowStageModal(false)}
        stages={stages}
        onSave={fetchStages}
      />

      {/* Applicant Review Modal */}
      <ApplicantTriageModal
        isOpen={showApplicantModal}
        onClose={() => {
          setShowApplicantModal(false);
          setModalApplicants([]);
          setModalNewStatus(null);
        }}
        job={modalJob}
        applicants={modalApplicants}
        targetStatus={modalNewStatus}
        pipelineStages={stages}
        onConfirm={handleTriageConfirm}
        isApplying={applyingModalChanges}
      />
    </div>
  );
};

export default JobsKanban;
