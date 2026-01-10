import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, placementCycleAPI, userAPI, campusAPI } from '../../services/api';
import { StatsCard, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { 
  Users, CheckSquare, FileText, TrendingUp, AlertCircle, Building2, 
  GraduationCap, Calendar, ChevronDown, ChevronUp, Eye, Clock,
  CheckCircle, XCircle, Briefcase, ArrowRight, Plus, Filter, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

const POCDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingSkills, setPendingSkills] = useState([]);
  const [companyTracking, setCompanyTracking] = useState([]);
  const [schoolTracking, setSchoolTracking] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [studentSummary, setStudentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCycleModal, setShowCycleModal] = useState(false);
  // Campus selection state
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [allCampuses, setAllCampuses] = useState([]);
  const [managedCampuses, setManagedCampuses] = useState([]);
  const [selectedCampuses, setSelectedCampuses] = useState([]);
  const [savingCampuses, setSavingCampuses] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchCampusData();
  }, []);

  useEffect(() => {
    if (selectedCycle || cycles.length > 0) {
      fetchTrackingData();
    }
  }, [selectedCycle]);

  const fetchCampusData = async () => {
    try {
      const [campusesRes, managedRes] = await Promise.all([
        campusAPI.getCampuses(),
        userAPI.getManagedCampuses()
      ]);
      setAllCampuses(campusesRes.data);
      const managed = managedRes.data.managedCampuses || [];
      setManagedCampuses(managed);
      setSelectedCampuses(managed.map(c => c._id));
    } catch (error) {
      console.error('Error fetching campus data:', error);
    }
  };

  const handleSaveCampuses = async () => {
    setSavingCampuses(true);
    try {
      await userAPI.updateManagedCampuses(selectedCampuses);
      toast.success('Managed campuses updated successfully');
      setShowCampusModal(false);
      fetchCampusData();
      fetchDashboardData(); // Refresh stats for new campuses
    } catch (error) {
      toast.error('Failed to update managed campuses');
    } finally {
      setSavingCampuses(false);
    }
  };

  const toggleCampusSelection = (campusId) => {
    setSelectedCampuses(prev => 
      prev.includes(campusId) 
        ? prev.filter(id => id !== campusId)
        : [...prev, campusId]
    );
  };

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, pendingResponse, cyclesResponse] = await Promise.all([
        statsAPI.getCampusPocStats(),
        userAPI.getPendingSkills(),
        statsAPI.getCycleStats()
      ]);
      setStats(statsResponse.data);
      setPendingSkills(pendingResponse.data.slice(0, 5));
      setCycles(cyclesResponse.data);
      
      // Set the most recent active cycle as default
      const activeCycle = cyclesResponse.data.find(c => c.status === 'active');
      if (activeCycle) {
        setSelectedCycle(activeCycle.cycleId);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackingData = async () => {
    try {
      const [companyRes, schoolRes, summaryRes] = await Promise.all([
        statsAPI.getCompanyTracking(selectedCycle),
        statsAPI.getSchoolTracking(selectedCycle),
        statsAPI.getStudentSummary({ cycleId: selectedCycle, status: statusFilter || undefined })
      ]);
      setCompanyTracking(companyRes.data);
      setSchoolTracking(schoolRes.data);
      setStudentSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      applied: { color: 'blue', label: 'Applied' },
      shortlisted: { color: 'purple', label: 'Shortlisted' },
      in_progress: { color: 'yellow', label: 'In Progress' },
      selected: { color: 'green', label: 'Selected' },
      rejected: { color: 'red', label: 'Rejected' },
      withdrawn: { color: 'gray', label: 'Withdrawn' },
      placed: { color: 'green', label: 'Placed' },
      not_applied: { color: 'gray', label: 'Not Applied' }
    };
    const config = statusConfig[status] || { color: 'gray', label: status };
    return <Badge variant={config.color}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campus POC Dashboard</h1>
          <p className="text-gray-600">Track and manage student placements for your campus</p>
          {/* Managed Campuses Display */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Managing:</span>
            {managedCampuses.length > 0 ? (
              managedCampuses.map(campus => (
                <span key={campus._id} className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                  {campus.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No campuses selected</span>
            )}
            <button 
              onClick={() => setShowCampusModal(true)}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              Change
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowCycleModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Placement Cycle
        </button>
      </div>

      {/* Campus Selection Modal */}
      {showCampusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Select Campuses to Manage</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose the campuses you want to manage. You will see students and approve profiles from these campuses.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allCampuses.map(campus => (
                <label 
                  key={campus._id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCampuses.includes(campus._id) 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCampuses.includes(campus._id)}
                    onChange={() => toggleCampusSelection(campus._id)}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-900">{campus.name}</span>
                    {campus.location && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({campus.location.city}, {campus.location.state})
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => {
                  setSelectedCampuses(managedCampuses.map(c => c._id));
                  setShowCampusModal(false);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCampuses}
                disabled={savingCampuses || selectedCampuses.length === 0}
                className="btn btn-primary"
              >
                {savingCampuses ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cycle Selector */}
      {cycles.length > 0 && (
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <Calendar className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Placement Cycle:</span>
          <select
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">All Cycles</option>
            {cycles.map(cycle => (
              <option key={cycle.cycleId} value={cycle.cycleId}>
                {cycle.name} ({cycle.students} students)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          icon={Users}
          label="Total Students"
          value={stats?.totalStudents || 0}
          color="blue"
        />
        <StatsCard
          icon={CheckSquare}
          label="Pending Skills"
          value={stats?.pendingSkillApprovals || 0}
          color="yellow"
        />
        <StatsCard
          icon={FileText}
          label="Pending Profiles"
          value={stats?.pendingProfileApprovals || 0}
          color="orange"
        />
        <StatsCard
          icon={Briefcase}
          label="Applications"
          value={stats?.totalApplications || 0}
          color="purple"
        />
        <StatsCard
          icon={TrendingUp}
          label="Placements"
          value={stats?.totalPlacements || 0}
          subValue={`${stats?.placementRate || 0}% rate`}
          color="green"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'company', label: 'Company-wise', icon: Building2 },
            { id: 'school', label: 'School-wise', icon: GraduationCap },
            { id: 'students', label: 'Student Summary', icon: Users },
            { id: 'cycles', label: 'Placement Cycles', icon: Calendar }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/campus-poc/skill-approvals" className="card hover:shadow-md transition-shadow p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <CheckSquare className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Skill Approvals</p>
                    <p className="text-xs text-gray-500">{stats?.pendingSkillApprovals || 0} pending</p>
                  </div>
                </div>
              </Link>
              <Link to="/campus-poc/profile-approvals" className="card hover:shadow-md transition-shadow p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Profile Approvals</p>
                    <p className="text-xs text-gray-500">{stats?.pendingProfileApprovals || 0} pending</p>
                  </div>
                </div>
              </Link>
              <Link to="/campus-poc/students" className="card hover:shadow-md transition-shadow p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">All Students</p>
                    <p className="text-xs text-gray-500">{stats?.totalStudents || 0} total</p>
                  </div>
                </div>
              </Link>
              <button onClick={() => setActiveTab('cycles')} className="card hover:shadow-md transition-shadow p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Manage Cycles</p>
                    <p className="text-xs text-gray-500">{cycles.length} cycles</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Pending Skill Approvals */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Pending Skill Approvals</h3>
              <Link to="/campus-poc/skill-approvals" className="text-primary-600 text-sm hover:underline">
                View all
              </Link>
            </div>
            {pendingSkills.length > 0 ? (
              <div className="space-y-3">
                {pendingSkills.map((student) => (
                  <div key={student._id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-gray-500">{student.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-600">
                          {student.pendingSkills?.length || 0} pending
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                <p className="text-sm">All skills approved!</p>
              </div>
            )}
          </div>

          {/* Placement Summary by Status */}
          {studentSummary && (
            <div className="card lg:col-span-2">
              <h3 className="font-semibold mb-4">Student Placement Overview</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{studentSummary.summary.placed}</p>
                  <p className="text-sm text-gray-600">Placed</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{studentSummary.summary.inProgress}</p>
                  <p className="text-sm text-gray-600">In Progress</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-600">{studentSummary.summary.notApplied}</p>
                  <p className="text-sm text-gray-600">Not Applied</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{studentSummary.summary.rejected}</p>
                  <p className="text-sm text-gray-600">Rejected</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'company' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Company-wise Application Tracking</h3>
            <span className="text-sm text-gray-500">{companyTracking.length} companies</span>
          </div>
          
          {companyTracking.length > 0 ? (
            <div className="space-y-3">
              {companyTracking.map((company) => (
                <div key={company.company} className="card">
                  <button
                    onClick={() => setExpandedCompany(expandedCompany === company.company ? null : company.company)}
                    className="w-full"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">{company.company}</p>
                          <p className="text-sm text-gray-500">
                            {company.jobs.length} positions • {company.totalApplications} applications
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {company.statusCounts.selected} selected
                          </span>
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            {company.statusCounts.in_progress + company.statusCounts.shortlisted} in progress
                          </span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            {company.statusCounts.rejected} rejected
                          </span>
                        </div>
                        {expandedCompany === company.company ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {expandedCompany === company.company && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {company.jobs.map((job) => (
                        <div key={job.jobId} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium">{job.title}</p>
                              <p className="text-xs text-gray-500 capitalize">{job.jobType?.replace('_', ' ')}</p>
                            </div>
                            <span className="text-sm text-gray-500">
                              {job.applications.length} applicants
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="pb-2 font-medium">Student</th>
                                  <th className="pb-2 font-medium">School</th>
                                  <th className="pb-2 font-medium">Status</th>
                                  <th className="pb-2 font-medium">Round</th>
                                  <th className="pb-2 font-medium">Applied</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {job.applications.map((app) => (
                                  <tr key={app.applicationId}>
                                    <td className="py-2">
                                      <Link 
                                        to={`/campus-poc/students/${app.studentId}`}
                                        className="text-primary-600 hover:underline"
                                      >
                                        {app.studentName}
                                      </Link>
                                    </td>
                                    <td className="py-2 text-gray-600">{app.school || 'N/A'}</td>
                                    <td className="py-2">{getStatusBadge(app.status)}</td>
                                    <td className="py-2">
                                      {app.currentRound + 1}/{app.totalRounds || '?'}
                                    </td>
                                    <td className="py-2 text-gray-500">
                                      {new Date(app.appliedAt).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No company applications yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'school' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">School-wise Student Tracking</h3>
          
          {schoolTracking.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schoolTracking.map((school) => (
                <div key={school.school} className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{school.school}</p>
                      <p className="text-sm text-gray-500">{school.totalStudents} students</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <p className="text-lg font-bold text-green-600">{school.placed}</p>
                      <p className="text-xs text-gray-500">Placed</p>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <p className="text-lg font-bold text-yellow-600">{school.inProgress}</p>
                      <p className="text-xs text-gray-500">In Progress</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-lg font-bold text-gray-600">{school.totalStudents - school.placed - school.inProgress}</p>
                      <p className="text-xs text-gray-500">Pending</p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {school.students.slice(0, 5).map((student) => (
                      <div key={student.studentId} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <Link 
                          to={`/campus-poc/students/${student.studentId}`}
                          className="text-primary-600 hover:underline truncate max-w-[150px]"
                        >
                          {student.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{student.applicationCount} apps</span>
                          {getStatusBadge(student.status)}
                        </div>
                      </div>
                    ))}
                    {school.students.length > 5 && (
                      <p className="text-xs text-center text-gray-500 pt-2">
                        +{school.students.length - 5} more students
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No school data available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Student Application Summary</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  fetchTrackingData();
                }}
                className="input text-sm"
              >
                <option value="">All Status</option>
                <option value="placed">Placed</option>
                <option value="in_progress">In Progress</option>
                <option value="not_applied">Not Applied</option>
                <option value="rejected">All Rejected</option>
              </select>
            </div>
          </div>

          {studentSummary && studentSummary.students.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Activity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {studentSummary.students.map((student) => (
                      <tr key={student.studentId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <Link 
                              to={`/campus-poc/students/${student.studentId}`}
                              className="font-medium text-primary-600 hover:underline"
                            >
                              {student.name}
                            </Link>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.school}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{student.cycle}</td>
                        <td className="px-4 py-3">
                          {getStatusBadge(student.placementStatus)}
                          {student.placedAt && (
                            <p className="text-xs text-gray-500 mt-1">@ {student.placedAt}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium">{student.totalApplications}</span>
                          {student.activeApplications > 0 && (
                            <span className="text-xs text-green-600 ml-1">
                              ({student.activeApplications} active)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {student.applications[0] ? (
                            <div className="text-xs">
                              <p className="font-medium">{student.applications[0].company}</p>
                              <p className="text-gray-500">{student.applications[0].job}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No applications</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            to={`/campus-poc/students/${student.studentId}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No students found matching the criteria</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cycles' && (
        <CycleManagement 
          cycles={cycles} 
          onUpdate={fetchDashboardData}
          showModal={showCycleModal}
          setShowModal={setShowCycleModal}
        />
      )}

      {/* New Cycle Modal */}
      {showCycleModal && activeTab !== 'cycles' && (
        <NewCycleModal 
          onClose={() => setShowCycleModal(false)} 
          onSuccess={() => {
            setShowCycleModal(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
};

// Cycle Management Component
const CycleManagement = ({ cycles, onUpdate, showModal, setShowModal }) => {
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [cycleStudents, setCycleStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const fetchCycleStudents = async (cycleId) => {
    setLoadingStudents(true);
    try {
      const [cycleRes, unassignedRes] = await Promise.all([
        placementCycleAPI.getCycleStudents(cycleId),
        placementCycleAPI.getUnassignedStudents()
      ]);
      setCycleStudents(cycleRes.data);
      setUnassignedStudents(unassignedRes.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleAssignStudents = async () => {
    if (selectedStudents.length === 0 || !selectedCycleId) return;
    try {
      await placementCycleAPI.assignStudents(selectedCycleId, selectedStudents);
      setSelectedStudents([]);
      fetchCycleStudents(selectedCycleId);
      onUpdate();
    } catch (error) {
      console.error('Error assigning students:', error);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!selectedCycleId) return;
    try {
      await placementCycleAPI.removeStudents(selectedCycleId, [studentId]);
      fetchCycleStudents(selectedCycleId);
      onUpdate();
    } catch (error) {
      console.error('Error removing student:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Placement Cycles</h3>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Cycle
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cycles List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-600">All Cycles</h4>
          {cycles.length > 0 ? (
            cycles.map((cycle) => (
              <button
                key={cycle.cycleId}
                onClick={() => {
                  setSelectedCycleId(cycle.cycleId);
                  fetchCycleStudents(cycle.cycleId);
                }}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedCycleId === cycle.cycleId
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{cycle.name}</p>
                    <p className="text-sm text-gray-500">{cycle.students} students</p>
                  </div>
                  <Badge variant={cycle.status === 'active' ? 'green' : cycle.status === 'completed' ? 'gray' : 'blue'}>
                    {cycle.status}
                  </Badge>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>{cycle.placed} placed</span>
                  <span>{cycle.inProgress} in progress</span>
                </div>
                {cycle.targetPlacements > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{cycle.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-primary-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(cycle.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No placement cycles yet</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-primary-600 text-sm hover:underline"
              >
                Create your first cycle
              </button>
            </div>
          )}
        </div>

        {/* Selected Cycle Details */}
        {selectedCycleId && (
          <>
            <div className="lg:col-span-2 space-y-4">
              {/* Assign Students */}
              <div className="card">
                <h4 className="font-medium mb-3">Add Students to Cycle</h4>
                {unassignedStudents.length > 0 ? (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                      {unassignedStudents.map((student) => (
                        <label
                          key={student._id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents([...selectedStudents, student._id]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(id => id !== student._id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {student.studentProfile?.currentSchool || 'No school'}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handleAssignStudents}
                      disabled={selectedStudents.length === 0}
                      className="btn btn-primary btn-sm w-full"
                    >
                      Add {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''} to Cycle
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    All students are assigned to cycles
                  </p>
                )}
              </div>

              {/* Cycle Students */}
              <div className="card">
                <h4 className="font-medium mb-3">Students in Cycle ({cycleStudents.length})</h4>
                {loadingStudents ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : cycleStudents.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cycleStudents.map((student) => (
                      <div
                        key={student._id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={student.placementStatus === 'placed' ? 'green' : 'gray'}>
                            {student.applicationCount} apps
                          </Badge>
                          <button
                            onClick={() => handleRemoveStudent(student._id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove from cycle"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No students in this cycle
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Cycle Modal */}
      {showModal && (
        <NewCycleModal 
          onClose={() => setShowModal(false)} 
          onSuccess={() => {
            setShowModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
};

// New Cycle Modal Component
const NewCycleModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    description: '',
    targetPlacements: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 1; y <= currentYear + 2; y++) {
    years.push(y);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await placementCycleAPI.createCycle({
        ...formData,
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        targetPlacements: formData.targetPlacements ? parseInt(formData.targetPlacements) : 0
      });
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create cycle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create New Placement Cycle</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                className="input w-full"
                required
              >
                {months.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="input w-full"
                required
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Placements (optional)
            </label>
            <input
              type="number"
              value={formData.targetPlacements}
              onChange={(e) => setFormData({ ...formData, targetPlacements: e.target.value })}
              className="input w-full"
              placeholder="e.g., 50"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input w-full"
              rows={3}
              placeholder="Any notes about this placement cycle..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default POCDashboard;
