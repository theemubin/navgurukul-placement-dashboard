import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { selfApplicationAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';
import { BulkUploadModal } from '../../components/common/BulkUpload';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied', color: 'bg-blue-100 text-blue-800' },
  { value: 'screening', label: 'Screening', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'interview_scheduled', label: 'Interview Scheduled', color: 'bg-purple-100 text-purple-800' },
  { value: 'interview_completed', label: 'Interview Completed', color: 'bg-pink-100 text-pink-800' },
  { value: 'offer_received', label: 'Offer Received', color: 'bg-green-100 text-green-800' },
  { value: 'offer_accepted', label: 'Offer Accepted', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'offer_declined', label: 'Offer Declined', color: 'bg-orange-100 text-orange-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-800' }
];

const EMPTY_FORM = {
  companyName: '',
  jobTitle: '',
  jobUrl: '',
  location: '',
  salary: '',
  applicationDate: new Date().toISOString().split('T')[0],
  status: 'applied',
  source: '',
  notes: '',
  interviewRounds: []
};

function SelfApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', data: EMPTY_FORM });
  const [deleteModal, setDeleteModal] = useState({ open: false, application: null });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await selfApplicationAPI.getAll();
      setApplications(res.data.selfApplications || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormModal({ open: true, mode: 'create', data: EMPTY_FORM });
  };

  const handleOpenEdit = (app) => {
    setFormModal({
      open: true,
      mode: 'edit',
      data: {
        ...app,
        companyName: app.company?.name || app.companyName || '',
        location: app.company?.location || app.location || '',
        salary: app.salary?.amount !== undefined ? app.salary.amount.toString() : (typeof app.salary === 'string' ? app.salary : ''),
        jobUrl: app.jobLink || app.jobUrl || '',
        applicationDate: app.applicationDate?.split('T')[0] || ''
      }
    });
  };

  const handleFormChange = (field, value) => {
    setFormModal(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      // Transform flat form data to nested structure expected by backend
      const payload = {
        company: {
          name: formModal.data.companyName,
          location: formModal.data.location
        },
        jobTitle: formModal.data.jobTitle,
        jobLink: formModal.data.jobUrl,
        salary: {
          amount: isNaN(parseFloat(formModal.data.salary)) ? undefined : parseFloat(formModal.data.salary)
        },
        applicationDate: formModal.data.applicationDate,
        status: formModal.data.status,
        notes: formModal.data.notes,
        source: formModal.data.source
      };

      if (formModal.mode === 'create') {
        await selfApplicationAPI.create(payload);
      } else {
        await selfApplicationAPI.update(formModal.data._id, payload);
      }
      setFormModal({ open: false, mode: 'create', data: EMPTY_FORM });
      await fetchApplications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (appId, newStatus, notes = '') => {
    try {
      await selfApplicationAPI.updateStatus(appId, { status: newStatus, notes });
      await fetchApplications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await selfApplicationAPI.delete(deleteModal.application._id);
      setDeleteModal({ open: false, application: null });
      await fetchApplications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete application');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusObj = STATUS_OPTIONS.find(s => s.value === status);
    return statusObj ? (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusObj.color}`}>
        {statusObj.label}
      </span>
    ) : (
      <Badge variant="secondary">{status}</Badge>
    );
  };

  const filteredApplications = filter === 'all'
    ? applications
    : applications.filter(a => a.status === filter);

  const getStats = () => {
    const apps = Array.isArray(applications) ? applications : [];
    const total = apps.length;
    const active = apps.filter(a => ['applied', 'in_progress', 'interview_scheduled'].includes(a.status)).length;
    const offers = apps.filter(a => ['offer_received', 'offer_accepted'].includes(a.status)).length;
    const rejected = apps.filter(a => a.status === 'rejected').length;
    return { total, active, offers, rejected };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Self Applications</h1>
          <p className="mt-2 text-gray-600">
            Track jobs you've applied to outside the placement portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setBulkUploadModal(true)}>
            <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={handleOpenCreate}>
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Application
          </Button>
        </div>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Applications</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.active}</div>
          <div className="text-sm text-gray-500">Active</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600">{stats.offers}</div>
          <div className="text-sm text-gray-500">Offers</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          <div className="text-sm text-gray-500">Rejected</div>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'all'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          All ({Array.isArray(applications) ? applications.length : 0})
        </button>
        {STATUS_OPTIONS.map(status => {
          const count = (Array.isArray(applications) ? applications : []).filter(a => a.status === status.value).length;
          if (count === 0) return null;
          return (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === status.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {status.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <Card className="text-center py-12">
          <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'No applications yet' : 'No applications with this status'}
          </h3>
          <p className="text-gray-500 mb-4">
            Start tracking your external job applications to keep everything organized.
          </p>
          {filter === 'all' && (
            <Button onClick={handleOpenCreate}>
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Your First Application
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map(app => (
            <Card key={app._id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{app.jobTitle}</h3>
                    {getStatusBadge(app.status)}
                    {app.verified && (
                      <Badge variant="success">
                        <CheckCircleIcon className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center text-gray-600 mb-2">
                    <BuildingOfficeIcon className="w-4 h-4 mr-1" />
                    <span className="font-medium">{app.company?.name}</span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    {app.company?.location && (
                      <span className="flex items-center">
                        <MapPinIcon className="w-4 h-4 mr-1" />
                        {app.company.location}
                      </span>
                    )}
                    {app.salary?.amount && (
                      <span className="flex items-center">
                        <CurrencyRupeeIcon className="w-4 h-4 mr-1" />
                        {app.salary.amount} {app.salary.currency || 'INR'}
                      </span>
                    )}
                    <span className="flex items-center">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Applied: {new Date(app.applicationDate).toLocaleDateString()}
                    </span>
                    {app.source && (
                      <span className="text-indigo-600">via {app.source}</span>
                    )}
                  </div>

                  {app.jobUrl && (
                    <a
                      href={app.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                    >
                      View Job Posting →
                    </a>
                  )}

                  {app.notes && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                      {app.notes}
                    </p>
                  )}

                  {/* Interview Rounds */}
                  {app.interviewRounds?.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Interview Rounds</h4>
                      <div className="flex flex-wrap gap-2">
                        {app.interviewRounds.map((round, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 text-xs rounded ${round.result === 'passed' ? 'bg-green-100 text-green-800' :
                              round.result === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {round.name || `Round ${idx + 1}`}
                            {round.date && ` - ${new Date(round.date).toLocaleDateString()}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Quick Status Update */}
                  <select
                    value={app.status}
                    onChange={(e) => handleStatusUpdate(app._id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleOpenEdit(app)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Edit"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, application: app })}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create', data: EMPTY_FORM })}
        title={formModal.mode === 'create' ? 'Add New Application' : 'Edit Application'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={formModal.data.companyName}
                onChange={(e) => handleFormChange('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={formModal.data.jobTitle}
                onChange={(e) => handleFormChange('jobTitle', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job URL
              </label>
              <input
                type="url"
                value={formModal.data.jobUrl}
                onChange={(e) => handleFormChange('jobUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formModal.data.location}
                onChange={(e) => handleFormChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="City, Remote, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary/CTC
              </label>
              <input
                type="text"
                value={formModal.data.salary}
                onChange={(e) => handleFormChange('salary', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., 4-6 LPA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Date *
              </label>
              <input
                type="date"
                value={formModal.data.applicationDate}
                onChange={(e) => handleFormChange('applicationDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formModal.data.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <input
                type="text"
                value={formModal.data.source}
                onChange={(e) => handleFormChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="LinkedIn, Naukri, Referral, etc."
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formModal.data.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Any additional notes about this application..."
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormModal({ open: false, mode: 'create', data: EMPTY_FORM })}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : formModal.mode === 'create' ? 'Add Application' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, application: null })}
        title="Delete Application"
        size="small"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete your application to{' '}
          <strong>{deleteModal.application?.company?.name || deleteModal.application?.companyName}</strong> for{' '}
          <strong>{deleteModal.application?.jobTitle}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setDeleteModal({ open: false, application: null })}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={bulkUploadModal}
        onClose={() => setBulkUploadModal(false)}
        type="selfApplications"
        onSuccess={() => {
          fetchApplications();
          setBulkUploadModal(false);
        }}
      />
    </div>
  );
}

export default SelfApplications;
