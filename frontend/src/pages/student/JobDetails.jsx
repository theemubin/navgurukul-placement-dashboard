import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { jobAPI, applicationAPI, authAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import { 
  ArrowLeft, Briefcase, MapPin, DollarSign, Calendar, Clock, 
  Users, Building, Globe, CheckCircle, AlertCircle, Heart, XCircle,
  TrendingUp, Award, GraduationCap
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
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [interestRequest, setInterestRequest] = useState(null);
  const [profileStatus, setProfileStatus] = useState('draft');
  const [coverLetter, setCoverLetter] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestForm, setInterestForm] = useState({
    reason: '',
    acknowledgedGaps: [],
    improvementPlan: ''
  });
  const [customResponses, setCustomResponses] = useState({});

  useEffect(() => {
    fetchJobWithMatch();
    checkIfApplied();
    fetchProfileStatus();
  }, [id]);

  const fetchProfileStatus = async () => {
    try {
      const response = await authAPI.getMe();
      setProfileStatus(response.data?.studentProfile?.profileStatus || 'draft');
    } catch (error) {
      console.error('Error fetching profile status:', error);
    }
  };

  const fetchJobWithMatch = async () => {
    try {
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
      }
    } catch (error) {
      toast.error('Error loading job details');
      navigate('/student/jobs');
    } finally {
      setLoading(false);
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
      toast.error(error.response?.data?.message || 'Error submitting application');
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
    const format = (num) => (num / 100000).toFixed(1) + ' LPA';
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
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <Briefcase className="w-8 h-8 text-gray-400" />
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
                  <DollarSign className="w-4 h-4" />
                  {formatSalary(job.salary)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {job.maxPositions} positions
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={job.status} />
            <StatusBadge status={job.jobType} />
          </div>
        </div>

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
          ) : matchDetails && !matchDetails.canApply ? (
            <button
              onClick={() => setShowInterestModal(true)}
              className="btn bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-2"
            >
              <Heart className="w-4 h-4" />
              Show Interest
            </button>
          ) : (
            <button
              onClick={() => setShowApplyModal(true)}
              className="btn btn-primary"
            >
              Apply Now
            </button>
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
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {matchDetails.breakdown?.skills?.matched || 0}/{matchDetails.breakdown?.skills?.required || 0}
                  </div>
                  <p className="text-xs text-gray-500">Skills Match</p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {matchDetails.breakdown?.eligibility?.passed || 0}/{matchDetails.breakdown?.eligibility?.total || 0}
                  </div>
                  <p className="text-xs text-gray-500">Eligibility</p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {matchDetails.canApply ? (
                      <CheckCircle className="w-6 h-6 mx-auto text-green-500" />
                    ) : (
                      <span className="text-orange-500">Need Approval</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Apply Status</p>
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Required Skills */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Required Skills</h2>
            <div className="space-y-2">
              {job.requiredSkills?.map((s) => (
                <div 
                  key={s.skill?._id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    s.required ? 'bg-primary-50' : 'bg-gray-50'
                  }`}
                >
                  <span className="text-sm">{s.skill?.name}</span>
                  {s.required && (
                    <span className="text-xs text-primary-600 font-medium">Required</span>
                  )}
                </div>
              ))}
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
              {(!job.eligibility?.schools?.length && 
                !job.eligibility?.campuses?.length && 
                !job.eligibility?.minCgpa &&
                !job.eligibility?.minModule) && (
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
                    <div key={index} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`req-${index}`}
                        checked={customResponses[index] || false}
                        onChange={(e) => setCustomResponses({
                          ...customResponses,
                          [index]: e.target.checked
                        })}
                        className="mt-1 rounded"
                      />
                      <label htmlFor={`req-${index}`} className="text-sm text-gray-700">
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
