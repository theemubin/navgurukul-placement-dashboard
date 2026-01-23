import { useState, useEffect } from 'react';
import { statsAPI } from '../../services/api';
import api from '../../services/api';
import { StatsCard, LoadingSpinner } from '../../components/common/UIComponents';
import UserApprovals from '../../components/manager/UserApprovals';
import ManagerStudents from '../../components/manager/ManagerStudents';
import { 
  Users, Briefcase, Building2, Award, TrendingUp, 
  CheckCircle, Clock, BarChart3, PieChart, Download, UserCog
} from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [coordinatorStats, setCoordinatorStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [activeTab, setActiveTab] = useState('approvals');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchStats();
    fetchCoordinatorStats();
    fetchPendingCount();
  }, [dateRange]);

  // Auto-refresh pending approvals count every 30s and listen for manual events
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPendingCount();
    }, 30000);

    const onPendingChanged = () => fetchPendingCount();
    window.addEventListener('pending:changed', onPendingChanged);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('pending:changed', onPendingChanged);
    };
  }, []);

  const fetchPendingCount = async () => {
    try {
      const resp = await api.get('/auth/pending-approvals');
      setPendingCount(Array.isArray(resp.data) ? resp.data.length : 0);
    } catch (err) {
      console.error('Failed to fetch pending approvals count', err);
      setPendingCount(0);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await statsAPI.getDashboardStats();
      setStats(response.data);
    } catch (error) {
      toast.error('Error fetching statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoordinatorStats = async () => {
    try {
      const response = await statsAPI.getCoordinatorStats();
      setCoordinatorStats(response.data);
    } catch (error) {
      console.error('Error fetching coordinator stats:', error);
    }
  };

  const exportData = (format) => {
    toast.success(`Exporting data as ${format.toUpperCase()}...`);
    // In real implementation, call API to generate export
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate derived metrics
  const placementRate = stats?.totalStudents > 0 
    ? ((stats?.placedStudents || 0) / stats.totalStudents * 100).toFixed(1) 
    : 0;
  
  const applicationSuccessRate = stats?.totalApplications > 0
    ? ((stats?.selectedApplications || 0) / stats.totalApplications * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-gray-600">Overview of placement statistics and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-sm"
          >
            <option value="all">All Time</option>
            <option value="year">This Year</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
          </select>
          <div className="relative">
            <button className="btn btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Students"
          value={stats?.totalStudents || 0}
          icon={Users}
          color="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Active Jobs"
          value={stats?.activeJobs || 0}
          icon={Briefcase}
          color="secondary"
        />
        <StatsCard
          title="Total Applications"
          value={stats?.totalApplications || 0}
          icon={Clock}
          color="accent"
        />
        <StatsCard
          title="Placements"
          value={stats?.placedStudents || 0}
          icon={Award}
          color="success"
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Placement Rate
          </h2>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold text-primary-600">{placementRate}%</div>
            <div className="text-sm text-gray-500 mb-2">
              {stats?.placedStudents || 0} out of {stats?.totalStudents || 0} students placed
            </div>
          </div>
          <div className="mt-4 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-1000"
              style={{ width: `${placementRate}%` }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Application Success Rate
          </h2>
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold text-green-600">{applicationSuccessRate}%</div>
            <div className="text-sm text-gray-500 mb-2">
              {stats?.selectedApplications || 0} selections from {stats?.totalApplications || 0} applications
            </div>
          </div>
          <div className="mt-4 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-1000"
              style={{ width: `${applicationSuccessRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Application Status Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-gray-600" />
            Application Status
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Pending', value: stats?.pendingApplications || 0, color: 'bg-yellow-500' },
              { label: 'Under Review', value: stats?.underReviewApplications || 0, color: 'bg-blue-500' },
              { label: 'Shortlisted', value: stats?.shortlistedApplications || 0, color: 'bg-purple-500' },
              { label: 'Interviewing', value: stats?.interviewingApplications || 0, color: 'bg-orange-500' },
              { label: 'Selected', value: stats?.selectedApplications || 0, color: 'bg-green-500' },
              { label: 'Rejected', value: stats?.rejectedApplications || 0, color: 'bg-red-500' }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm text-gray-600">{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Campus Statistics */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-600" />
            Campus Overview
          </h2>
          <div className="space-y-4">
            {(stats?.campusStats || []).slice(0, 5).map((campus, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{campus.name}</p>
                  <p className="text-xs text-gray-500">{campus.students} students</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">{campus.placements}</p>
                  <p className="text-xs text-gray-500">placements</p>
                </div>
              </div>
            ))}
            {(!stats?.campusStats || stats.campusStats.length === 0) && (
              <p className="text-gray-500 text-center py-4">No campus data available</p>
            )}
          </div>
        </div>

        {/* Top Companies */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-gray-600" />
            Top Recruiting Companies
          </h2>
          <div className="space-y-4">
            {(stats?.topCompanies || []).slice(0, 5).map((company, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.hires} hires</p>
                </div>
              </div>
            ))}
            {(!stats?.topCompanies || stats.topCompanies.length === 0) && (
              <p className="text-gray-500 text-center py-4">No company data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Manager Tabs: Pending Approvals / Students */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className={`px-3 py-2 rounded-md font-medium ${activeTab === 'approvals' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-700'}`} onClick={() => setActiveTab('approvals')}>
              Pending Approvals
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">{pendingCount}</span>
              )}
            </button>
            <button className={`px-3 py-2 rounded-md font-medium ${activeTab === 'students' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-700'}`} onClick={() => setActiveTab('students')}>Students</button>
          </div>
        </div>

        <div className="mt-4">
          {activeTab === 'approvals' ? <UserApprovals /> : <ManagerStudents />}
        </div>
      </div>

      {/* Coordinator Performance Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary-600" />
          Coordinator Job Distribution
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Coordinator</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Total Jobs</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Active Jobs</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Applications</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Placements</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coordinatorStats.map((coord, index) => (
                <tr key={coord.coordinator.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-bold text-primary-600">
                        {coord.coordinator.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{coord.coordinator.name}</p>
                        <p className="text-xs text-gray-500">{coord.coordinator.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-900">{coord.totalJobs}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {coord.activeJobs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-600">{coord.totalApplications}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-primary-600">{coord.placements}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      coord.conversionRate >= 20 ? 'bg-green-100 text-green-700' :
                      coord.conversionRate >= 10 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {coord.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
              {coordinatorStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No coordinator data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{stats?.totalCampuses || 0}</p>
          <p className="text-sm text-gray-500">Campuses</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{stats?.totalPocs || 0}</p>
          <p className="text-sm text-gray-500">Campus POCs</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{stats?.totalCoordinators || 0}</p>
          <p className="text-sm text-gray-500">Coordinators</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{stats?.totalJobs || 0}</p>
          <p className="text-sm text-gray-500">Total Jobs</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          Recent Placements
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Company</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Campus</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stats?.recentPlacements || []).slice(0, 5).map((placement, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{placement.studentName}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{placement.company}</td>
                  <td className="px-4 py-3 text-gray-600">{placement.role}</td>
                  <td className="px-4 py-3 text-gray-600">{placement.campus}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(placement.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!stats?.recentPlacements || stats.recentPlacements.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No recent placements
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
