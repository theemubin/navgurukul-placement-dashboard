import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applicationAPI } from '../../services/api';
import { LoadingSpinner, StatusBadge, Pagination, EmptyState, ConfirmModal } from '../../components/common/UIComponents';
import { FileText, ChevronRight, XCircle, Building, Calendar, CheckCircle, Clock, AlertCircle, GraduationCap, Briefcase, MessageCircle, ArrowRight, User } from 'lucide-react';
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
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const appId = params.get('appId');
    if (appId) {
      viewDetails(appId);
    }
  }, [location.search]);

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

      {/* Quick status counts - Gen Z Pills */}
      <div className="flex flex-wrap gap-4 items-center">
        {[
          { label: 'Applied', count: 'applied', color: 'bg-blue-50 text-blue-600 ring-blue-100' },
          { label: 'Shortlisted', count: 'shortlisted', color: 'bg-purple-50 text-purple-600 ring-purple-100' },
          { label: 'In Process', count: 'in_progress', color: 'bg-yellow-50 text-yellow-600 ring-yellow-100' },
          { label: 'Selected', count: 'selected', color: 'bg-green-50 text-green-600 ring-green-100' },
          { label: 'Rejected', count: 'rejected', color: 'bg-red-50 text-red-600 ring-red-100' },
        ].map((pill) => (
          <div key={pill.label} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold ring-1 transition-all ${pill.color}`}>
            {pill.label}
            <span className="bg-white px-2 rounded-full text-[10px] shadow-sm">{applications.filter(a => a.status === pill.count).length}</span>
          </div>
        ))}
      </div>



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
              <div
                key={app._id}
                onClick={() => viewDetails(app._id)}
                className={`group relative card overflow-hidden border-2 transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer ${app.status === 'selected' ? 'border-green-400 bg-green-50 shadow-green-100' :
                  app.status === 'rejected' ? 'border-red-100' : 'border-white hover:border-primary-100'
                  }`}>
                {app.status === 'selected' && <div className="absolute top-0 right-0 w-32 h-32 bg-green-200 blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none" />}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-110 ${isInternship ? 'bg-purple-100' : 'bg-blue-50'
                      }`}>
                      {isInternship
                        ? <GraduationCap className="w-7 h-7 text-purple-600" />
                        : <Briefcase className="w-7 h-7 text-blue-500" />
                      }
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{app.job?.title}</h3>
                        {isInternship && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-purple-600 text-white rounded">
                            Intern
                          </span>
                        )}
                        {app.status === 'selected' && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-600 text-white rounded animate-pulse">
                            Hired!
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 font-medium flex items-center gap-1.5">
                        <Building className="w-4 h-4" />
                        {app.job?.company?.name}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-100 uppercase tracking-tighter font-bold">
                          {app.status}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          Applied {format(new Date(app.createdAt), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-none pt-4 md:pt-0">
                    <Link
                      to={`/student/jobs/${app.job?._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 text-gray-400 hover:bg-primary-600 hover:text-white rounded-xl transition-all shadow-sm"
                    >
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
                            <div className={`w-full h-2 rounded-full ${isPassed ? 'bg-green-500' :
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
                      <div className={`p-3 rounded-lg ${daysInfo?.isToday ? 'bg-yellow-50 border border-yellow-200' :
                        daysInfo?.isPast ? 'bg-red-50 border border-red-200' :
                          'bg-blue-50 border border-blue-200'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <Clock className={`w-4 h-4 mt-0.5 ${daysInfo?.isToday ? 'text-yellow-600' :
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
                            <div className={`text-right ${daysInfo.isToday ? 'text-yellow-700' :
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
                      <span key={idx} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${result.status === 'passed' ? 'bg-green-100 text-green-700' :
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
                      onClick={(e) => {
                        e.stopPropagation();
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
            )
          })}

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

      {/* Application Details Side Drawer */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${showDetails ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
        <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 flex flex-col ${showDetails ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center">
                <Building className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedApp?.job?.title}</h3>
                <p className="text-xs text-gray-500">{selectedApp?.job?.company?.name}</p>
              </div>
            </div>
            <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-400"><XCircle className="w-6 h-6" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Status Hero */}
            <div className="text-center space-y-2 py-4">
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-black uppercase tracking-widest mb-2">
                {selectedApp?.status}
              </div>
              {selectedApp?.status === 'selected' ? (
                <h4 className="text-2xl font-black text-green-600">Congratulations! 🎉</h4>
              ) : selectedApp?.status === 'rejected' ? (
                <h4 className="text-2xl font-black text-red-600">Not This Time</h4>
              ) : (
                <h4 className="text-2xl font-black text-gray-900">Application Active</h4>
              )}
            </div>

            {/* Conversational Timeline */}
            <div className="space-y-6">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Application Journey</h5>

              <div className="space-y-6 relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />

                {/* Latest Message (Conversational Style) */}
                {selectedApp?.feedback && (
                  <div className="relative pl-10">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center z-10 shadow-lg shadow-primary-100">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-primary-50 p-4 rounded-2xl rounded-tl-none border border-primary-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-primary-700 uppercase">Latest Note from Team</span>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed italic italic font-medium">"{selectedApp.feedback}"</p>
                    </div>
                  </div>
                )}

                {/* Round Results */}
                {selectedApp?.roundResults?.slice().reverse().map((round, idx) => (
                  <div key={idx} className="relative pl-10">
                    <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 bg-white ${round.status === 'passed' ? 'border-green-500 text-green-500' :
                      round.status === 'failed' ? 'border-red-500 text-red-500' : 'border-blue-500 text-blue-500'
                      }`}>
                      {round.status === 'passed' ? <CheckCircle className="w-4 h-4" /> :
                        round.status === 'failed' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-900">{round.roundName || `Round ${round.round + 1}`}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full ${round.status === 'passed' ? 'bg-green-100 text-green-700' :
                          round.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>{round.status}</span>
                      </div>
                      {round.feedback && <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg italic">"{round.feedback}"</p>}
                      {round.evaluatedAt && <p className="text-[10px] text-gray-400 mt-2">{format(new Date(round.evaluatedAt), 'MMM dd, yyyy')}</p>}
                    </div>
                  </div>
                ))}

                {/* Initial Application */}
                <div className="relative pl-10">
                  <div className="absolute left-0 w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center z-10">
                    <FileText className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl">
                    <span className="text-sm font-bold text-gray-700">Application Submitted</span>
                    <p className="text-[10px] text-gray-400 mt-1">{selectedApp && format(new Date(selectedApp.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-gray-50">
            <button onClick={() => setShowDetails(false)} className="w-full btn btn-secondary py-3 rounded-xl font-bold">Close Drawer</button>
          </div>
        </div>
      </div>

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
