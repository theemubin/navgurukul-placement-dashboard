import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { jobAPI, authAPI, settingsAPI, jobReadinessAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, Badge } from '../../components/common/UIComponents';
import { Briefcase, MapPin, DollarSign, Calendar, Search, Filter, Star, AlertCircle, GraduationCap, Clock, CheckCircle, Users, TrendingUp, XCircle, Heart } from 'lucide-react';
import { format } from 'date-fns';

// Color variant mapping for stage colors
const COLOR_VARIANTS = {
  gray: 'default',
  yellow: 'warning',
  green: 'success',
  orange: 'warning',
  blue: 'info',
  red: 'danger',
  purple: 'primary',
  pink: 'primary',
  indigo: 'info'
};

// Dynamic Job Status Badge that uses pipeline stages
const JobStatusBadge = ({ status, stages }) => {
  // Find the stage configuration
  const stage = stages.find(s => s.id === status);

  // Don't show badge if stage is not visible to students or not found
  if (!stage || !stage.visibleToStudents) return null;

  const variant = COLOR_VARIANTS[stage.color] || 'default';
  const label = stage.studentLabel || stage.label;

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {label}
    </Badge>
  );
};

const StudentJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [internships, setInternships] = useState([]);
  const [matchingJobs, setMatchingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState('draft');
  const [activeCategory, setActiveCategory] = useState('jobs'); // 'jobs', 'internships' or 'paid-projects'
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'matching'
  const [jobPagination, setJobPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [internshipPagination, setInternshipPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', roleCategory: '' });
  const [pipelineStages, setPipelineStages] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [roleCategories, setRoleCategories] = useState([]);

  useEffect(() => {
    fetchProfileStatus();
    fetchPipelineStages();
    fetchReadiness();
    fetchRoleCategories();
  }, []);

  const fetchPipelineStages = async () => {
    try {
      const response = await settingsAPI.getPipelineStages();
      setPipelineStages(response.data.data || []);
    } catch (error) {
      console.error('Error fetching pipeline stages:', error);
    }
  };

  const fetchReadiness = async () => {
    try {
      const response = await jobReadinessAPI.getMyStatus();
      setReadiness(response.data);
    } catch (error) {
      console.error('Error fetching readiness:', error);
    }
  };

  const fetchRoleCategories = async () => {
    try {
      const response = await settingsAPI.getSettings();
      setRoleCategories(response.data.data.roleCategories || []);
    } catch (error) {
      console.error('Error fetching role categories:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'matching') {
      fetchMatchingJobs();
    } else {
      if (activeCategory === 'jobs') {
        fetchJobs();
      } else {
        if (activeCategory === 'internships') {
          fetchInternships();
        } else if (activeCategory === 'paid-projects') {
          fetchPaidProjects();
        }
      }
    }
  }, [activeCategory, activeTab, jobPagination.current, internshipPagination.current, filters]);

  const fetchProfileStatus = async () => {
    try {
      const response = await authAPI.getMe();
      setProfileStatus(response.data?.studentProfile?.profileStatus || 'draft');
    } catch (error) {
      console.error('Error fetching profile status:', error);
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: jobPagination.current,
        limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'full_time,part_time,contract' // Exclude internships
      });
      setJobs(response.data.jobs);
      setJobPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInternships = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current,
        limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'internship'
      });
      setInternships(response.data.jobs);
      setInternshipPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching internships:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaidProjects = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current,
        limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'paid_project'
      });
      setInternships(response.data.jobs);
      setInternshipPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching paid projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchingJobs = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getMatchingJobs();
      // Filter based on active category
      const all = response.data || [];
      if (activeCategory === 'jobs') {
        setMatchingJobs(all.filter(j => j.jobType !== 'internship'));
      } else {
        setMatchingJobs(all.filter(j => j.jobType === 'internship'));
      }
    } catch (error) {
      console.error('Error fetching matching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (salary) => {
    if (!salary?.min && !salary?.max) return 'Not disclosed';
    const format = (num) => (num / 100000).toFixed(1) + ' LPA';
    if (salary.min && salary.max) return `${format(salary.min)} - ${format(salary.max)}`;
    if (salary.min) return `${format(salary.min)}+`;
    return `Up to ${format(salary.max)}`;
  };

  const formatStipend = (salary) => {
    if (!salary?.min && !salary?.max) return 'Not disclosed';
    const format = (num) => '₹' + num.toLocaleString('en-IN') + '/month';
    if (salary.min && salary.max) return `${format(salary.min)} - ${format(salary.max)}`;
    if (salary.min) return `${format(salary.min)}+`;
    return `Up to ${format(salary.max)}`;
  };

  const displayJobs = activeTab === 'matching'
    ? matchingJobs
    : (activeCategory === 'jobs' ? jobs : internships);

  const pagination = activeCategory === 'jobs' ? jobPagination : internshipPagination;
  const setPagination = activeCategory === 'jobs' ? setJobPagination : setInternshipPagination;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Profile Approval Warning */}
      {profileStatus !== 'approved' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-800">Profile Approval Required</h4>
              <p className="text-yellow-700 text-sm mt-1">
                {profileStatus === 'pending_approval'
                  ? 'Your profile is pending approval by Campus POC. You can browse jobs but cannot apply until approved.'
                  : 'Your profile needs to be submitted and approved by Campus POC before you can apply for jobs. '}
                <Link to="/student/profile" className="underline font-medium">Go to Profile</Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {activeCategory === 'jobs' ? 'Job Listings' : 'Internship Opportunities'}
        </h1>
        <p className="text-gray-600">
          {activeCategory === 'jobs'
            ? 'Find full-time, part-time, and contract opportunities'
            : 'Find internship opportunities to kickstart your career'}
        </p>
      </div>

      {/* Category Tabs - Jobs vs Internships */}
      <div className="flex gap-4">
        <button
          onClick={() => { setActiveCategory('jobs'); setActiveTab('all'); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${activeCategory === 'jobs'
            ? 'bg-primary-600 text-white shadow-lg'
            : 'bg-white text-gray-600 border hover:border-primary-300 hover:text-primary-600'
            }`}
        >
          <Briefcase className="w-5 h-5" />
          Jobs
        </button>
        <button
          onClick={() => { setActiveCategory('internships'); setActiveTab('all'); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${activeCategory === 'internships'
            ? 'bg-primary-600 text-white shadow-lg'
            : 'bg-white text-gray-600 border hover:border-primary-300 hover:text-primary-600'
            }`}
        >
          <GraduationCap className="w-5 h-5" />
          Internships
        </button>
        <button
          onClick={() => { setActiveCategory('paid-projects'); setActiveTab('all'); }}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${activeCategory === 'paid-projects'
            ? 'bg-primary-600 text-white shadow-lg'
            : 'bg-white text-gray-600 border hover:border-primary-300 hover:text-primary-600'
            }`}
        >
          <DollarSign className="w-5 h-5" />
          Paid Projects
        </button>
      </div>

      {/* Sub-tabs: All vs Matching */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'all'
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          All {activeCategory === 'jobs' ? 'Jobs' : 'Internships'}
        </button>
        <button
          onClick={() => setActiveTab('matching')}
          className={`pb-3 px-1 font-medium transition-colors flex items-center gap-2 ${activeTab === 'matching'
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Star className="w-4 h-4" />
          Matching {activeCategory === 'jobs' ? 'Jobs' : 'Internships'}
        </button>
      </div>

      {/* Role Category Chips Filter */}
      {roleCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Filter by Role:</span>
          <button
            onClick={() => setFilters({ ...filters, roleCategory: '' })}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!filters.roleCategory
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All
          </button>
          {roleCategories.map((category) => (
            <button
              key={category}
              onClick={() => setFilters({ ...filters, roleCategory: category })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${filters.roleCategory === category
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {activeTab === 'all' && (
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeCategory}...`}
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      )}

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : displayJobs.length > 0 ? (
        <div className="space-y-4">
          {displayJobs.map((job) => (
            <Link
              key={job._id}
              to={`/student/jobs/${job._id}`}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${job.jobType === 'internship' ? 'bg-purple-100' : 'bg-gray-100'
                      }`}>
                      {job.jobType === 'internship'
                        ? <GraduationCap className="w-6 h-6 text-purple-500" />
                        : <Briefcase className="w-6 h-6 text-gray-400" />
                      }
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <p className="text-gray-600">{job.company?.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {job.jobType === 'internship' ? formatStipend(job.salary) : formatSalary(job.salary)}
                        </span>
                        {job.jobType === 'internship' && job.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.duration}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Deadline: {format(new Date(job.applicationDeadline), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.requiredSkills?.slice(0, 5).map((s) => (
                      <span
                        key={s.skill?._id}
                        className={`text-xs px-2 py-1 rounded ${s.required ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                          }`}
                      >
                        {s.skill?.name}
                      </span>
                    ))}
                    {job.requiredSkills?.length > 5 && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        +{job.requiredSkills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <JobStatusBadge status={job.status} stages={pipelineStages} />
                  <StatusBadge status={job.jobType} />

                  {/* Use Job Readiness logic for Apply/Interest */}
                  <div className="text-right">
                    {job.matchDetails?.overallPercentage !== undefined && (
                      <div className={`text-lg font-bold ${job.matchDetails.overallPercentage >= 80 ? 'text-green-600' :
                        job.matchDetails.overallPercentage >= 60 ? 'text-blue-600' :
                          job.matchDetails.overallPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                        {job.matchDetails.overallPercentage}% Match
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const studentPct = readiness?.readinessPercentage || 0;
                        const requirement = job.eligibility?.readinessRequirement || 'yes';

                        if (requirement === 'yes') {
                          if (studentPct === 100) {
                            return (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-3 h-3" /> Ready to Apply
                              </span>
                            );
                          } else {
                            return (
                              <span className="flex items-center gap-1 text-orange-600">
                                <Heart className="w-3 h-3" /> Expression of Interest
                              </span>
                            );
                          }
                        } else if (requirement === 'in_progress') {
                          if (studentPct >= 100) {
                            return (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-3 h-3" /> Ready to Apply
                              </span>
                            );
                          } else if (studentPct >= 30) {
                            return (
                              <span className="flex items-center gap-1 text-indigo-600">
                                <Clock className="w-3 h-3" /> Eligible (In Process)
                              </span>
                            );
                          } else {
                            return (
                              <span className="flex items-center gap-1 text-orange-600">
                                <Heart className="w-3 h-3" /> Expression of Interest
                              </span>
                            );
                          }
                        } else {
                          return (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" /> Open to Apply
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Legacy match percentage for backward compatibility */}
                  {!job.matchDetails && job.matchPercentage !== undefined && (
                    <div className={`text-sm font-medium ${job.matchPercentage >= 70 ? 'text-green-600' :
                      job.matchPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                      {job.matchPercentage}% Match
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {activeTab === 'all' && (
            <Pagination
              current={pagination.current}
              total={pagination.pages}
              onPageChange={(page) => setPagination({ ...pagination, current: page })}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={activeCategory === 'jobs' ? Briefcase : GraduationCap}
          title={`No ${activeCategory} found`}
          description={activeTab === 'matching'
            ? "Add and get your skills approved to see matching opportunities"
            : `No ${activeCategory === 'jobs' ? 'job' : 'internship'} postings available at the moment`
          }
        />
      )}
    </div>
  );
};

export default StudentJobs;
