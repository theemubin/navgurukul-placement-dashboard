import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI, statsAPI } from '../../services/api';
import { LoadingSpinner, Pagination, EmptyState, StatusBadge, Button, StatsCard } from '../../components/common/UIComponents';
import { BulkUploadModal } from '../../components/common/BulkUpload';
import { Users, Search, ChevronRight, GraduationCap, Upload, Filter, UserCheck, UserX, Clock, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const schools = [
  'School of Programming',
  'School of Business',
  'School of Finance',
  'School of Education',
  'School of Second Chance'
];

const POCStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', school: '', batch: '', status: '' });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStudents();
    fetchStats();
  }, [pagination.current, filters]);

  const fetchStats = async () => {
    try {
      const response = await statsAPI.getCampusPocStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getStudents({
        page: pagination.current,
        limit: 15,
        search: filters.search || undefined,
        school: filters.school || undefined,
        batch: filters.batch || undefined,
        status: filters.status || undefined
      });
      setStudents(response.data.students);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (e, studentId, newStatus) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await userAPI.updateStudentStatus(studentId, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      fetchStudents();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getApprovedSkillsCount = (skills) => {
    return skills?.filter(s => s.status === 'approved').length || 0;
  };

  const getPendingSkillsCount = (skills) => {
    return skills?.filter(s => s.status === 'pending').length || 0;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-600">View and manage students from your campus</p>
        </div>
        <Button onClick={() => setBulkUploadModal(true)}>
          <Upload className="w-5 h-5 mr-2" />
          Bulk Upload Students
        </Button>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatsCard
            icon={Users}
            label="Active"
            value={stats.statusCounts?.['Active'] || 0}
            color="primary"
          />
          <StatsCard
            icon={UserCheck}
            label="Placed"
            value={stats.statusCounts?.['Placed'] || 0}
            color="green"
          />
          <StatsCard
            icon={Briefcase}
            label="Internship"
            value={(stats.statusCounts?.['Internship Paid'] || 0) + (stats.statusCounts?.['Internship UnPaid'] || 0)}
            color="blue"
          />
          <StatsCard
            icon={Briefcase}
            label="Paid Projects"
            value={stats.statusCounts?.['Paid Project'] || 0}
            color="teal"
          />
          <StatsCard
            icon={UserX}
            label="Dropout"
            value={stats.statusCounts?.['Dropout'] || 0}
            color="red"
          />
          <StatsCard
            icon={Clock}
            label="Placement Rate"
            value={`${stats.placementRate}%`}
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          <select
            value={filters.school}
            onChange={(e) => setFilters({ ...filters, school: e.target.value })}
          >
            <option value="">All Schools</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.batch}
            onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
          >
            <option value="">All Batches</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Placed">Placed</option>
            <option value="Dropout">Dropout</option>
            <option value="Internship Paid">Internship Paid</option>
            <option value="Paid Project">Paid Project</option>
            <option value="Internship UnPaid">Internship UnPaid</option>
          </select>
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : students.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <div key={student._id} className="relative group">
                <Link
                  to={`/campus-poc/students/${student._id}`}
                  className="card block hover:shadow-md transition-shadow h-full"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-semibold text-lg">
                          {student.firstName?.[0]}{student.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {student.firstName} {student.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs block mb-0.5">School</span>
                        <p className="font-medium text-gray-700 truncate">{student.studentProfile?.currentSchool || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-0.5">Status</span>
                        <select
                          value={student.studentProfile?.currentStatus || 'Active'}
                          onChange={(e) => handleStatusChange(e, student._id, e.target.value)}
                          className="text-xs font-semibold py-1 px-2 h-auto border-gray-200 rounded-md bg-gray-50 focus:bg-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="Active">Active</option>
                          <option value="Placed">Placed</option>
                          <option value="Dropout">Dropout</option>
                          <option value="Internship Paid">Internship (Paid)</option>
                          <option value="Paid Project">Paid Project</option>
                          <option value="Internship UnPaid">Internship (UnPaid)</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-0.5">Profile</span>
                        <p className="font-medium text-gray-700 capitalize">
                          {student.studentProfile?.profileStatus?.replace('_', ' ') || 'Draft'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-0.5">Skills</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-600">
                            {getApprovedSkillsCount(student.studentProfile?.skills)}
                          </span>
                          {getPendingSkillsCount(student.studentProfile?.skills) > 0 && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded font-medium">
                              {getPendingSkillsCount(student.studentProfile?.skills)} pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <Pagination
            current={pagination.current}
            total={pagination.pages}
            onPageChange={(page) => setPagination({ ...pagination, current: page })}
          />
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Try adjusting your search filters"
        />
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={bulkUploadModal}
        onClose={() => setBulkUploadModal(false)}
        type="students"
        onSuccess={() => {
          fetchStudents();
          setBulkUploadModal(false);
        }}
      />
    </div>
  );
};

export default POCStudents;
