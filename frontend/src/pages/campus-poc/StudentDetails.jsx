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
  const [showDisapproveModal, setShowDisapproveModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [recommendReason, setRecommendReason] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
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
      setApplications(appsRes.data.applications || []);
      setJobReadiness(readinessRes.data.readiness);
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

  const handleDisapproveProfile = async () => {
    if (!revisionNotes.trim()) {
      toast.error('Please provide revision notes');
      return;
    }
    setProcessing(prev => ({ ...prev, disapproving: true }));
    try {
      await userAPI.requestProfileChanges(id, revisionNotes);
      toast.success('Profile sent back for revision');
      setShowDisapproveModal(false);
      setRevisionNotes('');
      fetchStudentData();
    } catch (error) {
      toast.error('Failed to disapprove profile');
    } finally {
      setProcessing(prev => ({ ...prev, disapproving: false }));
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

    const school = jobReadiness.school;
    const config = jobReadinessConfig.find(c => c.school === school);
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

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      {Icon && <Icon className="w-4 h-4 text-gray-400 mt-1 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-sm font-medium ${value ? 'text-gray-900' : 'text-gray-300 italic'}`}>
          {value || 'Empty'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Navigation & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <button
          onClick={() => navigate('/campus-poc/students')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">PROFILE STATUS:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter shadow-sm
            ${profile.profileStatus === 'approved' ? 'bg-green-100 text-green-700' :
              profile.profileStatus === 'needs_revision' ? 'bg-red-100 text-red-700' :
                profile.profileStatus === 'pending_approval' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                  'bg-gray-100 text-gray-700'}`}>
            {profile.profileStatus?.replace('_', ' ') || 'Draft'}
          </span>
        </div>
      </div>

      {/* Primary Bio Card */}
      <div className="card !p-0 overflow-hidden border-2">
        <div className="bg-primary-600 h-24 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-primary-50 flex items-center justify-center border-2 border-primary-100">
                <span className="text-primary-700 text-3xl font-extrabold">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-12 pb-6 px-6">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                {student.firstName} {student.lastName}
              </h1>
              <p className="text-gray-500 font-medium">{profile.currentSchool} • {profile.currentModule || 'General'}</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {profile.linkedIn && (
                  <a href={profile.linkedIn} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                {profile.github && (
                  <a href={profile.github} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">
                    <Github className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
                {profile.resumeLink && (
                  <a href={profile.resumeLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Resume Link
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 bg-gray-50 md:bg-transparent p-4 md:p-0 rounded-2xl">
              <div className="text-center md:text-right">
                <p className="text-3xl font-black text-primary-600 leading-none">{profile.cgpa || 'N/A'}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Current CGPA</p>
              </div>
              <div className="w-px h-8 bg-gray-200 md:hidden" />
              <div className="text-center md:text-right">
                <select
                  value={profile.currentStatus || 'Active'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs font-bold py-2 px-3 border-2 border-primary-100 rounded-xl bg-white focus:ring-4 focus:ring-primary-50 appearance-none text-primary-700 shadow-sm"
                >
                  <option value="Active">🟢 Active</option>
                  <option value="Placed">🎉 Placed</option>
                  <option value="Dropout">🛑 Dropout</option>
                  <option value="Internship Paid">💼 Paid Intern</option>
                  <option value="Paid Project">🔨 Paid Project</option>
                  <option value="Internship UnPaid">📝 Unpaid Intern</option>
                </select>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Placememt Status</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal & Contact */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 pb-2 border-b">Contact & Identity</h3>
            <div className="space-y-1">
              <InfoRow label="Email Address" value={student.email} icon={Mail} />
              <InfoRow label="Phone Number" value={student.phone} icon={Phone} />
              <InfoRow label="Gender" value={student.gender} icon={User} />
              <InfoRow label="House Name" value={profile.houseName} icon={GraduationCap} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 pb-2 border-b">Hometown</h3>
            <div className="space-y-1">
              <InfoRow label="State" value={profile.hometown?.state} />
              <InfoRow label="District" value={profile.hometown?.district} />
              <InfoRow label="Village / City" value={profile.hometown?.village} />
              <InfoRow label="Pincode" value={profile.hometown?.pincode} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 pb-2 border-b">Languages</h3>
            {profile.languages?.length > 0 ? (
              <div className="space-y-3">
                {profile.languages.map((lang, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1">
                    <div>
                      <span className="font-bold text-gray-900">{lang.language}</span>
                      {lang.isNative && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 rounded uppercase">Native</span>}
                    </div>
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg">{lang.speaking} / {lang.writing}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-300 italic text-sm">No languages listed</p>}
          </div>
        </div>

        {/* Center/Right Column: Academic & Skill Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Academic History */}
          <div className="card">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 pb-2 border-b">Academic Foundation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <span className="font-black text-gray-400 text-xs">10</span>
                  </div>
                  <span className="font-black text-gray-900 text-sm">Class 10th</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Board</p>
                    <p className="text-sm font-bold text-gray-700">{profile.tenthGrade?.board || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Score</p>
                    <p className="text-sm font-bold text-gray-700">{profile.tenthGrade?.percentage ? `${profile.tenthGrade.percentage}%` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Passing Year</p>
                    <p className="text-sm font-bold text-gray-700">{profile.tenthGrade?.passingYear || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                    <span className="font-black text-gray-400 text-xs">12</span>
                  </div>
                  <span className="font-black text-gray-900 text-sm">Class 12th</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Board</p>
                    <p className="text-sm font-bold text-gray-700">{profile.twelfthGrade?.board || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Score</p>
                    <p className="text-sm font-bold text-gray-700">{profile.twelfthGrade?.percentage ? `${profile.twelfthGrade.percentage}%` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Passing Year</p>
                    <p className="text-sm font-bold text-gray-700">{profile.twelfthGrade?.passingYear || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Higher Education</h4>
              {profile.higherEducation?.length > 0 ? (
                <div className="space-y-4">
                  {profile.higherEducation.map((edu, idx) => (
                    <div key={idx} className="p-4 border-2 border-gray-100 rounded-2xl hover:border-primary-100 transition-colors group">
                      <div className="flex justify-between">
                        <h5 className="font-black text-gray-900 group-hover:text-primary-600 transition-colors uppercase text-sm tracking-tight">{edu.degree} in {edu.specialization || edu.fieldOfStudy}</h5>
                        <span className="text-xs font-black bg-primary-50 text-primary-600 px-2 py-0.5 rounded-lg">{edu.startYear} - {edu.endYear || 'Present'}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-500 mt-1 uppercase">{edu.institution} • {edu.percentage}% Score</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-300 italic text-sm">No higher education details provided</p>}
            </div>
          </div>

          {/* Comprehensive Skills Section */}
          <div className="card">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 pb-2 border-b">Skills & Proficiency</h3>

            <div className="space-y-8">
              {/* Technical Skills */}
              <div>
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.15em] mb-3">Technical (Self Rating)</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.technicalSkills?.length > 0 ? profile.technicalSkills.map((s, idx) => (
                    <div key={idx} className="bg-white border shadow-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700">{s.skillName}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4].map(n => (
                          <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= s.selfRating ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  )) : <span className="text-gray-300 italic text-xs">No technical skills self-rated</span>}
                </div>
              </div>

              {/* Soft Skills */}
              <div>
                <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-[0.15em] mb-3">Soft Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.softSkills?.length > 0 ? profile.softSkills.map((s, idx) => (
                    <div key={idx} className="bg-teal-50 border border-teal-100 text-teal-800 rounded-xl px-3 py-1.5 text-xs font-bold">
                      {s.skillName}
                    </div>
                  )) : <span className="text-gray-300 italic text-xs">No soft skills rated</span>}
                </div>
              </div>

              {/* Standard Approved Skills */}
              <div className="pt-4 border-t border-dashed">
                <h4 className="text-[10px] font-black text-primary-600 uppercase tracking-[0.15em] mb-3">Verified Course Skills</h4>
                <div className="space-y-2">
                  {profile.skills?.length > 0 ? profile.skills.map((skillItem) => (
                    <div key={skillItem.skill?._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${skillItem.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                          {skillItem.status === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-sm font-bold text-gray-700">{skillItem.skill?.name}</span>
                      </div>
                      {skillItem.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleSkillApproval(skillItem.skill?._id, 'approved')} className="text-[10px] font-black uppercase text-green-600 bg-green-50 px-2 py-1 rounded-lg hover:bg-green-100">Approve</button>
                          <button onClick={() => handleSkillApproval(skillItem.skill?._id, 'rejected')} className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100">Deny</button>
                        </div>
                      )}
                    </div>
                  )) : <p className="text-gray-300 italic text-xs">No skills submitted for verification</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job Readiness Section - Moved to last */}
      <div className="card !bg-gray-900 !text-white overflow-hidden relative mt-6">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <CheckSquare className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary-400">Job Readiness Metrics</h3>
            <button onClick={() => navigate('/campus-poc/job-readiness-criteria')} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors underline decoration-2 underline-offset-4">Manage Criteria</button>
          </div>

          {jobReadiness ? (
            <div className="space-y-6">
              {Object.entries(getCriteriaByCategory()).map(([category, criteria]) => (
                <div key={category}>
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">{category}</h4>
                  <div className="space-y-2">
                    {criteria.map(c => {
                      const status = getStudentCriterionStatus(c.criteriaId);
                      const isCompleted = status?.status === 'verified' || status?.status === 'completed';

                      return (
                        <div key={c.criteriaId} className="group cursor-default">
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5">
                            <div className="flex gap-3 items-center">
                              <div className={`p-1.5 rounded-lg shrink-0 ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white/90">{c.name}</p>
                                {status?.selfReportedValue && <p className="text-[10px] text-primary-400 font-black mt-0.5 uppercase tracking-tighter">Value: {status.selfReportedValue}</p>}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                                                        ${status?.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                                status?.status === 'completed' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                                  'bg-white/10 text-white/40'}`}>
                              {status?.status || 'Not Started'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-white/40 italic text-sm">Dashboard processing...</p>}
        </div>
      </div>

      {/* Profile Review Actions - Integrated into page flow */}
      <div className="mt-12 flex flex-col md:flex-row justify-center gap-4">
        {profile.profileStatus === 'approved' ? (
          <button
            disabled
            className="flex-1 max-w-[240px] bg-gray-100 text-gray-400 font-black py-4 rounded-3xl uppercase tracking-[0.1em] text-sm flex items-center justify-center gap-2 cursor-not-allowed border-2 border-gray-200"
          >
            <CheckCircle className="w-5 h-5" /> Already Approved
          </button>
        ) : (
          <button
            onClick={() => {
              if (window.confirm('Approve this profile for placements?')) {
                userAPI.approveProfile(id, 'approved', '').then(() => {
                  toast.success('Profile approved');
                  fetchStudentData();
                });
              }
            }}
            className="flex-1 max-w-[240px] shadow-lg bg-green-600 text-white font-black py-4 rounded-3xl uppercase tracking-[0.1em] text-sm hover:bg-green-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" /> Approve Profile
          </button>
        )}
        <button
          onClick={() => setShowDisapproveModal(true)}
          className="flex-1 max-w-[240px] shadow-sm bg-white text-red-600 border-2 border-red-100 text-sm font-black py-4 rounded-3xl uppercase tracking-[0.1em] hover:bg-red-50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <XCircle className="w-5 h-5" /> Request Revision
        </button>
      </div>

      {/* Disapprove Modal */}
      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-6">
              <XCircle className="w-8 h-8" />
              <h3 className="text-2xl font-black tracking-tight">Request Revision</h3>
            </div>
            <p className="text-gray-500 font-bold mb-4 uppercase tracking-widest text-[10px]">Provide clear instructions for the student</p>
            <textarea
              rows={6}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Example: Your class 12th percentage is incorrect as per marksheet. Also please update your LinkedIn URL to point to your profile instead of the homepage..."
              className="w-full mb-6 p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-red-100 focus:bg-white transition-all text-gray-700 font-medium leading-relaxed"
            />
            <div className="flex gap-4">
              <button
                onClick={() => { setShowDisapproveModal(false); setRevisionNotes(''); }}
                className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDisapproveProfile}
                disabled={processing.disapproving || !revisionNotes.trim()}
                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-red-700 shadow-xl shadow-red-100 transition-all disabled:opacity-50"
              >
                {processing.disapproving ? 'Sending...' : 'Send to Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation Modal */}
      {showRecommendModal && selectedApplication && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Special Recommendation</h3>
            <p className="text-gray-500 text-sm font-medium mb-6">
              Recommend <span className="text-primary-600 font-black">{student.firstName}</span> for the role of <span className="text-gray-900 font-black">{selectedApplication.job?.title}</span>. This will be visible to the hiring coordinator.
            </p>
            <textarea
              rows={4}
              value={recommendReason}
              onChange={(e) => setRecommendReason(e.target.value)}
              placeholder="Why is this student a perfect fit for this specific role?"
              className="w-full mb-6 p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-primary-100 focus:bg-white transition-all text-gray-700 font-medium"
            />
            <div className="flex gap-4">
              <button
                onClick={() => { setShowRecommendModal(false); setSelectedApplication(null); setRecommendReason(''); }}
                className="flex-1 bg-gray-100 text-gray-500 font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRecommend}
                disabled={!recommendReason.trim()}
                className="flex-1 bg-primary-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-primary-700 shadow-xl shadow-primary-100 transition-all"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POCStudentDetails;
