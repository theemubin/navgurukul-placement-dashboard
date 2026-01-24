import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userAPI, applicationAPI, jobReadinessAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import {
  ArrowLeft, User, Mail, Phone, GraduationCap, Linkedin,
  Github, Globe, FileText, Star, CheckCircle, XCircle, Clock,
  CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const POCStudentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [applications, setApplications] = useState([]);
  const [jobReadiness, setJobReadiness] = useState(null);
  const [jobReadinessConfig, setJobReadinessConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [recommendReason, setRecommendReason] = useState('');
  const [processing, setProcessing] = useState({});
  const [pocComments, setPocComments] = useState({});
  const [pocRatings, setPocRatings] = useState({});

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  const fetchStudentData = async () => {
    try {
      const [studentRes, appsRes, readinessRes, configRes] = await Promise.all([
        userAPI.getStudent(id),
        applicationAPI.getApplications({ student: id }),
        jobReadinessAPI.getStudentReadiness(id),
        jobReadinessAPI.getConfig()
      ]);
      setStudent(studentRes.data);
      setApplications(appsRes.data.applications);
      setJobReadiness(readinessRes.data);
      setJobReadinessConfig(configRes.data || []);
    } catch (error) {
      toast.error('Error loading student data');
      navigate('/campus-poc/students');
    } finally {
      setLoading(false);
    }
  };

  const handleSkillApproval = async (skillId, status) => {
    setProcessing(prev => ({ ...prev, [skillId]: true }));
    try {
      await userAPI.approveSkill(id, skillId, status);
      toast.success(`Skill ${status}`);
      fetchStudentData();
    } catch (error) {
      toast.error('Error processing skill');
    } finally {
      setProcessing(prev => ({ ...prev, [skillId]: false }));
    }
  };

  const handleRecommend = async () => {
    if (!selectedApplication || !recommendReason.trim()) return;

    try {
      await applicationAPI.addRecommendation(selectedApplication._id, recommendReason);
      toast.success('Recommendation added successfully');
      setShowRecommendModal(false);
      setSelectedApplication(null);
      setRecommendReason('');
      fetchStudentData();
    } catch (error) {
      toast.error('Error adding recommendation');
    }
  };

  const handlePocComment = async (criteriaId, comment) => {
    try {
      await jobReadinessAPI.addPocComment(id, criteriaId, comment);
      toast.success('Comment added');
      fetchStudentData();
    } catch (error) {
      toast.error('Error adding comment');
    }
  };

  const handlePocRating = async (criteriaId, rating) => {
    try {
      await jobReadinessAPI.addPocRating(id, criteriaId, rating);
      toast.success('Rating added');
      fetchStudentData();
    } catch (error) {
      toast.error('Error adding rating');
    }
  };

  const handleVerifyCriterion = async (criteriaId, status, notes = '') => {
    try {
      await jobReadinessAPI.verifyCriterion(id, criteriaId, status, notes);
      toast.success('Criterion verified');
      fetchStudentData();
    } catch (error) {
      toast.error('Error verifying criterion');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await userAPI.updateStudentStatus(id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      fetchStudentData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getCriteriaByCategory = () => {
    const categories = {};
    if (!jobReadinessConfig.length || !jobReadiness) return categories;

    // Find the config for this student's school
    const config = jobReadinessConfig.find(c => c.school === jobReadiness.school);
    if (!config) return categories;

    config.criteria.forEach(criterion => {
      if (!categories[criterion.category]) {
        categories[criterion.category] = [];
      }
      categories[criterion.category].push(criterion);
    });

    return categories;
  };

  const getStudentCriterionStatus = (criteriaId) => {
    return jobReadiness?.criteriaStatus?.find(cs => cs.criteriaId === criteriaId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!student) return null;

  const profile = student.studentProfile || {};

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Button */}
      <button
        onClick={() => navigate('/campus-poc/students')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </button>

      {/* Header Card */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
            <span className="text-primary-700 text-2xl font-bold">
              {student.firstName?.[0]}{student.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {student.firstName} {student.lastName}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4" />
                {student.email}
              </div>
              {student.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  {student.phone}
                </div>
              )}
              {profile.currentSchool && (
                <div className="flex items-center gap-2 text-gray-600">
                  <GraduationCap className="w-4 h-4" />
                  {profile.currentSchool}
                </div>
              )}
              {profile.currentModule && (
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4" />
                  Module: {profile.currentModule}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              {profile.linkedIn && (
                <a href={profile.linkedIn} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary-600">
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
              {profile.github && (
                <a href={profile.github} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-900">
                  <Github className="w-5 h-5" />
                </a>
              )}
              {profile.portfolio && (
                <a href={profile.portfolio} target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary-600">
                  <Globe className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <p className="text-3xl font-bold text-primary-600">{profile.cgpa || '-'}</p>
              <p className="text-sm text-gray-500">CGPA</p>
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 block mb-1">Student Status</span>
              <select
                value={profile.currentStatus || 'Active'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-sm font-semibold py-1.5 px-3 border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="Active">Active</option>
                <option value="Placed">Placed</option>
                <option value="Dropout">Dropout</option>
                <option value="Internship Paid">Internship (Paid)</option>
                <option value="Paid Project">Paid Project</option>
                <option value="Internship UnPaid">Internship (UnPaid)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills */}
        <div>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Skills</h2>
            {profile.skills?.length > 0 ? (
              <div className="space-y-3">
                {profile.skills.map((skillItem) => (
                  <div
                    key={skillItem.skill?._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {skillItem.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {skillItem.status === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
                      {skillItem.status === 'pending' && <Clock className="w-5 h-5 text-yellow-500" />}
                      <div>
                        <p className="font-medium">{skillItem.skill?.name}</p>
                        <p className="text-sm text-gray-500 capitalize">
                          {skillItem.skill?.category?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    {skillItem.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSkillApproval(skillItem.skill?._id, 'rejected')}
                          disabled={processing[skillItem.skill?._id]}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleSkillApproval(skillItem.skill?._id, 'approved')}
                          disabled={processing[skillItem.skill?._id]}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <StatusBadge status={skillItem.status} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No skills added</p>
            )}
          </div>
        </div>

        {/* Job Readiness */}
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Job Readiness Review
              </h2>
              <button
                onClick={() => navigate('/campus-poc/job-readiness-criteria')}
                className="btn btn-sm btn-outline"
              >
                Configure Criteria
              </button>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <p className="text-blue-800 text-sm">
                💡 <strong>Review Process:</strong> Rate student submissions, add feedback, then approve/reject each criterion.
              </p>
            </div>
            {jobReadiness ? (
              <div className="space-y-4">
                {Object.entries(getCriteriaByCategory()).map(([category, criteria]) => (
                  <div key={category} className="border rounded-lg p-3">
                    <h3 className="font-medium text-gray-900 mb-3 capitalize">
                      {category.replace('_', ' ')}
                    </h3>
                    <div className="space-y-3">
                      {criteria.map(criterion => {
                        const studentStatus = getStudentCriterionStatus(criterion.criteriaId);
                        return (
                          <div key={criterion.criteriaId} className="bg-gray-50 rounded p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900">
                                  {criterion.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {criterion.description}
                                </div>
                                {studentStatus?.selfReportedValue && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    Student response: {studentStatus.selfReportedValue}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {studentStatus?.status === 'verified' && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                                {studentStatus?.status === 'completed' && (
                                  <Clock className="w-4 h-4 text-yellow-500" />
                                )}
                                {studentStatus?.status === 'in_progress' && (
                                  <Clock className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                            </div>

                            {criterion.pocCommentRequired && (
                              <div className="mt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  {criterion.pocCommentTemplate || 'Your feedback'}
                                </label>
                                <div className="flex gap-2">
                                  <textarea
                                    className="flex-1 text-xs border rounded px-2 py-1"
                                    rows={2}
                                    placeholder="Add your comment..."
                                    value={pocComments[criterion.criteriaId] || studentStatus?.pocComment || ''}
                                    onChange={(e) => setPocComments(prev => ({
                                      ...prev,
                                      [criterion.criteriaId]: e.target.value
                                    }))}
                                  />
                                  <button
                                    onClick={() => handlePocComment(criterion.criteriaId, pocComments[criterion.criteriaId] || studentStatus?.pocComment || '')}
                                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            )}

                            {criterion.pocRatingRequired && (
                              <div className="mt-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Rating (1-{criterion.pocRatingScale})
                                </label>
                                <div className="flex gap-2 items-center">
                                  <select
                                    value={pocRatings[criterion.criteriaId] || studentStatus?.pocRating || ''}
                                    onChange={(e) => setPocRatings(prev => ({
                                      ...prev,
                                      [criterion.criteriaId]: parseInt(e.target.value)
                                    }))}
                                    className="text-xs border rounded px-2 py-1"
                                  >
                                    <option value="">Select rating...</option>
                                    {Array.from({ length: criterion.pocRatingScale }, (_, i) => i + 1).map(num => (
                                      <option key={num} value={num}>{num}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handlePocRating(criterion.criteriaId, pocRatings[criterion.criteriaId] || studentStatus?.pocRating)}
                                    className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                  >
                                    Save
                                  </button>
                                  {studentStatus?.pocRating && (
                                    <span className="text-xs text-green-600 font-medium">
                                      Current: {studentStatus.pocRating}/{criterion.pocRatingScale}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {studentStatus?.status === 'completed' && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleVerifyCriterion(criterion.criteriaId, 'verified')}
                                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => handleVerifyCriterion(criterion.criteriaId, 'rejected')}
                                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No job readiness data available</p>
            )}
          </div>
        </div>

        {/* About & Resume */}
        <div className="space-y-6">
          {profile.about && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-gray-600 text-sm">{profile.about}</p>
            </div>
          )}
          {profile.resume && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">Resume</h2>
              <a
                href={`/${profile.resume}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary-600 hover:underline"
              >
                <FileText className="w-5 h-5" />
                View Resume
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Applications */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Applications ({applications.length})</h2>
        {applications.length > 0 ? (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{app.job?.title}</p>
                  <p className="text-sm text-gray-500">{app.job?.company?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Applied: {format(new Date(app.createdAt), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={app.status} />
                  {!app.specialRecommendation?.isRecommended &&
                    ['applied', 'shortlisted', 'in_progress'].includes(app.status) && (
                      <button
                        onClick={() => {
                          setSelectedApplication(app);
                          setShowRecommendModal(true);
                        }}
                        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                      >
                        <Star className="w-4 h-4" />
                        Recommend
                      </button>
                    )}
                  {app.specialRecommendation?.isRecommended && (
                    <span className="flex items-center gap-1 text-sm text-purple-600">
                      <Star className="w-4 h-4 fill-current" />
                      Recommended
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No applications yet</p>
        )}
      </div>

      {/* Recommendation Modal */}
      {showRecommendModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 animate-fadeIn">
            <h3 className="text-lg font-semibold mb-2">Add Special Recommendation</h3>
            <p className="text-gray-600 text-sm mb-4">
              Recommend {student.firstName} for {selectedApplication.job?.title} at {selectedApplication.job?.company?.name}
            </p>
            <textarea
              rows={4}
              value={recommendReason}
              onChange={(e) => setRecommendReason(e.target.value)}
              placeholder="Why do you recommend this student for this role?"
              className="w-full mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRecommendModal(false);
                  setSelectedApplication(null);
                  setRecommendReason('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRecommend}
                disabled={!recommendReason.trim()}
                className="btn btn-primary"
              >
                Submit Recommendation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POCStudentDetails;
