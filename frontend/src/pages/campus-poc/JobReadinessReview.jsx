import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { jobReadinessAPI, userAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  UserIcon,
  AcademicCapIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

function JobReadinessReview() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending, all, job-ready
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reviewModal, setReviewModal] = useState({ open: false, student: null, criterion: null });
  const [approveModal, setApproveModal] = useState({ open: false, student: null });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [filter]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter === 'pending') params.status = 'pending';
      if (filter === 'job-ready') params.isJobReady = true;
      
      const res = await jobReadinessAPI.getCampusStudents(params);
      // API returns { records: [...], pagination: {...} }
      setStudents(res.data?.records || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCriterion = async (status) => {
    try {
      setProcessing(true);
      // reviewModal.student is a JobReadiness record, student._id is the actual User ID
      const studentId = reviewModal.student?.student?._id || reviewModal.student?.student;
      await jobReadinessAPI.verifyStudentCriterion(
        studentId,
        reviewModal.criterion.criteriaId,
        {
          verified: status === 'verified',
          verificationNotes: document.getElementById('verificationNotes')?.value || ''
        }
      );
      setReviewModal({ open: false, student: null, criterion: null });
      await fetchStudents();
      
      // Refresh selected student if viewing details
      if (selectedStudent?._id === reviewModal.student._id) {
        const updated = students.find(s => s._id === reviewModal.student._id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify criterion');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveJobReady = async () => {
    try {
      setProcessing(true);
      // approveModal.student is a JobReadiness record, student._id is the actual User ID
      const studentId = approveModal.student?.student?._id || approveModal.student?.student;
      await jobReadinessAPI.approveStudentJobReady(
        studentId,
        { notes: document.getElementById('approvalNotes')?.value || '' }
      );
      setApproveModal({ open: false, student: null });
      await fetchStudents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve student');
    } finally {
      setProcessing(false);
    }
  };

  const getProgressStats = (record) => {
    const criteria = record.criteriaStatus || [];
    const total = criteria.length;
    const verified = criteria.filter(c => c.status === 'verified').length;
    const pending = criteria.filter(c => c.status === 'completed').length; // Completed by student, awaiting verification
    const inProgress = criteria.filter(c => c.status === 'in_progress').length;
    return { total, verified, pending, inProgress };
  };

  const canApproveJobReady = (record) => {
    const stats = getProgressStats(record);
    return stats.verified === stats.total && stats.total > 0 && !record.isJobReady;
  };

  // Helper to get student name from record
  const getStudentName = (record) => {
    if (record.student) {
      return `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim() || 'Unknown';
    }
    return 'Unknown';
  };

  // Helper to get student email from record
  const getStudentEmail = (record) => {
    return record.student?.email || '';
  };

  const filteredStudents = students.filter(record => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const name = getStudentName(record).toLowerCase();
    const email = getStudentEmail(record).toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const getOverallStats = () => {
    const total = students.length;
    const jobReady = students.filter(s => s.isJobReady).length;
    const pendingReview = students.filter(s => {
      const stats = getProgressStats(s);
      return stats.pending > 0;
    }).length;
    return { total, jobReady, pendingReview };
  };

  const overallStats = getOverallStats();

  if (loading && students.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Job Readiness Review</h1>
        <p className="mt-2 text-gray-600">
          Review and verify student job readiness criteria submissions.
        </p>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="text-center">
          <div className="text-3xl font-bold text-gray-900">{overallStats.total}</div>
          <div className="text-sm text-gray-500">Total Students</div>
        </Card>
        <Card className="text-center bg-yellow-50">
          <div className="text-3xl font-bold text-yellow-600">{overallStats.pendingReview}</div>
          <div className="text-sm text-gray-500">Pending Review</div>
        </Card>
        <Card className="text-center bg-green-50">
          <div className="text-3xl font-bold text-green-600">{overallStats.jobReady}</div>
          <div className="text-sm text-gray-500">Job Ready</div>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
              filter === 'pending' 
                ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ClockIcon className="w-4 h-4 mr-2" />
            Pending Review
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Students
          </button>
          <button
            onClick={() => setFilter('job-ready')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
              filter === 'job-ready' 
                ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <TrophyIcon className="w-4 h-4 mr-2" />
            Job Ready
          </button>
        </div>

        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <Card className="text-center py-12">
          <UserIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
          <p className="text-gray-500">
            {filter === 'pending' 
              ? 'No students have pending criteria to review.'
              : 'No students match your search.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredStudents.map(record => {
            const stats = getProgressStats(record);
            const isJobReady = record.isJobReady;
            const studentName = getStudentName(record);
            const studentEmail = getStudentEmail(record);
            
            return (
              <Card 
                key={record._id} 
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  selectedStudent?._id === record._id ? 'ring-2 ring-indigo-500' : ''
                } ${isJobReady ? 'border-l-4 border-l-green-500' : ''}`}
                onClick={() => setSelectedStudent(selectedStudent?._id === record._id ? null : record)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                      <UserIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{studentName}</h3>
                        {isJobReady && (
                          <Badge variant="success">
                            <TrophyIcon className="w-3 h-3 mr-1" />
                            Job Ready
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{studentEmail}</p>
                      <p className="text-sm text-gray-500">{record.school}</p>
                      {record.readinessPercentage > 0 && (
                        <p className="text-xs text-indigo-600 font-medium">{record.readinessPercentage}% Complete</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">
                      {stats.verified}/{stats.total}
                    </div>
                    <div className="text-xs text-gray-500">Verified</div>
                    {stats.pending > 0 && (
                      <Badge variant="warning" className="mt-1">
                        {stats.pending} pending
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{ width: `${stats.total > 0 ? (stats.verified / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedStudent?._id === record._id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3">Criteria Details</h4>
                    <div className="space-y-2">
                      {record.criteriaStatus?.map(criterion => (
                        <div 
                          key={criterion.criteriaId}
                          className={`p-3 rounded-lg border flex items-center justify-between ${
                            criterion.status === 'verified' 
                              ? 'bg-green-50 border-green-200' 
                              : criterion.status === 'completed'
                              ? 'bg-yellow-50 border-yellow-200'
                              : criterion.status === 'in_progress'
                              ? 'bg-blue-50 border-blue-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center">
                            {criterion.status === 'verified' ? (
                              <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                            ) : criterion.status === 'completed' ? (
                              <ClockIcon className="w-5 h-5 text-yellow-600 mr-2" />
                            ) : criterion.status === 'in_progress' ? (
                              <ClockIcon className="w-5 h-5 text-blue-600 mr-2" />
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-300 rounded-full mr-2" />
                            )}
                            <div>
                              <span className="font-medium text-gray-900">{criterion.criteriaId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                              {criterion.proofUrl && (
                                <a 
                                  href={criterion.proofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 ml-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Proof
                                </a>
                              )}
                              {criterion.selfReportedValue && (
                                <span className="text-xs text-gray-500 ml-2">Value: {criterion.selfReportedValue}</span>
                              )}
                            </div>
                          </div>
                          
                          {criterion.status === 'completed' && (
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewModal({ open: true, student: record, criterion });
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Approve as Job Ready Button */}
                    {!isJobReady && canApproveJobReady(record) && (
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setApproveModal({ open: true, student: record });
                          }}
                        >
                          <TrophyIcon className="w-5 h-5 mr-2" />
                          Approve as Job Ready
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Criterion Modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, student: null, criterion: null })}
        title={`Review: ${reviewModal.criterion?.criteriaId?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''}`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              <strong>Student:</strong> {reviewModal.student ? getStudentName(reviewModal.student) : ''}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Criterion:</strong> {reviewModal.criterion?.criteriaId?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            {reviewModal.criterion?.selfReportedValue && (
              <p className="text-sm text-gray-500 mt-1">
                <strong>Self-reported value:</strong> {reviewModal.criterion.selfReportedValue}
              </p>
            )}
          </div>

          {reviewModal.criterion?.proofUrl && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Proof:</p>
              <a 
                href={reviewModal.criterion.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline flex items-center"
              >
                <EyeIcon className="w-4 h-4 mr-1" />
                View Document
              </a>
            </div>
          )}

          {reviewModal.criterion?.notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Student Notes:</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {reviewModal.criterion.notes}
              </p>
            </div>
          )}

          {reviewModal.criterion?.verificationNotes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Previous Verification Notes:</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {reviewModal.criterion.verificationNotes}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification Notes (optional)
            </label>
            <textarea
              id="verificationNotes"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Add notes about your decision..."
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => handleVerifyCriterion('rejected')}
              disabled={processing}
            >
              <XMarkIcon className="w-5 h-5 mr-1" />
              Reject
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleVerifyCriterion('verified')}
              disabled={processing}
            >
              <CheckIcon className="w-5 h-5 mr-1" />
              Verify
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Job Ready Modal */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, student: null })}
        title="Approve as Job Ready"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <TrophyIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-gray-900">
              Approve {approveModal.student ? getStudentName(approveModal.student) : ''} as Job Ready?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This student has completed and verified all job readiness criteria.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approval Notes (optional)
            </label>
            <textarea
              id="approvalNotes"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Congratulations message or additional notes..."
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setApproveModal({ open: false, student: null })}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleApproveJobReady}
              disabled={processing}
            >
              {processing ? 'Approving...' : 'Approve as Job Ready'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default JobReadinessReview;
