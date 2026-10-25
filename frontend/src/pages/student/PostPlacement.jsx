import { ClipboardCheck, FileText, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import PostPlacementDashboard from './PostPlacementDashboard';
import DailyTrackerHistory from './DailyTrackerHistory';
import StudentPostPlacementTracking from './PostPlacementTracking';

const tabs = [
  {
    path: '/student/post-placement-dashboard',
    label: 'Overview',
    icon: ClipboardCheck
  },
  {
    path: '/student/daily-tracker-history',
    label: 'History',
    icon: FileText
  },
  {
    path: '/student/post-placement',
    label: 'Placement details',
    icon: ShieldCheck
  }
];

const PostPlacement = () => {
  const location = useLocation();
  const activeTab = tabs.find((tab) => location.pathname === tab.path) || tabs[0];
  const ActivePage = activeTab.path === tabs[0].path
    ? PostPlacementDashboard
    : activeTab.path === tabs[1].path
      ? DailyTrackerHistory
      : StudentPostPlacementTracking;

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <nav
          aria-label="Post-placement sections"
          className="grid grid-cols-3 gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.path === activeTab.path;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-[11px] font-black sm:text-sm">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <ActivePage />
    </div>
  );
};

export default PostPlacement;
