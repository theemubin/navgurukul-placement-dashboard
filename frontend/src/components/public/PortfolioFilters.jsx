import { useState, useEffect } from 'react';

const PortfolioFilters = ({ onFilterChange, filters }) => {
    const [selectedCampus, setSelectedCampus] = useState('');
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [selectedRole, setSelectedRole] = useState('');
    const [showSkillsDropdown, setShowSkillsDropdown] = useState(false);

    useEffect(() => {
        onFilterChange({
            campus: selectedCampus,
            skills: selectedSkills,
            role: selectedRole
        });
    }, [selectedCampus, selectedSkills, selectedRole]);

    const handleSkillToggle = (skillId) => {
        setSelectedSkills(prev =>
            prev.includes(skillId)
                ? prev.filter(id => id !== skillId)
                : [...prev, skillId]
        );
    };

    const clearAllFilters = () => {
        setSelectedCampus('');
        setSelectedSkills([]);
        setSelectedRole('');
    };

    const hasActiveFilters = selectedCampus || selectedSkills.length > 0 || selectedRole;

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter Students
                </h3>
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear All
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Campus Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campus
                    </label>
                    <select
                        value={selectedCampus}
                        onChange={(e) => setSelectedCampus(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                        <option value="">All Campuses</option>
                        {filters.campuses?.map(campus => (
                            <option key={campus._id} value={campus._id}>
                                {campus.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Role Filter */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role
                    </label>
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                        <option value="">All Roles</option>
                        {filters.roles?.map(role => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Skills Filter */}
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Skills
                    </label>
                    <button
                        onClick={() => setShowSkillsDropdown(!showSkillsDropdown)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left flex items-center justify-between"
                    >
                        <span className="text-gray-700">
                            {selectedSkills.length === 0
                                ? 'All Skills'
                                : `${selectedSkills.length} selected`}
                        </span>
                        <svg className={`w-5 h-5 transition-transform ${showSkillsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {/* Skills Dropdown */}
                    {showSkillsDropdown && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {filters.skills?.map(skill => (
                                <label
                                    key={skill._id}
                                    className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSkills.includes(skill._id)}
                                        onChange={() => handleSkillToggle(skill._id)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-3 text-sm text-gray-700">{skill.name}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                        {selectedCampus && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                {filters.campuses?.find(c => c._id === selectedCampus)?.name}
                                <button onClick={() => setSelectedCampus('')} className="hover:text-blue-900">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        )}
                        {selectedRole && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                {selectedRole}
                                <button onClick={() => setSelectedRole('')} className="hover:text-purple-900">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        )}
                        {selectedSkills.map(skillId => {
                            const skill = filters.skills?.find(s => s._id === skillId);
                            return skill ? (
                                <span key={skillId} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                    {skill.name}
                                    <button onClick={() => handleSkillToggle(skillId)} className="hover:text-green-900">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            ) : null;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioFilters;
