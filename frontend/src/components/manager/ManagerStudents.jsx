import { useState, useEffect } from 'react';
import { userAPI, jobReadinessAPI, applicationAPI, statsAPI } from '../../services/api';
import { LoadingSpinner, Pagination, Modal } from '../common/UIComponents';
import toast from 'react-hot-toast';

const ManagerStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  // show 10 per page by default
  const PAGE_SIZE = 10;

  // Modal for editing student
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingStudentId, setLoadingStudentId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getStudents({ page: pagination.current, limit: PAGE_SIZE, search: search || undefined, sortField: 'studentProfile.joiningDate', sortOrder: 'asc' });
      setStudents(res.data.students || []);
      setPagination(res.data.pagination || { current: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching students:', err);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = async (studentId) => {
    try {
      setSelectedStudent(null);
      setLoadingStudentId(studentId);
      setShowModal(true);
      setActiveModalTab('profile');
      setReadiness(null);
      setApps([]);
      const res = await userAPI.getUser(studentId);
      setSelectedStudent(res.data.user);
    } catch (err) {
      toast.error('Failed to load student');
      setShowModal(false);
    } finally {
      setLoadingStudentId(null);
    }
  };

  const [activeModalTab, setActiveModalTab] = useState('profile');
  const [readiness, setReadiness] = useState(null);
  const [readinessConfig, setReadinessConfig] = useState([]);
  const [apps, setApps] = useState([]);

  const schoolToAcronym = (school) => {
    if (!school) return 'Unknown';
    const trimmed = school.trim();
    // Known mappings
    const map = {
      'School of Programming': 'SoP',
      'School of Business': 'SoB',
      'School of Finance': 'SoF',
      'School of Education': 'SoE',
      'School of Second Chance': 'SoSC'
    };
    if (map[trimmed]) return map[trimmed];
    // Fallback: if starts with 'School of', build So + initials of remaining words
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('school of')) {
      const rest = trimmed.replace(/School of\s*/i, '');
      const initials = rest.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
      return `So${initials}`;
    }
    // Generic fallback: initials of words
    return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase()).join('');
  };


  const fetchReadiness = async (studentId) => {
    try {
      const res = await jobReadinessAPI.getStudentReadiness(studentId);
      setReadiness(res.data.readiness);
      setReadinessConfig(res.data.config || []);
    } catch (err) {
      console.error('Error fetching readiness:', err);
      toast.error('Failed to load readiness');
    }
  };

  const fetchApplications = async (studentId) => {
    try {
      const res = await applicationAPI.getApplications({ student: studentId, page: 1, limit: 10 });
      setApps(res.data.applications || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
      toast.error('Failed to load applications');
    }
  };

  const saveStudent = async () => {
    if (!selectedStudent) return;
    try {
      const payload = {
        firstName: selectedStudent.firstName,
        lastName: selectedStudent.lastName,
        email: selectedStudent.email,
        isActive: selectedStudent.isActive,
        role: selectedStudent.role,
        studentProfile: {
          currentStatus: selectedStudent.studentProfile?.currentStatus,
          joiningDate: selectedStudent.studentProfile?.joiningDate,
          currentSchool: selectedStudent.studentProfile?.currentSchool,
          linkedIn: selectedStudent.studentProfile?.linkedIn,
          about: selectedStudent.studentProfile?.about || '',
          resumeLink: selectedStudent.studentProfile?.resumeLink || '',
          resumeAccessible: selectedStudent.studentProfile?.resumeAccessible || false,
          resumeAccessibilityRemark: selectedStudent.studentProfile?.resumeAccessibilityRemark || ''
        }
      };
      await userAPI.updateUser(selectedStudent._id, payload);
      toast.success('Student updated');
      setShowModal(false);
      fetchStudents();
    } catch (err) {
      toast.error('Failed to save student');
      console.error('Save error:', err);
    }
  };

  const saveReadiness = async () => {
    if (!selectedStudent || !readiness) return;
    try {
      // send criteriaStatus array to server
      await jobReadinessAPI.updateStudentReadiness(selectedStudent._id, { criteriaStatus: readiness.criteriaStatus });
      toast.success('Readiness saved');
      // refresh readiness
      fetchReadiness(selectedStudent._id);
    } catch (err) {
      console.error('Save readiness error:', err);
      toast.error('Failed to save readiness');
    }
  };


  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, search]);



  const renderStudentContent = () => {
    if (!selectedStudent) return null;
    return (
      <div>
        <div className="flex items-center gap-2 border-b pb-3 mb-4">
          <button className={`px-3 py-1 rounded ${activeModalTab === 'profile' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100'}`} onClick={() => setActiveModalTab('profile')}>Profile</button>
          <button className={`px-3 py-1 rounded ${activeModalTab === 'readiness' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100'}`} onClick={() => { setActiveModalTab('readiness'); fetchReadiness(selectedStudent._id); }}>Readiness</button>
          <button className={`px-3 py-1 rounded ${activeModalTab === 'applications' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100'}`} onClick={() => { setActiveModalTab('applications'); fetchApplications(selectedStudent._id); }}>Applications</button>
        </div>

        {activeModalTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">First name</label>
                <input className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.firstName} onChange={(e) => setSelectedStudent(prev => ({ ...prev, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Last name</label>
                <input className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.lastName} onChange={(e) => setSelectedStudent(prev => ({ ...prev, lastName: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.email} onChange={(e) => setSelectedStudent(prev => ({ ...prev, email: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <select className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.role} onChange={(e) => setSelectedStudent(prev => ({ ...prev, role: e.target.value }))}>
                  <option value="student">Student</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="campus_poc">Campus PoC</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Account Active</label>
                <div className="mt-1">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!selectedStudent.isActive} onChange={(e) => setSelectedStudent(prev => ({ ...prev, isActive: e.target.checked }))} /> Account active</label>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Placement Status <span className="text-xs text-gray-400">(student's placement state, e.g., Active/Placed)</span></label>
                <select className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.studentProfile?.currentStatus || ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), currentStatus: e.target.value } }))}>
                  <option value="">Select</option>
                  <option value="Active">Active</option>
                  <option value="Placed">Placed</option>
                  <option value="Dropout">Dropout</option>
                  <option value="Internship Paid">Internship Paid</option>
                  <option value="Internship UnPaid">Internship UnPaid</option>
                  <option value="Paid Project">Paid Project</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500">Joining Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.studentProfile?.joiningDate ? new Date(selectedStudent.studentProfile.joiningDate).toISOString().slice(0, 10) : ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), joiningDate: e.target.value } }))} />
              </div>

              <div>
                <label className="text-xs text-gray-500">Current School</label>
                <input className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.studentProfile?.currentSchool || ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), currentSchool: e.target.value } }))} />
              </div>

              <div>
                <label className="text-xs text-gray-500">Resume Link</label>
                <div className="flex items-center gap-2 mt-1">
                  <input className="flex-1 px-3 py-2 border rounded" value={selectedStudent.studentProfile?.resumeLink || ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeLink: e.target.value } }))} />
                  <button className="px-3 py-1 bg-gray-100 rounded" onClick={async () => {
                    const url = selectedStudent.studentProfile?.resumeLink || '';
                    if (!url) { toast('Please enter a resume URL first'); return; }
                    try {
                      const res = await (await import('../../services/api')).utilsAPI.checkUrl(url);
                      const ok = res?.data?.ok === true;
                      setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessible: ok, resumeAccessibilityRemark: ok ? '' : (res?.data?.reason || `HTTP ${res?.data?.status || 'unknown'}`) } }));
                      toast.success(ok ? 'Resume is accessible' : 'Resume not accessible');
                    } catch (err) {
                      setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessible: false, resumeAccessibilityRemark: 'Check failed' } }));
                      toast.error('Error checking URL');
                    }
                  }}>Check</button>
                </div>

                <div className="mt-2">
                  <label className="text-xs text-gray-500">Accessibility remark</label>
                  <textarea className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.studentProfile?.resumeAccessibilityRemark || ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessibilityRemark: e.target.value } }))} />
                  <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={!!selectedStudent.studentProfile?.resumeAccessible} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessible: e.target.checked } }))} /> Resume Accessible</label>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500">LinkedIn</label>
              <input className="w-full px-3 py-2 border rounded mt-1" value={selectedStudent.studentProfile?.linkedIn || ''} onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), linkedIn: e.target.value } }))} />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveStudent}>Save</button>
            </div>
          </div>
        )}

        {activeModalTab === 'readiness' && (
          <div className="space-y-4">
            {readiness && readiness.criteriaStatus && readiness.criteriaStatus.length > 0 ? (
              readiness.criteriaStatus.map((c) => {
                const critInfo = readinessConfig.find(rc => rc.criteriaId === c.criteriaId) || {};
                return (
                  <div key={c.criteriaId} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{critInfo.name || c.criteriaId}</div>
                        <div className="text-sm text-gray-500">{critInfo.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={c.status} onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, status: e.target.value } : cs) }))} className="border rounded px-2 py-1">
                          <option value="not_started">Not started</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                          <option value="verified">Verified</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <textarea className="w-full border rounded p-2" placeholder="PoC comment" value={c.pocComment || ''} onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, pocComment: e.target.value } : cs) }))} />
                      <input type="number" min={0} max={critInfo.pocRatingScale || 5} className="w-full border rounded p-2" placeholder="PoC Rating" value={c.pocRating || ''} onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, pocRating: e.target.value ? Number(e.target.value) : undefined } : cs) }))} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-gray-500">No readiness data available</div>
            )}

            <div className="flex items-center gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setActiveModalTab('profile')}>Back</button>
              <button className="btn btn-primary" onClick={saveReadiness}>Save Readiness</button>
            </div>
          </div>
        )}

        {activeModalTab === 'applications' && (
          <div>
            {apps.length > 0 ? (
              <div className="divide-y">
                {apps.map(app => (
                  <div key={app._id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{app.job?.title || 'Job'}</div>
                        <div className="text-sm text-gray-500">{app.job?.company?.name}</div>
                      </div>
                      <div className="text-sm text-gray-500">{new Date(app.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm mt-2">Status: {app.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No applications found</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const studentContent = renderStudentContent();


  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Students</h3>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search by name or email"
            className="px-3 py-2 border rounded-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="py-8 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Campus</th>
                <th>Status</th>
                <th>Joining Date</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const joinDate = s.studentProfile?.joiningDate || s.studentProfile?.dateOfJoining;
                return (
                  <tr key={s._id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(s._id)}>
                    <td className="py-3">{s.firstName} {s.lastName}</td>
                    <td>{s.email}</td>
                    <td>{s.campus?.name || s.campus || '—'}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.studentProfile?.currentStatus === 'Placed' ? 'bg-green-100 text-green-800' :
                        s.studentProfile?.currentStatus === 'Active' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {s.studentProfile?.currentStatus || 'Active'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{joinDate ? new Date(joinDate).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4">
            <Pagination current={pagination.current} total={pagination.pages} onPageChange={(p) => setPagination({ ...pagination, current: p })} />
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Student'} size="lg">
        {/* Loading */}
        {loadingStudentId && !selectedStudent && (
          <div className="py-8 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        )}

        {/* Selected student content */}
        {studentContent}

        {/* No student */}
        {!loadingStudentId && !selectedStudent && (
          <div className="py-6 text-sm text-gray-500">No student loaded</div>
        )}
      </Modal>
    </div>
  );
};

export default ManagerStudents;
