import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  ListChecks,
  MessageSquareWarning,
  RefreshCw,
  Users
} from 'lucide-react';
import { dailyTrackerAPI, postPlacementAPI } from '../../services/api';
import { Button, LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';

const formatDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
};

const getTodayKey = () => {
  return new Date().toISOString().slice(0, 10);
};

const emptyTrackerForm = {
  date: getTodayKey(),
  projectName: '',
  tasksPerformed: '',
  challengesFaced: '',
  resolution: '',
  challengeStatus: 'No Challenge',
  supportRequired: '',
  additionalNotes: ''
};

const getConversionLabel = (placement) => {
  if (placement.employmentType === 'Full-Time Placement') return 'Not applicable';
  if (placement.hasFullTimeConversion === true) {
    return placement.fullTimeConversionDate
      ? `Yes, ${formatDate(placement.fullTimeConversionDate)}`
      : 'Yes, date pending';
  }
  if (placement.hasFullTimeConversion === false) return 'No';
  return 'Not recorded';
};

const MetricCard = ({ icon: Icon, label, value, detail, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{detail}</p>
    </div>
  );
};

const EmptyActivity = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 p-5">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 shadow-sm">
      <Icon size={19} />
    </div>
    <div>
      <p className="font-black text-gray-800">{title}</p>
      <p className="mt-1 text-sm font-medium text-gray-500">{description}</p>
    </div>
  </div>
);

