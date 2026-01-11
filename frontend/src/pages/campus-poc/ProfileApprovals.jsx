import { useState, useEffect } from 'react';
import { userAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';

const ProfileApprovals = () => {
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingProfiles();
  }, []);

  const fetchPendingProfiles = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getPendingProfiles();
      setPendingProfiles(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch pending profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studentId) => {
    try {
      setActionLoading(true);
      await userAPI.approveProfile(studentId, 'approved');
      setSuccess('Profile approved successfully');
      setShowDetailsModal(false);
      fetchPendingProfiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComments.trim()) {
      setError('Please provide comments for requesting changes');
      return;
    }
    
    try {
      setActionLoading(true);
      await userAPI.requestProfileChanges(selectedStudent._id, rejectComments);
      setSuccess('Changes requested successfully');
      setShowRejectModal(false);
      setShowDetailsModal(false);
      setRejectComments('');
      fetchPendingProfiles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request changes');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetailsModal = (student) => {
    setSelectedStudent(student);
    setShowDetailsModal(true);
  };

  const openRejectModal = () => {
    setShowRejectModal(true);
  };

  const getCEFRLabel = (level) => {
    const labels = {
      'A1': 'Beginner',
      'A2': 'Elementary',
      'B1': 'Intermediate',
      'B2': 'Upper Intermediate',
      'C1': 'Advanced',
      'C2': 'Proficient'
    };
    return labels[level] || level;
  };

  const getProficiencyColor = (proficiency) => {
    const colors = {
      beginner: 'bg-red-100 text-red-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-green-100 text-green-800',
      expert: 'bg-blue-100 text-blue-800'
    };
    return colors[proficiency] || 'bg-gray-100 text-gray-800';
  };

  // Helper to get student profile data (handles both nested and flat structures)
  const getProfileData = (student) => {
    const sp = student.studentProfile || {};
    return {
      // Hometown
      hometown: sp.hometown || student.hometown || {},
      // Current Education
      currentSchool: sp.currentSchool || student.currentEducation?.school || '',
      joiningDate: sp.joiningDate || sp.dateOfJoining || student.currentEducation?.joiningDate || null,
      currentModule: sp.currentModule || student.currentEducation?.currentModule || '',
      specialization: sp.customModuleDescription || student.currentEducation?.specialization || '',
      // Previous Education
      tenthGrade: sp.tenthGrade || student.tenthGrade || {},
      twelfthGrade: sp.twelfthGrade || student.twelfthGrade || {},
      higherEducation: sp.higherEducation || [],
      degree: student.degree || {},
      // Skills
      technicalSkills: sp.technicalSkills || student.technicalSkills || [],
      softSkills: sp.softSkills || student.softSkills || {},
      // English
      englishProficiency: sp.englishProficiency || student.englishProficiency || {},
      // Roles
      openForRoles: sp.openForRoles || student.rolePreferences || [],
      // Courses
      courses: sp.courses || [],
      // Profile status
      profileStatus: sp.profileStatus || 'draft',
      lastSubmittedAt: sp.lastSubmittedAt,
    };
  };

  const getRatingLabel = (rating) => {
    const labels = ['Not Set', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
    return labels[rating] || 'Not Set';
  };

  // Calculate profile completion percentage
  const calculateCompletion = (student) => {
    const data = getProfileData(student);
    const checks = [
      student.firstName && student.phone,
      data.hometown.pincode,
      data.currentSchool,
      data.tenthGrade.percentage,
      data.twelfthGrade.percentage,
      data.technicalSkills.length > 0,
      Object.values(data.softSkills).some(v => v > 0),
      data.englishProficiency.speaking,
      data.openForRoles.length > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile Approvals</h1>
        <p className="text-gray-600 mt-1">Review and approve student profiles</p>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" onClose={() => setSuccess(null)} className="mb-4">
          {success}
        </Alert>
      )}

      {pendingProfiles.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Pending Profiles</h3>
            <p className="mt-1 text-gray-500">All student profiles have been reviewed.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingProfiles.map((student) => {
            const completion = calculateCompletion(student);
            return (
            <Card key={student._id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-lg">
                      {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">
                      {student.firstName} {student.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>

              {/* Profile Completion Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Profile Completion</span>
                  <span className={`font-semibold ${completion >= 80 ? 'text-green-600' : completion >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{completion}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${completion >= 80 ? 'bg-green-500' : completion >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-24">School:</span>
                  <span className="text-gray-900">{student.studentProfile?.currentSchool || student.currentEducation?.school || 'Not set'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-24">Module:</span>
                  <span className="text-gray-900">{student.studentProfile?.currentModule || student.currentEducation?.currentModule || 'Not set'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-24">Location:</span>
                  <span className="text-gray-900">
                    {student.studentProfile?.hometown?.district 
                      ? `${student.studentProfile.hometown.district}, ${student.studentProfile.hometown.state}` 
                      : (student.hometown?.district ? `${student.hometown.district}, ${student.hometown.state}` : 'Not set')}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-gray-500 w-24">Roles:</span>
                  <span className="text-gray-900">
                    {(student.studentProfile?.openForRoles?.length > 0 || student.rolePreferences?.length > 0)
                      ? `${(student.studentProfile?.openForRoles || student.rolePreferences).slice(0, 2).join(', ')}${(student.studentProfile?.openForRoles || student.rolePreferences).length > 2 ? '...' : ''}`
                      : 'Not set'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => openDetailsModal(student)}
                >
                  View Details
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleApprove(student._id)}
                >
                  Approve
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedStudent && (() => {
        const profileData = getProfileData(selectedStudent);
        const completionPercent = calculateCompletion(selectedStudent);
        
        return (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`${selectedStudent.firstName} ${selectedStudent.lastName}'s Profile`}
          size="xl"
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Profile Completion Bar */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Profile Completion</span>
                <span className="text-sm font-bold text-primary-600">{completionPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${completionPercent >= 80 ? 'bg-green-500' : completionPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              {profileData.lastSubmittedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Submitted: {new Date(profileData.lastSubmittedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Personal Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Email</span>
                  <p className="font-medium">{selectedStudent.email}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Phone</span>
                  <p className="font-medium">{selectedStudent.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Date of Birth</span>
                  <p className="font-medium">
                    {selectedStudent.dateOfBirth 
                      ? new Date(selectedStudent.dateOfBirth).toLocaleDateString() 
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Gender</span>
                  <p className="font-medium capitalize">{selectedStudent.gender || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Hometown */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Hometown</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Pincode</span>
                  <p className="font-medium">{profileData.hometown.pincode || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Village/Town</span>
                  <p className="font-medium">{profileData.hometown.village || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">District</span>
                  <p className="font-medium">{profileData.hometown.district || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">State</span>
                  <p className="font-medium">{profileData.hometown.state || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Current Education (Navgurukul) */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Current Education (Navgurukul)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">School</span>
                  <p className="font-medium">{profileData.currentSchool || 'Not provided'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Specialization/Description</span>
                  <p className="font-medium">{profileData.specialization || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Joining Date</span>
                  <p className="font-medium">
                    {profileData.joiningDate 
                      ? new Date(profileData.joiningDate).toLocaleDateString() 
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Current Module</span>
                  <p className="font-medium">{profileData.currentModule || 'Not provided'}</p>
                </div>
              </div>
            </div>

            {/* Previous Education */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Previous Education</h3>
              
              {/* 10th Grade */}
              {profileData.tenthGrade.percentage && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">10th Grade</h4>
                  <div className="grid grid-cols-3 gap-4 pl-4">
                    <div>
                      <span className="text-sm text-gray-500">Percentage</span>
                      <p className="font-medium">{profileData.tenthGrade.percentage}%</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Board</span>
                      <p className="font-medium">{profileData.tenthGrade.board || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Year of Passing</span>
                      <p className="font-medium">{profileData.tenthGrade.passingYear || profileData.tenthGrade.yearOfPassing || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 12th Grade */}
              {profileData.twelfthGrade.percentage && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">12th Grade</h4>
                  <div className="grid grid-cols-4 gap-4 pl-4">
                    <div>
                      <span className="text-sm text-gray-500">Percentage</span>
                      <p className="font-medium">{profileData.twelfthGrade.percentage}%</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Board</span>
                      <p className="font-medium">{profileData.twelfthGrade.board || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Stream</span>
                      <p className="font-medium">{profileData.twelfthGrade.stream || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Year of Passing</span>
                      <p className="font-medium">{profileData.twelfthGrade.passingYear || profileData.twelfthGrade.yearOfPassing || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Higher Education */}
              {profileData.higherEducation?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Higher Education</h4>
                  {profileData.higherEducation.map((edu, index) => (
                    <div key={index} className="grid grid-cols-4 gap-4 pl-4 mb-2 p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm text-gray-500">Degree</span>
                        <p className="font-medium">{edu.degree || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Institution</span>
                        <p className="font-medium">{edu.institution || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Field</span>
                        <p className="font-medium">{edu.fieldOfStudy || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Year</span>
                        <p className="font-medium">{edu.endYear || edu.startYear || 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Courses */}
              {profileData.courses?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">Courses Completed</h4>
                  <div className="space-y-2">
                    {profileData.courses.map((course, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded flex items-center justify-between">
                        <div>
                          <p className="font-medium">{course.courseName}</p>
                          <p className="text-sm text-gray-500">{course.provider}</p>
                        </div>
                        {course.completionDate && (
                          <span className="text-xs text-gray-400">
                            {new Date(course.completionDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Technical Skills */}
            {profileData.technicalSkills?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Technical Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.technicalSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {skill.skillName || skill.name} {skill.selfRating ? `(${getRatingLabel(skill.selfRating)})` : skill.proficiency ? `(${skill.proficiency})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* English Proficiency */}
            {(profileData.englishProficiency.speaking || profileData.englishProficiency.writing) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">English Proficiency (CEFR)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Speaking</span>
                    <p className="font-medium">
                      {profileData.englishProficiency.speaking ? `${profileData.englishProficiency.speaking} - ${getCEFRLabel(profileData.englishProficiency.speaking)}` : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Writing</span>
                    <p className="font-medium">
                      {profileData.englishProficiency.writing ? `${profileData.englishProficiency.writing} - ${getCEFRLabel(profileData.englishProficiency.writing)}` : 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Soft Skills */}
            {Object.values(profileData.softSkills).some(v => v > 0) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Soft Skills</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(profileData.softSkills).filter(([_, v]) => v > 0).map(([skill, rating]) => (
                    <div key={skill} className="flex items-center justify-between p-2 bg-purple-50 rounded">
                      <span className="text-sm capitalize">{skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">{getRatingLabel(rating)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role Preferences / Open For Roles */}
            {profileData.openForRoles?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Open For Roles</h3>
                <div className="flex flex-wrap gap-2">
                  {profileData.openForRoles.map((role, index) => (
                    <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {index + 1}. {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Approval History */}
            {selectedStudent.approvalHistory?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Approval History</h3>
                <div className="space-y-3">
                  {selectedStudent.approvalHistory.map((history, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Badge variant={history.status === 'approved' ? 'success' : history.status === 'changes_requested' ? 'warning' : 'default'}>
                          {history.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(history.reviewedAt).toLocaleString()}
                        </span>
                      </div>
                      {history.comments && (
                        <p className="mt-2 text-sm text-gray-600">{history.comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowDetailsModal(false)}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={openRejectModal}
              disabled={actionLoading}
            >
              Request Changes
            </Button>
            <Button
              variant="primary"
              onClick={() => handleApprove(selectedStudent._id)}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Approve Profile'}
            </Button>
          </div>
        </Modal>
        );
      })()}

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectComments('');
          }}
          title="Request Profile Changes"
          size="md"
        >
          <div>
            <p className="text-gray-600 mb-4">
              Please provide feedback on what changes the student needs to make to their profile.
            </p>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              placeholder="Enter your comments and feedback..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
            />
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectComments('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={actionLoading || !rejectComments.trim()}
              >
                {actionLoading ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProfileApprovals;
