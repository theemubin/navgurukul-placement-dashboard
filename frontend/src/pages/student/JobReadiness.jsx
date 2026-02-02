import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { jobReadinessAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert } from '../../components/common/UIComponents';
import {
  CheckCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  ChatBubbleBottomCenterTextIcon,
  TrophyIcon,
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  FireIcon,
  RocketLaunchIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const CATEGORY_ICONS = {
  'profile': AcademicCapIcon,
  'skills': ChatBubbleBottomCenterTextIcon,
  'technical': BriefcaseIcon,
  'preparation': ClockIcon,
  'academic': AcademicCapIcon,
  'other': TrophyIcon
};

const MOTIVATIONAL_MESSAGES = [
  "You're doing great! Keep it up! 🚀",
  "One step closer to your dream job! 💪",
  "Amazing progress! You're unstoppable! ⭐",
  "You're on fire! Keep going! 🔥",
  "Fantastic work! Almost there! 🎯",
  "You're crushing it! 💯"
];

const MILESTONE_MESSAGES = {
  25: { emoji: '🌱', message: 'Great start! You\'re building momentum!' },
  50: { emoji: '🚀', message: 'Halfway there! You\'re doing amazing!' },
  75: { emoji: '⚡', message: 'Almost ready! Final push!' },
  100: { emoji: '🏆', message: 'You did it! You\'re Job Ready!' }
};

function JobReadiness() {
  const { user } = useAuth();
  const [readinessData, setReadinessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [reflections, setReflections] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetchReadinessStatus();
  }, []);

  const fetchReadinessStatus = async () => {
    try {
      setLoading(true);
      const res = await jobReadinessAPI.getMyStatus();

      const data = res.data;
      const transformedData = {
        ...data.readiness,
        progress: {
          criteria: (data.config || []).map(configCriterion => {
            const status = data.readiness.criteriaStatus?.find(
              cs => cs.criteriaId === configCriterion.criteriaId
            ) || {};

            return {
              ...configCriterion,
              selfReportedValue: status.selfReportedValue || '',
              notes: status.notes || '',
              proofUrl: status.proofUrl || '',
              pocComment: status.pocComment || '',
              pocRating: status.pocRating || null,
              verificationNotes: status.verificationNotes || '',
              completed: status.status === 'completed' || status.status === 'verified',
              verificationStatus: status.status === 'verified' ? 'verified' :
                status.status === 'completed' ? 'pending' :
                  'not_started'
            };
          }),
          isJobReady: data.readiness.isJobReady || false,
          jobReadyApprovedAt: data.readiness.approvedAt
        }
      };

      setReadinessData(transformedData);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      const message = err.response?.data?.message || '';
      if (message.includes('school not set') || message.includes('profile or school')) {
        setError('profile_incomplete');
      } else {
        setError(message || 'Failed to load job readiness status');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditing = (criterion) => {
    setEditingCriterion(criterion.criteriaId);
    setFormValues({
      [criterion.criteriaId]: criterion.selfReportedValue || ''
    });
    setReflections({
      [criterion.criteriaId]: criterion.notes || ''
    });
  };

  const handleCancelEditing = () => {
    setEditingCriterion(null);
    setFormValues({});
    setReflections({});
  };

  const handleSubmitCriterion = async (criterion) => {
    try {
      setSubmitting(true);
      const value = formValues[criterion.criteriaId];
      const reflection = reflections[criterion.criteriaId];

      await jobReadinessAPI.updateMyCriterion(criterion.criteriaId, {
        selfReportedValue: value,
        notes: reflection,
        status: 'completed',
        completed: true
      });

      setEditingCriterion(null);
      setFormValues({});
      setReflections({});

      // Show celebration animation
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);

      await fetchReadinessStatus();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (criterion) => {
    if (criterion.verificationStatus === 'verified') {
      return <Badge variant="success" className="flex items-center gap-1 animate-pulse">
        <CheckIcon className="w-3 h-3" /> Verified ✨
      </Badge>;
    }
    if (criterion.verificationStatus === 'pending') {
      return <Badge variant="warning" className="flex items-center gap-1">
        <ClockIcon className="w-3 h-3" /> Under Review
      </Badge>;
    }
    return <Badge variant="secondary">Not Started</Badge>;
  };

  const groupCriteriaByCategory = (criteria) => {
    const grouped = {};
    criteria.forEach(c => {
      const category = c.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(c);
    });
    return grouped;
  };

  const calculateProgress = () => {
    if (!readinessData?.progress?.criteria) return { completed: 0, total: 0, percentage: 0, submitted: 0 };
    const criteria = readinessData.progress.criteria;
    const completed = criteria.filter(c => c.verificationStatus === 'verified').length;
    const submitted = criteria.filter(c => c.completed).length;
    const total = criteria.length;
    return { completed, submitted, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getMotivationalMessage = (percentage) => {
    const milestones = [25, 50, 75, 100];
    const milestone = milestones.find(m => percentage >= m && percentage < m + 25) || 0;
    return MILESTONE_MESSAGES[milestone] || { emoji: '💪', message: MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)] };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error === 'profile_incomplete') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 shadow-sm">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AcademicCapIcon className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile first!</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            To view your job readiness criteria, you need to set your <b>Campus/School</b> in your profile.
            This helps us show you the specific requirements for your campus.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => window.location.href = '/student/profile'}
            className="font-bold px-8 shadow-lg shadow-indigo-100"
          >
            Go to Profile
          </Button>
        </div>
      </div>
    );
  }

  if (error && !readinessData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert type="error">{error}</Alert>
        <p className="mt-4 text-gray-600">
          Job readiness criteria may not be configured for your school yet. Please contact your Campus PoC.
        </p>
      </div>
    );
  }

  const progress = calculateProgress();
  const groupedCriteria = groupCriteriaByCategory(readinessData?.progress?.criteria || []);
  const motivationalMsg = getMotivationalMessage(progress.percentage);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <RocketLaunchIcon className="w-8 h-8 text-indigo-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Your Job Readiness Journey
          </h1>
          <SparklesIcon className="w-8 h-8 text-purple-600" />
        </div>
        <p className="text-gray-600 text-lg">Level up your skills and become job-ready! 🚀</p>
      </div>

      {error && <Alert type="error" className="mb-6">{error}</Alert>}

      {/* Gamified Progress Card */}
      <Card className="mb-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white border-0 shadow-2xl">
        <div className="relative overflow-hidden">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  {motivationalMsg.emoji} Level {Math.floor(progress.percentage / 25) + 1}
                </h2>
                <p className="text-white/90 text-lg">{motivationalMsg.message}</p>
              </div>
              <div className="text-right">
                {readinessData?.progress?.isJobReady ? (
                  <div className="flex flex-col items-center">
                    <TrophyIcon className="w-16 h-16 mb-2 animate-bounce" />
                    <span className="text-2xl font-bold">Job Ready!</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-5xl font-bold mb-1">{progress.percentage}%</div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        star <= Math.ceil(progress.percentage / 20) ? (
                          <StarIconSolid key={star} className="w-6 h-6 text-yellow-300" />
                        ) : (
                          <StarIcon key={star} className="w-6 h-6 text-white/30" />
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* XP Bar Style Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{progress.completed} / {progress.total} Verified</span>
                <span className="font-medium">{progress.submitted} Submitted</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-6 overflow-hidden backdrop-blur-sm">
                <div
                  className="h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${progress.percentage}%` }}
                >
                  {progress.percentage > 10 && (
                    <span className="text-xs font-bold text-white drop-shadow">
                      {progress.percentage}% XP
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Streak & Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <FireIcon className="w-6 h-6 mx-auto mb-1 text-orange-300" />
                <div className="text-2xl font-bold">{progress.submitted}</div>
                <div className="text-xs text-white/80">Submitted</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <CheckCircleIcon className="w-6 h-6 mx-auto mb-1 text-green-300" />
                <div className="text-2xl font-bold">{progress.completed}</div>
                <div className="text-xs text-white/80">Verified</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <TrophyIcon className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                <div className="text-2xl font-bold">{progress.total - progress.submitted}</div>
                <div className="text-xs text-white/80">Remaining</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Criteria by Category */}
      {Object.entries(groupedCriteria).map(([category, criteria]) => {
        const CategoryIcon = CATEGORY_ICONS[category] || TrophyIcon;
        const categoryComplete = criteria.filter(c => c.verificationStatus === 'verified').length;
        const categoryProgress = Math.round((categoryComplete / criteria.length) * 100);

        return (
          <Card key={category} className="mb-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-6 pb-4 border-b">
              <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl mr-3 shadow-sm">
                <CategoryIcon className="w-7 h-7 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 capitalize flex items-center gap-2">
                  {category}
                  {categoryProgress === 100 && <span className="text-2xl">✨</span>}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-xs">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${categoryProgress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {categoryComplete}/{criteria.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {criteria.map((criterion) => {
                const isEditing = editingCriterion === criterion.criteriaId;
                const isVerified = criterion.verificationStatus === 'verified';
                const isPending = criterion.verificationStatus === 'pending';

                return (
                  <div
                    key={criterion.criteriaId}
                    className={`p-6 rounded-2xl border-2 transition-all ${isVerified
                      ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md'
                      : isPending
                        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-md'
                        : isEditing
                          ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-gray-900 text-lg">{criterion.name}</h4>
                          {getStatusBadge(criterion)}
                          {criterion.isMandatory && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                              ⚡ Required
                            </span>
                          )}
                        </div>
                        {criterion.description && (
                          <p className="text-sm text-gray-600 leading-relaxed">{criterion.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Display Mode */}
                    {!isEditing && (
                      <div>
                        {criterion.selfReportedValue && (
                          <div className="mb-4 p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
                            <p className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-wide">📝 Your Response</p>
                            <p className="text-sm text-gray-900 font-medium">{criterion.selfReportedValue}</p>
                            {criterion.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wide">💭 Your Reflection</p>
                                <p className="text-sm text-gray-700 italic">{criterion.notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {!isVerified && (
                          <Button
                            variant={criterion.selfReportedValue ? "secondary" : "primary"}
                            size="md"
                            onClick={() => handleStartEditing(criterion)}
                            className="mt-2 font-bold shadow-md hover:shadow-lg transition-all"
                          >
                            {criterion.selfReportedValue ? '✏️ Edit Response' : '🚀 Start This Task'}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Edit Mode */}
                    {isEditing && (
                      <div className="space-y-4 mt-4">
                        {criterion.type === 'answer' && (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              ✍️ Your Answer
                            </label>
                            <input
                              type="text"
                              value={formValues[criterion.criteriaId] || ''}
                              onChange={(e) => setFormValues({
                                ...formValues,
                                [criterion.criteriaId]: e.target.value
                              })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              placeholder="Type your answer here..."
                              autoFocus
                            />
                          </div>
                        )}

                        {criterion.type === 'link' && (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              🔗 Link/URL
                            </label>
                            <input
                              type="url"
                              value={formValues[criterion.criteriaId] || ''}
                              onChange={(e) => setFormValues({
                                ...formValues,
                                [criterion.criteriaId]: e.target.value
                              })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              placeholder="https://..."
                              autoFocus
                            />
                          </div>
                        )}

                        {criterion.type === 'yes/no' && (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3">
                              ✅ Your Response
                            </label>
                            <div className="flex gap-4">
                              <button
                                onClick={() => setFormValues({
                                  ...formValues,
                                  [criterion.criteriaId]: 'yes'
                                })}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${formValues[criterion.criteriaId] === 'yes'
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-xl scale-105'
                                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-green-500'
                                  }`}
                              >
                                👍 Yes
                              </button>
                              <button
                                onClick={() => setFormValues({
                                  ...formValues,
                                  [criterion.criteriaId]: 'no'
                                })}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${formValues[criterion.criteriaId] === 'no'
                                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-xl scale-105'
                                  : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-red-500'
                                  }`}
                              >
                                👎 No
                              </button>
                            </div>
                          </div>
                        )}

                        {criterion.type === 'comment' && (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              💬 Your Comment
                            </label>
                            <textarea
                              value={formValues[criterion.criteriaId] || ''}
                              onChange={(e) => setFormValues({
                                ...formValues,
                                [criterion.criteriaId]: e.target.value
                              })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                              rows={4}
                              placeholder="Share your thoughts..."
                              autoFocus
                            />
                          </div>
                        )}

                        {/* Reflection Section - Always visible */}
                        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border-2 border-purple-200">
                          <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5" />
                            💭 Reflection: What did you learn?
                          </label>
                          <textarea
                            value={reflections[criterion.criteriaId] || ''}
                            onChange={(e) => setReflections({
                              ...reflections,
                              [criterion.criteriaId]: e.target.value
                            })}
                            className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white"
                            rows={3}
                            placeholder="Reflect on what you learned, challenges you faced, or how this helps your growth..."
                          />
                          <p className="text-xs text-purple-700 mt-2 italic">
                            💡 Tip: Reflecting helps you internalize your learning and shows your growth mindset!
                          </p>
                        </div>

                        <div className="flex gap-3 pt-3">
                          <Button
                            variant="secondary"
                            onClick={handleCancelEditing}
                            disabled={submitting}
                            className="flex items-center gap-2 font-bold"
                          >
                            <XMarkIcon className="w-5 h-5" />
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => handleSubmitCriterion(criterion)}
                            disabled={submitting || !formValues[criterion.criteriaId]}
                            className="flex-1 flex items-center justify-center gap-2 font-bold text-lg py-3 shadow-lg hover:shadow-xl transition-all"
                          >
                            {submitting ? (
                              <>
                                <LoadingSpinner size="small" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <RocketLaunchIcon className="w-5 h-5" />
                                Submit for Review 🎉
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* PoC Feedback */}
                    {(criterion.pocComment || criterion.pocRating) && (
                      <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                        <p className="text-sm text-blue-900 font-bold mb-3 flex items-center gap-2">
                          <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                          💬 Feedback from your PoC
                        </p>
                        {criterion.pocRating && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-blue-800">Rating:</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(star => (
                                star <= criterion.pocRating ? (
                                  <StarIconSolid key={star} className="w-5 h-5 text-yellow-500" />
                                ) : (
                                  <StarIcon key={star} className="w-5 h-5 text-gray-300" />
                                )
                              ))}
                            </div>
                          </div>
                        )}
                        {criterion.pocComment && (
                          <p className="text-sm text-blue-800 bg-white/50 p-3 rounded-lg">
                            {criterion.pocComment}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* Encouragement Footer */}
      {progress.percentage < 100 && (
        <Card className="mt-8 bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-200 text-center">
          <p className="text-lg font-bold text-indigo-900 mb-2">
            🌟 Keep going! You're {100 - progress.percentage}% away from being Job Ready!
          </p>
          <p className="text-sm text-indigo-700">
            Every criterion you complete brings you closer to your dream career! 💪
          </p>
        </Card>
      )}
    </div>
  );
}

export default JobReadiness;
