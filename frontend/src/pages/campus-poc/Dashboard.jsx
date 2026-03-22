import { useState, useEffect } from 'react';
import { formatDistanceToNow, isPast, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { statsAPI, placementCycleAPI, userAPI, campusAPI, gharAPI } from '../../services/api';
import { StatsCard, LoadingSpinner, Badge, Modal } from '../../components/common/UIComponents';
import {
  Users, CheckSquare, FileText, TrendingUp, AlertCircle, Building2,
  GraduationCap, Calendar, ChevronDown, ChevronUp, Eye, Clock,
  CheckCircle, XCircle, Briefcase, ArrowRight, Plus, Filter, Settings, RefreshCw,
  MessageSquare, ClipboardList, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

const POCDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingSkills, setPendingSkills] = useState([]);
  const [pendingProfilesCount, setPendingProfilesCount] = useState(0);
  const [companyTracking, setCompanyTracking] = useState([]);
  const [schoolTracking, setSchoolTracking] = useState([]);
  const [eligibleJobs, setEligibleJobs] = useState([]);
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [studentSummary, setStudentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('jobs'); // Active jobs first as default
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showCycleModal, setShowCycleModal] = useState(false);
  // Campus selection state
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [allCampuses, setAllCampuses] = useState([]);
  const [managedCampuses, setManagedCampuses] = useState([]);
  const [selectedCampuses, setSelectedCampuses] = useState([]);
  const [savingCampuses, setSavingCampuses] = useState(false);
  // Eligible students modal state
  const [eligibleStudentsModal, setEligibleStudentsModal] = useState({ open: false, job: null, students: [], loading: false });
  const [studentFilter, setStudentFilter] = useState('all'); // 'all', 'applied', 'not-applied'

  useEffect(() => {
    fetchDashboardData();
    fetchCampusData();
    fetchTrackingData();
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchTrackingData();
  }, [selectedStatus, selectedCycle]);

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

  const handleUpdateManagedCampuses = async (campusIds) => {
    setSavingCampuses(true); // Assuming this is still relevant for the new function
    try {
      await userAPI.updateManagedCampuses(campusIds);
      toast.success('Managed campuses updated');
      setShowCampusModal(false); // Changed from setShowCampusSelector to setShowCampusModal
      fetchCampusData();
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating managed campuses:', error);
      toast.error(error.response?.data?.message || 'Failed to update managed campuses');
    } finally {
      setSavingCampuses(false);
    }
  };

  const handleGharSync = async (email) => {
    if (!email) return;
    try {
      toast.loading('Syncing with Ghar...', { id: 'ghar-sync' });
      const response = await gharAPI.syncStudent(email);
      const updatedData = response.data.data?.student;
      toast.success('Synced with Ghar successfully', { id: 'ghar-sync' });
      
      // Update local state instead of full dashboard re-fetch
      setStudentSummary(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.map(s => s.email?.toLowerCase() === email?.toLowerCase() ? {
            ...s,
            placementStatus: updatedData.resolvedProfile?.currentStatus || s.placementStatus
          } : s)
        };
      });

      // Also refresh the overall stats in the background
      fetchDashboardData();
    } catch (error) {
      console.error('Error syncing with Ghar:', error);
      toast.error(error.response?.data?.message || 'Failed to sync with Ghar', { id: 'ghar-sync' });
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
      const [statsResponse, pendingResponse, cyclesResponse, jobsResponse] = await Promise.all([
        statsAPI.getCampusPocStats(selectedStatus),
        userAPI.getPendingSkills(),
        statsAPI.getCycleStats(),
        statsAPI.getEligibleJobs()
      ]);
      setStats(statsResponse.data);
      setPendingSkills(pendingResponse.data.slice(0, 5));
      setPendingProfilesCount(statsResponse.data.pendingProfileApprovals || 0);
      setCycles(cyclesResponse.data);
      setEligibleJobs(jobsResponse.data.jobs || []);
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
        statsAPI.getStudentSummary({ cycleId: selectedCycle, status: selectedStatus === 'all' ? undefined : selectedStatus })
      ]);
      setCompanyTracking(companyRes.data);
      setSchoolTracking(schoolRes.data);
      setStudentSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  };

  const getCategorizedCompanyTracking = () => {
    // Process companies and their jobs
    const processedCompanies = companyTracking.map(company => {
      const sortedJobs = [...company.jobs].sort((a, b) => {
        const aDeadline = a.applicationDeadline ? new Date(a.applicationDeadline).getTime() : Infinity;
        const bDeadline = b.applicationDeadline ? new Date(b.applicationDeadline).getTime() : Infinity;
        
        // Both past - sort by most recent deadline first
        if (isPast(aDeadline) && isPast(bDeadline)) return bDeadline - aDeadline;
        // A past - put b first
        if (isPast(aDeadline)) return 1;
        // B past - put a first
        if (isPast(bDeadline)) return -1;
        
        // Both future - sort by soonest deadline first
        return aDeadline - bDeadline;
      });

      // Determine company-level status (best job status)
      let status = 'closed';
      if (sortedJobs.some(j => !isPast(new Date(j.applicationDeadline)) && (j.status === 'active' || j.status === 'application_stage'))) {
        status = 'open';
      } else if (sortedJobs.some(j => (j.status !== 'closed' && j.status !== 'filled') || !isPast(new Date(j.applicationDeadline)))) {
        status = 'active';
      }

      return { ...company, jobs: sortedJobs, companyStatus: status };
    });

    // Grouping
    const groups = {
      open: processedCompanies.filter(c => c.companyStatus === 'open'),
      active: processedCompanies.filter(c => c.companyStatus === 'active'),
      closed: processedCompanies.filter(c => c.companyStatus === 'closed')
    };

    // Sort companies within each group by their earliest deadline (for open/active)
    const sortFn = (a, b) => {
      const aMin = Math.min(...a.jobs.map(j => new Date(j.applicationDeadline).getTime() || Infinity));
      const bMin = Math.min(...b.jobs.map(j => new Date(j.applicationDeadline).getTime() || Infinity));
      return aMin - bMin;
    };

    groups.open.sort(sortFn);
    groups.active.sort(sortFn);
    groups.closed.sort((a, b) => {
      // For closed, sort by most recent deadline descending
      const aMax = Math.max(...a.jobs.map(j => new Date(j.applicationDeadline).getTime() || 0));
      const bMax = Math.max(...b.jobs.map(j => new Date(b.applicationDeadline).getTime() || 0));
      return bMax - aMax;
    });

    return groups;
  };

  const fetchEligibleStudents = async (job) => {
    setEligibleStudentsModal({ open: true, job, students: [], loading: true });
    try {
      const response = await statsAPI.getJobEligibleStudents(job._id);
      setEligibleStudentsModal(prev => ({
        ...prev,
        students: response.data.students,
        total: response.data.total,
        applied: response.data.applied,
        notApplied: response.data.notApplied,
        loading: false
      }));
    } catch (error) {
      console.error('Error fetching eligible students:', error);
      toast.error('Failed to load eligible students');
      setEligibleStudentsModal(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchAllApprovedStudents = async () => {
    setEligibleStudentsModal({
      open: true,
      job: { title: 'All Approved Students', company: { name: 'Campus Summary' } },
      students: [],
      loading: true
    });
    try {
      const response = await statsAPI.getStudentSummary({ cycleId: selectedCycle });
      // Map summary data to match the modal's expected student format
      const students = (response.data.students || []).map(s => ({
        _id: s.studentId,
        firstName: s.name.split(' ')[0],
        lastName: s.name.split(' ').slice(1).join(' '),
        email: s.email,
        school: s.school,
        hasApplied: s.totalApplications > 0,
        applicationStatus: s.placementStatus,
        skillMatch: 100 // Default for general list
      }));

      setEligibleStudentsModal(prev => ({
        ...prev,
        students,
        total: response.data.summary?.total || students.length,
        applied: response.data.summary?.placed + response.data.summary?.inProgress,
        notApplied: response.data.summary?.notApplied,
        loading: false
      }));
    } catch (error) {
      console.error('Error fetching student summary:', error);
      toast.error('Failed to load student list');
      setEligibleStudentsModal(prev => ({ ...prev, loading: false }));
    }
  };

  const getFilteredEligibleStudents = () => {
    if (studentFilter === 'applied') {
      return eligibleStudentsModal.students.filter(s => s.hasApplied);
    } else if (studentFilter === 'not-applied') {
      return eligibleStudentsModal.students.filter(s => !s.hasApplied);
    }
    return eligibleStudentsModal.students;
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
    const statusKey = (status || '').toLowerCase().replace(' ', '_');
    const config = statusConfig[statusKey] || { color: 'gray', label: status };
    return <Badge variant={config.color}>{config.label}</Badge>;
  };

  const StatusBadge = ({ color, count, label }) => (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color === 'blue' ? 'bg-blue-100 text-blue-700' : color === 'amber' ? 'bg-amber-100 text-amber-700' : color === 'orange' ? 'bg-orange-100 text-orange-700' : color === 'green' ? 'bg-green-100 text-green-700' : color === 'indigo' ? 'bg-indigo-100 text-indigo-700' : color === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
      <span className="font-bold">{count}</span>
      <span>{label}</span>
    </div>
  );

  if (loading && !stats) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-4 animate-fadeIn pb-12">
      {/* Dynamic Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Campus PoC Dashboard</h1>
            <button
              onClick={() => setShowCycleModal(true)}
              className="px-2 py-1 bg-primary-50 text-primary-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-3 h-3 inline mr-1" /> New Cycle
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">Managing:</span>
            {managedCampuses.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {managedCampuses.map(campus => (
                  <span key={campus._id} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{campus.name}</span>
                ))}
              </div>
            ) : (
              <span className="font-bold text-gray-700">Loading...</span>
            )}
            <button onClick={() => setShowCampusModal(true)} className="text-primary-600 hover:underline flex items-center gap-1 font-bold ml-1">
              <Settings className="w-3 h-3" /> Change
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-700 p-0 focus:ring-0 min-w-[120px]"
            >
              <option value="all">All Students</option>
              <option value="placed">Placed</option>
              <option value="ready">Ready to Place</option>
              <option value="under-process">Under Process</option>
              <option value="dropout">Dropout</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-gray-700 p-0 focus:ring-0 min-w-[120px]"
            >
              <option value="">All placement cycles</option>
              {cycles.map(cycle => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.name || `${format(new Date(), 'MMMM')} ${format(new Date(), 'yyyy')}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Compact Status Strip */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <StatusBadge color="blue" count={studentSummary?.total || 0} label="Total" />
        <StatusBadge color="amber" count={pendingSkills.length} label="Pending Skills" />
        <StatusBadge color="orange" count={pendingProfilesCount} label="Pending Profiles" />
        <StatusBadge color="green" count={stats?.readinessPool?.['Job Ready'] || 0} label="Job Ready" />
        <StatusBadge color="indigo" count={stats?.readinessPool?.['Job Ready Under Process'] || 0} label="In Process" />
        <StatusBadge color="purple" count={stats?.interestCount || 0} label="Interested" />
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
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedCampuses.includes(campus._id)
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
                onClick={() => handleUpdateManagedCampuses(selectedCampuses)}
                disabled={savingCampuses || selectedCampuses.length === 0}
                className="btn btn-primary"
              >
                {savingCampuses ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eligible Students Modal */}
      <Modal
        isOpen={eligibleStudentsModal.open}
        onClose={() => {
          setEligibleStudentsModal({ open: false, job: null, students: [], loading: false });
          setStudentFilter('all');
        }}
        title={eligibleStudentsModal.job?.title || 'Eligible Students'}
        description={eligibleStudentsModal.job?.company?.name}
      >
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Students ({getFilteredEligibleStudents().length})</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setStudentFilter('all')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${studentFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                All ({eligibleStudentsModal.total || 0})
              </button>
              <button
                onClick={() => setStudentFilter('applied')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${studentFilter === 'applied' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Applied ({eligibleStudentsModal.applied || 0})
              </button>
              <button
                onClick={() => setStudentFilter('not-applied')}
                className={`px-3 py-1 rounded-full text-sm font-medium ${studentFilter === 'not-applied' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Not Applied ({eligibleStudentsModal.notApplied || 0})
              </button>
            </div>
          </div>

          {eligibleStudentsModal.loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : getFilteredEligibleStudents().length > 0 ? (
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredEligibleStudents().map((student) => (
                    <tr key={student._id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link to={`/campus-poc/students/${student._id}`} className="text-primary-600 hover:underline">
                          {student.firstName} {student.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {getStatusBadge(student.applicationStatus?.toLowerCase().replace(' ', '_') || 'not_applied')}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {student.hasApplied ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No students found for this filter.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Tab Navigation */}
      <div className="border-b border-gray-100">
        <nav className="flex gap-2 overflow-x-auto -mb-px">
          {[
            { id: 'jobs', label: 'Active Jobs', icon: Briefcase },
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'company', label: 'Company-wise', icon: Building2 },
            { id: 'school', label: 'School-wise', icon: GraduationCap },
            { id: 'summary', label: 'Student Summary', icon: Users },
            { id: 'cycles', label: 'Placement Cycles', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/campus-poc/skills" className="card hover:shadow-md transition-shadow p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <CheckSquare className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Skill Management</p>
                    <p className="text-xs text-gray-500">{pendingSkills.length} pending</p>
                  </div>
                </div>
              </Link>
              <Link to="/campus-poc/profile-approvals" className="card hover:shadow-md transition-shadow p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Profile Approvals</p>
                    <p className="text-xs text-gray-500">{pendingProfilesCount} pending</p>
                  </div>
                </div>
              </Link>
              <Link to="/campus-poc/students" className="card hover:shadow-md transition-shadow p-3">
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
              <Link to="/campus-poc/job-readiness-criteria" className="card hover:shadow-md transition-shadow p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Job Readiness Criteria</p>
                    <p className="text-xs text-gray-500">Manage school-wide criteria</p>
                  </div>
                </div>
              </Link>
              <button onClick={() => setActiveTab('cycles')} className="card hover:shadow-md transition-shadow p-3 text-left">
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Pending Skill Approvals</h3>
              <Link to="/campus-poc/skill-approvals" className="text-primary-600 text-sm hover:underline">
                View all
              </Link>
            </div>
            {pendingSkills.length > 0 ? (
              <div className="space-y-2">
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
              <h3 className="font-semibold mb-3">Student Placement Overview</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-7 h-7 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-green-600">{studentSummary.summary.placed}</p>
                  <p className="text-xs text-gray-600">Placed</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <Clock className="w-7 h-7 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-yellow-600">{studentSummary.summary.inProgress}</p>
                  <p className="text-xs text-gray-600">In Progress</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Users className="w-7 h-7 text-gray-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-gray-600">{studentSummary.summary.notApplied}</p>
                  <p className="text-xs text-gray-600">Not Applied</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-7 h-7 text-red-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-red-600">{studentSummary.summary.rejected}</p>
                  <p className="text-xs text-gray-600">Rejected</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-900">Active Jobs for Your Campus</h3>
              <p className="text-sm text-gray-500">Jobs your students can apply to</p>
            </div>
            <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-medium">
              {eligibleJobs.length} active jobs
            </span>
          </div>

          {/* Job type tabs */}
          <div className="flex gap-3 mt-3">
            <button onClick={() => setJobTypeFilter('all')} className={`px-3 py-1 rounded ${jobTypeFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
              All
            </button>
            <button onClick={() => setJobTypeFilter('internship')} className={`px-3 py-1 rounded ${jobTypeFilter === 'internship' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
              Internships
            </button>
            <button onClick={() => setJobTypeFilter('paid_project')} className={`px-3 py-1 rounded ${jobTypeFilter === 'paid_project' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
              Paid Projects
            </button>
          </div>

          {/* Filtered job metrics (update when jobTypeFilter or eligibleJobs change) */}
          {eligibleJobs && (
            (() => {
              const filteredJobs = eligibleJobs.filter(j => jobTypeFilter === 'all' ? true : (j.jobType === jobTypeFilter));
              const activeJobsCount = filteredJobs.length;
              const totalApplications = filteredJobs.reduce((acc, j) => acc + (j.applicationCount || 0), 0);
              const eligibleStudentsCount = filteredJobs.reduce((acc, j) => acc + (j.eligibleStudents || 0), 0);
              const selectedCount = filteredJobs.reduce((acc, j) => acc + (j.statusCounts?.selected || 0), 0);

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard icon={Briefcase} label="Active Jobs" value={activeJobsCount} color="secondary" compact />
            <StatsCard 
                    icon={Users} 
                    label="Eligible Students" 
                    value={eligibleStudentsCount} 
                    color="primary" 
                    onClick={fetchAllApprovedStudents}
                    compact
                  />
            <StatsCard icon={Clock} label="Applications" value={totalApplications} color="accent" compact />
            <StatsCard icon={CheckCircle} label="Selected" value={selectedCount} color="success" compact />
          </div>
              );
            })()
          )}

          {eligibleJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {eligibleJobs
                .filter(j => jobTypeFilter === 'all' ? true : (j.jobType === jobTypeFilter))
                .map((job) => (
                  <div key={job._id} className="card hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{job.title}</h4>
                          <p className="text-sm text-gray-600">{job.company?.name}</p>
                          <p className="text-xs text-gray-500 capitalize mt-1">{job.jobType?.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Link 
                          to={`/campus-poc/jobs/${job._id}`}
                          className="text-xs bg-primary-50 text-primary-600 px-3 py-1.5 rounded-lg border border-primary-100 hover:bg-primary-100 transition-all font-bold flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Details
                        </Link>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Deadline</p>
                          <p className="text-xs font-bold text-gray-700">
                             {format(new Date(job.applicationDeadline), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center justify-between py-3 border-t border-b border-gray-100 mb-3">
                      <button
                        className="text-center hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        onClick={() => fetchEligibleStudents(job)}
                        title="Click to view eligible students"
                      >
                        <p className="text-lg font-bold text-indigo-600 hover:underline">{job.eligibleStudents}</p>
                        <p className="text-xs text-gray-500">Eligible</p>
                      </button>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-600">{job.applicationCount}</p>
                        <p className="text-xs text-gray-500">Applied</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-yellow-600">{job.statusCounts?.shortlisted + job.statusCounts?.in_progress || 0}</p>
                        <p className="text-xs text-gray-500">In Progress</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">{job.statusCounts?.selected || 0}</p>
                        <p className="text-xs text-gray-500">Selected</p>
                      </div>
                    </div>

                    {/* Application Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Application Rate</span>
                        <span>{job.eligibleStudents > 0 ? Math.round((job.applicationCount / job.eligibleStudents) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary-500 transition-all"
                          style={{ width: `${job.eligibleStudents > 0 ? (job.applicationCount / job.eligibleStudents) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Positions */}
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">{job.maxPositions} position{job.maxPositions !== 1 ? 's' : ''} available</span>
                      {job.applicationCount === 0 && (
                        <span className="text-orange-600 text-xs font-medium">No applications yet</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No active jobs available</p>
              <p className="text-sm">There are no jobs currently open for your campus</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'company' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Company-wise Application Tracking</h3>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Open</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Active</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Closed</span>
            </div>
          </div>

          <div className="space-y-8">
            {(() => {
              const groups = getCategorizedCompanyTracking();
              const sections = [
                { id: 'open', label: 'Open for Application', companies: groups.open, color: 'text-green-700 bg-green-50' },
                { id: 'active', label: 'Ongoing Process / Active', companies: groups.active, color: 'text-blue-700 bg-blue-50' },
                { id: 'closed', label: 'Closed / Completed', companies: groups.closed, color: 'text-gray-600 bg-gray-50' }
              ];

              return sections.map(section => (
                <div key={section.id} className="space-y-3">
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-between ${section.color}`}>
                    {section.label}
                    <Badge variant={section.id === 'open' ? 'success' : section.id === 'active' ? 'primary' : 'default'}>
                      {section.companies.length}
                    </Badge>
                  </div>
                  
                  {section.companies.length > 0 ? (
                    <div className="space-y-3 pl-2">
                      {section.companies.map((company) => (
                        <div key={company.company} className="card p-0 overflow-hidden border-l-4 border-l-indigo-500">
                          <button
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedCompany(expandedCompany === company.company ? null : company.company)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center p-1 overflow-hidden">
                                {company.logo ? (
                                  <img src={company.logo} alt={company.company} className="w-full h-full object-contain" />
                                ) : (
                                  <Building2 className="w-6 h-6 text-gray-300" />
                                )}
                              </div>
                              <div className="text-left">
                                <h4 className="text-lg font-bold text-gray-900">{company.company}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                  {Object.entries(company.statusCounts)
                                    .filter(([_, count]) => count > 0)
                                    .map(([status, count]) => (
                                      <span key={status} className="text-xs text-gray-500 flex items-center gap-1">
                                        {count} {status}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-indigo-600">{company.totalApplications}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Applications</p>
                              </div>
                              {expandedCompany === company.company ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </button>

                          {expandedCompany === company.company && (
                            <div className="px-6 pb-6 bg-white border-t">
                              <div className="mt-4 space-y-4">
                                {company.jobs.map((job) => (
                                  <div key={job.jobId} className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-indigo-100 transition-colors">
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                          {job.title}
                                          {!isPast(new Date(job.applicationDeadline)) && (
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                          )}
                                        </h5>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                          <p className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-medium uppercase tracking-tight">
                                            {job.jobType?.replace('_', ' ')}
                                          </p>
                                          <Link 
                                            to={`/campus-poc/jobs/${job.jobId}`}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                                            target="_blank"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            View Details
                                          </Link>
                                          {job.eligibleCount !== undefined && (
                                            <button
                                              onClick={() => fetchEligibleStudents({ ...job, _id: job.jobId })}
                                              className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                                              title="Click to view eligible students"
                                            >
                                              <Users className="w-3 h-3" />
                                              {job.eligibleCount} Eligible
                                            </button>
                                          )}
                                          {job.applicationDeadline && (
                                            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${isPast(new Date(job.applicationDeadline))
                                              ? 'bg-red-50 text-red-600 border-red-100'
                                              : 'bg-orange-50 text-orange-600 border-orange-100 shadow-sm'
                                              }`}>
                                              <Clock className="w-3 h-3" />
                                              {isPast(new Date(job.applicationDeadline)) ? (
                                                <span>Closed ({format(new Date(job.applicationDeadline), 'MMM dd')})</span>
                                              ) : (
                                                <span className="font-bold uppercase tracking-tight">
                                                  Closing {formatDistanceToNow(new Date(job.applicationDeadline), { addSuffix: true })}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col items-end gap-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${job.status === 'active' || job.status === 'application_stage' ? 'bg-green-100 text-green-700 border border-green-200' :
                                            job.status === 'closed' || isPast(new Date(job.applicationDeadline)) ? 'bg-red-100 text-red-700 border border-red-200' :
                                              'bg-blue-100 text-blue-700 border border-blue-200'
                                            }`}>
                                            {isPast(new Date(job.applicationDeadline)) ? 'Deadline Passed' : job.status?.replace('_', ' ')}
                                          </span>
                                        </div>
                                        <div className="bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                                          <span className="text-sm font-bold text-gray-800">
                                            {job.applications.length}
                                          </span>
                                          <span className="ml-1.5 text-xs text-gray-500 font-medium">Applicants</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {job.applications.length > 0 ? (
                                      <div className="overflow-x-auto rounded-lg border border-gray-100 shadow-inner">
                                        <table className="w-full text-left text-sm">
                                          <thead className="bg-gray-100 text-gray-700 border-b">
                                            <tr>
                                              <th className="px-4 py-2 font-semibold">Student Name</th>
                                              <th className="px-4 py-2 font-semibold">School</th>
                                              <th className="px-4 py-2 font-semibold text-center">Current Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y bg-white">
                                            {job.applications.map((app) => (
                                              <tr key={app.applicationId} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-4 py-2.5 font-medium text-gray-900">{app.studentName}</td>
                                                <td className="px-4 py-2.5 text-gray-600">{app.school}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                  <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${app.status === 'selected' ? 'bg-green-100 text-green-700' :
                                                    app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                      'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {app.status}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <div className="text-center py-4 bg-white rounded-lg border border-dashed text-gray-400 text-xs">
                                        No applications yet for this campus
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-sm italic bg-gray-50/50 rounded-lg">
                      No companies in this category
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
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

      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Student Placement Summary</h3>
              <p className="text-xs text-gray-500">Comprehensive overview of all student applications and progress</p>
            </div>
          </div>

          {!studentSummary || studentSummary.students.length === 0 ? (
            <div className="card text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No students found matching current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {studentSummary.students.map((student) => {
                const isExpanded = expandedStudent === student.studentId;
                return (
                  <div 
                    key={student.studentId} 
                    className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${isExpanded ? 'ring-2 ring-primary-500 border-transparent' : 'hover:border-gray-300 border-gray-100'}`}
                  >
                    {/* Accordion Header */}
                    <div 
                      className="p-4 cursor-pointer flex items-center justify-between"
                      onClick={() => setExpandedStudent(isExpanded ? null : student.studentId)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 flex-1">
                          <div>
                            <Link 
                              to={`/campus-poc/students/${student.studentId}`}
                              className="font-bold text-gray-900 hover:text-primary-600 truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {student.name}
                            </Link>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{student.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Placement Status</p>
                            <div className="mt-0.5">{getStatusBadge(student.placementStatus)}</div>
                          </div>
                          <div className="hidden md:block">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Navgurukul School</p>
                            <p className="text-xs font-semibold text-gray-700 mt-0.5">{student.school}</p>
                          </div>
                          <div className="text-right pr-4">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Applications</p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">
                              {student.totalApplications} <span className="text-xs font-medium text-gray-500">Total</span>
                              {student.activeApplications > 0 && <span className="ml-1 text-green-600 text-xs">({student.activeApplications} Active)</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                           <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGharSync(student.email);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary-600 transition-colors"
                            title="Sync status with Ghar"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-50 bg-gray-50/30 rounded-b-xl animate-fadeIn">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <ClipboardList className="w-3.5 h-3.5" />
                          Application History
                        </h4>
                        
                        {student.applications.length === 0 ? (
                          <div className="text-center py-6 bg-white rounded-lg border border-dashed border-gray-200">
                            <p className="text-sm text-gray-500">No applications found for this student.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {student.applications.map((app) => (
                              <div key={app.applicationId} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                                      <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h5 className="font-bold text-gray-900">{app.company}</h5>
                                      <p className="text-sm text-gray-600">{app.job}</p>
                                      <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">Applied on {new Date(app.appliedAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Current Status</p>
                                      {getStatusBadge(app.status)}
                                    </div>
                                    <Link 
                                      to={`/campus-poc/jobs/${app.jobId || ''}`}
                                      className="p-2 hover:bg-gray-100 rounded-lg text-primary-600 transition-colors"
                                      title="View Job Details"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </Link>
                                  </div>
                                </div>

                                {/* Progress & Round Results */}
                                {app.roundResults && app.roundResults.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-50">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Interview Progress</p>
                                    <div className="flex flex-wrap gap-2">
                                      {app.roundResults.map((round, idx) => (
                                        <div key={idx} className={`px-3 py-2 rounded-lg border text-xs ${
                                          round.status === 'passed' ? 'bg-green-50 border-green-100 text-green-700' :
                                          round.status === 'failed' ? 'bg-red-50 border-red-100 text-red-700' :
                                          'bg-blue-50 border-blue-100 text-blue-700'
                                        }`}>
                                          <div className="font-bold flex items-center gap-1">
                                            <span>R{round.round}: {round.roundName}</span>
                                            {round.status === 'passed' ? <CheckCircle className="w-3 h-3" /> : round.status === 'failed' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                          </div>
                                          {round.feedback && <p className="mt-1 text-[10px] opacity-80 italic italic">"{round.feedback}"</p>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Recruiter Comments */}
                                {app.feedback && (
                                  <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg flex items-start gap-3">
                                    <MessageSquare className="w-4 h-4 text-indigo-500 mt-1" />
                                    <div>
                                      <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Overall Recruiter Feedback</p>
                                      <p className="text-sm text-gray-700 italic">"{app.feedback}"</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 text-center">
                          <Link 
                            to={`/campus-poc/students/${student.studentId}`}
                            className="text-xs font-bold text-primary-600 hover:underline flex items-center justify-center gap-1"
                          >
                            View Full Student Profile <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
  const [studentSearch, setStudentSearch] = useState('');

  const filteredUnassigned = unassignedStudents.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) || 
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

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
                className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedCycleId === cycle.cycleId
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
                    <div className="flex gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search students..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="pl-9 input w-full text-sm py-2"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (selectedStudents.length === filteredUnassigned.length && filteredUnassigned.length > 0) {
                            setSelectedStudents([]);
                          } else {
                            setSelectedStudents(filteredUnassigned.map(s => s._id));
                          }
                        }}
                        className="btn btn-secondary btn-sm whitespace-nowrap"
                        disabled={filteredUnassigned.length === 0}
                      >
                        {selectedStudents.length === filteredUnassigned.length && filteredUnassigned.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 mb-3 p-1">
                      {filteredUnassigned.length > 0 ? filteredUnassigned.map((student) => (
                        <label
                          key={student._id}
                          className="flex items-center w-full p-2 hover:bg-gray-50 rounded cursor-pointer"
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
                            className="rounded border-gray-300 mr-3 cursor-pointer"
                          />
                          <div className="flex-1 w-full min-w-0" style={{ minWidth: '0' }}>
                            <p className="text-sm font-bold text-black truncate">
                              {student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : student.name || student.email || 'Unknown Student'}
                            </p>
                            <p className="text-xs text-black truncate">{student.email || 'No email'}</p>
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap ml-3">
                            {student.studentProfile?.currentSchool || student.campus?.name || 'No school'}
                          </div>
                        </label>
                      )) : (
                        <p className="text-sm text-gray-500 text-center py-4">No students match your search.</p>
                      )}
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {student.fullName || student.name || `${student.firstName} ${student.lastName}`.trim()}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {student.dateOfPlacement && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">
                              Placed: {new Date(student.dateOfPlacement).toLocaleDateString()}
                            </span>
                          )}
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

// Eligible Students Modal Component
const EligibleStudentsModal = ({ isOpen, onClose, job, students, loading, total, applied, notApplied, studentFilter, setStudentFilter, getFilteredStudents }) => {
  if (!isOpen) return null;

  const filteredStudents = getFilteredStudents();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Eligible Students</h2>
              {job && (
                <p className="text-sm text-gray-600 mt-1">
                  {job.title} at {job.company?.name}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Stats Summary */}
          {!loading && (
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{total}</p>
                <p className="text-xs text-gray-500">Total Eligible</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{applied}</p>
                <p className="text-xs text-gray-500">Applied</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{notApplied}</p>
                <p className="text-xs text-gray-500">Not Applied</p>
              </div>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => setStudentFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${studentFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              All ({total || 0})
            </button>
            <button
              onClick={() => setStudentFilter('applied')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${studentFilter === 'applied'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              Applied ({applied || 0})
            </button>
            <button
              onClick={() => setStudentFilter('not-applied')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${studentFilter === 'not-applied'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              Not Applied ({notApplied || 0})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No students found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <div
                  key={student._id}
                  className={`p-4 rounded-lg border ${student.hasApplied
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium text-sm">
                          {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                        {student.enrollmentNumber && (
                          <p className="text-xs text-gray-400">ID: {student.enrollmentNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${student.skillMatch >= 80 ? 'bg-green-100 text-green-700' :
                        student.skillMatch >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {student.skillMatch}% Match
                      </div>
                      {student.hasApplied ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          {student.applicationStatus}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-orange-600">Not Applied</p>
                      )}
                    </div>
                  </div>
                  {student.school && (
                    <p className="mt-2 text-xs text-gray-500 ml-14">
                      <GraduationCap className="w-3 h-3 inline mr-1" />
                      {student.school}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default POCDashboard;
