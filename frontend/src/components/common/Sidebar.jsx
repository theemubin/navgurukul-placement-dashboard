import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  User,
  Briefcase,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  X,
  GraduationCap,
  ClipboardCheck,
  Target,
  ExternalLink,
  Heart
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    switch (user?.role) {
      case 'student':
        return [
          { path: '/student', icon: Home, label: 'Dashboard', exact: true },
          { path: '/student/profile', icon: User, label: 'My Profile' },
          { path: '/student/jobs', icon: Briefcase, label: 'Job Listings' },
          { path: '/student/applications', icon: FileText, label: 'My Applications' },
          { path: '/student/job-readiness', icon: Target, label: 'Job Readiness' },
          { path: '/student/self-applications', icon: ExternalLink, label: 'Self Applications' }
        ];
      case 'campus_poc':
        return [
          { path: '/campus-poc', icon: Home, label: 'Dashboard', exact: true },
          { path: '/campus-poc/students', icon: Users, label: 'Students' },
          { path: '/campus-poc/profile-approvals', icon: ClipboardCheck, label: 'Profile Approvals' },
          { path: '/campus-poc/skill-approvals', icon: CheckSquare, label: 'Skill Approvals' },
          { path: '/campus-poc/job-readiness', icon: Target, label: 'Job Readiness' },
          { path: '/campus-poc/self-applications', icon: ExternalLink, label: 'Self Applications' },
          { path: '/campus-poc/interest-requests', icon: Heart, label: 'Interest Requests' }
        ];
      case 'coordinator':
        return [
          { path: '/coordinator', icon: Home, label: 'Dashboard', exact: true },
          { path: '/coordinator/jobs', icon: Briefcase, label: 'Job Management' },
          { path: '/coordinator/applications', icon: FileText, label: 'Applications' },
          { path: '/coordinator/skills', icon: Settings, label: 'Skill Categories' }
        ];
      case 'manager':
        return [
          { path: '/manager', icon: Home, label: 'Dashboard', exact: true },
          { path: '/manager/reports', icon: BarChart3, label: 'Reports & Export' },
          { path: '/manager/settings', icon: Settings, label: 'Platform Settings' }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const getRoleLabel = () => {
    const labels = {
      student: 'Student',
      campus_poc: 'Campus POC',
      coordinator: 'Coordinator',
      manager: 'Manager'
    };
    return labels[user?.role] || 'User';
  };

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0
    `}>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="font-bold text-gray-900">Placement</h1>
            <p className="text-xs text-gray-500">Dashboard</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-semibold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">{getRoleLabel()}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact 
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
        <p className="text-xs text-gray-400 text-center">
          © 2026 Placement Dashboard
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
