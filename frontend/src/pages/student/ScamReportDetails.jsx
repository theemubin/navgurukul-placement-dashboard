import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Calendar,
  Eye,
  ThumbsUp,
  Share2,
  Flag,
  ExternalLink,
  Building2,
  MapPin,
  Clock,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
  MessageCircle,
  Send,
  Heart,
  Trash2,
  User,
  Phone,
  BarChart3,
  Target,
  DollarSign,
  Laptop,
  Coins,
  ClipboardList,
  Check,
  X,
  Search,
  Mail,
  FileText,
  HelpCircle,
  Link as LinkIcon,
  ArrowUpRight
} from 'lucide-react';
import { scamReportsAPI } from '../../services/api';
import { TrustScoreCircle, MiniCircularProgress } from '../../components/CircularProgress';
import toast from 'react-hot-toast';

const getIcon = (name, className = "w-4 h-4") => {
  const icons = {
    Shield: Shield,
    Phone: Phone,
    BarChart3: BarChart3,
    Target: Target,
    User: User,
    Building2: Building2,
    AlertTriangle: AlertTriangle,
    CheckCircle2: CheckCircle2,
    Search: Search,
    Mail: Mail,
    Users: Users,
    DollarSign: DollarSign,
    Laptop: Laptop,
    Coins: Coins,
    ClipboardList: ClipboardList,
    FileText: FileText,
    ExternalLink: ExternalLink,
    MessageCircle: MessageCircle,
    Copy: Copy,
    Send: Send,
    Heart: Heart,
    Trash2: Trash2,
    Check: Check,
    X: X
  };
  const IconComponent = icons[name] || HelpCircle;
  return <IconComponent className={className} />;
};

const ScamReportDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [userVote, setUserVote] = useState(null);

  // Comments state
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyingTo, setReplyingTo] = useState(null); // ID of the comment being replied to

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await scamReportsAPI.getReport(id);
      setReport(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report');
      navigate('/scam-reports');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    try {
      setVoting(true);
      await scamReportsAPI.voteOnReport(id, voteType);

      // Update local state
      setReport(prev => ({
        ...prev,
        communityVotes: {
          ...prev.communityVotes,
          [voteType]: (prev.communityVotes[voteType] || 0) + 1
        }
      }));

      setUserVote(voteType);
      toast.success(`Thanks for voting ${voteType}!`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record vote');
    } finally {
      setVoting(false);
    }
  };

  const copyLink = () => {
    // Generate universal shareable link that works for all roles
    const origin = window.location.origin;
    const shareableLink = `${origin}/scam-reports/${id}`;
    navigator.clipboard.writeText(shareableLink);
    toast.success('Shareable link copied! Works for all user roles.');
  };

  const getVerdictConfig = (verdict) => {
    const configs = {
      DANGER: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: AlertTriangle,
        color: 'red'
      },
      WARNING: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: AlertTriangle,
        color: 'amber'
      },
      SAFE: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: Shield,
        color: 'emerald'
      }
    };
    return configs[verdict] || configs.WARNING;
  };

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  // Comment functions
  const handleAddComment = async (parentId = null) => {
    const commentText = parentId ? replyText : newComment;
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await scamReportsAPI.addComment(id, commentText.trim(), parentId);

      // Add the new comment to the report
      setReport(prev => ({
        ...prev,
        comments: [...(prev.comments || []), response.data.comment]
      }));

      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }
      toast.success('Comment added successfully!');
    } catch (error) {
      toast.error('Failed to add comment: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const response = await scamReportsAPI.likeComment(id, commentId);

      // Update local state
      setReport(prev => ({
        ...prev,
        comments: prev.comments.map(comment =>
          comment._id === commentId
            ? {
              ...comment,
              likes: {
                ...comment.likes,
                count: response.data.likeCount
              }
            }
            : comment
        )
      }));

      // Track user's like status locally
      setCommentLikes(prev => ({
        ...prev,
        [commentId]: response.data.liked
      }));

      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to like comment');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Not Found</h3>
          <button
            onClick={() => navigate(-1)}
            className="text-primary-600 hover:text-primary-700 underline font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const verdictConfig = getVerdictConfig(report.verdict);
  const Icon = verdictConfig.icon;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Go back"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Scam Report Details</h1>
          <p className="text-gray-500">Community-verified job scam analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="Copy link"
          >
            <Copy size={18} />
          </button>
        </div>
      </div>

      {/* Main Report Card */}
      <div className={`bg-white rounded-xl border ${verdictConfig.border} p-8 mb-6 relative overflow-hidden`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, currentColor 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>

        <div className="relative flex flex-col lg:flex-row gap-8">
          {/* Trust Score */}
          <div className="flex justify-center lg:block">
            <TrustScoreCircle
              score={report.trustScore}
              size={140}
            />
          </div>

          {/* Company Details */}
          <div className="flex-1">
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl font-black text-gray-900 mb-2">
                  {report.companyName}
                </h2>
                <p className="text-xl text-gray-600 mb-3">{report.roleName}</p>
              </div>

              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${verdictConfig.bg} ${verdictConfig.text} ${verdictConfig.border} border`}>
                <Icon size={16} />
                {report.verdict}
              </span>
            </div>

            {/* Forum-style Author & Meta Information */}
            <div className="bg-gradient-to-r from-gray-50 to-primary-50/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-blue-500 rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {report.reportedBy?.firstName && report.reportedBy?.lastName
                      ? `${report.reportedBy.firstName} ${report.reportedBy.lastName}`
                      : 'Anonymous Student'}
                    {report.reportedBy?.campus && (
                      <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-medium">
                        {report.reportedBy.campus}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Flag size={12} />
                      Reported {formatDate(report.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {report.viewCount || 0} views
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {report.comments?.length || 0} comments
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <p className="text-gray-700 leading-relaxed text-lg">
              {report.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Sub-Scores */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Analysis Breakdown</h3>
            <Link
              to="/scam-education"
              className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
            >
              Learn How →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <MiniCircularProgress
              value={report.analysisData?.subScores?.companyLegitimacy || 0}
              label="Company Legitimacy"
              size={60}
            />
            <MiniCircularProgress
              value={report.analysisData?.subScores?.offerRealism || 0}
              label="Offer Realism"
              size={60}
            />
            <MiniCircularProgress
              value={report.analysisData?.subScores?.processFlags || 0}
              label="Process Flags"
              size={60}
            />
            <MiniCircularProgress
              value={report.analysisData?.subScores?.communitySentiment || 0}
              label="Community Sentiment"
              size={60}
            />
          </div>
        </div>

        {/* Community Voting */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Community Votes</h3>
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Confirmed Scam</span>
                <span className="text-2xl font-black text-red-600">{report.communityVotes?.agree || 0}</span>
              </div>
              {!userVote && (
                <button
                  onClick={() => handleVote('agree')}
                  disabled={voting}
                  className="w-full px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-semibold"
                >
                  +1 Confirmed Scam
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Helpful Report</span>
                <span className="text-2xl font-black text-blue-600">{report.communityVotes?.helpful || 0}</span>
              </div>
              {!userVote && (
                <button
                  onClick={() => handleVote('helpful')}
                  disabled={voting}
                  className="w-full px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 text-sm font-semibold"
                >
                  +1 Helpful Report
                </button>
              )}
            </div>
          </div>

          {userVote && (
            <div className="text-center text-green-600 text-sm font-semibold">
              Thanks for voting!
            </div>
          )}
        </div>
      </div>

      {/* Domain & Email Forensics */}
      {report.analysisData?.domainAnalysis && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Domain & Email Forensics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Company Domain</h4>
              <p className="text-gray-700">{report.analysisData.domainAnalysis.companyDomain || 'Not verified'}</p>
              {report.analysisData.domainAnalysis.domainAge && (
                <p className="text-xs text-gray-500 mt-1">Registered: {report.analysisData.domainAnalysis.domainAge}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Risk Level</h4>
              <p className={`font-semibold ${report.analysisData.domainAnalysis.domainRisk === 'High' ? 'text-red-600' :
                report.analysisData.domainAnalysis.domainRisk === 'Medium' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                {report.analysisData.domainAnalysis.domainRisk || 'Unknown'}
              </p>
            </div>
          </div>

          {report.analysisData.emailChecks && report.analysisData.emailChecks.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Email Verification</h4>
              {report.analysisData.emailChecks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`text-lg font-bold flex-shrink-0 mt-0.5 ${check.status === 'pass' ? 'text-green-600' :
                    check.status === 'fail' ? 'text-red-600' :
                      check.status === 'warn' ? 'text-amber-600' :
                        'text-gray-400'
                    }`}>
                    {check.status === 'pass' ? <CheckCircle2 size={16} /> :
                      check.status === 'fail' ? <X size={16} /> :
                        check.status === 'warn' ? <AlertTriangle size={16} /> :
                          <HelpCircle size={16} />}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{check.check}</p>
                    {check.detail && <p className="text-xs text-gray-600 mt-1">{check.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.analysisData.domainAnalysis.explanation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">{report.analysisData.domainAnalysis.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Red Flags & Green Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} /> Red Flags
          </h3>
          <div className="space-y-3">
            {(report.analysisData?.redFlags || []).map((flag, idx) => (
              <div key={idx} className="flex items-start gap-3 text-gray-700">
                <span className="mt-2 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span>{flag}</span>
              </div>
            ))}
            {(!report.analysisData?.redFlags || report.analysisData.redFlags.length === 0) && (
              <p className="text-gray-500 italic">No explicit red flags detected.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} /> Legitimacy Signals
          </h3>
          <div className="space-y-3">
            {(report.analysisData?.greenFlags || []).map((flag, idx) => (
              <div key={idx} className="flex items-start gap-3 text-gray-700">
                <span className="mt-2 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span>{flag}</span>
              </div>
            ))}
            {(!report.analysisData?.greenFlags || report.analysisData.greenFlags.length === 0) && (
              <p className="text-gray-500 italic">No strong legitimacy signals found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Final Verdict & Action Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Final Verdict & Recommendations</h3>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-gray-700 leading-relaxed">
            {report.analysisData?.finalVerdict || 'Analysis verdict not available.'}
          </p>
        </div>

        {report.analysisData?.actionItems && report.analysisData.actionItems.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Action Items:</h4>
            <div className="space-y-2">
              {report.analysisData.actionItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-gray-700">
                  <span className="mt-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Community Findings - Only Real Sources */}
      {report.analysisData?.communityFindings && report.analysisData.communityFindings.some(f => f.finding && !f.finding.includes('Search for') && !f.finding.includes('No ')) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Community Intelligence</h3>
          <div className="space-y-4">
            {report.analysisData.communityFindings.map((finding, idx) => {
              // Only show if there's actual finding, not generic search prompts
              if (!finding.finding || finding.finding.includes('Search for') || finding.finding.includes('No ')) return null;

              return (
                <div key={idx} className={`p-4 rounded-lg border-l-4 ${finding.sentiment === 'negative' ? 'bg-red-50 border-red-400' :
                  finding.sentiment === 'positive' ? 'bg-green-50 border-green-400' :
                    'bg-gray-50 border-gray-400'
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/50 text-gray-500">
                      {getIcon(finding.icon, "w-6 h-6")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{finding.source}</h4>
                      <p className="text-gray-700 text-sm mt-1 break-words">{finding.finding}</p>
                      {finding.sentiment && (
                        <p className={`text-xs font-semibold mt-2 inline-block px-2 py-1 rounded-full ${finding.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                          finding.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                          {finding.sentiment.charAt(0).toUpperCase() + finding.sentiment.slice(1)} Sentiment
                        </p>
                      )}

                      {Array.isArray(finding.links) && finding.links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {finding.links.map((link, liIdx) => link?.url ? (
                            <a
                              key={liIdx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-blue-600 font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <LinkIcon size={12} className="text-gray-400" />
                              {link.title || 'Source'}
                              <ArrowUpRight size={12} className="text-gray-400" />
                            </a>
                          ) : null)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded flex items-center gap-2">
            <HelpCircle size={14} /> Only verified findings from actual community sources are shown. Generic search links and unverified information are excluded.
          </p>
        </div>
      )}

      {/* Resources */}
      {report.analysisData?.resourceLinks && report.analysisData.resourceLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Verification Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.analysisData.resourceLinks.map((resource, idx) => (
              <a
                key={idx}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                  {getIcon(resource.icon, "w-6 h-6")}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{resource.title}</div>
                  <div className="text-sm text-gray-500">{resource.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {report.tags && report.tags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {report.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Forum-Style Comments Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle size={20} />
            Discussion ({report.comments?.length || 0})
          </h3>
        </div>

        {/* Add Comment Form */}
        <div className="mb-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-primary-600" />
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts or experiences with this company..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">
                  {newComment.length}/2000 characters
                </span>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                >
                  {submittingComment ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Post Comment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {report.comments && report.comments.length > 0 ? (
            report.comments.filter(c => !c.parentId).map((comment) => (
              <div key={comment._id} className="space-y-3">
                <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">
                        {comment.author?.firstName && comment.author?.lastName
                          ? `${comment.author.firstName} ${comment.author.lastName}`
                          : 'Anonymous'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed mb-2">
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikeComment(comment._id)}
                        className={`flex items-center gap-1 text-xs transition-colors ${commentLikes[comment._id]
                          ? 'text-red-600 hover:text-red-700'
                          : 'text-gray-500 hover:text-red-600'
                          }`}
                      >
                        <Heart
                          size={14}
                          className={commentLikes[comment._id] ? 'fill-current' : ''}
                        />
                        {comment.likes?.count || 0}
                      </button>
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                        className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
                      >
                        <MessageCircle size={14} />
                        Reply
                      </button>
                    </div>

                    {/* Reply Input */}
                    {replyingTo === comment._id && (
                      <div className="mt-3 flex gap-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Your reply..."
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                          rows={2}
                        />
                        <button
                          onClick={() => handleAddComment(comment._id)}
                          disabled={!replyText.trim() || submittingComment}
                          className="px-3 py-1 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Replies */}
                <div className="ml-10 space-y-3">
                  {report.comments.filter(c => c.parentId === comment._id).map(reply => (
                    <div key={reply._id} className="flex gap-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-xs">
                            {reply.author?.firstName && reply.author?.lastName
                              ? `${reply.author.firstName} ${reply.author.lastName}`
                              : 'Anonymous'}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-xs leading-relaxed">
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No comments yet. Be the first to share your thoughts!</p>
            </div>
          )}
        </div>

        {/* Forum-like info box */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200">
          <div className="flex items-start gap-3">
            <Shield size={20} className="text-primary-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-primary-900 mb-1">Community Guidelines</p>
              <p className="text-primary-700">
                Share your experiences respectfully. Help fellow students by providing constructive feedback about companies and job offers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScamReportDetails;