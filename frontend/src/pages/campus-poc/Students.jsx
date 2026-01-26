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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm">View and manage students from your campus</p>
        </div>
        <Button onClick={() => setBulkUploadModal(true)} className="w-full md:w-auto shadow-sm">
          <Upload className="w-4 h-4 mr-2" />
          <span className="hidden md:inline">Bulk Upload Students</span>
          <span className="md:hidden text-sm">Bulk Upload</span>
        </Button>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
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
            label="Intern"
            value={(stats.statusCounts?.['Internship Paid'] || 0) + (stats.statusCounts?.['Internship UnPaid'] || 0)}
            color="blue"
          />
          <StatsCard
            icon={Briefcase}
            label="Project"
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
            label="Rate"
            value={`${stats.placementRate}%`}
            color="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="card !p-3 md:!p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-1 sm:col-span-2 md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={filters.school}
            onChange={(e) => setFilters({ ...filters, school: e.target.value })}
            className="text-sm"
          >
            <option value="">All Schools</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.batch}
            onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
            className="text-sm"
          >
            <option value="">All Batches</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="text-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {students.map((student) => (
              <div key={student._id} className="relative group">
                <Link
                  to={`/campus-poc/students/${student._id}`}
                  className="card block hover:shadow-md transition-shadow h-full !p-3 md:!p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <span className="text-primary-700 font-bold text-base md:text-lg">
                          {student.firstName?.[0]}{student.lastName?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors truncate text-sm md:text-base">
                          {student.firstName} {student.lastName}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">{student.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 mt-1 shrink-0" />
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-3 md:gap-4 text-[11px] md:text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">School</span>
                        <p className="font-semibold text-gray-700 truncate">{student.studentProfile?.currentSchool || '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">Status</span>
                        <select
                          value={student.studentProfile?.currentStatus || 'Active'}
                          onChange={(e) => handleStatusChange(e, student._id, e.target.value)}
                          className="text-[10px] font-bold py-0.5 px-1.5 h-auto border-gray-200 rounded bg-gray-50 focus:bg-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="Active">Active</option>
                          <option value="Placed">Placed</option>
                          <option value="Dropout">Dropout</option>
                          <option value="Internship Paid">Paid Intern</option>
                          <option value="Paid Project">Paid Proj</option>
                          <option value="Internship UnPaid">Unpaid Intern</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">Profile</span>
                        <p className="font-semibold text-gray-700 capitalize">
                          {student.studentProfile?.profileStatus?.replace('_', ' ') || 'Draft'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">Skills</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-green-600 bg-green-50 px-1.5 rounded">
                            {getApprovedSkillsCount(student.studentProfile?.skills)}
                          </span>
                          {getPendingSkillsCount(student.studentProfile?.skills) > 0 && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-extrabold uppercase animate-pulse">
                              {getPendingSkillsCount(student.studentProfile?.skills)} Review
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
