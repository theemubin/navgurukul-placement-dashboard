import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { jobAPI, authAPI, settingsAPI, jobReadinessAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, Badge } from '../../components/common/UIComponents';
import {
  Briefcase, MapPin, IndianRupee, Calendar, Search, Star,
  AlertCircle, GraduationCap, Clock, CheckCircle, Heart,
  DollarSign, X, SlidersHorizontal, History, LayoutDashboard, ChevronRight,
  Settings2, ChevronDown, ChevronUp
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
  const [showRoleFilters, setShowRoleFilters] = useState(false);
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
      fetchJobs(activeTab === 'past');
    } else if (activeCategory === 'internships') {
      fetchInternships(activeTab === 'past');
    } else if (activeCategory === 'paid-projects') {
      fetchPaidProjects(activeTab === 'past');
    }
  }, [activeCategory, activeTab, jobPagination.current, internshipPagination.current, filters]);

  const fetchJobs = async (isPast = false) => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: jobPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'full_time,part_time,contract',
        past: isPast ? true : undefined
      });
      setJobs(response.data.jobs);
      setJobPagination(response.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchInternships = async (isPast = false) => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'internship',
        past: isPast ? true : undefined
      });
      setInternships(response.data.jobs);
      setInternshipPagination(response.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchPaidProjects = async (isPast = false) => {
    setLoading(true);
    try {
      const response = await jobAPI.getJobs({
        page: internshipPagination.current, limit: 10,
        search: filters.search || undefined,
        roleCategory: filters.roleCategory || undefined,
        jobType: 'paid_project',
        past: isPast ? true : undefined
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
    <div className="max-w-[1200px] mx-auto space-y-8 animate-fadeIn pb-12">
      {/* ── Top Header Section ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-8 shadow-2xl shadow-primary-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                Opportunities
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Job Listings
            </h1>
            <p className="text-primary-100/80 text-sm mt-2 max-w-md font-medium leading-relaxed">
              Discover your next career move across our network of verified hiring partners.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
             {/* Search box within glass panel */}
            <div className="relative group min-w-0 sm:min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-white transition-colors" />
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search ${categoryLabel.toLowerCase()}…`}
                defaultValue={filters.search}
                onChange={handleSearchChange}
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all text-sm font-medium"
              />
              {filters.search && (
                <button
                  onClick={() => { setFilters(f => ({ ...f, search: '' })); if (searchRef.current) searchRef.current.value = ''; }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation & Filter Shell ── */}
      <div className="bg-white/50 backdrop-blur-xl border border-white rounded-[2rem] p-4 md:p-6 shadow-xl shadow-gray-200/50 space-y-6">
        {/* Category Navigation (Segmented Control style) */}
        <div className="flex flex-wrap items-center justify-between gap-6 pb-2">
          <div className="flex p-1 bg-gray-100/80 rounded-2xl w-full sm:w-auto">
            {[
              { id: 'jobs', label: 'Jobs', icon: Briefcase },
              { id: 'internships', label: 'Internships', icon: GraduationCap },
              { id: 'paid-projects', label: 'Projects', icon: DollarSign },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleCategoryChange(id)}
                className={`flex items-center justify-center gap-2 flex-1 sm:flex-none sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeCategory === id 
                  ? 'bg-white text-primary-700 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 border-l border-gray-100 pl-2 lg:pl-6 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: `Active`, icon: LayoutDashboard },
              { id: 'matching', label: `Matching`, icon: Star },
              { id: 'past', label: `Past Jobs`, icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === id 
                  ? 'border-primary-600 text-primary-800' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Status Alert */}
        {profileStatus !== 'approved' && (
          <div className="relative group overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4 animate-fadeIn">
            <div className="absolute top-0 right-0 p-2 opacity-5">
               <AlertCircle size={80} />
            </div>
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <AlertCircle size={20} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-amber-900 text-sm">Approval Required</h4>
              <p className="text-amber-700/80 text-xs mt-0.5 font-medium leading-relaxed">
                {profileStatus === 'pending_approval'
                  ? 'Your profile is currently being reviewed. You can browse all active jobs but cannot submit applications yet.'
                  : 'Complete your profile and submit for POC approval to unlock application features. '}
                <Link to="/student/profile" className="text-amber-900 font-bold underline decoration-amber-200 hover:decoration-amber-400 decoration-2 underline-offset-2 transition-all ml-1">Go to Profile</Link>
              </p>
            </div>
          </div>
        )}

        {/* Role Filters Panel - Collapsible */}
        {openForRoles.length > 0 && activeTab === 'all' && (
          <div className="space-y-4 pt-2 border-t border-gray-100 mt-4">
            <button
              onClick={() => setShowRoleFilters(!showRoleFilters)}
              className="flex items-center gap-3 w-full group outline-none"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showRoleFilters ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600'}`}>
                <Settings2 size={14} />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary-600">Smart Filter</span>
                <p className="text-xs text-gray-400 font-medium tracking-tight">
                  {filters.roleCategory ? `Currently filtered by "${filters.roleCategory}"` : 'Filter opportunities by your career preferences'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                 {filters.roleCategory && !showRoleFilters && (
                    <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-700 text-[10px] font-bold">
                       {filters.roleCategory}
                    </span>
                 )}
                 {showRoleFilters ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>
            
            {showRoleFilters && (
              <div className="flex flex-wrap gap-2 pt-2 animate-slideDown">
                <button
                  onClick={() => handleRoleFilter('')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${!filters.roleCategory
                    ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200 scale-105'
                    : 'bg-white text-gray-500 border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                    }`}
                >
                  All Roles
                </button>
                {openForRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleFilter(role)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${filters.roleCategory === role
                      ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200 scale-105'
                      : 'bg-white text-gray-500 border-gray-100 hover:border-primary-200 hover:bg-primary-50/50'
                      }`}
                  >
                    {role}
                  </button>
                ))}
                {filters.roleCategory && (
                  <button
                    onClick={() => handleRoleFilter('')}
                    className="ml-2 px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors"
                  >
                     Reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin" />
            <p className="text-sm font-bold text-gray-400 mt-4 uppercase tracking-widest">Loading database...</p>
          </div>
        ) : displayJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {displayJobs.map((job) => (
              <Link
                key={job._id}
                to={`/student/jobs/${job._id}`}
                className="group relative"
              >
                <div className="bg-white rounded-[1.5rem] border border-gray-100 p-5 md:p-6 transition-all duration-300 hover:border-primary-300 hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Company Brand Column */}
                    <div className="flex flex-row md:flex-col items-center gap-4 shrink-0">
                      <div className="w-16 h-16 rounded-2xl border border-gray-50 bg-gray-50/50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {job.company?.logo ? (
                          <img src={job.company.logo} alt={job.company.name} className="w-12 h-12 object-contain" />
                        ) : (
                           <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                             <Briefcase className="w-6 h-6 text-gray-400" />
                           </div>
                        )}
                      </div>
                      <div className="md:hidden flex-1">
                        <h3 className="text-lg font-black text-gray-900 leading-tight">{job.title}</h3>
                        <p className="text-sm font-medium text-primary-600">{job.company?.name}</p>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-w-0">
                      <div className="hidden md:block mb-1">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">{job.jobType.replace('_', ' ')}</span>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight group-hover:text-primary-700 transition-colors truncate">
                          {job.title}
                        </h3>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{job.company?.name}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 mt-4">
                        <div className="flex items-center gap-2.5 text-xs text-gray-500 font-medium">
                          <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                             <MapPin size={12} />
                          </div>
                          {job.location}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-gray-500 font-medium">
                          <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                             <IndianRupee size={12} />
                          </div>
                          {formatSalary(job.salary)}
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-gray-500 font-medium">
                          <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                             <Calendar size={12} />
                          </div>
                          Expires {format(new Date(job.applicationDeadline), 'MMM dd')}
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {job.requiredSkills?.slice(0, 4).map((s) => (
                           <span key={s.skill?._id} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 text-gray-600 text-[10px] font-bold border border-gray-100">
                              {s.skill?.name}
                           </span>
                        ))}
                        {job.requiredSkills?.length > 4 && (
                           <span className="text-[10px] font-bold text-gray-400 ml-1">+{job.requiredSkills.length - 4} more</span>
                        )}
                      </div>
                    </div>

                    {/* Action Column */}
                    <div className="flex md:flex-col items-center justify-between md:justify-center gap-4 shrink-0 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                       <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                             <JobStatusBadge status={job.status} stages={pipelineStages} />
                             {activeTab === 'past' && <Badge variant="danger">Closed</Badge>}
                          </div>
                          
                          <div className="mt-2 text-right">
                            {job.matchDetails?.overallPercentage !== undefined ? (
                               <div className="flex flex-col items-end">
                                  <span className={`text-2xl font-black ${
                                    job.matchDetails.overallPercentage >= 80 ? 'text-green-600' :
                                    job.matchDetails.overallPercentage >= 60 ? 'text-blue-600' : 'text-amber-500'
                                  }`}>
                                    {job.matchDetails.overallPercentage}<span className="text-xs ml-0.5">% Match</span>
                                  </span>
                               </div>
                            ) : job.matchPercentage !== undefined && (
                                <span className="text-lg font-black text-primary-600">{job.matchPercentage}%</span>
                            )}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2 text-primary-600 group-hover:translate-x-1 transition-transform">
                          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">View Details</span>
                          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                            <ChevronRight size={16} />
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {activeTab !== 'matching' && (
              <div className="pt-4 flex justify-center">
                <Pagination
                  current={pagination.current}
                  total={pagination.pages}
                  onPageChange={(page) => setPagination(p => ({ ...p, current: page }))}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-20 flex justify-center bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
            <EmptyState
              icon={activeCategory === 'jobs' ? Briefcase : (activeCategory === 'internships' ? GraduationCap : DollarSign)}
              title={`No ${categoryLabel} Found`}
              description={
                activeTab === 'matching'
                  ? 'Update your skills and get them verified by POC to unlock matching opportunities.'
                  : filters.roleCategory
                    ? `No current openings match the "${filters.roleCategory}" filter.`
                    : `We couldn't find any ${categoryLabel.toLowerCase()} in the ${activeTab} database.`
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentJobs;
