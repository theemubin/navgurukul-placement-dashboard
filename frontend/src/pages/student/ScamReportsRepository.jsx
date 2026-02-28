import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  AlertTriangle,
  Shield,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Eye,
  TrendingUp,
  Building2,
  Calendar,
  Tag,
  ArrowRight,
  Users,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { scamReportsAPI } from '../../services/api';
import { TrustScoreCircle, MiniCircularProgress } from '../../components/CircularProgress';
import toast from 'react-hot-toast';

const ScamReportsRepository = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'popular', 'oldest'
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'danger', 'warning', 'safe'
  const [filters, setFilters] = useState({
    verdict: '',
    tags: '',
    sortBy: 'recent'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalReports: 0,
    hasNext: false,
    hasPrev: false
  });
  const [popularTags, setPopularTags] = useState([]);
  const [topContributors, setTopContributors] = useState([]);

  const [quickStats, setQuickStats] = useState({
    totalReports: 0,
    dangerousCompanies: 0,
    recentAlerts: 0,
    helpfulVotes: 0,
    activeUsers: 142
  });

  const fetchReports = async (page = 1, resetResults = true) => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: 12,
        sortBy: sortBy,
        verdict: activeCategory !== 'all' ? activeCategory.toUpperCase() : ''
      };

      if (searchQuery.trim()) {
        params.company = searchQuery.trim();
      }

      const response = await scamReportsAPI.getPublicReports(params);

      if (resetResults) {
        setReports(response.data.reports);
      } else {
        setReports(prev => [...prev, ...response.data.reports]);
      }

      setPagination(response.data.pagination);
      setPopularTags(response.data.popularTags);
      setTopContributors(response.data.topMembers || []);

      // Update quick stats
      setQuickStats(prev => ({
        ...prev,
        totalReports: response.data.pagination.totalReports,
        dangerousCompanies: response.data.reports.filter(r => r.verdict === 'DANGER').length,
        recentAlerts: response.data.reports.filter(r => {
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return new Date(r.createdAt) > dayAgo;
        }).length,
        helpfulVotes: response.data.reports.reduce((sum, r) => sum + (r.communityVotes?.helpful || 0), 0)
      }));

    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load scam reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(1, true);
  }, [sortBy, activeCategory, searchQuery]);

  const handleVote = async (reportId, voteType) => {
    try {
      await scamReportsAPI.voteOnReport(reportId, voteType);

      // Update the report in the local state
      setReports(prev =>
        prev.map(report =>
          report._id === reportId
            ? {
              ...report,
              communityVotes: {
                ...report.communityVotes,
                [voteType]: (report.communityVotes[voteType] || 0) + 1
              }
            }
            : report
        )
      );

      toast.success('Vote recorded! Thanks for helping the community.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record vote');
    }
  };

  const loadMoreReports = () => {
    if (pagination.hasNext && !loading) {
      fetchReports(pagination.currentPage + 1, false);
    }
  };

  // Calculate online status based on activity timestamp
  const getOnlineStatus = (lastActivityTime) => {
    if (!lastActivityTime) return 'offline';

    const now = new Date();
    const lastActivity = new Date(lastActivityTime);
    const diffMinutes = Math.floor((now - lastActivity) / (1000 * 60));

    if (diffMinutes < 5) return 'online';
    if (diffMinutes < 30) return 'recently-active';
    return 'offline';
  };

  // Handle tag click to filter
  const handleTagClick = (tag) => {
    // Add selected tag to search
    const newQuery = tag;
    setSearchQuery(newQuery);
    setFilters(prev => ({
      ...prev,
      tags: tag
    }));
    fetchReports(1, true);
  };

  const getVerdictBadge = (verdict, trustScore) => {
    const config = {
      DANGER: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: AlertTriangle
      },
      WARNING: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: AlertTriangle
      },
      SAFE: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: Shield
      }
    };

    const { bg, text, border, icon: Icon } = config[verdict] || config.WARNING;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ${bg} ${text} ${border} border`}>
        <Icon size={12} />
        {verdict}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getDashboardPath = () => {
    const role = user?.role;
    const dashboardMap = {
      student: '/student',
      campus_poc: '/campus-poc',
      coordinator: '/coordinator',
      manager: '/manager'
    };
    return dashboardMap[role] || '/student';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(getDashboardPath())}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors group -ml-2"
                title="Back to Dashboard"
              >
                <ArrowLeft size={20} className="text-gray-600 group-hover:text-gray-900" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Scam Reports</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-gray-600">Online</span>
                <span className="font-semibold text-gray-900">{quickStats.activeUsers} members</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6">
          {/* Left Sidebar */}
          <aside className="space-y-6">
            {/* Search */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for topics"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Sort Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setSortBy('recent')}
                className={`w-full px-4 py-3 text-sm font-semibold text-left transition-colors ${sortBy === 'recent' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Latest
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`w-full px-4 py-3 text-sm font-semibold text-left transition-colors ${sortBy === 'popular' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-gray-200'
                  }`}
              >
                Popular
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`w-full px-4 py-3 text-sm font-semibold text-left transition-colors ${sortBy === 'oldest' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-gray-200'
                  }`}
              >
                Older
              </button>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">Categories (3)</h3>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <Shield size={14} className="text-gray-400" />
                  All Reports
                </button>
                <button
                  onClick={() => setActiveCategory('danger')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'danger' ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  Danger
                </button>
                <button
                  onClick={() => setActiveCategory('warning')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'warning' ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  Warning
                </button>
                <button
                  onClick={() => setActiveCategory('safe')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'safe' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Safe
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="space-y-4">
            {/* Header with post count */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-indigo-900">{pagination.totalReports} Posts</h2>
              <Link
                to="/scam-detector"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} />
                Start a new topic
              </Link>
            </div>

            {/* Loading State */}
            {loading && reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
                <p className="text-gray-500">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report._id}
                    onClick={() => navigate(`/scam-reports/${report._id}`)}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer relative group"
                  >
                    {/* Author Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                          {report.reportedBy?.firstName?.charAt(0) || 'A'}
                        </div>
                        {/* Online status indicator */}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getOnlineStatus(report.reportedBy?.lastLogin) === 'online'
                          ? 'bg-green-500'
                          : getOnlineStatus(report.reportedBy?.lastLogin) === 'recently-active'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                          }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {report.reportedBy?.firstName && report.reportedBy?.lastName
                              ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}`
                              : 'Anonymous'}
                          </span>
                          <span className="text-sm text-gray-500">{formatDate(report.createdAt)}</span>
                        </div>
                      </div>
                      {/* Score and Category Badge */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${report.verdict === 'DANGER' ? 'bg-red-100 text-red-700' :
                            report.verdict === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                            {report.trustScore || 0}% {report.verdict}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Report Title */}
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {report.companyName} - {report.roleName}
                    </h3>

                    {/* Report Summary */}
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {report.summary}
                    </p>

                    {/* Tags */}
                    {report.tags && report.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {report.tags.slice(0, 3).map(tag => (
                          <button
                            key={tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTagClick(tag);
                            }}
                            className="px-2 py-1 bg-indigo-100 text-indigo-600 text-xs rounded-md hover:bg-indigo-200 transition-colors cursor-pointer font-medium"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Footer with engagement metrics */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        {/* Upvote - Agree */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(report._id, 'agree');
                          }}
                          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 p-1"
                        >
                          <ThumbsUp size={16} />
                          <span className="font-semibold">{report.communityVotes?.agree || 0}</span>
                        </button>

                        {/* Downvote - Disagree */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(report._id, 'disagree');
                          }}
                          className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 p-1"
                        >
                          <ThumbsDown size={16} />
                          <span className="font-semibold">{report.communityVotes?.disagree || 0}</span>
                        </button>

                        {/* More options */}
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {/* Views */}
                        <span className="flex items-center gap-1">
                          <Eye size={16} />
                          {report.viewCount || 0}
                        </span>

                        {/* Comments */}
                        <span className="flex items-center gap-1">
                          <MessageCircle size={16} />
                          {report.comments?.length || 0}
                        </span>

                        {/* See more link */}
                        <span className="text-primary-600 hover:underline font-medium">
                          see more
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More / Pagination */}
            {pagination.hasNext && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMoreReports}
                  disabled={loading}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loading ? 'Loading...' : 'See more'}
                </button>
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            {/* Top Members */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Top Members</h3>
              <div className="space-y-3">
                {topContributors.length > 0 ? (
                  topContributors.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {member.name?.charAt(0) || member?._id?.charAt(0) || 'U'}
                        </div>
                        {/* Online status indicator for members */}
                        <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${getOnlineStatus(member.lastLogin) === 'online'
                          ? 'bg-green-500'
                          : getOnlineStatus(member.lastLogin) === 'recently-active'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                          }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{member.name || 'Student'}</div>
                      </div>
                      <div className="text-xs text-gray-500">{member.postCount} posts</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">No active members yet.</p>
                )}
              </div>
            </div>

            {/* Popular Tags */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Popular tags</h3>
              <div className="space-y-2">
                {popularTags.length > 0 ? (
                  popularTags.slice(0, 8).map(tag => (
                    <button
                      key={tag.name}
                      onClick={() => setSearchQuery(tag.name)}
                      className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      #{tag.name}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">No popular tags yet.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <Link
          to="/scam-detector"
          className="flex items-center justify-center w-14 h-14 bg-indigo-600 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] text-white rounded-full transition-all hover:scale-105 active:scale-95 group relative group-hover:bg-indigo-700 p-0"
        >
          <Search size={22} className="group-hover:text-amber-300" />
        </Link>
      </div>

    </div>
  );
};

export default ScamReportsRepository;