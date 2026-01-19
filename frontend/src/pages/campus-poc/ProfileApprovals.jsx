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
  // Inline editing for soft skills (POC/Manager)
  const [editingSoftSkillKey, setEditingSoftSkillKey] = useState(null);
  const [editingSkillName, setEditingSkillName] = useState('');

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

  const openDetailsModal = async (student) => {
    try {
      // Fetch fresh student data to ensure latest changes and full fields are available
      const response = await userAPI.getStudent(student._id);
      setSelectedStudent(response.data);
      setShowDetailsModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load student details');
    }
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

  // Convert human skill name to canonical key (same logic as backend)
  const toKey = (name) => {
    if (!name) return '';
    return name.split(/\s+/).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join('');
  };

  // Save an edited soft skill (used when a soft skill has an empty name)
  const handleSaveSoftSkillEdit = async (s) => {
    if (!editingSkillName || !editingSkillName.trim()) {
      setError('Please provide a valid skill name');
      return;
    }

    try {
      setActionLoading(true);
      const newKey = toKey(editingSkillName.trim());
      if (!newKey) {
        setError('Invalid skill name');
        return;
      }

      // Send updates as softSkills map (merge happens on backend)
      const updates = { softSkills: { [newKey]: s.selfRating || 0 } };
      await userAPI.updateStudentProfile(selectedStudent._id, updates);

      // Refresh student data
      const response = await userAPI.getStudent(selectedStudent._id);
      setSelectedStudent(response.data);

      // Clear editing state
      setEditingSoftSkillKey(null);
      setEditingSkillName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update soft skill');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to get student profile data (handles both nested and flat structures)
  const getProfileData = (student) => {
    const sp = student.studentProfile || {};

    // Normalize soft skills: backend may provide array or object
    let softSkillsArray = [];
    let softSkillsMap = {};
    if (Array.isArray(sp.softSkills)) {
      // Preserve existing array entries and add a stable key
      softSkillsArray = sp.softSkills.map(s => {
        const skillKey = s.skillId ? (s.skillId.toString()) : toKey(s.skillName || '');
        return { ...s, skillKey };
      });
      softSkillsArray.forEach(s => {
        if (s && s.skillName) softSkillsMap[toKey(s.skillName)] = s.selfRating || 0;
      });
    } else if (typeof sp.softSkills === 'object' && sp.softSkills !== null) {
      softSkillsMap = sp.softSkills;
      for (const [k, v] of Object.entries(softSkillsMap)) {
        const skillName = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
        softSkillsArray.push({ skillKey: k, skillName, selfRating: v });
      }
    }

    // Snapshot normalization
    const snapshot = sp.lastApprovedSnapshot || {};
    const snapshotSoftArray = Array.isArray(snapshot.softSkills) ? snapshot.softSkills : (snapshot.softSkillsArray || []);

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
      softSkillsArray,
      softSkillsMap,
      snapshotSoftSkillsArray: snapshotSoftArray,
      // English
      englishProficiency: sp.englishProficiency || student.englishProficiency || {},
      // Roles
      openForRoles: sp.openForRoles || student.rolePreferences || [],
      // Courses
      courses: sp.courses || [],
      // Languages
      languages: sp.languages || [],
      snapshotLanguages: (sp.lastApprovedSnapshot && sp.lastApprovedSnapshot.languages) || [],
      // Council service
      councilService: sp.councilService || [],
      // Profile status
      profileStatus: sp.profileStatus || 'draft',
      lastSubmittedAt: sp.lastSubmittedAt,
      lastApprovedSnapshot: sp.lastApprovedSnapshot || null
    };
  };

  const getRatingLabel = (rating) => {
    const labels = ['Not Set', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
    return labels[rating] || 'Not Set';
  };

  // Helper to check if a field has changed
  const hasChanged = (currentValue, snapshotValue) => {
    if (!snapshotValue) return false;

    // Normalize values for comparison
    const normalize = (val) => {
      if (val === null || val === undefined) return '';
      return String(val).trim();
    };

    return normalize(currentValue) !== normalize(snapshotValue);
  };

  // Helper to check deeper objects (hometown, education)
  const isObjectChanged = (currentObj, snapshotObj, fields) => {
    if (!snapshotObj) return false;
    return fields.some(field => hasChanged(currentObj[field], snapshotObj[field]));
  };

  // Render a field with optional highlight
  const RenderField = ({ label, value, snapshotValue, className = '' }) => {
    const changed = hasChanged(value, snapshotValue);
    const isNew = snapshotValue === null || snapshotValue === undefined;

    return (
      <div className={`${className}`}>
        <span className="text-sm text-gray-500">{label}</span>
        <div className="font-medium">
          {changed ? (
            <div className="bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1">
              <span className="text-yellow-800">{value || 'Not provided'}</span>
              {snapshotValue && (
                <div className="text-xs text-red-500 mt-0.5 strike-through">
                  <span className="line-through opacity-75">{snapshotValue}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-900">{value || 'Not provided'}</span>
          )}
        </div>
      </div>
    );
  };

  // Calculate profile completion percentage
  const calculateCompletion = (student) => {
    const data = getProfileData(student);
    const softMap = data.softSkillsMap || {};
    const checks = [
      student.firstName && student.phone,
      data.hometown.pincode,
      data.currentSchool,
      data.tenthGrade.percentage,
      data.twelfthGrade.percentage,
      (data.technicalSkills || []).length > 0,
      Object.values(softMap).some(v => v > 0),
      data.englishProficiency.speaking,
      (data.openForRoles || []).length > 0,
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

        // Calculate changed sections for a short summary
        const changedSections = [];
        if (JSON.stringify(profileData.technicalSkills.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify((profileData.lastApprovedSnapshot?.technicalSkills || []).map(s => ({ n: s.skillName, r: s.selfRating })))) changedSections.push('Technical Skills');
        if (JSON.stringify(profileData.softSkillsArray.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify((profileData.lastApprovedSnapshot?.softSkills || profileData.lastApprovedSnapshot?.softSkillsArray || []).map(s => ({ n: s.skillName, r: s.selfRating })))) changedSections.push('Soft Skills');
        if (hasChanged(profileData.englishProficiency.speaking, profileData.lastApprovedSnapshot?.englishProficiency?.speaking) || hasChanged(profileData.englishProficiency.writing, profileData.lastApprovedSnapshot?.englishProficiency?.writing)) changedSections.push('English');
        if (JSON.stringify(profileData.higherEducation) !== JSON.stringify(profileData.lastApprovedSnapshot?.higherEducation || [])) changedSections.push('Higher Education');
        if (JSON.stringify(profileData.languages) !== JSON.stringify(profileData.snapshotLanguages || [])) changedSections.push('Languages');
        if (JSON.stringify(profileData.courses) !== JSON.stringify(profileData.lastApprovedSnapshot?.courses || [])) changedSections.push('Courses');
        if (JSON.stringify(profileData.councilService) !== JSON.stringify(profileData.lastApprovedSnapshot?.councilService || [])) changedSections.push('Council Service');
        if (JSON.stringify(profileData.openForRoles) !== JSON.stringify(profileData.lastApprovedSnapshot?.openForRoles || [])) changedSections.push('Open For Roles');

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

                {changedSections.length > 0 && (
                  <p className="text-xs text-yellow-800 mt-2">
                    <strong>Changes:</strong> {changedSections.join(', ')}
                  </p>
                )}
              </div>

              {/* Personal Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <RenderField
                    label="Email"
                    value={selectedStudent.email}
                    snapshotValue={null} // Email usually doesn't change here or isn't part of profile snapshot in same way
                  />
                  <RenderField
                    label="Phone"
                    value={selectedStudent.phone}
                    snapshotValue={profileData.lastApprovedSnapshot?.phone}
                  />
                  <RenderField
                    label="Date of Birth"
                    value={selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toLocaleDateString() : ''}
                    snapshotValue={profileData.lastApprovedSnapshot?.dateOfBirth ? new Date(profileData.lastApprovedSnapshot.dateOfBirth).toLocaleDateString() : ''}
                  />
                  <RenderField
                    label="Gender"
                    value={selectedStudent.gender}
                    snapshotValue={profileData.lastApprovedSnapshot?.gender}
                    className="capitalize"
                  />
                </div>
              </div>

              {/* Hometown */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Hometown</h3>
                <div className="grid grid-cols-2 gap-4">
                  <RenderField
                    label="Pincode"
                    value={profileData.hometown.pincode}
                    snapshotValue={profileData.lastApprovedSnapshot?.hometown?.pincode}
                  />
                  <RenderField
                    label="Village/Town"
                    value={profileData.hometown.village}
                    snapshotValue={profileData.lastApprovedSnapshot?.hometown?.village}
                  />
                  <RenderField
                    label="District"
                    value={profileData.hometown.district}
                    snapshotValue={profileData.lastApprovedSnapshot?.hometown?.district}
                  />
                  <RenderField
                    label="State"
                    value={profileData.hometown.state}
                    snapshotValue={profileData.lastApprovedSnapshot?.hometown?.state}
                  />
                </div>
              </div>

              {/* Current Education (Navgurukul) */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Current Education (Navgurukul)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <RenderField
                    label="School"
                    value={profileData.currentSchool}
                    snapshotValue={profileData.lastApprovedSnapshot?.currentSchool}
                  />
                  <RenderField
                    label="Specialization/Description"
                    value={profileData.specialization}
                    snapshotValue={profileData.lastApprovedSnapshot?.customModuleDescription}
                  />
                  <RenderField
                    label="Joining Date"
                    value={profileData.joiningDate ? new Date(profileData.joiningDate).toLocaleDateString() : ''}
                    snapshotValue={profileData.lastApprovedSnapshot?.joiningDate ? new Date(profileData.lastApprovedSnapshot.joiningDate).toLocaleDateString() : ''}
                  />
                  <RenderField
                    label="Current Module"
                    value={profileData.currentModule}
                    snapshotValue={profileData.lastApprovedSnapshot?.currentModule}
                  />
                </div>
              </div>

              {/* Previous Education */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Previous Education</h3>

                {/* 10th Grade */}
                {profileData.tenthGrade.percentage && (
                  <div className={`mb-4 ${isObjectChanged(profileData.tenthGrade, profileData.lastApprovedSnapshot?.tenthGrade, ['percentage', 'board', 'passingYear']) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                    <h4 className="font-medium text-gray-700 mb-2">
                      10th Grade
                      {isObjectChanged(profileData.tenthGrade, profileData.lastApprovedSnapshot?.tenthGrade, ['percentage', 'board', 'passingYear']) && (
                        <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                      )}
                    </h4>
                    <div className="grid grid-cols-3 gap-4 pl-4">
                      <RenderField
                        label="Percentage"
                        value={`${profileData.tenthGrade.percentage}%`}
                        snapshotValue={profileData.lastApprovedSnapshot?.tenthGrade?.percentage ? `${profileData.lastApprovedSnapshot.tenthGrade.percentage}%` : null}
                      />
                      <RenderField
                        label="Board"
                        value={profileData.tenthGrade.board}
                        snapshotValue={profileData.lastApprovedSnapshot?.tenthGrade?.board}
                      />
                      <RenderField
                        label="Year"
                        value={profileData.tenthGrade.passingYear}
                        snapshotValue={profileData.lastApprovedSnapshot?.tenthGrade?.passingYear}
                      />
                    </div>
                  </div>
                )}

                {/* 12th Grade */}
                {profileData.twelfthGrade.percentage && (
                  <div className={`mb-4 ${isObjectChanged(profileData.twelfthGrade, profileData.lastApprovedSnapshot?.twelfthGrade, ['percentage', 'board', 'stream', 'passingYear']) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                    <h4 className="font-medium text-gray-700 mb-2">
                      12th Grade
                      {isObjectChanged(profileData.twelfthGrade, profileData.lastApprovedSnapshot?.twelfthGrade, ['percentage', 'board', 'stream', 'passingYear']) && (
                        <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                      )}
                    </h4>
                    <div className="grid grid-cols-4 gap-4 pl-4">
                      <RenderField
                        label="Percentage"
                        value={`${profileData.twelfthGrade.percentage}%`}
                        snapshotValue={profileData.lastApprovedSnapshot?.twelfthGrade?.percentage ? `${profileData.lastApprovedSnapshot.twelfthGrade.percentage}%` : null}
                      />
                      <RenderField
                        label="Board"
                        value={profileData.twelfthGrade.board}
                        snapshotValue={profileData.lastApprovedSnapshot?.twelfthGrade?.board}
                      />
                      <RenderField
                        label="Stream"
                        value={profileData.twelfthGrade.stream}
                        snapshotValue={profileData.lastApprovedSnapshot?.twelfthGrade?.stream}
                      />
                      <RenderField
                        label="Year"
                        value={profileData.twelfthGrade.passingYear}
                        snapshotValue={profileData.lastApprovedSnapshot?.twelfthGrade?.passingYear}
                      />
                    </div>
                  </div>
                )}

                {/* Higher Education */}
                {profileData.higherEducation?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Higher Education</h4>
                    {profileData.higherEducation.map((edu, index) => {
                      // Try to find matching snapshot item by _id if possible, or fallback to index
                      const snapshotEdu = profileData.lastApprovedSnapshot?.higherEducation?.find(s => s._id === edu._id) ||
                        profileData.lastApprovedSnapshot?.higherEducation?.[index];

                      return (
                        <div key={index} className="grid grid-cols-4 gap-4 pl-4 mb-2 p-2 bg-gray-50 rounded">
                          <RenderField label="Degree" value={edu.degree} snapshotValue={snapshotEdu?.degree} />
                          <RenderField label="Institution" value={edu.institution} snapshotValue={snapshotEdu?.institution} />
                          <RenderField label="Field" value={edu.fieldOfStudy} snapshotValue={snapshotEdu?.fieldOfStudy} />
                          <RenderField label="Year" value={edu.endYear || edu.startYear} snapshotValue={snapshotEdu?.endYear || snapshotEdu?.startYear} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Courses */}
                {profileData.courses?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Courses Completed</h4>
                    <div className="space-y-2">
                      {profileData.courses.map((course, index) => {
                        const snapshotCourse = profileData.lastApprovedSnapshot?.courses?.find(c => c._id === course._id) ||
                          profileData.lastApprovedSnapshot?.courses?.[index];
                        const isChanged = snapshotCourse && (
                          course.courseName !== snapshotCourse.courseName ||
                          course.provider !== snapshotCourse.provider ||
                          course.completionDate !== snapshotCourse.completionDate
                        );

                        return (
                          <div key={index} className={`p-2 rounded flex items-center justify-between ${isChanged ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                            <div className="flex-1">
                              <RenderField label="Course" value={course.courseName} snapshotValue={snapshotCourse?.courseName} className="mb-1" />
                              <RenderField label="Provider" value={course.provider} snapshotValue={snapshotCourse?.provider} />
                            </div>
                            {course.completionDate && (
                              <RenderField
                                label="Date"
                                value={new Date(course.completionDate).toLocaleDateString()}
                                snapshotValue={snapshotCourse?.completionDate ? new Date(snapshotCourse.completionDate).toLocaleDateString() : null}
                                className="ml-4 text-right"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Technical Skills */}
              {profileData.technicalSkills?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.technicalSkills.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify(profileData.lastApprovedSnapshot?.technicalSkills?.map(s => ({ n: s.skillName, r: s.selfRating }))) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Technical Skills
                    {JSON.stringify(profileData.technicalSkills.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify(profileData.lastApprovedSnapshot?.technicalSkills?.map(s => ({ n: s.skillName, r: s.selfRating }))) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.technicalSkills.map((skill, index) => {
                      // Check if this specific skill is new or changed
                      const snapshotSkill = profileData.lastApprovedSnapshot?.technicalSkills?.find(s => s.skillName === skill.skillName || s.skillId === skill.skillId);
                      const isNew = !snapshotSkill;
                      const isChanged = snapshotSkill && snapshotSkill.selfRating !== skill.selfRating;

                      return (
                        <span
                          key={index}
                          className={`px-3 py-1 rounded-full text-sm ${isNew || isChanged ? 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-400' : 'bg-blue-100 text-blue-800'}`}
                        >
                          {skill.skillName || skill.name} {skill.selfRating ? `(${getRatingLabel(skill.selfRating)})` : skill.proficiency ? `(${skill.proficiency})` : ''}
                          {isChanged && <span className="text-xs ml-1 opacity-75">prev: {getRatingLabel(snapshotSkill.selfRating)}</span>}
                          {isNew && <span className="text-xs ml-1 text-green-700 font-bold">(New)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* English Proficiency */}
              {(profileData.englishProficiency.speaking || profileData.englishProficiency.writing) && (() => {
                const changedSpeaking = hasChanged(profileData.englishProficiency.speaking, profileData.lastApprovedSnapshot?.englishProficiency?.speaking);
                const changedWriting = hasChanged(profileData.englishProficiency.writing, profileData.lastApprovedSnapshot?.englishProficiency?.writing);
                const anyChanged = changedSpeaking || changedWriting;
                return (
                  <div className={`mb-6 ${anyChanged ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">English Proficiency (CEFR){anyChanged && <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <RenderField
                        label="Speaking"
                        value={profileData.englishProficiency.speaking ? `${profileData.englishProficiency.speaking} - ${getCEFRLabel(profileData.englishProficiency.speaking)}` : 'Not provided'}
                        snapshotValue={profileData.lastApprovedSnapshot?.englishProficiency?.speaking ? `${profileData.lastApprovedSnapshot.englishProficiency.speaking} - ${getCEFRLabel(profileData.lastApprovedSnapshot.englishProficiency.speaking)}` : null}
                      />
                      <RenderField
                        label="Writing"
                        value={profileData.englishProficiency.writing ? `${profileData.englishProficiency.writing} - ${getCEFRLabel(profileData.englishProficiency.writing)}` : 'Not provided'}
                        snapshotValue={profileData.lastApprovedSnapshot?.englishProficiency?.writing ? `${profileData.lastApprovedSnapshot.englishProficiency.writing} - ${getCEFRLabel(profileData.lastApprovedSnapshot.englishProficiency.writing)}` : null}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Soft Skills */}
              {profileData.softSkillsArray.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.softSkillsArray.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify(profileData.snapshotSoftSkillsArray?.map(s => ({ n: s.skillName, r: s.selfRating })) || []) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Soft Skills
                    {JSON.stringify(profileData.softSkillsArray.map(s => ({ n: s.skillName, r: s.selfRating }))) !== JSON.stringify(profileData.snapshotSoftSkillsArray?.map(s => ({ n: s.skillName, r: s.selfRating })) || []) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {profileData.softSkillsArray.map((s, idx) => {
                      const keyProp = s.skillKey || s.skillName || `soft-${idx}`;
                      const snapshotRating = (profileData.snapshotSoftSkillsArray || []).find(ps => ps.skillName === s.skillName)?.selfRating;
                      const changed = snapshotRating !== undefined && snapshotRating !== s.selfRating;
                      const isEmptyName = !s.skillName || !String(s.skillName).trim();

                      return (
                        <div key={`${keyProp}-${idx}`} className={`flex items-center justify-between p-2 rounded ${changed ? 'bg-yellow-100 ring-1 ring-yellow-300' : 'bg-purple-50'}`}>
                          <div className="flex flex-col">
                            {isEmptyName ? (
                              editingSoftSkillKey === keyProp ? (
                                <div className="flex gap-2 items-center">
                                  <input value={editingSkillName} onChange={e => setEditingSkillName(e.target.value)} className="border p-1 rounded text-sm" placeholder="Skill name" />
                                  <Button size="sm" variant="primary" onClick={() => handleSaveSoftSkillEdit(s)}>Save</Button>
                                  <Button size="sm" variant="secondary" onClick={() => { setEditingSoftSkillKey(null); setEditingSkillName(''); }}>Cancel</Button>
                                </div>
                              ) : (
                                <div className="flex gap-2 items-center">
                                  <span className="text-sm italic text-gray-500">Unnamed skill</span>
                                  <Button size="sm" variant="secondary" onClick={() => { setEditingSoftSkillKey(keyProp); setEditingSkillName(s.skillName || ''); }}>Edit</Button>
                                </div>
                              )
                            ) : (
                              <>
                                <span className="text-sm">{s.skillName}</span>
                                {changed && <span className="text-xs text-gray-500">Prev: {getRatingLabel(snapshotRating)}</span>}
                              </>
                            )}
                          </div>
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">{getRatingLabel(s.selfRating)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Role Preferences / Open For Roles */}
              {profileData.openForRoles?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.openForRoles.sort()) !== JSON.stringify(profileData.lastApprovedSnapshot?.openForRoles?.sort()) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Open For Roles
                    {JSON.stringify(profileData.openForRoles.sort()) !== JSON.stringify(profileData.lastApprovedSnapshot?.openForRoles?.sort()) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.openForRoles.map((role, index) => {
                      const wasSelected = profileData.lastApprovedSnapshot?.openForRoles?.includes(role);
                      const isNew = profileData.lastApprovedSnapshot && !wasSelected;

                      return (
                        <span key={index} className={`px-3 py-1 rounded-full text-sm ${isNew ? 'bg-yellow-200 text-yellow-900 border border-yellow-400' : 'bg-green-100 text-green-800'}`}>
                          {index + 1}. {role}
                          {isNew && <span className="ml-1 text-xs font-bold">(New)</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Higher Education */}
              {profileData.higherEducation?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.higherEducation) !== JSON.stringify(profileData.lastApprovedSnapshot?.higherEducation || []) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Higher Education
                    {JSON.stringify(profileData.higherEducation) !== JSON.stringify(profileData.lastApprovedSnapshot?.higherEducation || []) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {profileData.higherEducation.map((edu, idx) => {
                      const snapshotEdu = (profileData.lastApprovedSnapshot?.higherEducation || []).find(h => h.institution === edu.institution && h.degree === edu.degree);
                      const changed = !!snapshotEdu && (snapshotEdu.percentage !== edu.percentage || snapshotEdu.startYear !== edu.startYear || snapshotEdu.endYear !== edu.endYear);
                      const isNew = !snapshotEdu;
                      return (
                        <div key={idx} className={`p-3 rounded ${changed || isNew ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                          <p className="font-medium">{edu.institution} - {edu.degree}</p>
                          <p className="text-xs text-gray-500">{edu.startYear || ''} - {edu.endYear || ''} {edu.percentage ? `• ${edu.percentage}%` : ''} {isNew && <span className="text-xs text-green-700 font-bold ml-2">(New)</span>}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Languages */}
              {profileData.languages?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.languages) !== JSON.stringify(profileData.snapshotLanguages || []) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Languages
                    {JSON.stringify(profileData.languages) !== JSON.stringify(profileData.snapshotLanguages || []) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {profileData.languages.map((lang, idx) => {
                      const snapshotLang = (profileData.snapshotLanguages || []).find(l => l.language === lang.language);
                      const changed = !!snapshotLang && (snapshotLang.speaking !== lang.speaking || snapshotLang.writing !== lang.writing);
                      const isNew = !snapshotLang;
                      return (
                        <div key={idx} className={`p-3 rounded ${changed || isNew ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                          <p className="font-medium">{lang.language} <span className="text-xs text-gray-500 ml-2">S:{lang.speaking || 'N/A'} W:{lang.writing || 'N/A'}</span></p>
                          {isNew && <p className="text-xs text-green-700 font-bold">(New)</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Courses */}
              {profileData.courses?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.courses) !== JSON.stringify(profileData.lastApprovedSnapshot?.courses || []) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Courses
                    {JSON.stringify(profileData.courses) !== JSON.stringify(profileData.lastApprovedSnapshot?.courses || []) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {profileData.courses.map((course, idx) => {
                      const snapshotCourse = (profileData.lastApprovedSnapshot?.courses || []).find(c => c.courseName === course.courseName);
                      const changed = !!snapshotCourse && snapshotCourse.certificateUrl !== course.certificateUrl;
                      const isNew = !snapshotCourse;
                      return (
                        <div key={idx} className={`p-3 rounded ${changed || isNew ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                          <p className="font-medium">{course.courseName} <span className="text-xs text-gray-500 ml-2">{course.provider}</span></p>
                          {isNew && <p className="text-xs text-green-700 font-bold">(New)</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Council Service */}
              {profileData.councilService?.length > 0 && (
                <div className={`mb-6 ${JSON.stringify(profileData.councilService) !== JSON.stringify(profileData.lastApprovedSnapshot?.councilService || []) ? 'bg-yellow-50 p-3 rounded border border-yellow-200' : ''}`}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                    Council Service
                    {JSON.stringify(profileData.councilService) !== JSON.stringify(profileData.lastApprovedSnapshot?.councilService || []) && (
                      <span className="ml-2 text-xs text-yellow-700 font-normal">(Changed)</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {profileData.councilService.map((c, idx) => {
                      const snapshotC = (profileData.lastApprovedSnapshot?.councilService || []).find(s => s.post === c.post && s.monthsServed === c.monthsServed);
                      const isNew = !snapshotC;
                      return (
                        <div key={idx} className={`p-3 rounded ${isNew ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                          <p className="font-medium">{c.post} • {c.monthsServed} months {c.status ? `• ${c.status}` : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resume */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Resume</h3>
                <div>
                  {selectedStudent.studentProfile?.resume ? (
                    <div className="p-3 bg-gray-50 rounded">
                      <a href={`/${selectedStudent.studentProfile.resume}`} target="_blank" rel="noreferrer" className="text-primary-600">View Resume</a>
                    </div>
                  ) : selectedStudent.studentProfile?.resumeLink ? (
                    <div className="p-3 bg-gray-50 rounded">
                      <a href={selectedStudent.studentProfile.resumeLink} target="_blank" rel="noreferrer" className="text-primary-600">Resume Link</a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No resume uploaded</p>
                  )}
                </div>
              </div>

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
