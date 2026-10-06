import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, ClipboardList, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dailyTrackerAPI } from '../../services/api';
import { Button, LoadingSpinner } from '../../components/common/UIComponents';

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const DailyTrackerHistory = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dailyTrackerAPI.getMyTracker(1000);
      setEntries(response.data?.entries || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load tracker history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500" size={28} />
        <p className="mt-3 font-black text-red-900">{error}</p>
        <Button className="mt-5" onClick={loadHistory}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/student/post-placement-dashboard" className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-black text-gray-900">Daily Tracker History</h1>
          <p className="mt-2 text-sm font-medium text-gray-500">Your complete submitted work-update history.</p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-black text-gray-700">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <ClipboardList className="mx-auto text-gray-300" size={36} />
          <p className="mt-4 font-black text-gray-800">No daily updates yet</p>
          <p className="mt-1 text-sm font-medium text-gray-500">Submit your first update from the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <article key={entry._id} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                    <CalendarDays size={15} /> {formatDate(entry.date)}
                  </div>
                  <h2 className="mt-2 text-xl font-black text-gray-900">{entry.projectName}</h2>
                </div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ${entry.challengeStatus === 'Unresolved' ? 'bg-red-100 text-red-700' : entry.challengeStatus === 'Partially Resolved' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {entry.challengeStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Tasks performed</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-700">{entry.tasksPerformed}</p></div>
                <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Challenges faced</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-700">{entry.challengesFaced || 'None recorded'}</p></div>
                <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Resolution</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-700">{entry.resolution || 'None recorded'}</p></div>
                <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Support required</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-700">{entry.supportRequired || 'None requested'}</p></div>
              </div>
              {entry.additionalNotes && <p className="mt-5 border-t border-gray-100 pt-4 text-sm font-medium text-gray-600"><span className="font-black text-gray-800">Additional notes:</span> {entry.additionalNotes}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyTrackerHistory;
