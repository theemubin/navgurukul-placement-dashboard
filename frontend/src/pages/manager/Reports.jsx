import { useState, useEffect } from 'react';
import { statsAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import {
  BarChart3, TrendingUp, TrendingDown, Download,
  Users, Briefcase, Building2, Award, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('placement');
  const [dateRange, setDateRange] = useState('year');
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    fetchReportData();
  }, [reportType, dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await statsAPI.getReports({ dateRange });
      setReportData(response.data.data);
    } catch (error) {
      toast.error('Error fetching report data');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format) => {
    if (format === 'pdf') {
      window.print();
    } else if (format === 'excel') {
      window.open(`${import.meta.env.VITE_API_URL}/stats/export?type=placements&token=${localStorage.getItem('token')}`, '_blank');
    } else {
      toast.success(`Generating ${reportType} report as ${format.toUpperCase()}...`);
    }
  };

  // Use real data or fallback to empty array
  const monthlyData = reportData?.monthlyTrend || [];
  const maxValue = Math.max(...monthlyData.map(d => Math.max(d.applications || 0, d.placements || 0)), 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Detailed placement reports and trends</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="text-sm"
          >
            <option value="placement">Placement Report</option>
            <option value="application">Application Report</option>
            <option value="campus">Campus Report</option>
            <option value="company">Company Report</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="text-sm"
          >
            <option value="year">This Year</option>
            <option value="quarter">This Quarter</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => exportReport('pdf')}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={() => exportReport('excel')}
              className="btn btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="card bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{reportData?.totalStudents || 0}</p>
              <p className="text-sm opacity-80 uppercase tracking-wider font-semibold">Total Students</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm border-t border-white/20 pt-2">
            <TrendingUp className="w-4 h-4" />
            <span>+12% from last year</span>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{reportData?.placedStudents || 0}</p>
              <p className="text-sm opacity-80 uppercase tracking-wider font-semibold">Placements</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm border-t border-white/20 pt-2">
            <TrendingUp className="w-4 h-4" />
            <span>+8% from last year</span>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{reportData?.totalJobs || 0}</p>
              <p className="text-sm opacity-80 uppercase tracking-wider font-semibold">Job Postings</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm border-t border-white/20 pt-2">
            <TrendingUp className="w-4 h-4" />
            <span>+15% from last year</span>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-2xl font-bold">{reportData?.totalCompaniesCount || 0}</p>
              <p className="text-sm opacity-80 uppercase tracking-wider font-semibold">Companies</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm border-t border-white/20 pt-2">
            <TrendingUp className="w-4 h-4" />
            <span>+5 new this year</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            Monthly Placement Trend
          </h2>
          <div className="h-64 flex items-end gap-2">
            {monthlyData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-full">
                  <div
                    className="flex-1 bg-primary-500 rounded-t transition-all duration-500"
                    style={{ height: `${(data.applications / maxValue) * 100}%` }}
                    title={`Applications: ${data.applications}`}
                  />
                  <div
                    className="flex-1 bg-green-500 rounded-t transition-all duration-500"
                    style={{ height: `${(data.placements / maxValue) * 100}%` }}
                    title={`Placements: ${data.placements}`}
                  />
                </div>
                <span className="text-xs text-gray-500">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary-500 rounded" />
              <span>Applications</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Placements</span>
            </div>
          </div>
        </div>

        {/* Placement Rate by School */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            Placement Rate by School
          </h2>
          <div className="space-y-4">
            {(reportData?.schoolPerformance || []).map((item, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{item.school || 'Unknown School'}</span>
                  <span className="text-gray-500">{item.rate}% ({item.students} students)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${item.rate >= 80 ? 'bg-green-500' :
                      item.rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
            {(!reportData?.schoolPerformance || reportData.schoolPerformance.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recruiting Companies */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Recruiting Companies</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Rank</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Company</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Hires</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Avg Package</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(reportData?.topCompanies || []).map((company, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-600'
                        }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{company.name}</td>
                    <td className="px-3 py-2">{company.hires}</td>
                    <td className="px-3 py-2 text-green-600 font-medium">{company.package}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campus Performance */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Campus Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Campus</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Students</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Placed</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(reportData?.campusStats || []).map((campus, index) => {
                  const rate = campus.students > 0 ? Math.round((campus.placements / campus.students) * 100) : 0;
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{campus.name}</td>
                      <td className="px-3 py-2">{campus.students}</td>
                      <td className="px-3 py-2">{campus.placements}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${rate >= 80 ? 'bg-green-100 text-green-700' :
                          rate >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600" />
          Quick Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Highest Package', value: reportData?.quickStats?.highestPackage || 'N/A', color: 'text-green-600' },
            { label: 'Average Package', value: reportData?.quickStats?.averagePackage || 'N/A', color: 'text-blue-600' },
            { label: 'Lowest Package', value: reportData?.quickStats?.lowestPackage || 'N/A', color: 'text-gray-600' },
            { label: 'Total Offers', value: reportData?.quickStats?.totalOffers || '0', color: 'text-purple-600' },
            { label: 'PPO Offers', value: reportData?.quickStats?.ppoOffers || '0', color: 'text-orange-600' },
            { label: 'Dream Companies', value: reportData?.quickStats?.dreamCompanies || '0', color: 'text-primary-600' }
          ].map((stat, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;
