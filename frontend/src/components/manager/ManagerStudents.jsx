import { useState, useEffect } from 'react';
import { userAPI, jobReadinessAPI, applicationAPI, statsAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner, Pagination, Modal, Button, Badge } from '../common/UIComponents';
import {
  User,
  Mail,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  Home,
  AlertCircle
} from 'lucide-react';
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
  const [settings, setSettings] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.getSettings();
      if (res.data?.success) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

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
        phone: selectedStudent.phone,
        studentProfile: {
          currentStatus: selectedStudent.studentProfile?.currentStatus,
          isPaidProject: selectedStudent.studentProfile?.isPaidProject,
          onInternship: selectedStudent.studentProfile?.onInternship,
          internshipType: selectedStudent.studentProfile?.internshipType,
          joiningDate: selectedStudent.studentProfile?.joiningDate,
          currentSchool: selectedStudent.studentProfile?.currentSchool,
          currentModule: selectedStudent.studentProfile?.currentModule,
          houseName: selectedStudent.studentProfile?.houseName,
          linkedIn: selectedStudent.studentProfile?.linkedIn,
          github: selectedStudent.studentProfile?.github,
          portfolio: selectedStudent.studentProfile?.portfolio,
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
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, search]);



  const renderStudentContent = () => {
    if (!selectedStudent) return null;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Modern Tabs */}
        <div className="flex items-center gap-1 border-b p-1 mb-6 bg-gray-50 rounded-lg">
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeModalTab === 'profile' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveModalTab('profile')}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeModalTab === 'readiness' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveModalTab('readiness'); fetchReadiness(selectedStudent._id); }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Readiness
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeModalTab === 'applications' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveModalTab('applications'); fetchApplications(selectedStudent._id); }}
          >
            <Briefcase className="w-4 h-4" />
            Applications
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {activeModalTab === 'profile' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Personal Info Section */}
              <section>
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
                  <User className="w-4 h-4 text-primary-500" />
                  <h4>Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</label>
                    <input
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      value={selectedStudent.firstName}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</label>
                    <input
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      value={selectedStudent.lastName}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        value={selectedStudent.email}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</label>
                    <input
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                      value={selectedStudent.phone || ''}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                      value={selectedStudent.role}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="student">Student</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="campus_poc">Campus PoC</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!!selectedStudent.isActive}
                          onChange={(e) => setSelectedStudent(prev => ({ ...prev, isActive: e.target.checked }))}
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${selectedStudent.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedStudent.isActive ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">Account Active</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Placement & School Section */}
              <section>
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
                  <GraduationCap className="w-4 h-4 text-primary-500" />
                  <h4>Placement & Education</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Placement Lifecycle</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all font-medium py-2.5"
                      value={selectedStudent.studentProfile?.currentStatus || ''}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), currentStatus: e.target.value } }))}
                    >
                      <option value="">Select Status</option>
                      <option value="Active">Active</option>
                      <option value="In active">In active</option>
                      <option value="Long Leave">Long Leave</option>
                      <option value="Placed">Placed</option>
                      <option value="Dropout">Dropout</option>
                    </select>
                  </div>

                  <div className="space-y-2 border-l pl-4 border-gray-200">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">Work Engagements</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!selectedStudent.studentProfile?.isPaidProject}
                            onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), isPaidProject: e.target.checked } }))}
                          />
                          <div className={`w-10 h-6 rounded-full transition-colors ${selectedStudent.studentProfile?.isPaidProject ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedStudent.studentProfile?.isPaidProject ? 'translate-x-4' : ''}`}></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600 transition-colors">On Paid Project</span>
                      </label>

                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={!!selectedStudent.studentProfile?.onInternship}
                              onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), onInternship: e.target.checked } }))}
                            />
                            <div className={`w-10 h-6 rounded-full transition-colors ${selectedStudent.studentProfile?.onInternship ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedStudent.studentProfile?.onInternship ? 'translate-x-4' : ''}`}></div>
                          </div>
                          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">On Internship</span>
                        </label>

                        {selectedStudent.studentProfile?.onInternship && (
                          <div className="flex items-center gap-3 ml-12 animate-fadeIn transition-all">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                              <input
                                type="radio"
                                name="internshipType"
                                value="Paid"
                                checked={selectedStudent.studentProfile?.internshipType === 'Paid'}
                                onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), internshipType: e.target.value } }))}
                              />
                              Paid
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                              <input
                                type="radio"
                                name="internshipType"
                                value="Unpaid"
                                checked={selectedStudent.studentProfile?.internshipType === 'Unpaid'}
                                onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), internshipType: e.target.value } }))}
                              />
                              Unpaid
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Joining Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all font-medium py-2.5"
                        value={selectedStudent.studentProfile?.joiningDate ? new Date(selectedStudent.studentProfile.joiningDate).toISOString().slice(0, 10) : ''}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), joiningDate: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current School</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all font-medium py-2.5"
                      value={selectedStudent.studentProfile?.currentSchool || ''}
                      onChange={(e) => {
                        const school = e.target.value;
                        setSelectedStudent(prev => ({
                          ...prev,
                          studentProfile: {
                            ...(prev.studentProfile || {}),
                            currentSchool: school,
                            currentModule: '' // Reset module when school changes
                          }
                        }));
                      }}
                    >
                      <option value="">Select School</option>
                      {settings?.schools?.map(school => (
                        <option key={school} value={school}>{school}</option>
                      ))}
                      {!settings?.schools?.includes(selectedStudent.studentProfile?.currentSchool) && selectedStudent.studentProfile?.currentSchool && (
                        <option value={selectedStudent.studentProfile.currentSchool}>{selectedStudent.studentProfile.currentSchool}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Module</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all font-medium py-2.5"
                      value={selectedStudent.studentProfile?.currentModule || ''}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), currentModule: e.target.value } }))}
                      disabled={!selectedStudent.studentProfile?.currentSchool}
                    >
                      <option value="">Select Module</option>
                      {selectedStudent.studentProfile?.currentSchool && settings?.schoolModules?.[selectedStudent.studentProfile.currentSchool]?.map(mod => (
                        <option key={mod} value={mod}>{mod}</option>
                      ))}
                      {/* Fallback if current module is not in the list */}
                      {!settings?.schoolModules?.[selectedStudent.studentProfile?.currentSchool]?.includes(selectedStudent.studentProfile?.currentModule) && selectedStudent.studentProfile?.currentModule && (
                        <option value={selectedStudent.studentProfile.currentModule}>{selectedStudent.studentProfile.currentModule}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">House Name</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all font-medium py-2.5"
                      value={selectedStudent.studentProfile?.houseName || ''}
                      onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), houseName: e.target.value } }))}
                    >
                      <option value="">Select House</option>
                      <option value="Bageshree">Bageshree</option>
                      <option value="Bhairav">Bhairav</option>
                      <option value="Malhar">Malhar</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Career Links Section */}
              <section>
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
                  <LinkIcon className="w-4 h-4 text-primary-500" />
                  <h4>Professional Presence</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn Profile</label>
                    <div className="relative">
                      <Linkedin className="absolute left-3 top-2.5 w-4 h-4 text-blue-600" />
                      <input
                        className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="https://linkedin.com/in/..."
                        value={selectedStudent.studentProfile?.linkedIn || ''}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), linkedIn: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">GitHub Profile</label>
                    <div className="relative">
                      <Github className="absolute left-3 top-2.5 w-4 h-4 text-gray-900" />
                      <input
                        className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="https://github.com/..."
                        value={selectedStudent.studentProfile?.github || ''}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), github: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio / Other Link</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 w-4 h-4 text-green-600" />
                      <input
                        className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder="https://portfolio.me"
                        value={selectedStudent.studentProfile?.portfolio || ''}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), portfolio: e.target.value } }))}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Resume Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-gray-900 font-semibold">
                    <LinkIcon className="w-4 h-4 text-primary-500" />
                    <h4>Resume Management</h4>
                  </div>
                  {selectedStudent.studentProfile?.resumeAccessible === true && (
                    <Badge variant="success" className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Accessible
                    </Badge>
                  )}
                  {selectedStudent.studentProfile?.resumeAccessible === false && (
                    <Badge variant="danger" className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Inaccessible
                    </Badge>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Resume Link</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          className="w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all"
                          value={selectedStudent.studentProfile?.resumeLink || ''}
                          onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeLink: e.target.value } }))}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 whitespace-nowrap"
                        onClick={async () => {
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
                        }}
                      >
                        Verify
                      </Button>
                      {selectedStudent.studentProfile?.resumeLink && (
                        <a
                          href={selectedStudent.studentProfile.resumeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-all"
                          title="Open Resume"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Accessibility Remark</label>
                      <textarea
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all min-h-[80px]"
                        placeholder="Any issues with accessibility..."
                        value={selectedStudent.studentProfile?.resumeAccessibilityRemark || ''}
                        onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessibilityRemark: e.target.value } }))}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={!!selectedStudent.studentProfile?.resumeAccessible}
                            onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), resumeAccessible: e.target.checked } }))}
                          />
                          <div className={`w-10 h-6 rounded-full transition-colors ${selectedStudent.studentProfile?.resumeAccessible ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedStudent.studentProfile?.resumeAccessible ? 'translate-x-4' : ''}`}></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 group-hover:text-green-600 transition-colors">Manual Override</span>
                          <span className="text-[10px] text-gray-400">Mark as accessible manually</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              {/* About Section */}
              <section className="pb-4">
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-semibold">
                  <AlertCircle className="w-4 h-4 text-primary-500" />
                  <h4>About Student</h4>
                </div>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all min-h-[120px]"
                  placeholder="Student bio, background, etc..."
                  value={selectedStudent.studentProfile?.about || ''}
                  onChange={(e) => setSelectedStudent(prev => ({ ...prev, studentProfile: { ...(prev.studentProfile || {}), about: e.target.value } }))}
                />
              </section>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 justify-end pt-6 border-t mt-8 bg-white sticky bottom-0 z-10 pb-4">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button variant="primary" className="px-8" onClick={saveStudent}>Save All Changes</Button>
              </div>
            </div>
          )}

          {activeModalTab === 'readiness' && (
            <div className="space-y-4 animate-fadeIn">
              {readiness && readiness.criteriaStatus && readiness.criteriaStatus.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {readiness.criteriaStatus.map((c) => {
                    const critInfo = readinessConfig.find(rc => rc.criteriaId === c.criteriaId) || {};
                    return (
                      <div key={c.criteriaId} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <div className="font-semibold text-gray-900">{critInfo.name || c.criteriaId}</div>
                            <div className="text-xs text-gray-500 mt-1">{critInfo.description}</div>
                          </div>
                          <select
                            value={c.status}
                            onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, status: e.target.value } : cs) }))}
                            className={`text-sm font-medium border rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 transition-all ${c.status === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                              c.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                          >
                            <option value="not_started">Not started</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                            <option value="verified">Verified</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Manager Remark</label>
                            <textarea
                              className="w-full text-sm border border-gray-100 bg-gray-50 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 transition-all min-h-[60px]"
                              placeholder="Write a comment..."
                              value={c.pocComment || ''}
                              onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, pocComment: e.target.value } : cs) }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rating</label>
                            <input
                              type="number"
                              min={0}
                              max={critInfo.pocRatingScale || 5}
                              className="w-full text-sm border border-gray-100 bg-gray-50 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 transition-all"
                              placeholder={`0-${critInfo.pocRatingScale || 5}`}
                              value={c.pocRating || ''}
                              onChange={(e) => setReadiness(prev => ({ ...prev, criteriaStatus: prev.criteriaStatus.map(cs => cs.criteriaId === c.criteriaId ? { ...cs, pocRating: e.target.value ? Number(e.target.value) : undefined } : cs) }))}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No readiness data available</p>
                </div>
              )}

              <div className="flex items-center gap-3 justify-end pt-6 border-t mt-8 bg-white sticky bottom-0 z-10 pb-4">
                <Button variant="secondary" onClick={() => setActiveModalTab('profile')}>Back to Profile</Button>
                <Button variant="primary" className="px-8" onClick={saveReadiness}>Save Readiness</Button>
              </div>
            </div>
          )}

          {activeModalTab === 'applications' && (
            <div className="space-y-4 animate-fadeIn">
              {apps.length > 0 ? (
                <div className="space-y-3">
                  {apps.map(app => (
                    <div key={app._id} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg group-hover:bg-primary-600 group-hover:text-white transition-colors">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{app.job?.title || 'Job Position'}</div>
                            <div className="text-sm text-gray-500">{app.job?.company?.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            app.status === 'selected' ? 'success' :
                              app.status === 'rejected' ? 'danger' :
                                app.status === 'applied' ? 'info' : 'default'
                          }>
                            {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                          </Badge>
                          <div className="text-[10px] text-gray-400 mt-1">
                            {new Date(app.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Briefcase className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No applications found</p>
                </div>
              )}
            </div>
          )}
        </div>
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
                    <td className="py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.studentProfile?.currentStatus === 'Placed' ? 'bg-green-100 text-green-700' :
                            s.studentProfile?.currentStatus === 'Active' ? 'bg-blue-100 text-blue-700' :
                              s.studentProfile?.currentStatus === 'Long Leave' ? 'bg-purple-100 text-purple-700' :
                                s.studentProfile?.currentStatus === 'In active' ? 'bg-gray-100 text-gray-700' :
                                  'bg-red-100 text-red-700'
                            }`}>
                            {s.studentProfile?.currentStatus || 'Active'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.studentProfile?.isPaidProject && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold border border-amber-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              PAID PROJECT
                            </span>
                          )}
                          {s.studentProfile?.onInternship && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              INTERNSHIP {s.studentProfile?.internshipType?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
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

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Student'}
        size="xl"
      >
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
