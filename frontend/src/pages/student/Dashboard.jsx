import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, applicationAPI } from '../../services/api';
import { StatsCard, LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import { 
  FileText, Briefcase, CheckCircle, XCircle, Clock, 
  TrendingUp, DollarSign, User, ArrowRight, ArrowUpRight,
  ShieldCheck, AlertTriangle, Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const StudentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobReadiness, setJobReadiness] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchJobReadiness();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await statsAPI.getStudentStats();
      setStats(response.data.stats);
      setRecentApplications(response.data.recentApplications);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobReadiness = async () => {
    try {
      const res = await import('../../services/api').then(m => m.jobReadinessAPI.getMyStatus());
      if (
        res.data?.school === 'School of Programming' &&
        Array.isArray(res.data?.progress?.criteria) &&
        res.data.progress.criteria.length > 0
      ) {
        setJobReadiness(res.data);
      } else {
        setJobReadiness(null);
      }
    } catch (err) {
      setJobReadiness(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 animate-fadeIn pb-12">
      {/* ── Welcome Hero Section ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-900 to-primary-900 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-primary-200 text-[10px] font-black uppercase tracking-[0.2em]">
              <TrendingUp size={12} /> Live Dashboard
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-2">
                Hello, <span className="text-primary-400">{user?.firstName || 'Student'}</span>!
              </h1>
              <p className="text-gray-400 text-lg font-medium max-w-md">
                Your career journey is looking promising. You've got {stats?.totalApplications || 0} active {stats?.totalApplications === 1 ? 'application' : 'applications'} in the pipeline.
              </p>
            </div>
          </div>
          
          {/* Main Action Button */}
          <Link 
            to="/student/jobs" 
            className="group relative flex items-center gap-4 px-8 py-5 rounded-2xl bg-white text-gray-900 font-black text-lg shadow-xl hover:shadow-primary-500/20 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 group-hover:text-white transition-colors">Find Your Next Job</span>
            <div className="relative z-10 w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all">
              <ArrowRight size={20} />
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Stats & Readiness Column (Left) ── */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Job Readiness (Premium implementation) */}
          {jobReadiness && (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-xl shadow-gray-100/50">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${jobReadiness.progress.isJobReady ? 'bg-green-100 text-green-600' : 'bg-primary-100 text-primary-600'}`}>
                        {jobReadiness.progress.isJobReady ? <ShieldCheck size={24} /> : <TrendingUp size={24} />}
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Placement Readiness</h3>
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">{jobReadiness.school}</p>
                     </div>
                  </div>
                  {jobReadiness.progress.isJobReady ? (
                    <div className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100">
                      Approved for Placement
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary-100">
                      Training Phase
                    </div>
                  )}
               </div>

               {/* Readiness Progress Bar */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                     <span className="font-bold text-gray-500">Progress to Certification</span>
                     <span className="font-black text-gray-900">
                       {Math.round((jobReadiness.progress.criteria?.filter(c => c.completed).length / jobReadiness.progress.criteria?.length) * 100)}%
                     </span>
                  </div>
                  <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                     <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${
                          jobReadiness.progress.isJobReady ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-primary-500 to-primary-700'
                        }`} 
                        style={{ width: `${(jobReadiness.progress.criteria?.filter(c => c.completed).length / jobReadiness.progress.criteria?.length) * 100}%` }}
                     />
                  </div>
                  <div className="flex items-center gap-6 mt-6">
                     <div className="flex -space-x-2">
                        {jobReadiness.progress.criteria?.map((c, i) => (
                          <div 
                            key={i} 
                            className={`w-3 h-3 rounded-full border-2 border-white ${c.completed ? 'bg-green-500' : 'bg-gray-200'}`} 
                            title={c.label}
                          />
                        ))}
                     </div>
                     <p className="text-xs font-medium text-gray-500">
                       <span className="font-black text-gray-900">{jobReadiness.progress.criteria?.filter(c => c.completed).length}</span> milestones completed out of <span className="font-black text-gray-900">{jobReadiness.progress.criteria?.length}</span> and ready for take off.
                     </p>
                  </div>
               </div>
            </div>
          )}

          {/* Core Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <FileText size={20} />
               </div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Apps</p>
               <h4 className="text-3xl font-black text-gray-900">{stats?.totalApplications || 0}</h4>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Clock size={20} />
               </div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">In Process</p>
               <h4 className="text-3xl font-black text-gray-900">{stats?.inProgress || 0}</h4>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
               <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <CheckCircle size={20} />
               </div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Selected</p>
               <h4 className="text-3xl font-black text-gray-900">{stats?.selected || 0}</h4>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
               <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <XCircle size={20} />
               </div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rejected</p>
               <h4 className="text-3xl font-black text-gray-900">{stats?.rejected || 0}</h4>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-xl shadow-gray-100/50">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Recent Applications</h2>
                <p className="text-sm font-medium text-gray-400">Your latest recruitment updates</p>
              </div>
              <Link 
                to="/student/applications" 
                className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all group"
              >
                <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
            <div className="p-4">
              {recentApplications.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {recentApplications.map((app) => (
                    <div 
                      key={app._id} 
                      className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-lg hover:shadow-gray-200/50 border border-transparent hover:border-gray-100 transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                           {app.job?.company?.logo ? (
                              <img src={app.job.company.logo} alt={app.job.company.name} className="w-8 h-8 object-contain" />
                           ) : (
                              <Briefcase size={18} className="text-gray-300" />
                           )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-gray-900 truncate leading-tight">{app.job?.title}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">{app.job?.company?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <StatusBadge status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-[2rem] bg-gray-50 flex items-center justify-center text-gray-200 mb-6">
                    <Search size={40} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">No Active Applications</h3>
                  <p className="text-gray-400 font-medium text-sm mt-2 max-w-[240px] text-center">
                    Start your journey by browsing thousands of available jobs today.
                  </p>
                  <Link 
                    to="/student/jobs" 
                    className="mt-6 font-black text-xs uppercase tracking-widest text-primary-600 hover:text-primary-700 underline underline-offset-4"
                  >
                    Explore Job Feed
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Secondary Actions Column (Right) ── */}
        <div className="space-y-8">
           {/* Quick Action Profile Card */}
           <Link to="/student/profile" className="block group">
              <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-[2rem] p-8 text-white shadow-xl shadow-green-200 hover:-translate-y-1 transition-all duration-300">
                 <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6">
                    <User size={30} className="text-white" />
                 </div>
                 <h3 className="text-2xl font-black tracking-tight leading-tight">Refine Your Profile</h3>
                 <p className="text-green-100 font-medium text-sm mt-3 opacity-80 leading-relaxed">
                   Unlock better job matches by keeping your skills and certifications updated.
                 </p>
                 <div className="flex items-center gap-2 mt-8 font-black text-xs uppercase tracking-[0.2em]">
                    Update Now <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
                 </div>
              </div>
           </Link>

           {/* Paid Projects Spotlight */}
           <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-100/50">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-6">
                <DollarSign size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight leading-tight">Niche Opportunities</h3>
              <p className="text-gray-400 font-medium text-sm mt-2 leading-relaxed">
                 Browse part-time projects and paid internships for quick earnings.
              </p>
              <div className="mt-8 pt-8 border-t border-gray-50 flex items-center justify-between">
                 <div>
                    <p className="text-2xl font-black text-gray-900">{stats?.paidProjects || stats?.paidProjectsCount || 0}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Projects</p>
                 </div>
                 <Link to="/student/jobs?type=paid_project" className="p-3 bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-600 hover:text-white transition-all">
                    <ArrowRight size={18} />
                 </Link>
              </div>
           </div>

           {/* Tip Card */}
           <div className="bg-primary-50 rounded-[2rem] p-8 border border-primary-100 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-100 rounded-full blur-2xl" />
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-white border border-primary-100 flex items-center justify-center text-primary-600 shadow-sm">
                    <AlertTriangle size={18} />
                 </div>
                 <h4 className="font-black text-primary-900 text-sm tracking-tight uppercase">Platform Tip</h4>
              </div>
              <p className="text-primary-800/70 font-medium text-sm leading-relaxed relative z-10">
                 Did you know? Students who update their profile every 30 days are <span className="text-primary-900 font-black">2.5x more likely</span> to get shortlisted by premium startups.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
