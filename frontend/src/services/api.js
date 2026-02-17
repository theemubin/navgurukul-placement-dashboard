import axios from 'axios';

// Normalize API base and ensure it always includes '/api'
const rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_URL = rawApi.replace(/\/+$/, '') + '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Send cookies (HttpOnly auth_token) with all requests by default
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Debug: log outgoing request summary only in development (avoid logging cookies)
    if (import.meta.env.DEV) {
      try {
        console.debug('API request:', (config.method || '').toUpperCase(), config.url, 'withCredentials=', !!config.withCredentials, 'Authorization=', !!config.headers?.Authorization);
      } catch (e) {
        // ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      console.warn('API response error:', error?.response?.status, error?.response?.data, error?.response?.headers);
    }
    if (error.response?.status === 401) {
      // Only redirect to login and clear state if we're not already on an auth/login route 
      // to avoid reload loops or wiping state during AuthCallback's initialization.
      const pathname = window.location.pathname || '';
      if (!pathname.startsWith('/auth') && !pathname.startsWith('/login')) {
        // Clear client-side auth state
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Notify app of logout
        window.dispatchEvent(new CustomEvent('auth:logout'));
        // Use replace to avoid creating history entries
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  // getMe supports cookie-based auth: include credentials when requesting
  getMe: () => api.get('/auth/me', { withCredentials: true }),
  changePassword: (data) => api.put('/auth/change-password', data),
  // Exchange short-lived code (cookie will be set by server)
  exchange: (code) => api.post('/auth/google/exchange', { code }, { withCredentials: true }),
  logout: () => api.post('/auth/logout', {}, { withCredentials: true })
};

// User APIs
export const userAPI = {
  getStudents: (params) => api.get('/users/students', { params }),
  getStudent: (id) => api.get(`/users/students/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  submitProfile: () => api.post('/users/profile/submit'),
  addSkill: (skillId) => api.post('/users/profile/skills', { skillId }),
  approveSkill: (studentId, skillId, status) =>
    api.put(`/users/students/${studentId}/skills/${skillId}`, { status }),
  getPendingSkills: () => api.get('/users/pending-skills'),
  getPendingProfiles: () => api.get('/users/pending-profiles'),
  approveProfile: (studentId, status, revisionNotes) =>
    api.put(`/users/students/${studentId}/profile/approve`, { status, revisionNotes }),
  requestProfileChanges: (studentId, revisionNotes) =>
    api.put(`/users/students/${studentId}/profile/approve`, { status: 'needs_revision', revisionNotes }),
  updateStudentProfile: (studentId, data) =>
    api.put(`/users/students/${studentId}/profile`, data),
  getEligibleCount: (params) => api.get('/users/eligible-count', { params }),
  getStudentLocations: () => api.get('/users/student-locations'),
  // Get list of coordinators for assignment/filtering
  getCoordinators: () => api.get('/users/coordinators'),
  // Admin/Manager user management
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id) => api.get(`/users/${id}`),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  // Managed campuses for Campus POCs
  getManagedCampuses: () => api.get('/users/managed-campuses'),
  updateManagedCampuses: (campusIds) => api.put('/users/managed-campuses', { campusIds }),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.put('/users/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadResume: (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.put('/users/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // Export presets (personal)
  getExportPresets: () => api.get('/users/me/export-presets'),
  createExportPreset: (data) => api.post('/users/me/export-presets', data),
  deleteExportPreset: (id) => api.delete(`/users/me/export-presets/${id}`),
  // AI API Keys (personal for coordinators/managers)
  getAIKeys: () => api.get('/users/me/ai-keys'),
  addAIKey: (data) => api.post('/users/me/ai-keys', data),
  updateAIKey: (keyId, data) => api.patch(`/users/me/ai-keys/${keyId}`, data),
  deleteAIKey: (keyId) => api.delete(`/users/me/ai-keys/${keyId}`),
  updateStudentStatus: (studentId, status) => api.put(`/users/students/${studentId}/status`, { status })
};

// Settings APIs
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  getSetting: (key) => api.get(`/settings/${key}`),
  updateSetting: (key, value) => api.put(`/settings/${key}`, { value }),
  addItem: (key, item) => api.post(`/settings/${key}/add`, { item }),
  removeItem: (key, item) => api.post(`/settings/${key}/remove`, { item }),
  initSettings: () => api.post('/settings/init'),
  addCourseSkill: (skill) => api.post('/settings/course-skills', { skill }),
  addSchool: (school) => api.post('/settings/schools', { school }),
  // Pipeline stages
  getPipelineStages: () => api.get('/settings/pipeline-stages'),
  createPipelineStage: (stage) => api.post('/settings/pipeline-stages', stage),
  updatePipelineStage: (stageId, updates) => api.put(`/settings/pipeline-stages/${stageId}`, updates),
  deletePipelineStage: (stageId) => api.delete(`/settings/pipeline-stages/${stageId}`),
  reorderPipelineStages: (stageIds) => api.put('/settings/pipeline-stages-order', { stageIds }),
  getAIConfig: () => api.get('/settings/ai-config'),
  updateAIConfig: (config) => api.put('/settings/ai-config', config),
  getAIStatus: () => api.get('/settings/ai-status'),
  updateSettings: (data) => api.put('/settings', data),
  addHigherEducationOption: (data) => api.post('/settings/higher-education/add', data),
  addInstitutionOption: (institution, pincode = '') => api.post('/settings/institutions/add', { institution, pincode }),
  addCouncilPostOption: (post) => api.post('/settings/council-posts/add', { post }),
  addLocationOption: (location) => api.post('/settings/locations/add', { location }),
  addCompanyOption: (companyData) => api.post('/settings/companies/add', companyData),
  updateProficiencyRubrics: (rubrics) => api.put('/settings/proficiency-rubrics', { rubrics }),
  getEducationAnalytics: () => api.get('/settings/analytics/education'),
  renameEducationItem: (data) => api.post('/settings/education/rename', data)
};

// Job APIs
export const jobAPI = {
  getJobs: (params) => api.get('/jobs', { params }),
  getMatchingJobs: () => api.get('/jobs/matching'),
  getJob: (id) => api.get(`/jobs/${id}`),
  getJobWithMatch: (id) => api.get(`/jobs/${id}/match`),
  getCompanies: () => api.get('/jobs/companies'),
  getLocations: () => api.get('/jobs/locations'),
  createJob: (data) => api.post('/jobs', data),
  updateJob: (id, data) => api.put(`/jobs/${id}`, data),
  deleteJob: (id) => api.delete(`/jobs/${id}`),
  updateJobStatus: (id, status, notes) => api.patch(`/jobs/${id}/status`, { status, notes }),
  // Export job applications
  exportJobApplications: (id, data) => api.post(`/jobs/${id}/export`, data, { responseType: 'blob' }),
  // AI-powered JD parsing
  parseJDFromUrl: (url) => api.post('/jobs/parse-jd', { url }),
  parseJDFromPDF: (file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    return api.post('/jobs/parse-jd', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  parseJDFromText: (text) => api.post('/jobs/parse-jd', { text }),
  // Interest requests (for <60% match students)
  submitInterest: (jobId, data) => api.post(`/jobs/${jobId}/interest`, data),
  getInterestRequests: (jobId, params) => api.get(`/jobs/${jobId}/interest-requests`, { params }),
  getAllInterestRequests: (params) => api.get(`/jobs/interest-requests/all`, { params }),
  reviewInterestRequest: (requestId, data) => api.patch(`/jobs/interest-requests/${requestId}`, data),
  // FAQ/Questions
  getQuestions: (jobId) => api.get(`/jobs/${jobId}/questions`),
  askQuestion: (jobId, question) => api.post(`/jobs/${jobId}/questions`, { question }),
  answerQuestion: (jobId, questionId, answer, isPublic) => api.patch(`/jobs/${jobId}/questions/${questionId}`, { answer, isPublic }),
  // Timeline
  addTimelineEvent: (jobId, event, description, metadata) => api.post(`/jobs/${jobId}/timeline`, { event, description, metadata }),
  // Expected update
  updateExpectedDate: (jobId, expectedUpdateDate, expectedUpdateNote) => api.patch(`/jobs/${jobId}/expected-update`, { expectedUpdateDate, expectedUpdateNote }),
  // Coordinator assignment
  assignCoordinator: (jobId, coordinatorId) => api.patch(`/jobs/${jobId}/coordinator`, { coordinatorId }),
  broadcastJob: (jobId) => api.post(`/jobs/${jobId}/broadcast`),
  bulkUpdate: (jobId, data) => api.post(`/jobs/${jobId}/bulk-update`, data),
  getCoordinatorJobStats: () => api.get('/jobs/stats/coordinator-jobs')
};

// Application APIs
export const applicationAPI = {
  getApplications: (params) => api.get('/applications', { params }),
  getApplication: (id) => api.get(`/applications/${id}`),
  apply: (jobId, coverLetter, customResponses, type = 'regular') => api.post('/applications', { jobId, coverLetter, customResponses, type }),
  updateStatus: (id, status, feedback) =>
    api.put(`/applications/${id}/status`, { status, feedback }),
  updateRound: (id, roundData) => api.put(`/applications/${id}/rounds`, roundData),
  addRecommendation: (id, reason) => api.put(`/applications/${id}/recommend`, { reason }),
  withdraw: (id) => api.put(`/applications/${id}/withdraw`),
  exportCSV: (params) => api.get('/applications/export/csv', { params, responseType: 'blob' }),
  // Enhanced export with field selection
  getExportFields: () => api.get('/applications/export/fields'),
  exportXLS: (data) => api.post('/applications/export/xls', data, { responseType: 'blob' })
};

// Skill APIs
export const skillAPI = {
  getSkills: (params) => api.get('/skills', { params }),
  getCategories: () => api.get('/skills/categories'),
  getSkill: (id) => api.get(`/skills/${id}`),
  createSkill: (data) => api.post('/skills', data),
  updateSkill: (id, data) => api.put(`/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/skills/${id}`)
};

// Questions APIs (Company Forum)
export const questionAPI = {
  getQuestions: (params) => api.get('/questions', { params }),
  askQuestion: (data) => api.post('/questions', data),
  answerQuestion: (id, answer) => api.patch(`/questions/${id}/answer`, { answer }),
  deleteQuestion: (id) => api.delete(`/questions/${id}`)
};

// Notification APIs
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications/clear/read')
};

// Stats APIs
export const statsAPI = {
  getDashboard: (params) => api.get('/stats/dashboard', { params }),
  getDashboardStats: (params) => api.get('/stats/dashboard', { params }), // Alias for Manager Dashboard
  getReports: (params) => api.get('/stats/reports', { params }),
  getCampusStats: () => api.get('/stats/campus'),
  getStudentStats: () => api.get('/stats/student'),
  getCampusPocStats: (status) => api.get('/stats/campus-poc', { params: { status } }),
  getEligibleJobs: () => api.get('/stats/campus-poc/eligible-jobs'),
  getJobEligibleStudents: (jobId) => api.get(`/stats/campus-poc/job/${jobId}/eligible-students`),
  getCompanyTracking: (cycleId) => api.get('/stats/campus-poc/company-tracking', { params: { cycleId } }),
  getSchoolTracking: (cycleId) => api.get('/stats/campus-poc/school-tracking', { params: { cycleId } }),
  getStudentSummary: (params) => api.get('/stats/campus-poc/student-summary', { params }),
  getCycleStats: () => api.get('/stats/campus-poc/cycle-stats'),
  getCoordinatorStats: () => api.get('/stats/coordinator-stats'),
  exportStats: (params) => api.get('/stats/export', { params, responseType: 'blob' })
};

// Placement Cycle APIs
export const placementCycleAPI = {
  getCycles: (params) => api.get('/placement-cycles', { params }),
  createCycle: (data) => api.post('/placement-cycles', data),
  updateCycle: (id, data) => api.put(`/placement-cycles/${id}`, data),
  deleteCycle: (id) => api.delete(`/placement-cycles/${id}`),
  getCycleStudents: (cycleId, params) => api.get(`/placement-cycles/${cycleId}/students`, { params }),
  assignStudents: (cycleId, studentIds) => api.post(`/placement-cycles/${cycleId}/students`, { studentIds }),
  removeStudents: (cycleId, studentIds) => api.delete(`/placement-cycles/${cycleId}/students`, { data: { studentIds } }),
  getUnassignedStudents: (params) => api.get('/placement-cycles/unassigned/students', { params }),
  updateMyCycle: (cycleId) => api.put('/placement-cycles/my-cycle', { cycleId }),
  updateStudentCycleOnPlacement: (studentId) => api.put(`/placement-cycles/student/${studentId}/placement-success`)
};

// Campus APIs
export const campusAPI = {
  getCampuses: () => api.get('/campuses'),
  getCampus: (id) => api.get(`/campuses/${id}`),
  createCampus: (data) => api.post('/campuses', data),
  updateCampus: (id, data) => api.put(`/campuses/${id}`, data),
  deleteCampus: (id) => api.delete(`/campuses/${id}`)
};

// Utilities
export const utilsAPI = {
  checkUrl: (url) => api.post('/utils/check-url', { url })
};

// Self Application APIs (for external jobs)
export const selfApplicationAPI = {
  getAll: (params) => api.get('/self-applications', { params }),
  getOne: (id) => api.get(`/self-applications/${id}`),
  create: (data) => api.post('/self-applications', data),
  update: (id, data) => api.put(`/self-applications/${id}`, data),
  delete: (id) => api.delete(`/self-applications/${id}`),
  updateStatus: (id, statusUpdate) => api.patch(`/self-applications/${id}/status`, statusUpdate),
  verify: (id, data) => api.patch(`/self-applications/${id}/verify`, data),
  getCampusStats: (params) => api.get('/self-applications/stats/campus', { params }),
  getCampusApplications: (params) => api.get('/self-applications', { params })
};

// Job Readiness APIs
export const jobReadinessAPI = {
  // Config management (for Coordinator/Manager)
  getConfig: (params) => api.get('/job-readiness/config', { params }),
  createConfig: (data) => api.post('/job-readiness/config', data),
  seedDefaultCriteria: () => api.post('/job-readiness/config/seed'),
  addCriterion: (configId, data) => api.post(`/job-readiness/config/${configId}/criteria`, data),
  editCriterion: (configId, criteriaId, data) => api.put(`/job-readiness/config/${configId}/criteria/${criteriaId}`, data),
  deleteCriterion: (configId, criteriaId) => api.delete(`/job-readiness/config/${configId}/criteria/${criteriaId}`),
  // Student self-tracking
  getMyStatus: () => api.get('/job-readiness/my-status'),
  updateMyCriterion: (criteriaId, data) => {
    // If there's a file, use FormData
    if (data.proofFile) {
      const formData = new FormData();
      if (data.completed !== undefined) formData.append('completed', data.completed);
      if (data.status) formData.append('status', data.status);
      if (data.selfReportedValue !== undefined) formData.append('selfReportedValue', data.selfReportedValue);
      if (data.notes) formData.append('notes', data.notes);
      formData.append('proofFile', data.proofFile);
      return api.patch(`/job-readiness/my-status/${criteriaId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    // Otherwise send JSON
    return api.patch(`/job-readiness/my-status/${criteriaId}`, data);
  },
  // Manager/PoC student readiness operations
  getStudentReadiness: (studentId) => api.get(`/job-readiness/student/${studentId}`),
  updateStudentReadiness: (studentId, data) => api.put(`/job-readiness/student/${studentId}`, data),
  // Campus PoC review
  getCampusStudents: (params) => api.get('/job-readiness/campus-students', { params }),
  verifyCriterion: (studentId, criteriaId, status, notes) =>
    api.patch(`/job-readiness/student/${studentId}/verify/${criteriaId}`, { status, verificationNotes: notes }),
  addPocComment: (studentId, criteriaId, comment) =>
    api.post(`/job-readiness/student/${studentId}/comment/${criteriaId}`, { comment }),
  addPocRating: (studentId, criteriaId, rating) =>
    api.post(`/job-readiness/student/${studentId}/rate/${criteriaId}`, { rating }),
  getStudentReadiness: (studentId) => api.get(`/job-readiness/student/${studentId}`),
  approveStudentJobReady: (studentId, data) =>
    api.patch(`/job-readiness/student/${studentId}/approve`, data)
};

// Bulk Upload APIs
export const bulkUploadAPI = {
  // Download sample templates
  downloadStudentsSample: () => api.get('/bulk-upload/sample/students', { responseType: 'blob' }),
  downloadSelfApplicationsSample: () => api.get('/bulk-upload/sample/self-applications', { responseType: 'blob' }),
  downloadSelfApplicationsCampusSample: () => api.get('/bulk-upload/sample/self-applications-campus', { responseType: 'blob' }),
  downloadAttendanceSample: () => api.get('/bulk-upload/sample/attendance', { responseType: 'blob' }),
  // Upload files
  uploadStudents: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-upload/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadSelfApplications: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-upload/self-applications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadSelfApplicationsCampus: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-upload/self-applications/campus', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadAttendance: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/bulk-upload/attendance', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Recruitment Lead APIs
export const leadAPI = {
  getLeads: () => api.get('/leads'),
  updateLead: (id, data) => api.patch(`/leads/${id}`, data)
};

export const featuredPlacementAPI = {
  getFeaturedPlacements: () => api.get('/featured-placements'),
  getAvailablePlacements: () => api.get('/featured-placements/available'),
  createFeaturedPlacement: (data) => api.post('/featured-placements', data),
  updateFeaturedPlacement: (id, data) => api.put(`/featured-placements/${id}`, data),
  deleteFeaturedPlacement: (id) => api.delete(`/featured-placements/${id}`),
  reorderFeaturedPlacements: (placements) => api.put('/featured-placements/reorder/batch', { placements }),
  uploadHeroImage: (id, file) => {
    const formData = new FormData();
    formData.append('heroImage', file);
    return api.put(`/featured-placements/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Ghar Dashboard Integration APIs
export const gharAPI = {
  connectionStatus: () => api.get('/ghar/connection-status'),
  studentPreview: (email, isDev) => api.get(`/ghar/student-preview/${email}?isDev=${isDev}`),
  syncStudent: (email) => api.post('/ghar/sync-student', { email }),
  batchSync: (campusId) => api.post('/ghar/batch-sync', { campusId }),
  getAttendanceConfig: (isDev) => api.get(`/ghar/attendance-config?isDev=${isDev}`)
};

// Public APIs (No auth required)
export const publicAPI = {
  submitLead: (data) => axios.post(`${API_URL}/public/leads`, data)
};

export default api;
