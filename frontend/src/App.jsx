import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentProfile from './pages/student/Profile';
import StudentJobs from './pages/student/Jobs';
import StudentApplications from './pages/student/Applications';
import JobDetails from './pages/student/JobDetails';
import StudentJobReadiness from './pages/student/JobReadiness';
import StudentSelfApplications from './pages/student/SelfApplications';

// Campus POC Pages
import POCDashboard from './pages/campus-poc/Dashboard';
import POCStudents from './pages/campus-poc/Students';
import POCSkillApprovals from './pages/campus-poc/SkillApprovals';
import POCStudentDetails from './pages/campus-poc/StudentDetails';
import POCProfileApprovals from './pages/campus-poc/ProfileApprovals';
import POCJobReadinessReview from './pages/campus-poc/JobReadinessReview';
import JobReadinessCriteriaConfig from './pages/campus-poc/JobReadinessCriteriaConfig';
import POCSelfApplicationsReview from './pages/campus-poc/SelfApplicationsReview';
import POCInterestRequestsReview from './pages/campus-poc/InterestRequestsReview';

// Coordinator Pages
import CoordinatorDashboard from './pages/coordinator/Dashboard';
import CoordinatorJobs from './pages/coordinator/Jobs';
import JobForm from './pages/coordinator/JobForm';
import CoordinatorApplications from './pages/coordinator/Applications';
import CoordinatorSkills from './pages/coordinator/Skills';

// Manager Pages
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerReports from './pages/manager/Reports';
import ManagerSettings from './pages/manager/Settings';

// Common Pages
import Notifications from './pages/common/Notifications';
import NotFound from './pages/common/NotFound';

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role.replace('_', '-')}`} replace />;
  }

  return children;
};

// Public Route wrapper (redirects if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (user) {
    const dashboardRoutes = {
      student: '/student',
      campus_poc: '/campus-poc',
      coordinator: '/coordinator',
      manager: '/manager'
    };
    return <Navigate to={dashboardRoutes[user.role]} replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Student Routes */}
      <Route path="/student" element={
        <ProtectedRoute allowedRoles={['student']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="jobs" element={<StudentJobs />} />
        <Route path="jobs/:id" element={<JobDetails />} />
        <Route path="applications" element={<StudentApplications />} />
        <Route path="job-readiness" element={<StudentJobReadiness />} />
        <Route path="self-applications" element={<StudentSelfApplications />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="job-readiness-criteria" element={<JobReadinessCriteriaConfig />} />
      </Route>

      {/* Campus POC Routes */}
      <Route path="/campus-poc" element={
        <ProtectedRoute allowedRoles={['campus_poc']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<POCDashboard />} />
        <Route path="students" element={<POCStudents />} />
        <Route path="students/:id" element={<POCStudentDetails />} />
        <Route path="skill-approvals" element={<POCSkillApprovals />} />
        <Route path="profile-approvals" element={<POCProfileApprovals />} />
        <Route path="job-readiness" element={<POCJobReadinessReview />} />
        <Route path="job-readiness-criteria" element={<JobReadinessCriteriaConfig />} />
        <Route path="self-applications" element={<POCSelfApplicationsReview />} />
        <Route path="interest-requests" element={<POCInterestRequestsReview />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Coordinator Routes */}
      <Route path="/coordinator" element={
        <ProtectedRoute allowedRoles={['coordinator']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<CoordinatorDashboard />} />
        <Route path="jobs" element={<CoordinatorJobs />} />
        <Route path="jobs/new" element={<JobForm />} />
        <Route path="jobs/:id/edit" element={<JobForm />} />
        <Route path="applications" element={<CoordinatorApplications />} />
        <Route path="skills" element={<CoordinatorSkills />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Manager Routes */}
      <Route path="/manager" element={
        <ProtectedRoute allowedRoles={['manager']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<ManagerDashboard />} />
        <Route path="reports" element={<ManagerReports />} />
        <Route path="settings" element={<ManagerSettings />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
