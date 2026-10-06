import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, CheckCircle2, ClipboardList, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { dailyTrackerMonitoringAPI } from '../../services/api';
import { Button, LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

const MonitoringDetail = ({ record, onBack }) => (
  <div className="space-y-6">
    <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back to monitoring</Button>
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-cyan-600">Placement information</p>
          <h1 className="mt-1 text-3xl font-black text-gray-900">{record.studentName}</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">{record.studentEmail}</p>
        </div>
        <StatusBadge status={record.overallStatus} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Company</p><p className="mt-1 font-bold text-gray-900">{record.companyName || 'N/A'}</p></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Role</p><p className="mt-1 font-bold text-gray-900">{record.designation || 'N/A'}</p></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Employment</p><p className="mt-1 font-bold text-gray-900">{record.employmentType || 'N/A'}</p></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Joining date</p><p className="mt-1 font-bold text-gray-900">{formatDate(record.joiningDate)}</p></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Conversion</p><p className="mt-1 font-bold text-gray-900">{record.hasFullTimeConversion === true ? `Yes${record.fullTimeConversionDate ? `, ${formatDate(record.fullTimeConversionDate)}` : ''}` : record.hasFullTimeConversion === false ? 'No' : 'N/A'}</p></div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Present/work days</p><p className="mt-2 text-3xl font-black text-green-600">{record.presentWorkDays}</p></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Missing days</p><p className="mt-2 text-3xl font-black text-amber-600">{record.missingDays}</p></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Attendance</p><p className="mt-2 text-3xl font-black text-gray-900">{record.attendancePercentage === null ? '--' : `${record.attendancePercentage}%`}</p></div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-gray-400">Today</p><p className={`mt-2 text-xl font-black ${record.todayStatus === 'Submitted' ? 'text-green-600' : 'text-amber-600'}`}>{record.todayStatus}</p></div>
    </section>

    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><ClipboardList className="text-cyan-600" /><div><p className="text-xs font-black uppercase tracking-widest text-gray-400">Daily tracker</p><h2 className="text-2xl font-black text-gray-900">Complete history</h2></div></div>
        <div className="mt-5 space-y-3">
          {record.entries?.length === 0 && <p className="text-sm font-medium text-gray-500">No tracker entries yet.</p>}
          {record.entries?.map((entry) => (
            <div key={entry._id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-gray-900">{formatDate(entry.date)} · {entry.projectName}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600">{entry.challengeStatus}</span></div>
              <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-gray-700">{entry.tasksPerformed}</p>
              {entry.challengesFaced && <p className="mt-2 text-xs font-semibold text-amber-700">Challenge: {entry.challengesFaced}</p>}
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><ShieldAlert className="text-red-500" /><h2 className="text-2xl font-black text-gray-900">Challenges</h2></div>
          <div className="mt-5 space-y-2 text-sm font-bold"><p>Total: {record.totalChallenges}</p><p className="text-green-700">Resolved: {record.resolvedChallenges}</p><p className="text-amber-700">Partial: {record.partiallyResolvedChallenges}</p><p className="text-red-700">Unresolved: {record.unresolvedChallenges}</p></div>
          {record.unresolvedChallenges > 0 && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">Unresolved challenges need placement-team attention.</div>}
        </section>
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Building2 className="text-cyan-600" /><h2 className="text-2xl font-black text-gray-900">Projects</h2></div>
          <div className="mt-5 space-y-3">{record.projects?.map((project) => <div key={project.projectName} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><span className="text-sm font-bold text-gray-800">{project.projectName}</span><span className="text-xs font-black text-gray-500">{project.daysWorked} {project.daysWorked === 1 ? 'day' : 'days'}</span></div>)}</div>
        </section>
      </div>
    </div>
  </div>
);

const PostPlacementMonitoring = () => {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState({ company: '', employmentType: '', joiningDateFrom: '', joiningDateTo: '', todayStatus: '', attendanceMin: '', challengeStatus: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await dailyTrackerMonitoringAPI.getPlacements(filters);
      setRecords(response.data?.placements || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load placement monitoring');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const openStudent = async (studentId) => {
    try {
      const response = await dailyTrackerMonitoringAPI.getStudent(studentId);
      setSelected(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load student monitoring details');
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (selected) return <MonitoringDetail record={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-cyan-600">Placement team</p><h1 className="mt-1 text-3xl font-black text-gray-900">Post-Placement Monitoring</h1><p className="mt-2 text-sm font-medium text-gray-500">Track daily work updates, presence, projects, and support needs for placed students.</p></div><Button variant="outline" onClick={loadRecords}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input placeholder="Search student or company" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <input placeholder="Company" value={filters.company} onChange={(event) => setFilters({ ...filters, company: event.target.value })} />
          <select value={filters.employmentType} onChange={(event) => setFilters({ ...filters, employmentType: event.target.value })}><option value="">Employment Type</option><option>Internship</option><option>Paid Internship</option><option>Full-Time Placement</option></select>
          <select value={filters.todayStatus} onChange={(event) => setFilters({ ...filters, todayStatus: event.target.value })}><option value="">Today&apos;s Status</option><option>Submitted</option><option>Pending</option></select>
          <input type="date" value={filters.joiningDateFrom} onChange={(event) => setFilters({ ...filters, joiningDateFrom: event.target.value })} />
          <input type="date" value={filters.joiningDateTo} onChange={(event) => setFilters({ ...filters, joiningDateTo: event.target.value })} />
          <input type="number" min="0" max="100" placeholder="Minimum attendance %" value={filters.attendanceMin} onChange={(event) => setFilters({ ...filters, attendanceMin: event.target.value })} />
          <select value={filters.challengeStatus} onChange={(event) => setFilters({ ...filters, challengeStatus: event.target.value })}><option value="">Challenge Status</option><option>Resolved</option><option>Partially Resolved</option><option>Unresolved</option><option>No Challenge</option></select>
        </div>
        <div className="mt-4 flex gap-3"><Button onClick={loadRecords}><Search className="mr-2 h-4 w-4" />Apply Filters</Button><Button variant="outline" onClick={() => { setFilters({ company: '', employmentType: '', joiningDateFrom: '', joiningDateTo: '', todayStatus: '', attendanceMin: '', challengeStatus: '', search: '' }); setTimeout(loadRecords, 0); }}>Reset</Button></div>
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-left text-sm"><thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-500"><tr><th className="p-4">Student</th><th className="p-4">Company</th><th className="p-4">Employment</th><th className="p-4">Joining Date</th><th className="p-4">Last Update</th><th className="p-4">Today</th><th className="p-4">Attendance</th><th className="p-4">Days Tracked</th><th className="p-4">Unresolved</th><th className="p-4">Overall</th></tr></thead><tbody className="divide-y divide-gray-100">{records.map((record) => <tr key={record.studentId} className="cursor-pointer hover:bg-cyan-50/40" onClick={() => openStudent(record.studentId)}><td className="p-4 font-black text-gray-900">{record.studentName}</td><td className="p-4 font-medium text-gray-700">{record.companyName || 'N/A'}</td><td className="p-4 text-gray-700">{record.employmentType || 'N/A'}</td><td className="p-4 text-gray-700">{formatDate(record.joiningDate)}</td><td className="p-4 text-gray-700">{formatDate(record.lastTrackerUpdate)}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs font-black ${record.todayStatus === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{record.todayStatus}</span></td><td className="p-4 font-bold text-gray-800">{record.attendancePercentage === null ? '--' : `${record.attendancePercentage}%`}</td><td className="p-4 font-bold text-gray-800">{record.daysTracked}</td><td className={`p-4 font-black ${record.unresolvedChallenges ? 'text-red-600' : 'text-gray-500'}`}>{record.unresolvedChallenges}</td><td className="p-4"><StatusBadge status={record.overallStatus} /></td></tr>)}</tbody></table>
        {records.length === 0 && <div className="p-12 text-center text-sm font-medium text-gray-500">No placed students match the selected filters.</div>}
      </div>
    </div>
  );
};

export default PostPlacementMonitoring;
