import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { statsAPI, settingsAPI, campusAPI, jobReadinessAPI, userAPI } from '../../services/api';
import { useSchools } from '../../context/SchoolsContext';
import { Card, LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line
} from 'recharts';
import { 
  Target, Briefcase, Users, ArrowUpRight, Search, 
  Layers, Zap, Info, ChevronRight, MapPin, Flag,
  CheckCircle, ExternalLink, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Building2, Calendar, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';

const PipelineAnalytics = () => {
  const { user } = useAuth();
  const basePath = user?.role === 'campus_poc' ? '/campus-poc' : user?.role === 'manager' ? '/manager' : '/coordinator';
  const [data, setData] = useState([]);
  const [campusBreakdown, setCampusBreakdown] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [campusSchools, setCampusSchools] = useState([]);
  const [expandedCampuses, setExpandedCampuses] = useState({});
  const [filters, setFilters] = useState({
    campus: '',
    school: ''
  });
  const [selectedRole, setSelectedRole] = useState(null);

  // Job-Ready Roster state
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterOpen, setRosterOpen] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPipelineData();
    fetchRoster(1);
    setRosterSearch('');
  }, [filters]);

  const fetchRoster = async (page = 1) => {
    try {
      setRosterLoading(true);
      const params = { isJobReady: 'true', limit: 20, page };
      if (filters.campus) params.campus = filters.campus;
      if (filters.school) params.school = filters.school;
      const res = await jobReadinessAPI.getCampusStudents(params);
      setRoster(res.data.records || []);
      setRosterTotal(res.data.pagination?.total || 0);
      setRosterPage(page);
    } catch (err) {
      console.error('Failed to load job-ready roster', err);
    } finally {
      setRosterLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const requests = [
        campusAPI.getCampuses(),
        settingsAPI.getSettings()
      ];
      // For PoC, also fetch managed campuses to filter the dropdown
      if (user?.role === 'campus_poc') {
        requests.push(userAPI.getManagedCampuses());
      }
      const results = await Promise.all(requests);
      const allCampuses = results[0].data || [];
      // Prefer provider value if available
      setSchools(results[1].data?.data?.schools || []);

      if (user?.role === 'campus_poc' && results[2]) {
        const managedIds = (results[2].data || []).map(c => c._id);
        setCampuses(allCampuses.filter(c => managedIds.includes(c._id)));
      } else {
        setCampuses(allCampuses);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

    const { schools: globalSchools } = useSchools();

    useEffect(() => {
      if (globalSchools && globalSchools.length > 0) setSchools(globalSchools);
    }, [globalSchools]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      const res = await statsAPI.getTalentPipeline(filters);
      setData(res.data?.roles || []);
      setCampusBreakdown(res.data?.campusBreakdown || []);
      setCampusSchools(res.data?.campusSchools || []);
      setCycle(res.data?.cycle || null);
      if (res.data?.roles?.length > 0 && !selectedRole) {
        setSelectedRole(res.data.roles[0]);
      }
    } catch (err) {
      toast.error('Failed to load pipeline analytics');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalReady: data.reduce((sum, item) => sum + item.jobReady, 0),
    totalJobs: data.reduce((sum, item) => sum + item.activeJobs, 0),
    avgReadiness: data.length ? (data.reduce((sum, item) => sum + (item.jobReady / (item.totalInterested || 1)), 0) / data.length * 100).toFixed(1) : 0,
    topRole: data.length ? data[0].role : 'N/A'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 shadow-2xl rounded-2xl border border-gray-100 backdrop-blur-md bg-white/90">
          <p className="font-bold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm py-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-500">{entry.name}:</span>
              <span className="font-bold text-gray-900">{entry.value}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
            Ready Rate: {((payload[1].value / (payload[0].value || 1)) * 100).toFixed(1)}%
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading && data.length === 0) return <LoadingSpinner size="lg" fullPage />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-600" />
            Talent Pipeline Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Analyzing student interests, job readiness, and market demand to drive placements.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filters.campus}
              onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              className="pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">All Campuses</option>
              {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filters.school}
              onChange={(e) => setFilters({ ...filters, school: e.target.value })}
              className="pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">All Schools</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 flex flex-col justify-between">
          <div className="p-2.5 bg-indigo-600 rounded-lg text-white shadow-md w-fit mb-3">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-tight">Market Ready</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{stats.totalReady}</h3>
          </div>
        </Card>
        
        {/* Cycle Goal Progress */}
        {cycle && (
          <Card className="p-4 bg-gradient-to-br from-violet-50 to-white border-violet-100 flex flex-col justify-between">
            <div className="p-2.5 bg-violet-600 rounded-lg text-white shadow-md w-fit mb-3">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest leading-tight truncate" title={`${cycle.name} Goal`}>
                {cycle.name} Goal
              </p>
              <div className="flex items-end justify-between mt-1">
                <h3 className="text-xl font-black text-gray-900">{cycle.current}</h3>
                <span className="text-[10px] font-bold text-gray-400 mb-0.5">/ {cycle.target}</span>
              </div>
              <div className="w-full bg-gray-200 h-1 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-violet-600 rounded-full" 
                  style={{ width: `${Math.min((cycle.current / (cycle.target || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 flex flex-col justify-between">
          <div className="p-2.5 bg-emerald-600 rounded-lg text-white shadow-md w-fit mb-3">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-tight">Open Jobs</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{stats.totalJobs}</h3>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-100 flex flex-col justify-between">
          <div className="p-2.5 bg-amber-600 rounded-lg text-white shadow-md w-fit mb-3">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-tight">Readiness Rate</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{stats.avgReadiness}%</h3>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-50 to-white border-rose-100 flex flex-col justify-between">
          <div className="p-2.5 bg-rose-600 rounded-lg text-white shadow-md w-fit mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest leading-tight">Top Demand</p>
            <h3 className="text-lg font-black text-gray-900 mt-1 truncate" title={stats.topRole}>{stats.topRole}</h3>
          </div>
        </Card>
      </div>

      {/* Campus Talent Pipeline Table */}
      {campusBreakdown.length > 0 && (
        <Card className="overflow-hidden border-gray-100 shadow-sm bg-white">
          <div className="px-6 py-4 border-b border-gray-50 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Campus Talent Pipeline</h3>
                <p className="text-xs text-gray-500 mt-0.5">Per-campus placement readiness breakdown</p>
              </div>
            </div>
            {campusBreakdown.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-amber-700">
                  Leading: {campusBreakdown[0].campusName}
                </span>
                <span className="text-[10px] font-bold text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  {campusBreakdown[0].placementReadyPct}% Ready
                </span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white text-left">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">#</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Campus</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Active</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Interns (In)</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Interns (Out)</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Open for Placements</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Placed This Cycle</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Placement Ready</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      Readiness Pending
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      Cycle Not Allocated
                    </span>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-blue-500" />
                      Comm. Ready
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campusBreakdown.map((row, idx) => (
                  <React.Fragment key={row.campusId}>
                    <tr
                      onClick={() => {
                        const key = String(row.campusId);
                        setExpandedCampuses(prev => ({ ...prev, [key]: !prev[key] }));
                        // debug help: uncomment if needed
                        // console.log('toggle campus', key);
                      }}
                      className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${
                        idx === 0 ? 'bg-amber-50/20' : ''
                      }`}
                    >
                    <td className="px-6 py-4">
                      {idx === 0 ? (
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Trophy className="w-4 h-4 text-amber-600" />
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-gray-400">{idx + 1}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {row.campusName[0]}
                        </div>
                        <span className="font-bold text-gray-900">{row.campusName}</span>
                        {idx === 0 && (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Leading</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.totalStudents}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.activeCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.internsInCampus}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.internsOutCampus}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.openForPlacements}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">{row.placedCount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-indigo-700">{row.placementReadyPct}%</span>
                        <span className="text-xs text-gray-500">({row.placementReady})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${row.readinessPending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{row.readinessPendingPct}%</span>
                        <span className="text-xs text-gray-500">({row.readinessPending})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${row.cycleNotAllocated > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{row.cycleNotAllocatedPct}%</span>
                        <span className="text-xs text-gray-500">({row.cycleNotAllocated})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-600">{row.communicationReadyPct}%</span>
                        <span className="text-xs text-gray-500">({row.communicationReady})</span>
                      </div>
                    </td>
                    </tr>
                    {expandedCampuses[row.campusId] && (
                      (campusSchools.find(c => c.campusId === row.campusId)?.schools || []).map(sch => {
                        const pct = sch.students ? Math.round((sch.placementReady || 0) / sch.students * 100) : 0;
                        const readinessPendingPct = sch.students ? Math.round((sch.readinessPending || 0) / sch.students * 100) : 0;
                        const cycleNotAllocatedPct = sch.students ? Math.round((sch.cycleNotAllocated || 0) / sch.students * 100) : 0;
                        const commReadyPct = sch.students ? Math.round((sch.communicationReady || 0) / sch.students * 100) : 0;
                        return (
                          <tr
                            key={`${row.campusId}-sch-${sch.school}`}
                            className={`bg-white hover:bg-gray-50 transition-colors cursor-pointer ${filters.school === sch.school ? 'bg-indigo-50/60' : ''}`}
                            onClick={() => setFilters({ ...filters, school: sch.school })}
                          >
                            <td className="px-6 py-2" />
                            <td className="px-6 py-2">
                              <div className="pl-6 text-sm text-gray-800">↳ {sch.school}</div>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.students}</span>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.activeCount || 0}</span>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.internsInCampus || 0}</span>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.internsOutCampus || 0}</span>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.openForPlacements || 0}</span>
                            </td>
                            <td className="px-6 py-2">
                              <span className="text-sm font-medium text-gray-700">{sch.placements || sch.placedCount || 0}</span>
                            </td>
                            <td className="px-6 py-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-indigo-700">{pct}%</span>
                                <span className="text-xs text-gray-500">({sch.placementReady || 0})</span>
                              </div>
                            </td>
                            <td className="px-6 py-2">
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${sch.readinessPending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{readinessPendingPct}%</span>
                                <span className="text-xs text-gray-500">({sch.readinessPending || 0})</span>
                              </div>
                            </td>
                            <td className="px-6 py-2">
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${sch.cycleNotAllocated > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{cycleNotAllocatedPct}%</span>
                                <span className="text-xs text-gray-500">({sch.cycleNotAllocated || 0})</span>
                              </div>
                            </td>
                            <td className="px-6 py-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-blue-600">{commReadyPct}%</span>
                                <span className="text-xs text-gray-500">({sch.communicationReady || 0})</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    </React.Fragment>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-gray-50/80 border-t-2 border-gray-200">
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-600 uppercase tracking-widest">Totals</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.totalStudents || r.students || r.totalActive || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.activeCount || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.internsInCampus || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.internsOutCampus || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.openForPlacements || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-900">
                      {campusBreakdown.reduce((s, r) => s + Number(r.placedCount || r.placements || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-indigo-700">
                      {campusBreakdown.reduce((s, r) => s + Number(r.placementReady || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-amber-700">
                      {campusBreakdown.reduce((s, r) => s + Number(r.readinessPending || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-gray-700">
                      {campusBreakdown.reduce((s, r) => s + Number(r.cycleNotAllocated || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm font-black text-blue-700">
                      {campusBreakdown.reduce((s, r) => s + Number(r.communicationReady || 0), 0)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 p-8 bg-white border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -mr-32 -mt-32" />
          
          <div className="flex items-center justify-between mb-8 relative">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Pipeline Visualization</h3>
              <p className="text-sm text-gray-500">Interested vs. Ready vs. Jobs</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <div className="w-3 h-3 rounded-full bg-gray-200" /> Interest
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <div className="w-3 h-3 rounded-full bg-indigo-600" /> Job Ready
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <div className="w-3 h-3 rounded-full bg-emerald-500" /> Active Jobs
              </div>
            </div>
          </div>

          <div className="h-[600px] min-h-[600px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                layout="vertical"
                data={data} 
                margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                <XAxis 
                  type="number"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis 
                  dataKey="role"
                  type="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar 
                  dataKey="totalInterested" 
                  name="Interested" 
                  fill="#f3f4f6" 
                  radius={[0, 6, 6, 0]} 
                  barSize={20} 
                />
                <Bar 
                  dataKey="jobReady" 
                  name="Job Ready" 
                  fill="#4f46e5" 
                  radius={[0, 6, 6, 0]} 
                  barSize={20} 
                />
                <Line 
                  type="monotone" 
                  dataKey="activeJobs" 
                  name="Active Jobs" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Action Center */}
        <div className="space-y-6">
          <Card className="p-6 bg-white border-amber-200 shadow-xl shadow-amber-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
            <h4 className="text-lg font-bold mb-2 flex items-center gap-2 text-gray-900 relative">
              <Zap className="w-5 h-5 text-amber-500" />
              Job Search Priority
            </h4>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 relative">
              These roles have **Job Ready** talent but **low/no** active jobs. Prioritize sourcing these roles first.
            </p>
            <div className="space-y-3 relative">
              {data.filter(d => d.jobReady > d.activeJobs).slice(0, 3).map(d => (
                <div key={d.role} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100 group-hover:border-amber-300 transition-colors">
                  <span className="font-bold text-sm text-gray-800">{d.role}</span>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-amber-700">{d.jobReady - d.activeJobs} Ready Students</span>
                  </div>
                </div>
              ))}
              {data.filter(d => d.jobReady > d.activeJobs).length === 0 && (
                <div className="py-4 text-center text-gray-400 italic text-sm">
                  Supply and demand are currently balanced.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 bg-white border-gray-100 shadow-sm">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Pipeline Breakdown</h4>
            <div className="space-y-4">
              {data.slice(0, 6).map(d => (
                <div key={d.role} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">{d.role}</span>
                    <span className="text-xs font-bold text-gray-400">{d.jobReady}/{d.totalInterested} Ready</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-1000"
                      style={{ width: `${(d.jobReady / (d.totalInterested || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Detailed Table */}
      <Card className="overflow-hidden border-gray-100 shadow-sm bg-white">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Detailed Role Pipeline</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Info className="w-4 h-4" />
            Sorted by student interest
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white text-left">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Role Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Interested</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Job Ready</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Readiness %</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Active Jobs</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Potential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((row) => (
                <tr 
                  key={row.role} 
                  className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${selectedRole?.role === row.role ? 'bg-indigo-50/50' : ''}`}
                  onClick={() => setSelectedRole(row)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {row.role[0]}
                      </div>
                      <span className="font-bold text-gray-900">{row.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-600">{row.totalInterested}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="indigo" className="font-bold">{row.jobReady}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{((row.jobReady / (row.totalInterested || 1)) * 100).toFixed(0)}%</span>
                      {((row.jobReady / (row.totalInterested || 1)) * 100) > 50 && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${row.activeJobs === 0 ? 'text-rose-500' : 'text-gray-900'}`}>
                      {row.activeJobs}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      {row.jobReady > 0 && row.activeJobs === 0 ? (
                        <Badge variant="warning" className="text-[10px] animate-pulse">Sourcing Need</Badge>
                      ) : row.jobReady > 10 ? (
                        <Badge variant="success" className="text-[10px]">High Potential</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role Drill-down */}
      {selectedRole && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slideUp">
          <Card className="p-6 bg-white border-gray-100 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
              Ready Students: {selectedRole.role}
              <Badge variant="indigo">{selectedRole.readyStudents.length} Visible</Badge>
            </h4>
            {selectedRole.readyStudents.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center italic">No Job-Ready students yet for this role.</p>
            ) : (
              <div className="space-y-3">
                {selectedRole.readyStudents.map(student => (
                  <div key={student._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center font-bold text-indigo-600">
                        {student.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.campus}</p>

                    
                      </div>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 bg-white border-gray-100 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
              Open Jobs: {selectedRole.role}
              <Badge variant="emerald">{selectedRole.openJobList.length} Active</Badge>
            </h4>
            {selectedRole.openJobList.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                  <Search className="w-8 h-8" />
                </div>
                <h5 className="font-bold text-rose-900">No active jobs found</h5>
                <p className="text-sm text-rose-600 mt-1">Start sourcing jobs for {selectedRole.role} to match your ready talent!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedRole.openJobList.map(job => (
                  <div key={job._id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{job.title}</p>
                        <p className="text-xs text-emerald-600 font-bold mt-1 uppercase tracking-wider">{job.company}</p>
                      </div>
                      <Badge variant="success" className="text-[10px]">Open</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Job-Ready Roster */}
      <Card className="overflow-hidden border-gray-100 shadow-sm bg-white">
        {/* Section Header */}
        <div
          className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setRosterOpen(o => !o)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Job-Ready Student Roster</h3>
              <p className="text-xs text-gray-500 mt-0.5">All students who have achieved job readiness</p>
            </div>
            <span className="ml-2 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              {rosterTotal} students
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            {rosterOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>

        {rosterOpen && (
          <div className="p-6 space-y-4">
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full focus:ring-2 focus:ring-emerald-400 outline-none transition-all"
              />
            </div>

            {rosterLoading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="md" />
              </div>
            ) : roster.length === 0 ? (
              <div className="text-center py-12 text-gray-400 italic text-sm">
                No job-ready students found{filters.campus || filters.school ? ' for the selected filters' : ''}.
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-gray-100">
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Campus</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Placement Cycle</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">School / Module</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Open For Roles</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Readiness</th>
                        <th className="pb-3 text-xs font-bold text-gray-400 uppercase tracking-widest"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {roster
                        .filter(r => {
                          if (!rosterSearch.trim()) return true;
                          const q = rosterSearch.toLowerCase();
                          const name = `${r.student?.firstName} ${r.student?.lastName}`.toLowerCase();
                          const email = (r.student?.email || '').toLowerCase();
                          return name.includes(q) || email.includes(q);
                        })
                        .map(record => {
                          const student = record.student || {};
                          const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
                          const school = student.studentProfile?.currentSchool || '—';
                          const module = student.studentProfile?.currentModule || null;
                          const campus = student.campus?.name || '—';
                          const roles = student.studentProfile?.openForRoles || [];
                          const pct = record.readinessPercentage ?? 0;
                          const cycle = record.placementCycle || null;

                          return (
                            <tr key={record._id} className="hover:bg-emerald-50/20 transition-colors group">
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm shrink-0">
                                    {name[0] || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
                                    <p className="text-xs text-gray-400 truncate">{student.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 pr-4">
                                <span className="text-sm font-medium text-gray-700">{campus}</span>
                              </td>
                              <td className="py-4 pr-4">
                                {cycle ? (
                                  <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-semibold rounded-full border border-violet-100">
                                    {cycle}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">—</span>
                                )}
                              </td>
                              <td className="py-4 pr-4">
                                <p className="text-sm font-medium text-gray-700">{school}</p>
                                {module && <p className="text-xs text-gray-400 mt-0.5">{module}</p>}
                              </td>
                              <td className="py-4 pr-4">
                                {roles.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {roles.slice(0, 3).map(role => (
                                      <span key={role} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded-full border border-indigo-100">
                                        {role}
                                      </span>
                                    ))}
                                    {roles.length > 3 && (
                                      <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-semibold rounded-full border border-gray-100">
                                        +{roles.length - 3}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Not set</span>
                                )}
                              </td>
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-emerald-700">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-4 text-right">
                                <Link
                                  to={`${basePath}/job-readiness`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                  View <ExternalLink className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {rosterTotal > 20 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Showing {(rosterPage - 1) * 20 + 1}–{Math.min(rosterPage * 20, rosterTotal)} of {rosterTotal}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchRoster(rosterPage - 1)}
                        disabled={rosterPage <= 1}
                        className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchRoster(rosterPage + 1)}
                        disabled={rosterPage * 20 >= rosterTotal}
                        className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PipelineAnalytics;
