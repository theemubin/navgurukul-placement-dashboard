import { NavLink, Outlet } from 'react-router-dom';
import { Key, MessageSquare, Settings } from 'lucide-react';

const SettingsLayout = ({ role = 'coordinator' }) => {
    const base = `/${role}/settings`;

    const coordinatorTabs = [
        { to: base, label: 'AI API Keys', icon: Key, end: true },
        { to: `${base}/discord`, label: 'Discord', icon: MessageSquare, end: false },
    ];

    const managerTabs = [
        { to: base, label: 'Platform Settings', icon: Settings, end: true },
    ];

    const tabs = role === 'manager' ? managerTabs : coordinatorTabs;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600">Manage your preferences and integrations</p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-1 -mb-px">
                    {tabs.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${isActive
                                    ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Nested Page Content */}
            <Outlet />
        </div>
    );
};

export default SettingsLayout;
