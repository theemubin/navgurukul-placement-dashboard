import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';

/**
 * FilterBar Component
 * Provides filtering options: search, campus, skills
 * Campus filter is prominently displayed for easy access
 */
const FilterBar = ({
  searchValue,
  onSearchChange,
  selectedCampus,
  onCampusChange,
  selectedSkill,
  onSkillChange,
  campuses = [],
  skills = [],
  onReset
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleReset = () => {
    onSearchChange('');
    onCampusChange('');
    onSkillChange('');
    onReset?.();
    setIsExpanded(false);
  };

  const hasActiveFilters = searchValue || selectedCampus || selectedSkill;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
      {/* Main Filter Row - Search + Campus */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Campus Filter - Prominently Displayed */}
        <div className="md:w-48">
          <select
            value={selectedCampus}
            onChange={(e) => onCampusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            title="Filter by campus name"
          >
            <option value="">All Campuses</option>
            {campuses.map((campus) => (
              <option key={campus._id} value={campus._id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {isExpanded ? 'Hide' : 'More'}
        </button>
      </div>

      {/* Advanced Filters - Skills */}
      {isExpanded && (
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Skill Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Approved Skill
              </label>
              <select
                value={selectedSkill}
                onChange={(e) => onSkillChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Skills</option>
                {skills.map((skill) => (
                  <option key={skill._id} value={skill._id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {searchValue && (
            <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              🔍 {searchValue}
              <button
                onClick={() => onSearchChange('')}
                className="hover:text-blue-600"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}
          {selectedCampus && (
            <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              📍 {campuses.find(c => c._id === selectedCampus)?.name}
              <button
                onClick={() => onCampusChange('')}
                className="hover:text-green-600"
                title="Clear campus filter"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}
          {selectedSkill && (
            <span className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              ⭐ {skills.find(s => s._id === selectedSkill)?.name}
              <button
                onClick={() => onSkillChange('')}
                className="hover:text-purple-600"
                title="Clear skill filter"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
