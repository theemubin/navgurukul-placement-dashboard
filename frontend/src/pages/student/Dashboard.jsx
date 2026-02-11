import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsAPI, applicationAPI } from '../../services/api';
import { StatsCard, LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import { FileText, Briefcase, CheckCircle, XCircle, Clock, TrendingUp, DollarSign, Eye } from 'lucide-react';

const StudentDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobReadiness, setJobReadiness] = useState(null);

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
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600">Track your placement journey</p>
      </div>

      {/* Job Readiness Summary (School of Programming only) */}
      {jobReadiness && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatsCard
            icon={CheckCircle}
            label="Job Readiness"
            value={jobReadiness.progress.isJobReady ? 'Job Ready' : jobReadiness.progress.criteria && jobReadiness.progress.criteria.filter(c => c.completed).length > 0 ? 'In Progress' : 'Not Ready'}
            subValue={jobReadiness.progress.criteria ? `${jobReadiness.progress.criteria.filter(c => c.completed).length} of ${jobReadiness.progress.criteria.length} completed` : ''}
            color={jobReadiness.progress.isJobReady ? 'green' : jobReadiness.progress.criteria && jobReadiness.progress.criteria.filter(c => c.completed).length > 0 ? 'yellow' : 'red'}
          />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={FileText}
          label="Total Applications"
          value={stats?.totalApplications || 0}
          color="blue"
        />
        <StatsCard
          icon={Clock}
          label="In Progress"
          value={stats?.inProgress || 0}
          color="yellow"
        />
        <StatsCard
          icon={CheckCircle}
          label="Selected"
          value={stats?.selected || 0}
          color="green"
        />
        <StatsCard
          icon={XCircle}
          label="Rejected"
          value={stats?.rejected || 0}
          color="red"
        />
        <StatsCard
          icon={DollarSign}
          label="Paid Projects"
          value={stats?.paidProjects || stats?.paidProjectsCount || 0}
          color="teal"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/student/jobs" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Browse Jobs</h3>
              <p className="text-sm text-gray-500">Find matching opportunities</p>
            </div>
          </div>
        </Link>
        <Link to="/student/profile" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Update Profile</h3>
              <p className="text-sm text-gray-500">Keep your profile up to date</p>
            </div>
          </div>
        </Link>
        <Link to="/students" className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Eye className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">View Portfolios</h3>
              <p className="text-sm text-gray-500">Browse student portfolios</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Applications */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Applications</h2>
          <Link to="/student/applications" className="text-primary-600 text-sm hover:underline">
            View all
          </Link>
        </div>
        {recentApplications.length > 0 ? (
          <div className="space-y-3">
            {recentApplications.map((app) => (
              <div 
                key={app._id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{app.job?.title}</p>
                  <p className="text-sm text-gray-500">{app.job?.company?.name}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No applications yet</p>
            <Link to="/student/jobs" className="text-primary-600 hover:underline">
              Browse jobs to get started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
