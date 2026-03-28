import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, gharAPI } from '../../services/api';
import { StatsCard, LoadingSpinner, ConfirmDialog } from '../../components/common/UIComponents';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Briefcase, FileText, Users, TrendingUp, Building, 
  Plus, GraduationCap, X, Star, ExternalLink 
} from 'lucide-react';
import HistoricalCycleCharts from '../../components/common/HistoricalCycleCharts';

const StudentTableModal = ({ isOpen, onClose, title, students }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-50">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">School</th>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Pool Days</th>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Readiness</th>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Skills (Stars)</th>
                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => {
                const daysInPool = student.jobReady100At 
                  ? Math.max(0, Math.floor((new Date() - new Date(student.jobReady100At)) / (1000 * 60 * 60 * 24)))
                  : null;

                return (
                  <tr key={student.studentId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900">{student.name}</div>
                      <div className="text-xs text-gray-500">{student.email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">{student.school}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{student.cycle}</div>
                    </td>
                    <td className="py-4 px-4">
                      {daysInPool !== null ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{daysInPool} days</span>
                          <span className="text-[9px] text-gray-400 uppercase">Since 100% Ready</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">Not at 100%</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${student.readinessPercentage >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                            style={{ width: `${student.readinessPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">{student.readinessPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        {student.technicalSkills?.slice(0, 3).map((skill, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{skill.skillName}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4].map(n => (
                                <Star 
                                  key={n} 
                                  className={`w-2.5 h-2.5 ${n <= skill.selfRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} 
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        {!student.technicalSkills?.length && <span className="text-xs text-gray-300 italic">No skills listed</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Link 
                        to={`/coordinator/students/${student.studentId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        View Profile <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CoordinatorDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [schoolTracking, setSchoolTracking] = useState([]);
  const [roleTracking, setRoleTracking] = useState([]);
  const [cycleTracking, setCycleTracking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalStudents, setModalStudents] = useState([]);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [dashboardRes, trackingRes] = await Promise.all([
        statsAPI.getDashboard(),
        statsAPI.getSchoolTracking()
      ]);
      setStats(dashboardRes.data);
      setSchoolTracking(trackingRes.data?.schoolTracking || []);
      setRoleTracking(trackingRes.data?.roleTracking || []);
      setCycleTracking(trackingRes.data?.cycleTracking || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAll = async () => {
    setSyncing(true);
    
    toast.promise(
      gharAPI.importAll({}),
      {
        loading: 'Interfacing with Zoho Data...',
        success: (res) => {
          fetchStats(); // Refresh dashboard
          return res.data.message || 'Import completed successfully';
        },
        error: (err) => err.response?.data?.message || 'Failed to sync with Zoho'
      },
      {
        style: { minWidth: '350px' },
        success: { duration: 5000, icon: '🚀' }
      }
    ).finally(() => setSyncing(false));
  };

  const openStudentModal = (title, students) => {
    setModalTitle(title);
    setModalStudents(students);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coordinator Dashboard</h1>
          <p className="text-gray-600">Manage jobs, applications, and placements</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'manager' && (
            <button 
              onClick={() => setShowImportConfirm(true)} 
              disabled={syncing}
              className="btn btn-secondary flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              {syncing ? 'Syncing...' : 'Sync From Zoho'}
            </button>
          )}
          <Link to="/coordinator/jobs/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Post New Job
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          icon={Users}
          label="Total (Approved)"
          value={stats?.summary?.totalStudents || 0}
          color="blue"
        />
        <StatsCard
          icon={ExternalLink}
          label="Imported (Pending)"
          value={stats?.summary?.neverLoggedInCount || 0}
          color="amber"
          title="Students imported from Zoho who haven't logged in yet"
        />
        <StatsCard
          icon={Briefcase}
          label="Active Jobs"
          value={stats?.summary?.totalJobs || 0}
          color="purple"
        />
        <StatsCard
          icon={FileText}
          label="Applications"
          value={stats?.summary?.totalApplications || 0}
          color="yellow"
        />
        <StatsCard
          icon={TrendingUp}
          label="Placements"
          value={stats?.summary?.totalPlacements || 0}
          color="green"
        />
        <StatsCard
          icon={Building}
          label="Companies"
          value={stats?.summary?.activeCompanies || 0}
          color="primary"
        />
      </div>

      {/* Cycle-wise Section - NEW */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Cycle-wise Job Readiness
          </h2>
          <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-green-100">Across {cycleTracking.length} active cycles</span>
        </div>
        
        {cycleTracking.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cycleTracking.map((cycle) => (
              <div key={cycle.cycle} className="group relative bg-white border-2 border-gray-100 rounded-3xl p-5 hover:border-green-500/30 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300">
                <div className="mb-4">
                  <h3 className="text-base font-black text-gray-900 group-hover:text-green-600 transition-colors truncate">{cycle.cycle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cycle.totalStudents} total</span>
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">{cycle.placed} placed</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => openStudentModal(`${cycle.cycle} - 30% Ready`, cycle.students.filter(s => s.readinessPercentage >= 30))}
                    className="flex flex-col items-center justify-center p-3 bg-indigo-50/50 rounded-2xl hover:bg-indigo-100 transition-colors border border-indigo-100/50"
                  >
                    <span className="text-xl font-black text-indigo-700">{cycle.jobReady30Count || 0}</span>
                    <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter mt-0.5">30% Pool</span>
                  </button>
                  <button 
                    onClick={() => openStudentModal(`${cycle.cycle} - 100% Ready`, cycle.students.filter(s => s.readinessPercentage >= 100))}
                    className="flex flex-col items-center justify-center p-3 bg-emerald-50/50 rounded-2xl hover:bg-emerald-100 transition-colors border border-emerald-100/50"
                  >
                    <span className="text-xl font-black text-emerald-700">{cycle.jobReady100Count || 0}</span>
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter mt-0.5">100% Pool</span>
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Success Rate</span>
                    <span className="text-[10px] font-black text-emerald-600">{Math.round((cycle.placed / (cycle.totalStudents || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${(cycle.placed / (cycle.totalStudents || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No placement cycle data available</p>
          </div>
        )}
      </div>

      <HistoricalCycleCharts title="Placement History & Performance" />

      {/* School-wise Section */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 uppercase tracking-tight">
          <GraduationCap className="w-6 h-6 text-purple-600" />
          School-wise Job Readiness
        </h2>
        {schoolTracking.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schoolTracking.map((school) => (
              <div key={school.school} className="rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-purple-100">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{school.school}</p>
                      <p className="text-xs text-gray-500">Total students: {school.totalStudents}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button 
                    onClick={() => openStudentModal(`${school.school} - 30% Job Ready`, school.students.filter(s => s.readinessPercentage >= 30))}
                    className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center hover:bg-blue-100 transition-colors"
                  >
                    <p className="text-2xl font-bold text-blue-700">{school.jobReady30Count || 0}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">30% Job Ready</p>
                  </button>
                  <button 
                    onClick={() => openStudentModal(`${school.school} - 100% Job Ready`, school.students.filter(s => s.readinessPercentage >= 100))}
                    className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center hover:bg-emerald-100 transition-colors"
                  >
                    <p className="text-2xl font-bold text-emerald-700">{school.jobReady100Count || 0}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">100% Job Ready</p>
                  </button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500 font-bold uppercase">30% Readiness Rate</span>
                      <span className="text-blue-600 font-black">{school.totalStudents > 0 ? Math.round(((school.jobReady30Count || 0) / school.totalStudents) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${school.totalStudents > 0 ? Math.round(((school.jobReady30Count || 0) / school.totalStudents) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-gray-500 font-bold uppercase">100% Readiness Rate</span>
                      <span className="text-emerald-600 font-black">{school.totalStudents > 0 ? Math.round(((school.jobReady100Count || 0) / school.totalStudents) * 100) : 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${school.totalStudents > 0 ? Math.round(((school.jobReady100Count || 0) / school.totalStudents) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No school readiness data available.</p>
        )}
      </div>

      {/* Role-wise Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-blue-600" />
          Role-wise Job Readiness
        </h2>
        {roleTracking.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleTracking.map((role) => (
              <div key={role.role} className="rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <div>
                    <h3 className="font-bold text-gray-900">{role.role}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{role.totalStudents} Interested</p>
                  </div>
                  <Briefcase className="w-5 h-5 text-blue-500 opacity-20" />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => openStudentModal(`${role.role} - 30% Ready`, role.students.filter(s => s.readinessPercentage >= 30))}
                    className="p-2 rounded-lg bg-indigo-50 text-indigo-700 text-center hover:bg-indigo-100 transition-colors"
                  >
                    <p className="text-xl font-black">{role.jobReady30Count || 0}</p>
                    <p className="text-[9px] font-black uppercase tracking-tighter">30% Ready</p>
                  </button>
                  <button 
                    onClick={() => openStudentModal(`${role.role} - 100% Ready`, role.students.filter(s => s.readinessPercentage >= 100))}
                    className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-center hover:bg-emerald-100 transition-colors"
                  >
                    <p className="text-xl font-black">{role.jobReady100Count || 0}</p>
                    <p className="text-[9px] font-black uppercase tracking-tighter">100% Ready</p>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No role readiness data available.</p>
        )}
      </div>

      {/* Application Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Application Status</h2>
          <div className="space-y-3">
            {Object.entries(stats?.applicationsByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="capitalize text-gray-600">{status.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        status === 'selected' ? 'bg-green-500' :
                        status === 'rejected' ? 'bg-red-500' :
                        status === 'in_progress' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ 
                        width: `${(count / (stats?.summary?.totalApplications || 1)) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="font-medium w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Companies</h2>
          <div className="space-y-3">
            {stats?.topCompanies?.length > 0 ? (
              stats.topCompanies.map((company, index) => (
                <div key={company._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-900">{company._id}</span>
                  </div>
                  <span className="font-medium text-green-600">{company.placements} placements</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No placement data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Placements */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Placements</h2>
        {stats?.recentPlacements?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentPlacements.map((placement) => (
              <div key={placement._id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {placement.student?.firstName} {placement.student?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {placement.job?.title} at {placement.job?.company?.name}
                  </p>
                </div>
                <span className="text-green-600 text-sm font-medium">Placed ✓</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent placements</p>
        )}
      </div>

      {/* Student List Modal */}
      {/* Import Confirmation */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => setShowImportConfirm(false)}
        onConfirm={() => {
          setShowImportConfirm(false);
          handleImportAll();
        }}
        title="Sync Student Data"
        message="This will interface with Ghar Zoho and create placeholder accounts for students who haven't logged in. Are you sure you want to proceed?"
        confirmLabel={syncing ? 'Syncing...' : 'Sync Now'}
        type="primary"
      />

      <StudentTableModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        students={modalStudents}
      />
    </div>
  );
};

export default CoordinatorDashboard;
