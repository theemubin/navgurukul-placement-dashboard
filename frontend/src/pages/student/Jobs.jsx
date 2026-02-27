import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { jobAPI, authAPI, settingsAPI, jobReadinessAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, Badge } from '../../components/common/UIComponents';
import {
  Briefcase, MapPin, IndianRupee, Calendar, Search, Star,
  AlertCircle, GraduationCap, Clock, CheckCircle, Heart,
  DollarSign, X, SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';

// Color variant mapping for stage colors
const COLOR_VARIANTS = {
  gray: 'default', yellow: 'warning', green: 'success',
  orange: 'warning', blue: 'info', red: 'danger',
  purple: 'primary', pink: 'primary', indigo: 'info'
};

// Dynamic Job Status Badge that uses pipeline stages
const JobStatusBadge = ({ status, stages }) => {
  const stage = stages.find(s => s.id === status);
  if (!stage || !stage.visibleToStudents) return null;
  const variant = COLOR_VARIANTS[stage.color] || 'default';
  const label = stage.studentLabel || stage.label;
  return <Badge variant={variant} className="flex items-center gap-1">{label}</Badge>;
};

const StudentJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [internships, setInternships] = useState([]);
  const [matchingJobs, setMatchingJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState('draft');
  const [activeCategory, setActiveCategory] = useState('jobs');
  const [activeTab, setActiveTab] = useState('all');
  const [jobPagination, setJobPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [internshipPagination, setInternshipPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', roleCategory: '' });
  const [pipelineStages, setPipelineStages] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [openForRoles, setOpenForRoles] = useState([]); // roles from student profile
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  // On mount, load profile, stages, readiness, and role preferences
  useEffect(() => {
    const init = async () => {
      try {
        const [profileRes, stagesRes, readinessRes] = await Promise.all([
          authAPI.getMe(),
          settingsAPI.getPipelineStages(),
          jobReadinessAPI.getMyStatus().catch(() => ({ data: null })),
        ]);
        const profile = profileRes.data;
        setProfileStatus(profile?.studentProfile?.profileStatus || 'draft');
        setPipelineStages(stagesRes.data.data || []);
        setReadiness(readinessRes.data);

        // Get roles the student is open for — filter bar shows only these
        const myRoles = profile?.studentProfile?.openForRoles || [];
        setOpenForRoles(myRoles);
        // Don't auto-select — default to "All" so all jobs are visible on load
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, []);

  // Fetch jobs when filters/category/tab/page change
  useEffect(() => {
    if (activeTab === 'matching') {
      fetchMatchingJobs();
    } else if (activeCategory === 'jobs') {
      fetchJobs();
    } else if (activeCategory === 'internships') {
      fetchInternships();
    } else if (activeCategory === 'paid-projects') {
      fetchPaidProjects();
    }
  }, [activeCategory, activeTab, jobPagination.current, internshipPagination.current, filters]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: jobPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'full_time,part_time,contract'
      });
      setJobs(response.data.jobs);
      setJobPagination(response.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchInternships = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'internship'
      });
      setInternships(response.data.jobs);
      setInternshipPagination(response.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchPaidProjects = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'paid_project'
      });
      setInternships(response.data.jobs);
      setInternshipPagination(response.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchMatchingJobs = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getMatchingJobs();
      const all = response.data || [];
      if (activeCategory === 'jobs') setMatchingJobs(all.filter(j => j.jobType !== 'internship'));
      else setMatchingJobs(all.filter(j => j.jobType === 'internship'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Debounced search handler
  const handleSearchChange = (e) => {
    const value = e.target.value;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters(f => ({ ...f, search: value }));
      if (activeCategory === 'jobs') setJobPagination(p => ({ ...p, current: 1 }));
      else setInternshipPagination(p => ({ ...p, current: 1 }));
    }, 350);
  };

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveTab('all');
    setJobPagination(p => ({ ...p, current: 1 }));
    setInternshipPagination(p => ({ ...p, current: 1 }));
  };

  const handleRoleFilter = (role) => {
    setFilters(f => ({ ...f, roleCategory: role }));
    if (activeCategory === 'jobs') setJobPagination(p => ({ ...p, current: 1 }));
    else setInternshipPagination(p => ({ ...p, current: 1 }));
  };

  const formatSalary = (salary) => {
    if (!salary?.min && !salary?.max) return 'Not disclosed';
    const fmt = (num) => '₹' + (num / 100000).toFixed(1) + ' LPA';
    if (salary.min && salary.max) return `${fmt(salary.min)} – ${fmt(salary.max)}`;
    if (salary.min) return `${fmt(salary.min)}+`;
    return `Up to ${fmt(salary.max)}`;
  };

  const displayJobs = activeTab === 'matching'
    ? matchingJobs
    : (activeCategory === 'jobs' ? jobs : internships);

  const pagination = activeCategory === 'jobs' ? jobPagination : internshipPagination;
  const setPagination = activeCategory === 'jobs' ? setJobPagination : setInternshipPagination;

  const categoryLabel = activeCategory === 'jobs' ? 'Jobs'
    : activeCategory === 'internships' ? 'Internships' : 'Paid Projects';

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Profile Approval Warning */}
      {profileStatus !== 'approved' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-800">Profile Approval Required</h4>
            <p className="text-yellow-700 text-sm mt-0.5">
              {profileStatus === 'pending_approval'
                ? 'Your profile is pending approval. You can browse but cannot apply yet.'
                : 'Submit your profile for Campus POC approval before applying. '}
              <Link to="/student/profile" className="underline font-medium">Go to Profile</Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Header + Search Row ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Listings</h1>
          <p className="text-gray-500 text-sm">Find full-time, part-time, internship &amp; paid project opportunities</p>
        </div>
        {/* Inline search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder={`Search ${categoryLabel.toLowerCase()}…`}
            defaultValue={filters.search}
            onChange={handleSearchChange}
            className="pl-9 pr-4 py-2 w-full rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent shadow-sm"
          />
          {filters.search && (
            <button
              onClick={() => { setFilters(f => ({ ...f, search: '' })); if (searchRef.current) searchRef.current.value = ''; }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Type tabs: Jobs / Internships / Paid Projects ── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'jobs', label: 'Jobs', icon: Briefcase },
          { id: 'internships', label: 'Internships', icon: GraduationCap },
          { id: 'paid-projects', label: 'Paid Projects', icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleCategoryChange(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${activeCategory === id
              ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100'
              : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── All / Matching sub-tabs ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {[
            { id: 'all', label: `All ${categoryLabel}` },
            { id: 'matching', label: `⭐ Matching ${categoryLabel}` },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Role Filter Pills — only show roles from student profile ── */}
      {openForRoles.length > 0 && activeTab === 'all' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="font-medium">Filter by your open roles</span>
            {filters.roleCategory && (
              <button
                onClick={() => handleRoleFilter('')}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRoleFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${!filters.roleCategory
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
            >
              All
            </button>
            {openForRoles.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleFilter(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${filters.roleCategory === role
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                  }`}
              >
                {role}
              </button>
            ))}
          </div>
          {/* Show a tip if no profile roles are set */}
        </div>
      )}

      {/* If no openForRoles set, show prompt */}
      {openForRoles.length === 0 && activeTab === 'all' && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Add roles you're open to in your{' '}
            <Link to="/student/profile" className="underline font-medium">profile</Link>{' '}
            to enable role-based filtering here.
          </span>
        </div>
      )}

      {/* ── Jobs List ── */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner size="lg" />
        </div>
      ) : displayJobs.length > 0 ? (
        <div className="space-y-3">
          {displayJobs.map((job) => (
            <Link
              key={job._id}
              to={`/student/jobs/${job._id}`}
              className="block"
            >
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left: logo + details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {job.company?.logo ? (
                        <img src={job.company.logo} alt={job.company.name} className="w-8 h-8 object-contain" />
                      ) : job.jobType === 'internship' ? (
                        <GraduationCap className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Briefcase className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">{job.title}</h3>
                      <p className="text-sm text-gray-500">{job.company?.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                        <span className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />{formatSalary(job.salary)}</span>
                        {job.jobType === 'internship' && job.duration && (
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.duration}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Deadline: {format(new Date(job.applicationDeadline), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      {/* Skill chips */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.requiredSkills?.slice(0, 5).map((s) => (
                          <span
                            key={s.skill?._id}
                            className={`text-[11px] px-2 py-0.5 rounded-md ${s.required ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {s.skill?.name}
                          </span>
                        ))}
                        {job.requiredSkills?.length > 5 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">+{job.requiredSkills.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: status + match */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
                    <JobStatusBadge status={job.status} stages={pipelineStages} />
                    <StatusBadge status={job.jobType} />

                    {/* Match percentage */}
                    {job.matchDetails?.overallPercentage !== undefined && (
                      <span className={`text-base font-bold ${job.matchDetails.overallPercentage >= 80 ? 'text-green-600'
                        : job.matchDetails.overallPercentage >= 60 ? 'text-blue-600'
                          : job.matchDetails.overallPercentage >= 40 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                        {job.matchDetails.overallPercentage}% Match
                      </span>
                    )}
                    {!job.matchDetails && job.matchPercentage !== undefined && (
                      <span className={`text-sm font-medium ${job.matchPercentage >= 70 ? 'text-green-600' : job.matchPercentage >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {job.matchPercentage}% Match
                      </span>
                    )}

                    {/* Eligibility label */}
                    <div className="text-[11px] font-medium">
                      {(() => {
                        const pct = readiness?.readinessPercentage || 0;
                        const req = job.eligibility?.readinessRequirement || 'yes';
                        if (req === 'yes') {
                          return pct === 100
                            ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Ready to Apply</span>
                            : <span className="flex items-center gap-1 text-amber-600"><Heart className="w-3 h-3" />Expression of Interest</span>;
                        } else if (req === 'in_progress') {
                          return pct >= 100
                            ? <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Ready to Apply</span>
                            : pct >= 30
                              ? <span className="flex items-center gap-1 text-indigo-600"><Clock className="w-3 h-3" />Eligible (In Process)</span>
                              : <span className="flex items-center gap-1 text-amber-600"><Heart className="w-3 h-3" />Expression of Interest</span>;
                        } else {
                          return <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Open to Apply</span>;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {activeTab === 'all' && (
            <Pagination
              current={pagination.current}
              total={pagination.pages}
              onPageChange={(page) => setPagination(p => ({ ...p, current: page }))}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={activeCategory === 'jobs' ? Briefcase : GraduationCap}
          title={`No ${categoryLabel.toLowerCase()} found`}
          description={
            activeTab === 'matching'
              ? 'Add and get your skills approved to see matching opportunities'
              : filters.roleCategory
                ? `No ${categoryLabel.toLowerCase()} found for "${filters.roleCategory}" — try clearing the filter`
                : `No ${categoryLabel.toLowerCase()} available at the moment`
          }
        />
      )}
    </div>
  );
};

export default StudentJobs;
