import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applicationAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, ConfirmModal } from '../../components/common/UIComponents';
import { FileText, ChevronRight, XCircle, Building, Calendar, CheckCircle, Clock, AlertCircle, GraduationCap, Briefcase } from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, isPast, isFuture } from 'date-fns';
import toast from 'react-hot-toast';

const StudentApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [selectedApp, setSelectedApp] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState(null);

  useEffect(() => {
    fetchApplications();
  }, [pagination.current]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await applicationAPI.getApplications({
        page: pagination.current,
        limit: 10
      });
      setApplications(response.data.applications);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawingId) return;
    
    try {
      await applicationAPI.withdraw(withdrawingId);
      toast.success('Application withdrawn successfully');
      setShowWithdrawModal(false);
      setWithdrawingId(null);
      fetchApplications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error withdrawing application');
    }
  };

  const viewDetails = async (appId) => {
    try {
      const response = await applicationAPI.getApplication(appId);
      setSelectedApp(response.data);
      setShowDetails(true);
    } catch (error) {
      toast.error('Error loading application details');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      applied: 'bg-blue-500',
      shortlisted: 'bg-purple-500',
      in_progress: 'bg-yellow-500',
      selected: 'bg-green-500',
      rejected: 'bg-red-500',
      withdrawn: 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getNextStep = (app) => {
    if (!app.job?.interviewRounds || app.job.interviewRounds.length === 0) {
      return null;
    }
    
    // Find the next pending round
    const nextRoundIndex = app.currentRound;
    if (nextRoundIndex >= app.job.interviewRounds.length) {
      return null;
    }
    
    const nextRound = app.job.interviewRounds[nextRoundIndex];
    const roundResult = app.roundResults?.find(r => r.round === nextRoundIndex);
    
    return {
      roundNumber: nextRoundIndex + 1,
      roundName: nextRound?.name || `Round ${nextRoundIndex + 1}`,
      roundType: nextRound?.type,
      scheduledDate: roundResult?.scheduledDate || nextRound?.scheduledDate,
      status: roundResult?.status || 'pending'
    };
  };

  const getDaysInfo = (date) => {
    if (!date) return null;
    const targetDate = new Date(date);
    const today = new Date();
    const days = differenceInDays(targetDate, today);
    
    if (isPast(targetDate) && days !== 0) {
      return { text: `${Math.abs(days)} days ago`, isPast: true, days: Math.abs(days) };
    } else if (days === 0) {
      return { text: 'Today', isToday: true, days: 0 };
    } else {
      return { text: `In ${days} days`, isFuture: true, days };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
        <p className="text-gray-600">Track your applications, upcoming rounds, and read feedback for each job</p>
      </div>

      {/* Quick status counts */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="text-sm px-3 py-2 bg-gray-100 rounded">Applied: <strong>{applications.filter(a => a.status === 'applied').length}</strong></div>
        <div className="text-sm px-3 py-2 bg-purple-100 rounded">Shortlisted: <strong>{applications.filter(a => a.status === 'shortlisted').length}</strong></div>
        <div className="text-sm px-3 py-2 bg-yellow-100 rounded">In process: <strong>{applications.filter(a => a.status === 'in_progress').length}</strong></div>
        <div className="text-sm px-3 py-2 bg-green-100 rounded">Selected: <strong>{applications.filter(a => a.status === 'selected').length}</strong></div>
        <div className="text-sm px-3 py-2 bg-red-100 rounded">Rejected: <strong>{applications.filter(a => a.status === 'rejected').length}</strong></div>
      </div>

      {/* Feedback & comments grouped by company */}
      {(() => {
        const feedbackByCompany = applications.reduce((acc, app) => {
          const company = app.job?.company?.name || 'Unknown';
          const entries = [];
          if (app.feedback) entries.push({ source: 'Application', text: app.feedback, date: app.feedbackAt });
          if (app.roundResults && app.roundResults.length > 0) {
            app.roundResults.forEach(r => {
              if (r.feedback) entries.push({ source: r.roundName || `Round ${r.round + 1}`, text: r.feedback, date: r.evaluatedAt });
            });
          }
          if (entries.length > 0) {
            acc[company] = acc[company] || [];
            acc[company].push({ jobTitle: app.job?.title, entries });
          }
          return acc;
        }, {});

        if (Object.keys(feedbackByCompany).length === 0) return null;

        return (
          <div className="card">
            <h3 className="text-lg font-semibold mb-3">Feedback & Comments</h3>
            <div className="space-y-4">
              {Object.entries(feedbackByCompany).map(([company, jobs]) => (
                <div key={company}>
                  <h4 className="font-medium mb-2">{company}</h4>
                  <div className="space-y-2">
                    {jobs.map(j => (
                      <div key={j.jobTitle} className="p-3 border rounded bg-white">
                        <div className="font-medium">{j.jobTitle}</div>
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          {j.entries.map((e, idx) => (
                            <div key={idx} className="p-2 bg-gray-50 rounded">
                              <div className="text-xs text-gray-500">{e.source}</div>
                              <div>{e.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map((app) => {
            const nextStep = getNextStep(app);
            const daysInfo = nextStep?.scheduledDate ? getDaysInfo(nextStep.scheduledDate) : null;
            const isInternship = app.job?.jobType === 'internship';
            
            return (
            <div key={app._id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                    isInternship ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    {isInternship 
                      ? <GraduationCap className="w-6 h-6 text-purple-500" />
                      : <Briefcase className="w-6 h-6 text-gray-400" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{app.job?.title}</h3>
                      {isInternship && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          Internship
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600">{app.job?.company?.name}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Applied: {format(new Date(app.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={app.status} />
                  <Link to={`/student/jobs/${app.job?._id}`} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Progress Bar with Round Details */}
              {['applied', 'shortlisted', 'in_progress'].includes(app.status) && app.job?.interviewRounds && app.job.interviewRounds.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Interview Progress</span>
                    <span className="text-sm font-medium">
                      Round {app.currentRound} of {app.job.interviewRounds.length}
                    </span>
                  </div>
                  
                  {/* Visual Progress Steps */}
                  <div className="flex items-center gap-1 mb-4">
                    {app.job.interviewRounds.map((round, index) => {
                      const roundResult = app.roundResults?.find(r => r.round === index);
                      const isPassed = roundResult?.status === 'passed';
                      const isFailed = roundResult?.status === 'failed';
                      const isCurrent = index === app.currentRound;
                      const isScheduled = roundResult?.status === 'scheduled';
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className={`w-full h-2 rounded-full ${
                            isPassed ? 'bg-green-500' :
                            isFailed ? 'bg-red-500' :
                            isScheduled ? 'bg-yellow-500' :
                            isCurrent ? 'bg-blue-300' : 'bg-gray-200'
                          }`} />
                          <span className="text-xs text-gray-500 mt-1 truncate max-w-full" title={round.name}>
                            {round.name || `R${index + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Next Step Info */}
                  {nextStep && (
                    <div className={`p-3 rounded-lg ${
                      daysInfo?.isToday ? 'bg-yellow-50 border border-yellow-200' :
                      daysInfo?.isPast ? 'bg-red-50 border border-red-200' :
                      'bg-blue-50 border border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <Clock className={`w-4 h-4 mt-0.5 ${
                            daysInfo?.isToday ? 'text-yellow-600' :
                            daysInfo?.isPast ? 'text-red-600' : 'text-blue-600'
                          }`} />
                          <div>
                            <p className="font-medium text-gray-900">
                              Next: {nextStep.roundName}
                              {nextStep.roundType && (
                                <span className="text-gray-500 font-normal"> ({nextStep.roundType.replace('_', ' ')})</span>
                              )}
                            </p>
                            {nextStep.scheduledDate ? (
                              <p className="text-sm text-gray-600">
                                Scheduled: {format(new Date(nextStep.scheduledDate), 'MMM dd, yyyy h:mm a')}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500">Date to be announced</p>
                            )}
                          </div>
                        </div>
                        {daysInfo && (
                          <div className={`text-right ${
                            daysInfo.isToday ? 'text-yellow-700' :
                            daysInfo.isPast ? 'text-red-700' : 'text-blue-700'
                          }`}>
                            <p className="font-semibold text-lg">{daysInfo.days}</p>
                            <p className="text-xs">{daysInfo.isToday ? 'Today!' : daysInfo.isPast ? 'days overdue' : 'days left'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Completed Rounds Summary */}
              {app.roundResults && app.roundResults.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {app.roundResults.map((result, idx) => (
                    <span key={idx} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                      result.status === 'passed' ? 'bg-green-100 text-green-700' :
                      result.status === 'failed' ? 'bg-red-100 text-red-700' :
                      result.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {result.status === 'passed' && <CheckCircle className="w-3 h-3" />}
                      {result.status === 'failed' && <XCircle className="w-3 h-3" />}
                      {result.status === 'scheduled' && <Clock className="w-3 h-3" />}
                      {result.roundName || `Round ${result.round + 1}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              {['applied', 'shortlisted', 'in_progress'].includes(app.status) && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <button
                    onClick={() => {
                      setWithdrawingId(app._id);
                      setShowWithdrawModal(true);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Withdraw Application
                  </button>
                </div>
              )}
            </div>
          )})}

          <Pagination
            current={pagination.current}
            total={pagination.pages}
            onPageChange={(page) => setPagination({ ...pagination, current: page })}
          />
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Start applying to jobs to see your applications here"
          action={
            <Link to="/student/jobs" className="btn btn-primary">
              Browse Jobs
            </Link>
          }
        />
      )}

      {/* Application Details Modal */}
      {showDetails && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedApp.job?.title}</h3>
                  <p className="text-gray-600">{selectedApp.job?.company?.name}</p>
                </div>
                <StatusBadge status={selectedApp.status} />
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Timeline */}
              <div>
                <h4 className="font-semibold mb-4">Application Timeline</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Applied</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(selectedApp.createdAt), 'MMMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  {selectedApp.roundResults?.map((round, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        round.status === 'passed' ? 'bg-green-100' :
                        round.status === 'failed' ? 'bg-red-100' :
                        round.status === 'scheduled' ? 'bg-yellow-100' : 'bg-blue-100'
                      }`}>
                        <span className={`text-sm font-medium ${
                          round.status === 'passed' ? 'text-green-600' :
                          round.status === 'failed' ? 'text-red-600' :
                          round.status === 'scheduled' ? 'text-yellow-600' : 'text-blue-600'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{round.roundName || `Round ${round.round}`}</p>
                          <StatusBadge status={round.status} />
                        </div>
                        {round.scheduledDate && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {round.status === 'scheduled' ? 'Scheduled: ' : 'Completed: '}
                            {format(new Date(round.scheduledDate), 'MMM dd, yyyy h:mm a')}
                            {round.status === 'scheduled' && (
                              <span className="ml-2 text-yellow-600 font-medium">
                                ({formatDistanceToNow(new Date(round.scheduledDate), { addSuffix: true })})
                              </span>
                            )}
                          </p>
                        )}
                        {round.feedback && (
                          <p className="text-sm text-gray-600 mt-1">{round.feedback}</p>
                        )}
                        {round.score && (
                          <p className="text-sm text-gray-500 mt-1">Score: {round.score}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedApp.status === 'selected' && (
                    <div className="p-4 rounded-lg bg-green-50 border border-green-200 relative overflow-hidden">
                      <span className="absolute top-2 right-3 text-2xl animate-pop">🎉</span>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                          <CheckCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-700 text-lg">You've been selected! 🎉</p>
                          <p className="text-sm text-gray-700">Congratulations on your placement. We'll send next steps and contact details shortly.</p>
                          {selectedApp.feedback && (
                            <p className="text-sm text-gray-700 mt-2">Feedback: {selectedApp.feedback}</p>
                          )}
                        </div>
                        <div className="ml-auto">
                          <button className="px-4 py-2 bg-green-600 text-white rounded">View Next Steps</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedApp.status === 'rejected' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-600">Not Selected</p>
                        {selectedApp.feedback && (
                          <p className="text-sm text-gray-600 mt-1">{selectedApp.feedback}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Recommendation */}
              {selectedApp.specialRecommendation?.isRecommended && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="font-medium text-purple-700">Special Recommendation</p>
                  <p className="text-sm text-purple-600 mt-1">
                    You've received a recommendation from your Campus POC!
                  </p>
                  {selectedApp.specialRecommendation.reason && (
                    <p className="text-sm text-gray-600 mt-2">
                      "{selectedApp.specialRecommendation.reason}"
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setShowDetails(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      <ConfirmModal
        isOpen={showWithdrawModal}
        title="Withdraw Application"
        message="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmText="Withdraw"
        onConfirm={handleWithdraw}
        onCancel={() => {
          setShowWithdrawModal(false);
          setWithdrawingId(null);
        }}
        danger
      />
    </div>
  );
};

export default StudentApplications;
