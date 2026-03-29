import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI, statsAPI, gharAPI } from '../../services/api';
import { LoadingSpinner, Pagination, EmptyState, StatusBadge, Button, StatsCard } from '../../components/common/UIComponents';
import { BulkUploadModal } from '../../components/common/BulkUpload';
import { Users, Search, ChevronRight, GraduationCap, Upload, Filter, UserCheck, UserX, Clock, Briefcase, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const schools = [
  'School of Programming',
  'School of Business',
  'School of Finance',
  'School of Education',
  'School of Second Chance'
];

const ProgressBar = ({ progress, total }) => {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div 
        className="bg-primary-600 h-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const POCStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: '', school: '', batch: '', status: '' });
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedStudents, setExpandedStudents] = useState({});

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

  const handleGharSync = async (e, email) => {
    e.preventDefault();
    e.stopPropagation();
    if (!email) {
      toast.error('Student email not found');
      return;
    }

    try {
      const response = await gharAPI.syncStudent(email);
      const updatedData = response.data.data?.student;
      toast.success('Synced with Ghar successfully');
      
      // Update local state instead of full reload (case-insensitive email matching)
      setStudents(prev => prev.map(s => s.email?.toLowerCase() === email?.toLowerCase() ? {
        ...s,
        ...updatedData,
        resolvedProfile: updatedData.resolvedProfile || s.resolvedProfile
      } : s));
      
      // Still refresh stats and full list as they depend on overall counts
      fetchStats();
      fetchStudents();
    } catch (error) {
      console.error('Error syncing with Ghar:', error);
      toast.error(error.response?.data?.message || 'Failed to sync with Ghar');
    }
  };

  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const handleSyncAll = async () => {
    if (!students.length) return;
    setSyncAllLoading(true);
    setSyncProgress(0);
    
    let successCount = 0;
    let failCount = 0;

    toast.loading('Starting batch sync...', { id: 'batch-sync' });

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      if (student.email) {
        try {
          await gharAPI.syncStudent(student.email);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }
      setSyncProgress(i + 1);
    }

    setSyncAllLoading(false);
    toast.success(`Batch sync completed! ${successCount} successful, ${failCount} failed.`, { id: 'batch-sync' });
    fetchStudents();
    fetchStats();
  };

  const getApprovedSkillsCount = (skills) => {
    return skills?.filter(s => s.status === 'approved').length || 0;
  };

  const getPendingSkillsCount = (skills) => {
    return skills?.filter(s => s.status === 'pending').length || 0;
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  };

  const joinNonEmpty = (parts = []) => {
    const filtered = parts
      .map((part) => (typeof part === 'string' ? part.trim() : part))
      .filter(Boolean);
    return filtered.length > 0 ? filtered.join(', ') : '-';
  };

  const getProfileField = (student, key, fallback = '-') => {
    const profileValue = student?.studentProfile?.[key];
    const resolvedValue = student?.resolvedProfile?.[key];
    if (profileValue !== undefined && profileValue !== null && profileValue !== '') return profileValue;
    if (resolvedValue !== undefined && resolvedValue !== null && resolvedValue !== '') return resolvedValue;
    return fallback;
  };

  const toggleExpandStudent = (e, studentId) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm">View and manage students from your campus</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          {syncAllLoading && (
            <div className="flex flex-col items-end justify-center">
              <span className="text-[10px] font-bold text-primary-600 mb-1">SYNCING: {syncProgress}/{students.length}</span>
              <div className="w-32">
                <ProgressBar progress={syncProgress} total={students.length} />
              </div>
            </div>
          )}
          <Button 
            onClick={handleSyncAll} 
            disabled={syncAllLoading || loading || students.length === 0}
            variant="outline"
            className="w-full md:w-auto shadow-sm border-primary-200 text-primary-700 hover:bg-primary-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncAllLoading ? 'animate-spin' : ''}`} />
            Sync All Status
          </Button>
        </div>
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
            <option value="">All Batches (Join Year)</option>
            {Array.from({ length: new Date().getFullYear() - 2020 + 2 }, (_, i) => 2021 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="text-sm"
          >
            <option value="">All Statuses</option>
            <option value="never_logged_in">Never Logged In</option>
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
                <div className={`card block hover:shadow-md transition-shadow h-full !p-3 md:!p-6 ${!student.lastLogin ? 'opacity-70 saturate-[0.8] grayscale-[0.2]' : ''}`}>
                  <Link
                    to={`/campus-poc/students/${student._id}`}
                    className="block"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                          <span className="text-primary-700 font-bold text-base md:text-lg">
                            {student.firstName?.[0]}{student.lastName?.[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors truncate text-sm md:text-base flex items-center gap-2">
                            {student.firstName} {student.lastName}
                            {!student.lastLogin && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-700 uppercase tracking-tighter border border-amber-200">
                                <Clock className="w-2 h-2 mr-0.5" /> Never logged in
                              </span>
                            )}
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
                          <p className="font-semibold text-gray-700 truncate">{getProfileField(student, 'currentSchool')}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">Status</span>
                          <div className="flex items-center gap-1 group/sync">
                            <select
                              disabled
                              value={student.resolvedProfile?.currentStatus || student.studentProfile?.currentStatus || 'Active'}
                              onChange={(e) => handleStatusChange(e, student._id, e.target.value)}
                              className="text-[10px] font-bold py-0.5 px-1.5 h-auto border-gray-200 rounded bg-gray-50 focus:bg-white opacity-80 cursor-not-allowed"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="Active">Active</option>
                              <option value="Placed">Placed</option>
                              <option value="Intern (In Campus)">Intern (In Campus)</option>
                              <option value="Intern (Out Campus)">Intern (Out Campus) </option>
                              <option value="Dropout">Dropout</option>
                              <option value="DropOut">DropOut</option>
                              <option value="InActive">InActive</option>
                              <option value="Completed-Opted out for placement">Opted out</option>
                              <option value="Internship Paid">Paid Intern</option>
                              <option value="Internship UnPaid">Unpaid Intern</option>
                              <option value="Paid Project">Paid Proj</option>
                            </select>
                            <button
                              onClick={(e) => handleGharSync(e, student.email)}
                              className="p-1 hover:bg-primary-50 rounded-md text-gray-400 hover:text-primary-600 transition-colors"
                              title="Sync status with Ghar"
                              disabled={loading}
                            >
                              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400 font-bold uppercase tracking-tighter block mb-0.5">Profile</span>
                          <p className="font-semibold text-gray-700 capitalize">
                            {student.studentProfile?.profileStatus?.replaceAll('_', ' ') || 'Draft'}
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

                  <div className="mt-3 border-t pt-3">
                    <button
                      onClick={(e) => toggleExpandStudent(e, student._id)}
                      className="w-full text-left text-xs font-bold uppercase tracking-wide text-primary-700 hover:text-primary-800"
                    >
                      {expandedStudents[student._id] ? 'Hide Full Details' : 'Show Full Details'}
                    </button>

                    {expandedStudents[student._id] && (
                      <div className="mt-3 space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div><span className="text-gray-400 font-semibold">Campus:</span> <span className="text-gray-800">{student.campus?.name || getProfileField(student, 'campus')}</span></div>
                          <div><span className="text-gray-400 font-semibold">Campus Code:</span> <span className="text-gray-800">{student.campus?.code || '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Phone:</span> <span className="text-gray-800">{student.phone || getProfileField(student, 'phone')}</span></div>
                          <div><span className="text-gray-400 font-semibold">Gender:</span> <span className="text-gray-800">{student.gender || getProfileField(student, 'gender')}</span></div>
                          <div><span className="text-gray-400 font-semibold">Joining Date:</span> <span className="text-gray-800">{formatDate(getProfileField(student, 'joiningDate', null))}</span></div>
                          <div><span className="text-gray-400 font-semibold">Current Module:</span> <span className="text-gray-800">{getProfileField(student, 'currentModule')}</span></div>
                          <div><span className="text-gray-400 font-semibold">House:</span> <span className="text-gray-800">{getProfileField(student, 'houseName')}</span></div>
                          <div><span className="text-gray-400 font-semibold">Attendance:</span> <span className="text-gray-800">{getProfileField(student, 'attendancePercentage')}</span></div>
                          <div><span className="text-gray-400 font-semibold">English Speaking:</span> <span className="text-gray-800">{student.studentProfile?.englishProficiency?.speaking || student.resolvedProfile?.englishSpeaking || '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">English Writing:</span> <span className="text-gray-800">{student.studentProfile?.englishProficiency?.writing || student.resolvedProfile?.englishWriting || '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Open Roles:</span> <span className="text-gray-800">{student.studentProfile?.openForRoles?.length ? student.studentProfile.openForRoles.join(', ') : '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Hometown:</span> <span className="text-gray-800">{joinNonEmpty([
                            student.studentProfile?.hometown?.village,
                            student.studentProfile?.hometown?.district,
                            student.studentProfile?.hometown?.state,
                            student.studentProfile?.hometown?.pincode
                          ])}</span></div>
                          <div><span className="text-gray-400 font-semibold">Tenth:</span> <span className="text-gray-800">{student.studentProfile?.tenthGrade?.percentage ? `${student.studentProfile.tenthGrade.percentage}% (${student.studentProfile.tenthGrade.passingYear || '-'})` : '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Twelfth:</span> <span className="text-gray-800">{student.studentProfile?.twelfthGrade?.percentage ? `${student.studentProfile.twelfthGrade.percentage}% (${student.studentProfile.twelfthGrade.passingYear || '-'})` : '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">About:</span> <span className="text-gray-800">{student.studentProfile?.about || '-'}</span></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div><span className="text-gray-400 font-semibold">LinkedIn:</span> <a href={student.studentProfile?.linkedIn} target="_blank" rel="noreferrer" className="text-primary-700 break-all">{student.studentProfile?.linkedIn || '-'}</a></div>
                          <div><span className="text-gray-400 font-semibold">GitHub:</span> <a href={student.studentProfile?.github} target="_blank" rel="noreferrer" className="text-primary-700 break-all">{student.studentProfile?.github || '-'}</a></div>
                          <div><span className="text-gray-400 font-semibold">Portfolio:</span> <a href={student.studentProfile?.portfolio} target="_blank" rel="noreferrer" className="text-primary-700 break-all">{student.studentProfile?.portfolio || '-'}</a></div>
                          <div><span className="text-gray-400 font-semibold">Resume:</span> <a href={student.studentProfile?.resumeLink} target="_blank" rel="noreferrer" className="text-primary-700 break-all">{student.studentProfile?.resumeLink || '-'}</a></div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Courses</p><p className="font-bold text-gray-800">{student.studentProfile?.courses?.length || 0}</p></div>
                          <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Soft Skills</p><p className="font-bold text-gray-800">{student.studentProfile?.softSkills?.length || 0}</p></div>
                          <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Technical Skills</p><p className="font-bold text-gray-800">{student.studentProfile?.technicalSkills?.length || 0}</p></div>
                          <div className="bg-gray-50 rounded p-2"><p className="text-gray-400">Languages</p><p className="font-bold text-gray-800">{student.studentProfile?.languages?.length || 0}</p></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div><span className="text-gray-400 font-semibold">Profile Submitted At:</span> <span className="text-gray-800">{formatDateTime(student.studentProfile?.lastSubmittedAt)}</span></div>
                          <div><span className="text-gray-400 font-semibold">Profile Approved At:</span> <span className="text-gray-800">{formatDateTime(student.studentProfile?.approvedAt)}</span></div>
                          <div><span className="text-gray-400 font-semibold">Discord Username:</span> <span className="text-gray-800">{student.discord?.username || '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Discord Verified:</span> <span className="text-gray-800">{student.discord?.verified ? 'Yes' : 'No'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Cycle ID:</span> <span className="text-gray-800 break-all">{student.placementCycle || '-'}</span></div>
                          <div><span className="text-gray-400 font-semibold">Last Login:</span> <span className="text-gray-800">{formatDateTime(student.lastLogin)}</span></div>
                          <div><span className="text-gray-400 font-semibold">Created At:</span> <span className="text-gray-800">{formatDateTime(student.createdAt)}</span></div>
                          <div><span className="text-gray-400 font-semibold">Updated At:</span> <span className="text-gray-800">{formatDateTime(student.updatedAt)}</span></div>
                          <div><span className="text-gray-400 font-semibold">Student ID:</span> <span className="text-gray-800 break-all">{student._id}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
