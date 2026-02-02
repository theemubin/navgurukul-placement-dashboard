import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { selfApplicationAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';
import { BulkUploadModal } from '../../components/common/BulkUpload';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  FunnelIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

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

function SelfApplicationsReview() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ status: 'all', verified: 'pending' }); // Default to pending
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModal, setDetailModal] = useState({ open: false, application: null });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appsRes, statsRes] = await Promise.all([
        selfApplicationAPI.getCampusApplications({ all: true }),
        selfApplicationAPI.getCampusStats()
      ]);
      setApplications(appsRes.data.selfApplications || []);
      setStats(statsRes.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (appId, verified) => {
    try {
      setProcessing(true);
      const notes = document.getElementById('verificationNotes')?.value || '';
      await selfApplicationAPI.verify(appId, {
        isVerified: verified,
        verificationNotes: notes
      });
      setDetailModal({ open: false, application: null });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify application');
    } finally {
      setProcessing(false);
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

  const filteredApplications = (Array.isArray(applications) ? applications : []).filter(app => {
    // Status filter
    if (filter.status !== 'all' && app.status !== filter.status) return false;

    // Verification filter
    const isActuallyVerified = app.isVerified === true;
    const isActuallyRejected = app.isVerified === false && app.verifiedBy;
    const isActuallyPending = app.isVerified === undefined || app.isVerified === null || (app.isVerified === false && !app.verifiedBy);

    if (filter.verified === 'verified' && !isActuallyVerified) return false;
    if (filter.verified === 'rejected' && !isActuallyRejected) return false;
    if (filter.verified === 'pending' && !isActuallyPending) return false;

    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const studentName = `${app.student?.firstName || ''} ${app.student?.lastName || ''}`.toLowerCase();
      return (
        studentName.includes(search) ||
        app.company?.name?.toLowerCase().includes(search) ||
        app.jobTitle?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const toggleStudent = (studentId) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const expandAll = () => {
    const allIds = Object.keys(groupedByStudent);
    const newExpanded = {};
    allIds.forEach(id => newExpanded[id] = true);
    setExpandedStudents(newExpanded);
  };

  const collapseAll = () => {
    setExpandedStudents({});
  };

  // Group by student
  const groupedByStudent = filteredApplications.reduce((acc, app) => {
    const studentId = app.student?._id || 'unknown';
    if (!acc[studentId]) {
      acc[studentId] = {
        student: app.student,
        applications: []
      };
    }
    acc[studentId].applications.push(app);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const tabCounts = {
    pending: (Array.isArray(applications) ? applications : []).filter(a => a.isVerified === undefined || a.isVerified === null || (a.isVerified === false && !a.verifiedBy)).length,
    verified: (Array.isArray(applications) ? applications : []).filter(a => a.isVerified === true).length,
    rejected: (Array.isArray(applications) ? applications : []).filter(a => a.isVerified === false && a.verifiedBy).length,
    all: (Array.isArray(applications) ? applications : []).length
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Self Applications Review</h1>
          <p className="mt-2 text-gray-600">
            Review and verify student self-reported job applications.
          </p>
        </div>
        <Button onClick={() => setBulkUploadModal(true)}>
          <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
          Bulk Upload
        </Button>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Applications</div>
          </Card>
          <Card className="text-center bg-blue-50">
            <div className="text-3xl font-bold text-blue-600">{stats.active}</div>
            <div className="text-sm text-gray-500">Active</div>
          </Card>
          <Card className="text-center bg-green-50">
            <div className="text-3xl font-bold text-green-600">{stats.offers}</div>
            <div className="text-sm text-gray-500">Offers</div>
          </Card>
          <Card className="text-center bg-emerald-50">
            <div className="text-3xl font-bold text-emerald-600">{stats.placed}</div>
            <div className="text-sm text-gray-500">Placed</div>
          </Card>
          <Card className="text-center bg-yellow-50">
            <div className="text-3xl font-bold text-yellow-600">{stats.unverified}</div>
            <div className="text-sm text-gray-500">Unverified</div>
          </Card>
        </div>
      )}

      {/* Verification Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8 overflow-x-auto">
          {[
            { id: 'pending', label: 'Pending Verification', count: tabCounts.pending, color: 'text-yellow-600', border: 'border-yellow-500' },
            { id: 'verified', label: 'Verified', count: tabCounts.verified, color: 'text-green-600', border: 'border-green-500' },
            { id: 'rejected', label: 'Rejected', count: tabCounts.rejected, color: 'text-red-600', border: 'border-red-500' },
            { id: 'all', label: 'All Applications', count: tabCounts.all, color: 'text-indigo-600', border: 'border-indigo-500' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(prev => ({ ...prev, verified: tab.id }))}
              className={`pb-4 px-1 text-sm font-bold border-b-2 transition-all whitespace-nowrap relative ${filter.verified === tab.id
                ? `${tab.border} ${tab.color}`
                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter ${filter.verified === tab.id ? `${tab.color} bg-white border border-current` : 'text-gray-500 bg-gray-100'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Filters & Search */}

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-64">
          <select
            value={filter.status}
            onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold shadow-sm"
          >
            <option value="all">All Job Statuses</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student, company, or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Students ({Object.keys(groupedByStudent).length})
        </h2>
        <div className="flex gap-2 text-xs">
          <button onClick={expandAll} className="text-indigo-600 hover:text-indigo-800 font-medium">Expand All</button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-indigo-600 hover:text-indigo-800 font-medium">Collapse All</button>
        </div>
      </div>

      {/* Applications by Student */}
      {Object.keys(groupedByStudent).length === 0 ? (
        <Card className="text-center py-12">
          <BuildingOfficeIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No applications found</h3>
          <p className="text-gray-500">
            No self-applications match your current filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.values(groupedByStudent).map(({ student, applications: studentApps }) => {
            const studentId = student?._id || 'unknown';
            const isExpanded = expandedStudents[studentId];
            return (
              <div key={studentId} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Student Header (Accordion Toggle) */}
                <button
                  onClick={() => toggleStudent(studentId)}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mr-4">
                      {student?.avatar ? (
                        <img src={student.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-indigo-500" />
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">
                        {student?.firstName} {student?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center">
                        {student?.email}
                        {student?.studentProfile?.currentSchool && (
                          <>
                            <span className="mx-2 font-light text-gray-300">|</span>
                            <span>{student.studentProfile.currentSchool}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xl font-black text-indigo-600 leading-none">{studentApps.length}</div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">Applications</div>
                    </div>
                    <div className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                      <ChevronDownIcon className="w-5 h-5" />
                    </div>
                  </div>
                </button>

                {/* Sub-applications (Accordion Content) */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-3 animate-fadeIn">
                    {studentApps.map(app => (
                      <div
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:border-indigo-300 active:scale-[0.99] group ${app.isVerified === true
                          ? 'border-green-100 bg-white/80'
                          : app.isVerified === false
                            ? 'border-red-100 bg-white/80'
                            : 'border-yellow-100 bg-white shadow-sm'
                          }`}
                        onClick={() => setDetailModal({ open: true, application: app })}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{app.jobTitle}</h4>
                              {getStatusBadge(app.status)}
                              {app.isVerified === true && (
                                <Badge variant="success">
                                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                              {app.isVerified === false && (
                                <Badge variant="danger">
                                  <XCircleIcon className="w-3 h-3 mr-1" />
                                  Rejected
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-2 gap-x-4 mb-3">
                              <div className="flex items-center text-sm font-medium text-gray-700">
                                <BuildingOfficeIcon className="w-4 h-4 mr-2 text-gray-400" />
                                {app.company?.name || app.companyName}
                              </div>
                              {app.company?.location && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <MapPinIcon className="w-4 h-4 mr-2 text-gray-400" />
                                  {app.company.location}
                                </div>
                              )}
                              {app.salary?.amount && (
                                <div className="flex items-center text-sm font-semibold text-green-700">
                                  <CurrencyRupeeIcon className="w-4 h-4 mr-2" />
                                  {app.salary.amount} {app.salary.currency || 'INR'}
                                </div>
                              )}
                              <div className="flex items-center text-sm text-gray-500">
                                <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                                {new Date(app.applicationDate).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-start opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-2 text-indigo-600 bg-indigo-50 rounded-lg font-bold text-xs uppercase">
                              Open Details
                            </div>
                          </div>
                        </div>

                        {/* Verification Notes In-App View */}
                        {app.verificationNotes && (
                          <div className="mt-3 text-xs italic text-gray-500 bg-white/50 p-2.5 rounded-lg border border-dashed border-gray-200">
                            <span className="font-bold text-gray-700 not-italic mr-1 text-[10px] uppercase">Review Comment:</span> {app.verificationNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Review & Action Modal */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, application: null })}
        title="Application Review Detail"
        size="large"
      >
        {detailModal.application && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Details */}
            <div className="flex-1 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Student</label>
                  <p className="font-bold text-gray-900">
                    {detailModal.application.student?.firstName} {detailModal.application.student?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{detailModal.application.student?.email}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Company & Title</label>
                  <p className="font-bold text-gray-900">{detailModal.application.company?.name}</p>
                  <p className="text-sm text-indigo-600 font-medium">{detailModal.application.jobTitle}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Salary Package</label>
                  <p className="font-bold text-green-700">
                    {detailModal.application.salary?.amount
                      ? `${detailModal.application.salary.amount} ${detailModal.application.salary.currency || 'INR'}`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Status</label>
                  <div>{getStatusBadge(detailModal.application.status)}</div>
                </div>
              </div>

              {detailModal.application.jobUrl && (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <ArrowTopRightOnSquareIcon className="w-5 h-5 text-indigo-500" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-indigo-900">Verification Source</p>
                    <a href={detailModal.application.jobUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 underline">
                      View Original Job Description
                    </a>
                  </div>
                </div>
              )}

              {detailModal.application.notes && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Student Remark</label>
                  <p className="text-sm text-gray-700 bg-white border border-gray-100 p-3 rounded-lg italic">
                    "{detailModal.application.notes}"
                  </p>
                </div>
              )}

              {detailModal.application.interviewRounds?.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block mb-1">Interview Timeline</label>
                  <div className="mt-2 space-y-2">
                    {detailModal.application.interviewRounds.map((round, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg">
                        <span className="text-sm font-medium text-gray-800">{round.name || `Round ${idx + 1}`}</span>
                        <Badge variant={round.result === 'passed' ? 'success' : round.result === 'failed' ? 'danger' : 'secondary'}>
                          {round.result || 'Ongoing'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Verification Action */}
            <div className="lg:w-80 space-y-4">
              <div className={`p-5 rounded-2xl border-2 ${detailModal.application.isVerified === true ? 'border-green-200 bg-green-50' : detailModal.application.isVerified === false ? 'border-red-200 bg-red-50' : 'border-indigo-100 bg-indigo-50'}`}>
                <h4 className="font-black text-gray-900 uppercase tracking-tighter text-lg mb-4">
                  {detailModal.application.isVerified === true ? 'Verified Application' : detailModal.application.isVerified === false ? 'Rejected Entry' : 'Action Required'}
                </h4>

                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Internal Review Notes</label>
                <textarea
                  id="verificationNotes"
                  className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-4"
                  rows={4}
                  placeholder="Explain your decision..."
                  defaultValue={detailModal.application.verificationNotes || ''}
                />

                <div className="space-y-3">
                  <Button
                    className="w-full font-bold shadow-lg shadow-indigo-200"
                    variant="primary"
                    disabled={processing}
                    onClick={() => handleVerify(detailModal.application._id, true)}
                  >
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Approve & Verify
                  </Button>
                  <Button
                    className="w-full font-bold"
                    variant="danger"
                    disabled={processing}
                    onClick={() => handleVerify(detailModal.application._id, false)}
                  >
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    Reject Application
                  </Button>
                </div>
              </div>

              {detailModal.application.verifiedBy && (
                <div className="text-[10px] text-center text-gray-400 font-medium">
                  Last action by {detailModal.application.verifiedBy.firstName} on {new Date(detailModal.application.verifiedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={bulkUploadModal}
        onClose={() => setBulkUploadModal(false)}
        type="selfApplicationsCampus"
        onSuccess={() => {
          fetchData();
          setBulkUploadModal(false);
        }}
      />
    </div>
  );
}

export default SelfApplicationsReview;
