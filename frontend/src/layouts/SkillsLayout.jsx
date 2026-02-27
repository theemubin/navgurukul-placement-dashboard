import { NavLink, Outlet } from 'react-router-dom';
import { Tag, CheckSquare } from 'lucide-react';

const SkillsLayout = ({ role = 'coordinator' }) => {
    const base = `/${role}/skills`;

    const tabs = [
        { to: base, label: 'Skill Categories', icon: Tag, end: true },
        { to: `${base}/approvals`, label: 'Skill Approvals', icon: CheckSquare, end: false },
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
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

export default SkillsLayout;
