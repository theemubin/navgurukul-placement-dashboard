import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobAPI, applicationAPI, authAPI, questionAPI, jobReadinessAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import {
  ArrowLeft, Briefcase, MapPin, IndianRupee, Calendar, Clock,
  Users, Building, Globe, CheckCircle, AlertCircle, Heart, XCircle,
  TrendingUp, Award, GraduationCap, MessageCircle, Send, User, History, Check, Trash
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Match Percentage Circle Component
const MatchCircle = ({ percentage }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return '#22c55e'; // green
    if (percentage >= 60) return '#3b82f6'; // blue
    if (percentage >= 40) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-24 h-24">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={getColor()}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={`absolute text-2xl font-bold`} style={{ color: getColor() }}>
        {percentage}%
      </span>
    </div>
  );
};

// Proficiency Level Display
const ProficiencyBadge = ({ level }) => {
  const labels = ['None', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
  const colors = [
    'bg-gray-100 text-gray-600',
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-yellow-100 text-yellow-700'
  ];
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[level] || colors[0]}`}>
      {labels[level] || 'Unknown'}
    </span>
  );
};

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [interestRequest, setInterestRequest] = useState(null);
  const [profileStatus, setProfileStatus] = useState('draft');

  // Debug helper to log decision variables (removed in production)
  const debugDecision = (msg, vars = {}) => {
    // eslint-disable-next-line no-console
    console.debug('[JobDetails Decision]', msg, vars);
  };
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestForm, setInterestForm] = useState({
    improvementPlan: ''
  });
  const [readiness, setReadiness] = useState(null);
  const [customResponses, setCustomResponses] = useState({});
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);

  useEffect(() => {
    fetchJobWithMatch();
    checkIfApplied();
    fetchProfileStatus();
    fetchReadiness();
  }, [id]);

  useEffect(() => {
    if (job) {
      fetchQuestions();
    }
  }, [job]);

  const fetchQuestions = async () => {
    if (!job?.company?.name) return;
    try {
      const response = await questionAPI.getQuestions({ company: job.company.name });
      setQuestions(response.data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const handleAskQuestion = async () => {
    if (newQuestion.trim().length < 10) {
      toast.error('Question must be at least 10 characters');
      return;
    }
    setAskingQuestion(true);
    try {
      await questionAPI.askQuestion({ jobId: id, question: newQuestion });
      toast.success('Question submitted!');
      setNewQuestion('');
      fetchQuestions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting question');
    } finally {
      setAskingQuestion(false);
    }
  };

  const fetchProfileStatus = async () => {
    try {
      const response = await authAPI.getMe();
      setProfileStatus(response.data?.studentProfile?.profileStatus || 'draft');
    } catch (error) {
      console.error('Error fetching profile status:', error);
    }
  };

  const fetchReadiness = async () => {
    try {
      const response = await jobReadinessAPI.getMyStatus();
      // API returns { readiness, config, defaults } — store the readiness object itself
      setReadiness(response.data?.readiness || response.data);
    } catch (error) {
      console.error('Error fetching readiness:', error);
    }
  };

  const fetchJobWithMatch = async () => {
    try {
      setMatchLoading(true);
      // Try to get job with match details first
      try {
        const matchResponse = await jobAPI.getJobWithMatch(id);
        setJob(matchResponse.data);
        setMatchDetails(matchResponse.data.matchDetails);
        setInterestRequest(matchResponse.data.interestRequest);
      } catch (matchError) {
        // Fallback to regular job fetch
        const response = await jobAPI.getJob(id);
        setJob(response.data);
        setMatchDetails(null);
        setInterestRequest(null);
      }
    } catch (error) {
      toast.error('Error loading job details');
      navigate('/student/jobs');
    } finally {
      setLoading(false);
      setMatchLoading(false);
    }
  };

  const checkIfApplied = async () => {
    try {
      const response = await applicationAPI.getApplications({ job: id });
      setHasApplied(response.data.applications.length > 0);
    } catch (error) {
      console.error('Error checking application status:', error);
    }
  };

  const handleApply = async () => {
    // Check mandatory custom requirements
    if (job.customRequirements?.length > 0) {
      const missingMandatory = job.customRequirements.some((req, index) =>
        req.isMandatory && !customResponses[index]
      );
      if (missingMandatory) {
        toast.error('Please confirm all required fields');
        return;
      }
    }

    setApplying(true);
    try {
      // Include custom responses in the application
      const applicationData = {
        coverLetter,
        customResponses: job.customRequirements?.map((req, index) => ({
          requirement: req.requirement,
          response: customResponses[index] || false,
          isMandatory: req.isMandatory
        })) || []
      };
      await applicationAPI.apply(id, applicationData.coverLetter, applicationData.customResponses);
      toast.success('Application submitted successfully!');
      setHasApplied(true);
      setShowApplyModal(false);
      setCustomResponses({});
    } catch (error) {
      const msg = error.response?.data?.message || 'Error submitting application';

      // If backend blocks due to readiness (403), offer the student to submit interest instead.
      if (error.response?.status === 403 && /Job Ready|must be/i.test(msg)) {
        const wantInterest = window.confirm(`${msg}\n\nWould you like to express interest instead?`);
        if (wantInterest) {
          await handleInterestExpression();
          setApplying(false);
          return;
        }
      }

      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  const handleInterestExpression = async () => {
    setApplying(true);
    try {
      await applicationAPI.apply(id, '', [], 'interest');
      toast.success('Interest expressed successfully!');
      setHasApplied(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting interest');
    } finally {
      setApplying(false);
    }
  };

  const handleSubmitInterest = async () => {
    if (interestForm.reason.length < 50) {
      toast.error('Please provide a detailed reason (at least 50 characters)');
      return;
    }

    setSubmittingInterest(true);
    try {
      const response = await jobAPI.submitInterest(id, {
        reason: interestForm.reason,
        acknowledgedGaps: interestForm.acknowledgedGaps,
        improvementPlan: interestForm.improvementPlan
      });
      toast.success('Interest request submitted! Your Campus PoC will review it.');
      setInterestRequest({ status: 'pending', createdAt: new Date() });
      setShowInterestModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting interest request');
    } finally {
      setSubmittingInterest(false);
    }
  };

  const formatSalary = (salary) => {
    if (!salary?.min && !salary?.max) return 'Not disclosed';
    const format = (num) => '₹' + (num / 100000).toFixed(1) + ' LPA';
    if (salary.min && salary.max) return `${format(salary.min)} - ${format(salary.max)}`;
    if (salary.min) return `${format(salary.min)}+`;
    return `Up to ${format(salary.max)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!job) return null;

  const isDeadlinePassed = new Date(job.applicationDeadline) < new Date();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Button */}
      <button
        onClick={() => navigate('/student/jobs')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-white border border-gray-100 shadow-sm rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {job.company?.logo ? (
                <img src={job.company.logo} alt={job.company.name} className="w-10 h-10 object-contain" />
              ) : (
                <Briefcase className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-lg text-gray-600">{job.company?.name}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <IndianRupee className="w-4 h-4" />
                  {formatSalary(job.salary)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {job.maxPositions} positions
                </span>
              </div>
              {/* Job Coordinator */}
              {job.coordinator && (
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Job Coordinator: <span className="font-medium">{job.coordinator.firstName} {job.coordinator.lastName}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={job.status} />
            <StatusBadge status={job.jobType} />
            {job.eligibility?.femaleOnly && (
              <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-xs font-medium">
                Female Only
              </span>
            )}
            {job.eligibility?.houses?.length > 0 && (
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                <Home className="w-3 h-3" />
                {job.eligibility.houses.join(', ')} Only
              </span>
            )}
          </div>
        </div>

        {/* Expected Update Info */}
        {job.expectedUpdateDate && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Expected Update: {format(new Date(job.expectedUpdateDate), 'MMMM dd, yyyy')}</span>
            </div>
            {job.expectedUpdateNote && (
              <p className="text-sm text-blue-600 mt-1">{job.expectedUpdateNote}</p>
            )}
          </div>
        )}

        {/* Apply Button */}
        <div className="mt-6 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Application Deadline: {format(new Date(job.applicationDeadline), 'MMMM dd, yyyy')}</span>
            {isDeadlinePassed && (
              <span className="text-red-500 text-sm">(Passed)</span>
            )}
          </div>

          {hasApplied ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span>Already Applied</span>
            </div>
          ) : isDeadlinePassed ? (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <span>Applications Closed</span>
            </div>
          ) : profileStatus !== 'approved' ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="w-5 h-5" />
                <span>Profile Approval Required</span>
              </div>
              <Link to="/student/profile" className="text-sm text-primary-600 hover:underline">
                Complete your profile →
              </Link>
            </div>
          ) : interestRequest?.status === 'pending' ? (
            <div className="flex items-center gap-2 text-yellow-600">
              <Clock className="w-5 h-5" />
              <span>Interest request pending approval</span>
            </div>
          ) : interestRequest?.status === 'rejected' ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span>Interest request not approved</span>
            </div>
          ) : (
            <div className="flex gap-3">
              {(() => {
                const studentPct = readiness?.readinessPercentage || 0;
                const requirement = job.eligibility?.readinessRequirement || 'yes';

                // Readiness gate
                let meetsReadiness = false;
                if (requirement === 'yes') {
                  meetsReadiness = studentPct === 100;
                } else if (requirement === 'in_progress') {
                  meetsReadiness = studentPct >= 30;
                } else {
                  meetsReadiness = true;
                }

                // Allow applying even if overall match is low when the only unmet piece is custom requirements
                let allowApplyEvenIfMatchLow = false;
                if (matchDetails && !matchDetails.canApply) {
                  const skillsOk = (matchDetails.breakdown?.skills?.percentage || 0) === 100;
                  const eligibilityOk = (matchDetails.breakdown?.eligibility?.percentage || 0) === 100;
                  const requirementsNotOk = (matchDetails.breakdown?.requirements?.percentage || 100) < 100;

                  if (skillsOk && eligibilityOk && requirementsNotOk) {
                    allowApplyEvenIfMatchLow = true;
                  }
                }

                // Prefer showing Apply Now if the match engine explicitly allows it, even if readiness is not fully met.
                const canApplyUi = (matchDetails?.canApply === true) || (meetsReadiness && allowApplyEvenIfMatchLow);

                // If match details are still loading, avoid showing Show Interest prematurely
                if (matchLoading) {
                  debugDecision('Match still loading, showing placeholder for apply area', { matchLoading });
                  return (
                    <div className="flex items-center gap-3">
                      <button className="btn btn-primary opacity-50" disabled>Loading…</button>
                    </div>
                  );
                }

                // Debug log when we choose to show Show Interest (helps reproduce issues)
                if (!canApplyUi) {
                  debugDecision('Deciding to show Show Interest', {
                    canApply: matchDetails?.canApply,
                    allowApplyEvenIfMatchLow,
                    meetsReadiness,
                    studentPct,
                    matchDetailsSummary: {
                      skillsPct: matchDetails?.breakdown?.skills?.percentage,
                      eligibilityPct: matchDetails?.breakdown?.eligibility?.percentage,
                      requirementsPct: matchDetails?.breakdown?.requirements?.percentage
                    }
                  });
                }

                if (canApplyUi) {
                  return (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="btn btn-primary"
                      >
                        Apply Now
                      </button>
                      {allowApplyEvenIfMatchLow && (
                        <span className="text-sm text-yellow-700">You will need to confirm job requirements when applying</span>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <button
                      onClick={handleInterestExpression}
                      disabled={applying}
                      className="btn bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
                    >
                      <Heart className="w-4 h-4" />
                      {applying ? 'Submitting...' : 'Show Interest'}
                    </button>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Match Details Card - Show only if we have match details */}
      {matchDetails && (
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="text-center">
              <MatchCircle percentage={matchDetails.overallPercentage} />
              <p className="text-sm text-gray-600 mt-2">Your Match Score</p>
            </div>

            <div className="flex-1 space-y-4">
              {/* Summary Messages */}
              <div className="space-y-1">
                {matchDetails.summary?.map((msg, i) => (
                  <p key={i} className="text-sm">{msg}</p>
                ))}

                {/* Missing mandatory custom requirements (surface them explicitly) */}
                {(() => {
                  const missing = (matchDetails?.breakdown?.requirements?.details || []).filter(d => !d.meets).map(d => d.requirement).filter(Boolean);
                  if (missing.length > 0) {
                    return (
                      <p className="text-sm text-yellow-800 mt-2">⚠️ You will need to confirm: {missing.join(', ')}</p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
                <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-sm">
                  <div className="text-lg font-bold text-blue-600">
                    {matchDetails.breakdown?.skills?.matched || 0}/{matchDetails.breakdown?.skills?.required || 0}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Skills Match</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-green-100 shadow-sm">
                  <div className="text-lg font-bold text-green-600">
                    {matchDetails.breakdown?.eligibility?.passed || 0}/{matchDetails.breakdown?.eligibility?.total || 0}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Eligibility</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-sm">
                  <div className="text-lg font-bold text-purple-600">
                    {matchDetails.canApply ? (
                      <CheckCircle className="w-6 h-6 mx-auto text-green-500" />
                    ) : (
                      <span className="text-xs text-orange-500 font-bold">Need Permission</span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Apply Status</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Job Description</h2>
            <p className="text-gray-600 whitespace-pre-line">{job.description}</p>
          </div>

          {/* Requirements */}
          {job.requirements?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Requirements</h2>
              <ul className="space-y-2">
                {job.requirements.map((req, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-600">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Responsibilities */}
          {job.responsibilities?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Responsibilities</h2>
              <ul className="space-y-2">
                {job.responsibilities.map((resp, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-600">
                    <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 shrink-0" />
                    {resp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview Rounds */}
          {job.interviewRounds?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Interview Process</h2>
              <div className="space-y-3">
                {job.interviewRounds.map((round, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{round.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{round.type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company Forum Section */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Company Forum
              </h2>
              {questions.filter(q => !q.answer).length > 0 && (
                <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {questions.filter(q => !q.answer).length} unanswered
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Questions asked here are visible to all students applying for {job.company?.name}.
            </p>

            {/* Ask a Question */}
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder={`Ask a question about ${job.company?.name}...`}
                  className="flex-1"
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={askingQuestion || newQuestion.length < 10}
                  className="btn btn-primary flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                  {askingQuestion ? 'Sending...' : 'Ask'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Min 10 characters. Your identity will be kept anonymous to other students.</p>
            </div>

            {/* Questions List */}
            {questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q._id || idx} className="border-l-4 border-primary-200 pl-4 py-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{q.question}</p>
                        <div className="flex gap-2 text-xs text-gray-400 mt-1">
                          <span>{format(new Date(q.createdAt), 'MMM d, yyyy')}</span>
                          {q.jobTitle && q.jobTitle !== job.title && (
                            <span>• via {q.jobTitle}</span>
                          )}
                        </div>
                      </div>

                      {/* Coordinator Actions */}
                      {['coordinator', 'manager', 'campus_poc'].includes(JSON.parse(localStorage.getItem('user'))?.role) && (
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete this question?')) {
                              try {
                                await questionAPI.deleteQuestion(q._id);
                                toast.success('Question deleted');
                                fetchQuestions();
                              } catch (e) { toast.error('Failed to delete'); }
                            }
                          }}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Delete Question"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {q.answer ? (
                      <div className="mt-2 bg-gray-50 p-3 rounded relative group">
                        <p className="text-gray-700 text-sm">{q.answer}</p>
                        {q.answeredAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Answered {format(new Date(q.answeredAt), 'MMM d, yyyy')}
                          </p>
                        )}

                        {/* Coordinator Edit Answer Button (Optional enhancement) */}
                      </div>
                    ) : (
                      <div className="mt-2">
                        {['coordinator', 'manager', 'campus_poc'].includes(JSON.parse(localStorage.getItem('user'))?.role) ? (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              placeholder="Write an answer..."
                              className="text-sm py-1 px-2 border rounded flex-1"
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  try {
                                    await questionAPI.answerQuestion(q._id, e.target.value);
                                    toast.success('Answer submitted');
                                    fetchQuestions();
                                  } catch (err) { toast.error('Failed to submit answer'); }
                                }
                              }}
                            />
                            <button className="btn btn-xs btn-primary">Answer</button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">Awaiting response...</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded">
                No questions asked yet for {job.company?.name}.
              </p>
            )}
          </div>

          {/* Job Journey/Timeline - Grouped & Bento Style */}
          {job.timeline && (
            <div className="card border-none bg-gray-50/50">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                  <History className="w-5 h-5 text-primary-600" />
                </div>
                Job Journey
              </h2>

              <div className="space-y-4">
                {(() => {
                  const timeline = [...(job.timeline || [])];

                  // Add "Created" event if missing
                  if (!timeline.find(t => t.event === 'created')) {
                    timeline.push({
                      event: 'created',
                      description: 'Job Posted',
                      changedAt: job.createdAt,
                      changedBy: job.createdBy
                    });
                  }

                  return timeline.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)).map((event, idx) => {
                    const isLast = idx === timeline.length - 1;
                    const desc = event.description || '';

                    let displayTitle = desc;
                    let displayIcon = <div className="w-2 h-2 bg-primary-400 rounded-full" />;
                    let meta = null;

                    if (desc.includes('Bulk update performed')) {
                      const actionMatch = desc.match(/action=([^,]+)/);
                      const updatedMatch = desc.match(/updated=(\d+)/);
                      const count = updatedMatch ? updatedMatch[1] : '0';
                      const action = actionMatch ? actionMatch[1] : '';

                      if (action === 'set_status') {
                        const status = event.metadata?.status;
                        const roundName = event.metadata?.roundName;
                        if (status) {
                          const label = (status === 'interviewing' || status === 'in_progress') && roundName ? roundName : getStatusLabel(status);
                          displayTitle = `${count} student${count !== '1' ? 's' : ''} moved to ${label}`;
                        } else {
                          displayTitle = `${count} application${count !== '1' ? 's' : ''} reviewed by team`;
                        }
                        displayIcon = <Users className="w-3 h-3 text-primary-600" />;
                      }
                    } else if (event.event === 'created' || desc.toLowerCase().includes('posted')) {
                      displayTitle = 'Job Opportunity Created';
                      displayIcon = <CheckCircle className="w-3 h-3 text-green-500" />;
                      const creator = event.changedBy || job.createdBy;
                      if (creator?.firstName) {
                        meta = `by ${creator.firstName} ${creator.lastName}`;
                      }
                    }

                    return (
                      <div key={idx} className="relative pl-8 pb-4">
                        {!isLast && <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-gray-200" />}
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white bg-white shadow-sm flex items-center justify-center z-10">
                          {displayIcon}
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                          <p className="text-sm font-bold text-gray-800">{displayTitle}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">
                              {format(new Date(event.changedAt), 'MMM dd, yyyy')}
                            </p>
                            {meta && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-[10px] text-gray-500 font-medium">{meta}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Required Skills */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Required Skills</h2>
            <div className="space-y-3">
              {job.requiredSkills?.map((s) => {
                // Find matching skill detail from match data
                const skillDetail = matchDetails?.breakdown?.skills?.details?.find(
                  d => d.skillId === (s.skill?._id?.toString() || s.skill?.toString())
                );

                const proficiencyLevels = ['None', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
                const requiredLevel = s.proficiencyLevel || 1;
                const studentLevel = skillDetail?.studentLevel || 0;
                const meets = skillDetail?.meets || false;

                return (
                  <div
                    key={s.skill?._id}
                    className={`p-3 rounded-lg border-2 ${meets
                      ? 'border-green-200 bg-green-50'
                      : 'border-orange-200 bg-orange-50'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{s.skill?.name || 'Unknown Skill'}</span>
                      {meets ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Required Level</p>
                        <ProficiencyBadge level={requiredLevel} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Your Level</p>
                        <ProficiencyBadge level={studentLevel} />
                      </div>
                    </div>

                    {!meets && (
                      <p className="text-xs text-orange-700 mt-2">
                        ⚠️ You need to improve from {proficiencyLevels[studentLevel]} to {proficiencyLevels[requiredLevel]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eligibility */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Eligibility Criteria</h2>
            <div className="space-y-3 text-sm">
              {job.eligibility?.minCgpa && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Minimum CGPA</span>
                  <span className="font-medium">{job.eligibility.minCgpa}</span>
                </div>
              )}
              {job.eligibility?.schools?.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">Schools</span>
                  <div className="flex flex-wrap gap-1">
                    {job.eligibility.schools.map((school, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        {school}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {job.eligibility?.campuses?.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">Campuses</span>
                  <div className="flex flex-wrap gap-1">
                    {job.eligibility.campuses.map((campus, i) => (
                      <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {campus.name || campus}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {job.eligibility?.minModule && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Minimum Module</span>
                  <span className="font-medium">{job.eligibility.minModule}</span>
                </div>
              )}
              {job.eligibility?.femaleOnly && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Gender Requirement</span>
                  <span className="font-medium text-pink-600">Female Only</span>
                </div>
              )}
              {job.eligibility?.minAttendance && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Attendance</span>
                  <span className="font-medium">{job.eligibility.minAttendance}%</span>
                </div>
              )}
              {job.eligibility?.minMonthsAtNavgurukul && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Min Time at NG</span>
                  <span className="font-medium">{job.eligibility.minMonthsAtNavgurukul} months</span>
                </div>
              )}
              {(!job.eligibility?.schools?.length &&
                !job.eligibility?.campuses?.length &&
                !job.eligibility?.minCgpa &&
                !job.eligibility?.minModule &&
                !job.eligibility?.femaleOnly &&
                !job.eligibility?.minAttendance &&
                !job.eligibility?.minMonthsAtNavgurukul) && (
                  <p className="text-green-600 font-medium">Open for all students</p>
                )}
            </div>
          </div>

          {/* Company Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">About Company</h2>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="font-medium">{job.company?.name}</p>
                {job.company?.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </div>
            {job.company?.description && (
              <p className="text-sm text-gray-600">{job.company.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 my-8 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Apply for {job.title}</h3>
            <p className="text-gray-600 mb-4">
              Your profile and resume will be shared with the recruiter.
            </p>

            {/* Custom Requirements - Yes/No Questions */}
            {job.customRequirements?.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Please confirm the following:</h4>
                <div className="space-y-3">
                  {job.customRequirements.map((req, index) => (
                    <div key={index}
                      className="flex items-start gap-3 group cursor-pointer"
                      onClick={() => setCustomResponses(prev => ({
                        ...prev,
                        [index]: !prev[index]
                      }))}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors duration-200 ease-in-out ${customResponses[index]
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-300 group-hover:border-blue-500'
                        }`}>
                        {customResponses[index] && (
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        )}
                      </div>

                      <input
                        type="checkbox"
                        id={`req-${index}`}
                        checked={customResponses[index] || false}
                        onChange={() => { }} // Handled by parent div
                        className="hidden"
                      />
                      <label
                        htmlFor={`req-${index}`}
                        className="text-sm text-gray-700 cursor-pointer select-none"
                      >
                        {req.requirement}
                        {req.isMandatory && <span className="text-red-500 ml-1">*</span>}
                      </label>
                    </div>
                  ))}
                </div>
                {job.customRequirements.some(r => r.isMandatory) && (
                  <p className="text-xs text-gray-500 mt-2">* Required fields must be checked to apply</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cover Letter (Optional)
              </label>
              <textarea
                rows={4}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell us why you're a good fit for this role..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowApplyModal(false)}
                className="btn btn-secondary"
                disabled={applying}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="btn btn-primary"
                disabled={applying || (job.customRequirements?.some(r => r.isMandatory && !customResponses[job.customRequirements.indexOf(r)]))}
              >
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interest Request Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Heart className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Show Interest in {job.title}</h3>
                <p className="text-sm text-gray-500">Your match score is below 60%. Request Campus PoC approval to apply.</p>
              </div>
            </div>

            {/* Match Gap Summary */}
            {matchDetails && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">What you're missing:</h4>
                <ul className="space-y-1 text-sm text-yellow-700">
                  {matchDetails.breakdown?.skills?.details?.filter(s => !s.meets).map((skill, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      {skill.skillName}: Need {skill.requiredLevelLabel}, you have {skill.studentLevelLabel}
                    </li>
                  ))}
                  {Object.entries(matchDetails.breakdown?.eligibility?.details || {})
                    .filter(([_, d]) => d.required && !d.meets)
                    .map(([key, detail]) => (
                      <li key={key} className="flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        {detail.message}
                      </li>
                    ))
                  }
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Why do you want to apply for this role? *
                  <span className="text-gray-400 font-normal"> (min 50 characters)</span>
                </label>
                <textarea
                  rows={4}
                  value={interestForm.reason}
                  onChange={(e) => setInterestForm({ ...interestForm, reason: e.target.value })}
                  placeholder="Explain why you're interested in this role despite not meeting all requirements. What unique skills or experiences do you bring?"
                  className={interestForm.reason.length > 0 && interestForm.reason.length < 50 ? 'border-red-300' : ''}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {interestForm.reason.length}/50 characters minimum
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How do you plan to address the gaps? (Optional)
                </label>
                <textarea
                  rows={3}
                  value={interestForm.improvementPlan}
                  onChange={(e) => setInterestForm({ ...interestForm, improvementPlan: e.target.value })}
                  placeholder="E.g., Currently learning React through a course, will complete DSA practice within 2 weeks..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInterestModal(false)}
                className="btn btn-secondary"
                disabled={submittingInterest}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitInterest}
                className="btn bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
                disabled={submittingInterest || interestForm.reason.length < 50}
              >
                {submittingInterest ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Submit Interest Request
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

export default JobDetails;