const PostPlacementDashboard = () => {
  const [placement, setPlacement] = useState(null);
  const [todayEntry, setTodayEntry] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [trackerSummary, setTrackerSummary] = useState(null);
  const [trackerForm, setTrackerForm] = useState(emptyTrackerForm);
  const [useLifeline, setUseLifeline] = useState(false);
  const [trackerSaving, setTrackerSaving] = useState(false);
  const [trackerError, setTrackerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlacement = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await postPlacementAPI.getMyPlacement({ forceRefresh: true });
      const nextPlacement = response.data?.placement || null;
      setPlacement(nextPlacement);

      if (nextPlacement) {
        try {
          const trackerResponse = await dailyTrackerAPI.getMyTracker();
          const data = trackerResponse.data || {};
          const nextTodayEntry = data.today || null;
          setTodayEntry(nextTodayEntry);
          setRecentEntries(data.entries || []);
          setTrackerSummary(data.summary || null);
          setTrackerForm({ ...emptyTrackerForm });
          setUseLifeline(false);
          setTrackerError('');
        } catch (trackerRequestError) {
          setTrackerError(trackerRequestError.response?.data?.message || 'Unable to load daily updates');
        }
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your placement dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackerSubmit = async (event) => {
    event.preventDefault();
    try {
      setTrackerSaving(true);
      setTrackerError('');
      const payload = { ...trackerForm, date: useLifeline ? trackerForm.date : getTodayKey() };
      if (todayEntry && !useLifeline) {
        await dailyTrackerAPI.updateToday(payload);
      } else {
        await dailyTrackerAPI.submitToday(payload);
      }
      const trackerResponse = await dailyTrackerAPI.getMyTracker();
      setTodayEntry(trackerResponse.data?.today || null);
      setRecentEntries(trackerResponse.data?.entries || []);
      setTrackerSummary(trackerResponse.data?.summary || null);
      setTrackerForm({ ...emptyTrackerForm, date: getTodayKey() });
      setUseLifeline(false);
    } catch (requestError) {
      setTrackerError(requestError.response?.data?.message || 'Unable to save today\'s update');
    } finally {
      setTrackerSaving(false);
    }
  };

  useEffect(() => {
    loadPlacement();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500" size={28} />
        <p className="mt-3 font-black text-red-900">{error}</p>
        <Button className="mt-5" onClick={loadPlacement}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
      </div>
    );
  }

  if (!placement) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <Briefcase className="mx-auto text-gray-300" size={38} />
        <h1 className="mt-4 text-2xl font-black text-gray-900">Post-Placement Dashboard</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-gray-500">This dashboard becomes available after your placement details are submitted.</p>
        <Link to="/student/post-placement" className="mt-6 inline-flex items-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
          Open placement form <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    );
  }

  const joiningDate = placement.joiningDate || placement.internshipStartDate;
  const currentStatus = placement.status || placement.student?.studentProfile?.currentStatus || 'active';

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-gray-950 p-7 text-white shadow-xl md:p-9">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <ClipboardCheck size={13} /> Student support dashboard
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Post-Placement Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-gray-300">Stay on top of your work updates, presence, projects, tasks, and challenges after joining.</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={currentStatus} />
            <Button variant="outline" onClick={loadPlacement}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-600">Placement overview</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900">{placement.companyName || 'Company not recorded'}</h2>
          </div>
          <Briefcase className="text-gray-300" size={25} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Role</p><p className="mt-1 font-bold text-gray-900">{placement.designation || 'Not recorded'}</p></div>
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Employment</p><p className="mt-1 font-bold text-gray-900">{placement.employmentType || 'Not recorded'}</p></div>
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Joining date</p><p className="mt-1 font-bold text-gray-900">{formatDate(joiningDate)}</p></div>
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Status</p><p className="mt-1 font-bold capitalize text-gray-900">{currentStatus}</p></div>
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Conversion</p><p className="mt-1 font-bold text-gray-900">{getConversionLabel(placement)}</p></div>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-700">Daily tracker</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900">Today&apos;s Work Update</h2>
            <p className="mt-2 text-sm font-medium text-gray-600">Record the work you completed today and flag anything that needs support.</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${todayEntry ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {todayEntry ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
              {todayEntry ? 'Submitted' : 'Pending'}
            </span>
            <span className="text-xs font-bold text-gray-500">Date: {formatDate(getTodayKey())}</span>
          </div>
        </div>
        <form onSubmit={handleTrackerSubmit} autoComplete="off" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Entry date
              <input type="date" value={trackerForm.date} max={getTodayKey()} disabled={!useLifeline} onChange={(event) => setTrackerForm({ ...trackerForm, date: event.target.value })} />
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-gray-200 bg-white p-3 text-sm font-bold text-gray-700">
              <input type="checkbox" checked={useLifeline} onChange={(event) => setUseLifeline(event.target.checked)} />
              Use a missed-day lifeline ({trackerSummary?.lifelinesRemaining ?? 3} remaining this month)
            </label>
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Project worked on <span className="text-red-500">*</span>
              <input required value={trackerForm.projectName} onChange={(event) => setTrackerForm({ ...trackerForm, projectName: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Challenge status
              <select value={trackerForm.challengeStatus} onChange={(event) => setTrackerForm({ ...trackerForm, challengeStatus: event.target.value })}>
                <option>No Challenge</option>
                <option>Resolved</option>
                <option>Partially Resolved</option>
                <option>Unresolved</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm font-bold text-gray-700">
            Tasks performed <span className="text-red-500">*</span>
            <textarea required rows="4" value={trackerForm.tasksPerformed} onChange={(event) => setTrackerForm({ ...trackerForm, tasksPerformed: event.target.value })} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Challenges faced
              <textarea rows="3" value={trackerForm.challengesFaced} onChange={(event) => setTrackerForm({ ...trackerForm, challengesFaced: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-gray-700">
              How did you resolve the challenge?
              <textarea rows="3" value={trackerForm.resolution} onChange={(event) => setTrackerForm({ ...trackerForm, resolution: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Support required
              <textarea rows="3" value={trackerForm.supportRequired} onChange={(event) => setTrackerForm({ ...trackerForm, supportRequired: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-gray-700">
              Additional notes
              <textarea rows="3" value={trackerForm.additionalNotes} onChange={(event) => setTrackerForm({ ...trackerForm, additionalNotes: event.target.value })} />
            </label>
          </div>
          {trackerError && <p className="text-sm font-semibold text-red-600">{trackerError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-gray-500">Today&apos;s entry is automatic. You have up to 3 lifelines per month for missed dates.</p>
            <Button type="submit" disabled={trackerSaving}>
              <FileText className="mr-2 h-4 w-4" />{trackerSaving ? 'Saving...' : todayEntry ? "Update Today's Update" : "Submit Today's Update"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Daily updates</p><h2 className="mt-1 text-2xl font-black text-gray-900">Submission summary</h2></div>
          <span className="text-xs font-bold text-gray-400">From placement start to today</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Total days" value={trackerSummary?.totalDaysExpected || 0} detail="Days in tracking period" />
          <MetricCard icon={FileText} label="Updates submitted" value={trackerSummary?.updatesSubmitted || 0} detail="Valid daily entries" tone="green" />
          <MetricCard icon={AlertTriangle} label="Missing updates" value={trackerSummary?.missingUpdates || 0} detail="Days without an entry" tone="amber" />
          <MetricCard icon={todayEntry ? CheckCircle2 : Clock3} label="Today's status" value={todayEntry ? 'Submitted' : 'Pending'} detail={todayEntry ? 'Update recorded today' : 'Submit before the day ends'} tone={todayEntry ? 'green' : 'amber'} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Work presence</p><h2 className="mt-1 text-2xl font-black text-gray-900">Attendance snapshot</h2></div>
          <span className="text-xs font-bold text-gray-400">Valid update = work day</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Days tracked" value={trackerSummary?.daysTracked || 0} detail="Daily updates submitted" />
          <MetricCard icon={CheckCircle2} label="Days present" value={trackerSummary?.daysPresent || 0} detail="Based on submitted updates" tone="green" />
          <MetricCard icon={AlertTriangle} label="Missing days" value={trackerSummary?.missingUpdates || 0} detail="No update recorded" tone="amber" />
          <MetricCard icon={Clock3} label="Attendance" value={trackerSummary?.attendancePercentage ? `${trackerSummary.attendancePercentage}%` : '--'} detail="Based on tracker data" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3"><ListChecks className="text-gray-300" size={24} /><div><p className="text-xs font-black uppercase tracking-widest text-gray-400">History</p><h2 className="mt-1 text-2xl font-black text-gray-900">Recent Activity</h2></div></div>
          </div>
          <div className="mt-5 space-y-3">
            {recentEntries.length === 0 && <EmptyActivity icon={ListChecks} title="No daily updates yet" description="Submit today&apos;s update to start your work history." />}
            {recentEntries.map((entry) => (
              <div key={entry._id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-gray-900">{formatDate(entry.date)} · {entry.projectName}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600">{entry.challengeStatus}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-600">{entry.tasksPerformed}</p>
                {entry.challengesFaced && <p className="mt-2 text-xs font-semibold text-amber-700">Challenge: {entry.challengesFaced}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Support</p><h2 className="mt-1 text-2xl font-black text-gray-900">Challenges</h2></div>
            <MessageSquareWarning className="text-gray-300" size={24} />
          </div>
          <div className="mt-5 space-y-3">
            <MetricCard icon={MessageSquareWarning} label="Total challenges" value={trackerSummary?.totalChallenges || 0} detail="Reported in daily updates" />
            <div className="grid grid-cols-3 gap-3">
              <MetricCard icon={CheckCircle2} label="Resolved" value={trackerSummary?.resolvedChallenges || 0} detail="Challenges closed" tone="green" />
              <MetricCard icon={Clock3} label="Partial" value={trackerSummary?.partiallyResolvedChallenges || 0} detail="Still in progress" tone="amber" />
              <MetricCard icon={AlertTriangle} label="Unresolved" value={trackerSummary?.unresolvedChallenges || 0} detail="May need support" tone="red" />
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
        <Users size={15} /> Daily updates, attendance calculations, and challenge history will populate this dashboard in the next feature phase.
      </div>
    </div>
  );
};

export default PostPlacementDashboard;
