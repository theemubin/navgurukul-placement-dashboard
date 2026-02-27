import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AuthCallback from './pages/auth/AuthCallback';
import PendingApproval from './pages/auth/PendingApproval';
import AccountInactive from './pages/auth/AccountInactive';

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
import UnifiedJobReadiness from './pages/campus-poc/UnifiedJobReadiness';
import POCSelfApplicationsReview from './pages/campus-poc/SelfApplicationsReview';
import POCInterestRequestsReview from './pages/campus-poc/InterestRequestsReview';
import POCSkills from './pages/campus-poc/Skills';

// Coordinator Pages
import CoordinatorDashboard from './pages/coordinator/Dashboard';
import CoordinatorJobs from './pages/coordinator/Jobs';
import JobForm from './pages/coordinator/JobForm';
import CoordinatorApplications from './pages/coordinator/Applications';
import CoordinatorSkills from './pages/coordinator/Skills';
import CoordinatorInterestRequests from './pages/coordinator/InterestRequests';
import CoordinatorInterestRequestsForManager from './pages/coordinator/InterestRequests';
import CoordinatorForum from './pages/coordinator/Forum';
// Coordinator Settings sub-pages
import AIKeysSettings from './pages/coordinator/settings/AIKeys';
import DiscordSettings from './pages/coordinator/settings/Discord';
// Layout wrappers
import SkillsLayout from './layouts/SkillsLayout';
import SettingsLayout from './layouts/SettingsLayout';

// Manager Pages
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerReports from './pages/manager/Reports';
import ManagerSettings from './pages/manager/Settings';
import UsersManager from './pages/manager/Users';
import CarouselManagement from './pages/manager/CarouselManagement';
import PartnerManagement from './pages/manager/PartnerManagement';
import LeadsManagement from './pages/manager/LeadsManagement';
import GharIntegration from './pages/manager/GharIntegration';
import GharDataViewer from './pages/manager/GharDataViewer';

// Common Pages
import Notifications from './pages/common/Notifications';
import NotFound from './pages/common/NotFound';

// Public Pages
import Portfolios from './pages/public/Portfolios';

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

// Protected Route wrapper (normalize role variants to avoid hyphen/underscore mismatches)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const normalizedUserRole = user.role ? user.role.replace('-', '_') : '';
    const normalizedAllowed = allowedRoles.map(r => r.replace('-', '_'));
    if (!normalizedAllowed.includes(normalizedUserRole)) {
      return <Navigate to={`/${user.role.replace('_', '-')}`} replace />;
    }
  }

  return children;
};

// Public Route wrapper (redirects if authenticated) - normalize role to path
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (user) {
    const path = `/${user.role.replace('_', '-')}`;
    return <Navigate to={path} replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/portfolios" element={<Portfolios />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/pending-approval" element={<PendingApproval />} />
      <Route path="/auth/account-inactive" element={<AccountInactive />} />

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
        <Route path="job-readiness" element={<UnifiedJobReadiness />} />
        <Route path="self-applications" element={<POCSelfApplicationsReview />} />
        <Route path="interest-requests" element={<POCInterestRequestsReview />} />
        <Route path="skills" element={<POCSkills />} />
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
        {/* Nested Skills routes */}
        <Route path="skills" element={<SkillsLayout role="coordinator" />}>
          <Route index element={<CoordinatorSkills />} />
          <Route path="approvals" element={<POCSkillApprovals />} />
        </Route>
        <Route path="interest-requests" element={<CoordinatorInterestRequests />} />
        <Route path="forum" element={<CoordinatorForum />} />
        {/* Nested Settings routes */}
        <Route path="settings" element={<SettingsLayout role="coordinator" />}>
          <Route index element={<AIKeysSettings />} />
          <Route path="discord" element={<DiscordSettings />} />
        </Route>
        <Route path="job-readiness" element={<UnifiedJobReadiness />} />
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
        <Route path="carousel" element={<CarouselManagement />} />
        <Route path="partners" element={<PartnerManagement />} />
        <Route path="leads" element={<LeadsManagement />} />
        <Route path="settings" element={<ManagerSettings />} />
        <Route path="job-readiness" element={<UnifiedJobReadiness />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="interest-requests" element={<CoordinatorInterestRequestsForManager />} />
        <Route path="users" element={<UsersManager />} />
        <Route path="ghar" element={<GharIntegration />} />
        <Route path="ghar-viewer" element={<GharDataViewer />} />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/portfolios" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
