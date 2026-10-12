import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, ArrowLeft } from 'lucide-react';
import StudentCard from '../components/StudentCard';
import StudentModal from '../components/StudentModal';
import FilterBar from '../components/FilterBar';
import { portfolioAPI } from '../services/api';

/**
 * StudentPortfolio Page
 * Public page displaying approved student portfolios
 * - Fetches from GET /api/users/portfolio
 * - Shows only approved students with approved skills
 * - Includes search, campus filter, and skill filter
 * - Modal expansion on card click
 */
const StudentPortfolio = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchValue, setSearchValue] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');

  // Modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const ITEMS_PER_PAGE = 12;

  // Fetch portfolio students
  const fetchPortfolioStudents = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pageNum,
        limit: ITEMS_PER_PAGE,
        ...(searchValue && { search: searchValue }),
        ...(selectedCampus && { campus: selectedCampus }),
        ...(selectedSkill && { skill: selectedSkill })
      };

      const response = await portfolioAPI.getPortfolioStudents(params);
      setStudents(response.data.students || []);
      setTotalPages(response.data.pagination?.pages || 0);
      setTotal(response.data.pagination?.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch portfolio students:', err);
      setError(
        err.response?.data?.message ||
        'Failed to load student portfolios. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch campuses and skills on mount
  useEffect(() => {
    const fetchFiltersData = async () => {
      try {
        const [campusesRes, skillsRes] = await Promise.all([
          portfolioAPI.getPortfolioCampuses(),
          portfolioAPI.getPortfolioSkills()
        ]);
        setCampuses(campusesRes.data || []);
        setSkills(skillsRes.data || []);
      } catch (err) {
        console.error('Failed to fetch filter data:', err);
      }
    };

    fetchFiltersData();
  }, []);

  // Fetch students on mount and when filters change
  useEffect(() => {
    setPage(1); // Reset to page 1 when filters change
    fetchPortfolioStudents(1);
  }, [searchValue, selectedCampus, selectedSkill]);

  // Handle card click to open modal
  const handleCardClick = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  // Handle pagination
  const handleNextPage = () => {
    if (page < totalPages) {
      fetchPortfolioStudents(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      fetchPortfolioStudents(page - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 md:py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-700 transition-colors text-sm font-semibold"
            title="Go back to previous page"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Student Portfolios
          </h1>
          <p className="text-blue-100 text-lg">
            Discover talented students from Navgurukul campuses
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <FilterBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          selectedCampus={selectedCampus}
          onCampusChange={setSelectedCampus}
          selectedSkill={selectedSkill}
          onSkillChange={setSelectedSkill}
          campuses={campuses}
          skills={skills}
          onReset={() => setPage(1)}
        />

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading student portfolios...</p>
            </div>
          </div>
        )}

        {/* Student Cards Grid */}
        {!loading && students.length > 0 && (
          <>
            {/* Results Summary */}
            <div className="mb-4 text-gray-600 text-sm">
              Showing <span className="font-semibold">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(page * ITEMS_PER_PAGE, total)}
              </span>{' '}
              of <span className="font-semibold">{total}</span> students
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mb-8">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>

                {/* Page Indicators */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => fetchPortfolioStudents(pageNum)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && (
                    <span className="px-2 py-2 text-gray-600">...</span>
                  )}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-900 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && students.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6v6m0 0v6m0-6h6m0 0h6M6 12a6 6 0 100-12 6 6 0 000 12z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No students found
            </h3>
            <p className="text-gray-600">
              Try adjusting your filters or search criteria
            </p>
          </div>
        )}
      </div>

      {/* Student Modal */}
      <StudentModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default StudentPortfolio;
