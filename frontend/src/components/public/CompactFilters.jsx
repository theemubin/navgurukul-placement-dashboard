import { useState, useEffect, useRef } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';

const CompactFilters = ({ onFilterChange, filters }) => {
    const [selectedCampus, setSelectedCampus] = useState('');
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [selectedRole, setSelectedRole] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        onFilterChange({
            campus: selectedCampus,
            skills: selectedSkills,
            role: selectedRole,
        });
    }, [selectedCampus, selectedSkills, selectedRole]);

    const handleSkillToggle = (skillId) => {
        setSelectedSkills((prev) =>
            prev.includes(skillId)
                ? prev.filter((id) => id !== skillId)
                : [...prev, skillId]
        );
    };

    const clearAllFilters = () => {
        setSelectedCampus('');
        setSelectedSkills([]);
        setSelectedRole('');
    };

    const activeFiltersCount =
        (selectedCampus ? 1 : 0) +
        selectedSkills.length +
        (selectedRole ? 1 : 0);

    const toggleDropdown = (dropdown) => {
        setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
    };

    return (
        <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm mb-8 rounded-xl overflow-hidden">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Filter Toggle Button (Mobile) */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="lg:hidden flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                        <Filter className="w-4 h-4" />
                        <span>Filters</span>
                        {activeFiltersCount > 0 && (
                            <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>

                    {/* Desktop Filters */}
                    <div className="hidden lg:flex items-center gap-3 flex-1" ref={dropdownRef}>
                        <div className="flex items-center gap-2 text-gray-700 font-medium">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm">Filter by:</span>
                        </div>

                        {/* Campus Filter */}
                        <div className="relative">
                            <button
                                onClick={() => toggleDropdown('campus')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${selectedCampus
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                    }`}
                            >
                                <span className="text-sm font-medium">
                                    {selectedCampus
                                        ? filters.campuses?.find((c) => c._id === selectedCampus)?.name || 'Campus'
                                        : 'Campus'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {activeDropdown === 'campus' && (
                                <div className="absolute top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => {
                                            setSelectedCampus('');
                                            setActiveDropdown(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        All Campuses
                                    </button>
                                    {filters.campuses?.map((campus) => (
                                        <button
                                            key={campus._id}
                                            onClick={() => {
                                                setSelectedCampus(campus._id);
                                                setActiveDropdown(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedCampus === campus._id
                                                ? 'bg-blue-50 text-blue-700 font-medium'
                                                : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {campus.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Role Filter */}
                        <div className="relative">
                            <button
                                onClick={() => toggleDropdown('role')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${selectedRole
                                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                    }`}
                            >
                                <span className="text-sm font-medium">
                                    {selectedRole || 'Role'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {activeDropdown === 'role' && (
                                <div className="absolute top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => {
                                            setSelectedRole('');
                                            setActiveDropdown(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        All Roles
                                    </button>
                                    {filters.roles?.map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => {
                                                setSelectedRole(role);
                                                setActiveDropdown(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedRole === role
                                                ? 'bg-purple-50 text-purple-700 font-medium'
                                                : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Skills Filter */}
                        <div className="relative">
                            <button
                                onClick={() => toggleDropdown('skills')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${selectedSkills.length > 0
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                    }`}
                            >
                                <span className="text-sm font-medium">
                                    Skills {selectedSkills.length > 0 && `(${selectedSkills.length})`}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {activeDropdown === 'skills' && (
                                <div className="absolute top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-80 overflow-y-auto">
                                    <div className="px-4 py-2 border-b border-gray-200">
                                        <p className="text-xs text-gray-500 font-medium">Select multiple skills</p>
                                    </div>
                                    {filters.skills?.map((skill) => (
                                        <label
                                            key={skill._id}
                                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedSkills.includes(skill._id)}
                                                onChange={() => handleSkillToggle(skill._id)}
                                                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                                            />
                                            <span className="text-sm text-gray-700">{skill.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Clear All Button */}
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                            >
                                <X className="w-4 h-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Active Filters Count (Desktop) */}
                    {activeFiltersCount > 0 && (
                        <div className="hidden lg:block text-sm text-gray-600">
                            <span className="font-medium">{activeFiltersCount}</span> filter{activeFiltersCount !== 1 ? 's' : ''} active
                        </div>
                    )}
                </div>

                {/* Mobile Filters Dropdown */}
                {showFilters && (
                    <div className="lg:hidden mt-4 space-y-3 pb-2">
                        {/* Campus */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Campus</label>
                            <select
                                value={selectedCampus}
                                onChange={(e) => setSelectedCampus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Campuses</option>
                                {filters.campuses?.map((campus) => (
                                    <option key={campus._id} value={campus._id}>
                                        {campus.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">All Roles</option>
                                {filters.roles?.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Skills */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Skills ({selectedSkills.length} selected)
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                                {filters.skills?.map((skill) => (
                                    <label
                                        key={skill._id}
                                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSkills.includes(skill._id)}
                                            onChange={() => handleSkillToggle(skill._id)}
                                            className="w-4 h-4 text-green-600 rounded"
                                        />
                                        <span className="text-sm text-gray-700">{skill.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {activeFiltersCount > 0 && (
                            <button
                                onClick={clearAllFilters}
                                className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                            >
                                Clear All Filters
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompactFilters;
