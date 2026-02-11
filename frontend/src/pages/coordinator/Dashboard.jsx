import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI } from '../../services/api';
import { StatsCard, LoadingSpinner } from '../../components/common/UIComponents';
import { Briefcase, FileText, Users, TrendingUp, Building, Plus, Eye } from 'lucide-react';

const CoordinatorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await statsAPI.getDashboard();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coordinator Dashboard</h1>
          <p className="text-gray-600">Manage jobs, applications, and placements</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/students" className="btn btn-secondary flex items-center gap-2" title="View student portfolios">
            <Eye className="w-4 h-4" />
            Portfolios
          </Link>
          <Link to="/coordinator/jobs/new" className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Post New Job
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          icon={Users}
          label="Total Students"
          value={stats?.summary?.totalStudents || 0}
          color="blue"
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/coordinator/jobs" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manage Jobs</h3>
              <p className="text-sm text-gray-500">Create and update job postings</p>
            </div>
          </div>
        </Link>
        <Link to="/coordinator/applications" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Review Applications</h3>
              <p className="text-sm text-gray-500">Process student applications</p>
            </div>
          </div>
        </Link>
        <Link to="/coordinator/skills" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Skill Categories</h3>
              <p className="text-sm text-gray-500">Manage available skills</p>
            </div>
          </div>
        </Link>
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
    </div>
  );
};

export default CoordinatorDashboard;
