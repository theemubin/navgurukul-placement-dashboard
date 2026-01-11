import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { jobAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' }
];

function InterestRequestsReview() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewModal, setReviewModal] = useState({ open: false, request: null });
  const [detailModal, setDetailModal] = useState({ open: false, request: null });
  const [processing, setProcessing] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [reviewForm, setReviewForm] = useState({ notes: '', rejectionReason: '' });

  useEffect(() => {
    fetchRequests();
  }, [filter, pagination.page]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await jobAPI.getAllInterestRequests({ 
        status: filter !== 'all' ? filter : undefined,
        page: pagination.page,
        limit: 20
      });
      setRequests(response.data.requests);
      setPagination({
        page: response.data.page,
        pages: response.data.pages,
        total: response.data.total
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load interest requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status) => {
    try {
      setProcessing(true);
      await jobAPI.reviewInterestRequest(reviewModal.request._id, {
        status,
        reviewNotes: reviewForm.notes,
        rejectionReason: status === 'rejected' ? reviewForm.rejectionReason : undefined
      });
      setReviewModal({ open: false, request: null });
      setReviewForm({ notes: '', rejectionReason: '' });
      await fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to review request');
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

  const getMatchColor = (percentage) => {
    if (percentage >= 60) return 'text-green-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredRequests = requests.filter(req => {
    if (!searchTerm) return true;
    const student = req.student;
    const job = req.job;
    const searchLower = searchTerm.toLowerCase();
    return (
      `${student?.firstName} ${student?.lastName}`.toLowerCase().includes(searchLower) ||
      student?.email?.toLowerCase().includes(searchLower) ||
      job?.title?.toLowerCase().includes(searchLower) ||
      job?.company?.name?.toLowerCase().includes(searchLower)
    );
  });

  const pendingCount = filter === 'all' ? 
    requests.filter(r => r.status === 'pending').length : 
    (filter === 'pending' ? pagination.total : 0);

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interest Requests</h1>
          <p className="text-gray-600 mt-1">
            Review student requests to apply for jobs they don't fully qualify for
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="warning" className="animate-pulse">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {filter === 'pending' ? pagination.total : '...'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {filter === 'approved' ? pagination.total : '...'}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {filter === 'rejected' ? pagination.total : '...'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPagination(p => ({ ...p, page: 1 }));
              }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, email, job title, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="p-8 text-center">
          <HeartIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No interest requests found</p>
          {filter === 'pending' && (
            <p className="text-sm text-gray-400 mt-2">
              No students have requested to apply for jobs they don't qualify for
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request._id} className={`p-4 border-l-4 ${
              request.status === 'pending' ? 'border-l-yellow-500 bg-yellow-50' :
              request.status === 'approved' ? 'border-l-green-500' :
              'border-l-red-500'
            }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Student & Job Info */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <UserIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {request.student?.firstName} {request.student?.lastName}
                      </h3>
                      <p className="text-sm text-gray-600">{request.student?.email}</p>
                      {request.student?.studentProfile?.enrollmentNumber && (
                        <p className="text-xs text-gray-500">
                          ID: {request.student.studentProfile.enrollmentNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 ml-2">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-800">{request.job?.title}</p>
                      <p className="text-sm text-gray-600">{request.job?.company?.name}</p>
                    </div>
                  </div>

                  {/* Match Score */}
                  <div className="flex items-center gap-2 ml-2">
                    <ChartBarIcon className="w-5 h-5 text-gray-400" />
                    <span className={`font-bold ${getMatchColor(request.matchDetails?.overallPercentage)}`}>
                      {request.matchDetails?.overallPercentage}% Match
                    </span>
                    <span className="text-xs text-gray-500">
                      (Skills: {request.matchDetails?.skillMatch?.matched || 0}/{request.matchDetails?.skillMatch?.required || 0})
                    </span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    <span className="text-xs text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDetailModal({ open: true, request })}
                    >
                      <EyeIcon className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                    {request.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setReviewModal({ open: true, request })}
                      >
                        Review
                      </Button>
                    )}
                  </div>

                  {request.reviewedBy && (
                    <p className="text-xs text-gray-500">
                      Reviewed by {request.reviewedBy?.firstName} {request.reviewedBy?.lastName}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            disabled={pagination.page === 1}
            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="secondary"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, request: null })}
        title="Interest Request Details"
        size="lg"
      >
        {detailModal.request && (
          <div className="space-y-6">
            {/* Student Info */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Student Information</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Name:</strong> {detailModal.request.student?.firstName} {detailModal.request.student?.lastName}</p>
                <p><strong>Email:</strong> {detailModal.request.student?.email}</p>
                {detailModal.request.student?.studentProfile?.currentSchool && (
                  <p><strong>School:</strong> {detailModal.request.student.studentProfile.currentSchool}</p>
                )}
                {detailModal.request.student?.studentProfile?.enrollmentNumber && (
                  <p><strong>Enrollment:</strong> {detailModal.request.student.studentProfile.enrollmentNumber}</p>
                )}
              </div>
            </div>

            {/* Job Info */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Job Information</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Title:</strong> {detailModal.request.job?.title}</p>
                <p><strong>Company:</strong> {detailModal.request.job?.company?.name}</p>
                {detailModal.request.job?.applicationDeadline && (
                  <p><strong>Deadline:</strong> {new Date(detailModal.request.job.applicationDeadline).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            {/* Match Details */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Match Analysis</h4>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className={`text-lg font-bold ${getMatchColor(detailModal.request.matchDetails?.overallPercentage)}`}>
                  Overall Match: {detailModal.request.matchDetails?.overallPercentage}%
                </p>
                <p>
                  <strong>Skills:</strong> {detailModal.request.matchDetails?.skillMatch?.matched || 0} / {detailModal.request.matchDetails?.skillMatch?.required || 0} matched 
                  ({detailModal.request.matchDetails?.skillMatch?.percentage || 0}%)
                </p>
                <p>
                  <strong>Requirements:</strong> {detailModal.request.matchDetails?.requirementsMatch?.met || 0} / {detailModal.request.matchDetails?.requirementsMatch?.total || 0} met
                </p>
              </div>
            </div>

            {/* Student's Reason */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Student's Reason</h4>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">{detailModal.request.reason}</p>
              </div>
            </div>

            {/* Acknowledged Gaps */}
            {detailModal.request.acknowledgedGaps?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Acknowledged Gaps</h4>
                <ul className="list-disc list-inside bg-yellow-50 p-4 rounded-lg">
                  {detailModal.request.acknowledgedGaps.map((gap, i) => (
                    <li key={i} className="text-gray-700">{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvement Plan */}
            {detailModal.request.improvementPlan && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Improvement Plan</h4>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{detailModal.request.improvementPlan}</p>
                </div>
              </div>
            )}

            {/* Review Info */}
            {detailModal.request.status !== 'pending' && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Review Information</h4>
                <div className={`p-4 rounded-lg ${
                  detailModal.request.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <p><strong>Status:</strong> {detailModal.request.status}</p>
                  {detailModal.request.reviewedBy && (
                    <p><strong>Reviewed By:</strong> {detailModal.request.reviewedBy.firstName} {detailModal.request.reviewedBy.lastName}</p>
                  )}
                  {detailModal.request.reviewedAt && (
                    <p><strong>Reviewed At:</strong> {new Date(detailModal.request.reviewedAt).toLocaleString()}</p>
                  )}
                  {detailModal.request.reviewNotes && (
                    <p><strong>Notes:</strong> {detailModal.request.reviewNotes}</p>
                  )}
                  {detailModal.request.rejectionReason && (
                    <p><strong>Rejection Reason:</strong> {detailModal.request.rejectionReason}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => {
          setReviewModal({ open: false, request: null });
          setReviewForm({ notes: '', rejectionReason: '' });
        }}
        title="Review Interest Request"
        size="md"
      >
        {reviewModal.request && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium">
                {reviewModal.request.student?.firstName} {reviewModal.request.student?.lastName}
              </p>
              <p className="text-sm text-gray-600">
                wants to apply for <strong>{reviewModal.request.job?.title}</strong> at {reviewModal.request.job?.company?.name}
              </p>
              <p className={`mt-2 font-bold ${getMatchColor(reviewModal.request.matchDetails?.overallPercentage)}`}>
                Match Score: {reviewModal.request.matchDetails?.overallPercentage}%
              </p>
            </div>

            {/* Reason Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student's Reason
              </label>
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                {reviewModal.request.reason}
              </div>
            </div>

            {/* Review Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                value={reviewForm.notes}
                onChange={(e) => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Add any notes about this review..."
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Rejection Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason (if rejecting)
              </label>
              <textarea
                value={reviewForm.rejectionReason}
                onChange={(e) => setReviewForm(f => ({ ...f, rejectionReason: e.target.value }))}
                rows={2}
                placeholder="Explain why the request is being rejected..."
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="success"
                className="flex-1"
                onClick={() => handleReview('approved')}
                disabled={processing}
              >
                <CheckIcon className="w-5 h-5 mr-1" />
                Approve
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => handleReview('rejected')}
                disabled={processing || !reviewForm.rejectionReason}
              >
                <XMarkIcon className="w-5 h-5 mr-1" />
                Reject
              </Button>
            </div>

            {!reviewForm.rejectionReason && (
              <p className="text-xs text-gray-500 text-center">
                Please provide a rejection reason before rejecting
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default InterestRequestsReview;
