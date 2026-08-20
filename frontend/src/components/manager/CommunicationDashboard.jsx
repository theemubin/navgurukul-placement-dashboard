import React, { useState, useEffect, useMemo, memo } from 'react';
import { userAPI } from '../../services/api';
import { LoadingSpinner, EmptyState } from '../common/UIComponents';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  LabelList
} from 'recharts';
import { 
  MessageCircle, TrendingUp, Award, BookOpen, Clock, CheckCircle, 
  School, Calendar, Target, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Static constants & pure helpers (defined once, outside the component) ──
const cefrOrder = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const getReadTheoryValue = (student) => {
  const raw = student?.studentProfile?.readTheoryLevel
    || student?.resolvedProfile?.readTheoryLevel
    || student?.studentProfile?.externalData?.ghar?.readTheoryLevel?.value
    || null;
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
};

const getCefrValue = (student) => {
  return {
    speaking: student?.studentProfile?.englishProficiency?.speaking 
      || student?.resolvedProfile?.englishSpeaking 
      || student?.studentProfile?.externalData?.ghar?.englishSpeaking?.value 
      || '',
    writing: student?.studentProfile?.englishProficiency?.writing 
      || student?.resolvedProfile?.englishWriting 
      || student?.studentProfile?.externalData?.ghar?.englishWriting?.value 
      || ''
  };
};

const isCommunicationReady = (level) => cefrOrder[level] >= cefrOrder['B2'];

const getCefrColor = (level) => {
  const order = cefrOrder[level] || 0;
  if (order >= cefrOrder['B2']) return 'text-green-600 bg-green-50';
  if (order >= cefrOrder['B1']) return 'text-blue-600 bg-blue-50';
  if (order >= cefrOrder['A2']) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-600 bg-gray-50';
};

const getReadTheoryBadgeClass = (score) => {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-500 border-gray-200';
  if (score < 3) return 'bg-red-50 text-red-700 border-red-200';
  if (score < 5) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (score < 7) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (score < 9) return 'bg-green-50 text-green-700 border-green-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

// ── Memoised sub-views (React.memo prevents re-render on tab switch) ──
const CefrProficiencyView = memo(({ cefrStudents, commReadyPercentage, analytics }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Users className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assessed Students</p>
          <p className="text-2xl font-black text-gray-900">{cefrStudents.length}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Award className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comm Ready (B2+)</p>
          <p className="text-2xl font-black text-gray-900">{commReadyPercentage}%</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-purple-50 rounded-2xl text-purple-600"><Target className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Level</p>
          <p className="text-2xl font-black text-gray-900">B1+</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Readiness by School</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.schoolData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis type="category" dataKey="school" width={100} tick={{ fontSize: 10, fontWeight: 700 }} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="readyRate" name="Ready %" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Speaking vs Writing Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-bold border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="p-2 text-gray-400 uppercase tracking-tighter">S \ W</th>
                {cefrLevels.map(l => <th key={l} className="p-2 text-gray-600 bg-gray-50 rounded-lg">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {analytics.matrix.map(row => (
                <tr key={row.speaking}>
                  <td className="p-2 text-gray-600 bg-gray-50 rounded-lg text-center">{row.speaking}</td>
                  {row.values.map(cell => {
                    const ratio = analytics.maxCount > 0 ? cell.count / analytics.maxCount : 0;
                    const bgColor = ratio > 0.7 ? 'bg-primary-600 text-white'
                                  : ratio > 0.4 ? 'bg-primary-300 text-primary-900'
                                  : ratio > 0   ? 'bg-primary-100 text-primary-700'
                                  : 'bg-gray-50 text-gray-300';
                    return (
                      <td key={cell.writing} className={`p-2 rounded-lg text-center transition-all ${bgColor}`}>
                        {cell.count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Student Proficiencies</h3>
        <span className="text-[10px] font-black bg-primary-50 text-primary-600 px-3 py-1 rounded-full uppercase">Top 50</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">School</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Speaking</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Writing</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cefrStudents.slice(0, 50).map(s => {
              const { speaking, writing } = getCefrValue(s);
              const ready    = isCommunicationReady(speaking) && isCommunicationReady(writing);
              return (
                <tr key={s._id} className="hover:bg-primary-50/20 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center font-black text-primary-700 text-xs">
                        {s.firstName?.[0]}{s.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] font-bold text-gray-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{s.studentProfile?.currentSchool || s.resolvedProfile?.currentSchool || '-'}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${getCefrColor(speaking)}`}>{speaking || '-'}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${getCefrColor(writing)}`}>{writing || '-'}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {ready
                      ? <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-100">Ready</span>
                      : <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase border border-amber-100">In Progress</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
));

const ReadTheoryView = memo(({ readTheoryStudents, readTheoryAnalytics }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><BookOpen className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Average Level</p>
          <p className="text-2xl font-black text-gray-900">{readTheoryAnalytics.average}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><CheckCircle className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Benchmark (7+)</p>
          <p className="text-2xl font-black text-gray-900">
            {Math.round((readTheoryStudents.filter(s => s.readTheoryNumeric >= 7).length / (readTheoryStudents.length || 1)) * 100)}%
          </p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
        <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><Clock className="w-6 h-6" /></div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Needs Support</p>
          <p className="text-2xl font-black text-gray-900">{readTheoryStudents.filter(s => s.readTheoryNumeric < 5).length}</p>
        </div>
      </div>
    </div>

    <div className="card bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Score Distribution</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={readTheoryAnalytics.distribution} margin={{ top: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="count" name="Students" fill="#4f46e5" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="pct" position="top" formatter={v => `${v}%`} style={{ fontSize: 10, fontWeight: 800, fill: '#4f46e5' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Individual Levels</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">School</th>
              <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Read Theory Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...readTheoryStudents].sort((a,b) => b.readTheoryNumeric - a.readTheoryNumeric).slice(0, 50).map(s => (
              <tr key={s._id} className="hover:bg-primary-50/20 transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center font-black text-indigo-700 text-xs">
                      {s.firstName?.[0]}{s.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{s.firstName} {s.lastName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">{s.studentProfile?.currentSchool || s.resolvedProfile?.currentSchool || '-'}</span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${getReadTheoryBadgeClass(s.readTheoryNumeric)}`}>
                    Level {s.readTheoryNumeric}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
));

// ── Main Dashboard Component ──
const CommunicationDashboard = ({ campusId = '' }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('cefr');

  const fetchCommunicationData = async () => {
    setLoading(true);
    try {
      const params = { limit: 2000, summary: 'communication' };
      if (campusId) params.campus = campusId;
      
      const response = await userAPI.getStudents(params);
      const allStudents = response.data.students || [];
      
      const allowedStatuses = ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'];
      
      // Filter students with communication data AND allowed status
      const commStudents = allStudents.filter(s => {
        const status = s.studentProfile?.currentStatus || s.resolvedProfile?.currentStatus || 'Active';
        const isAllowedStatus = allowedStatuses.includes(status);
        if (!isAllowedStatus) return false;

        const { speaking, writing } = getCefrValue(s);
        const hasCefr = speaking || writing;
        const hasReadTheory = getReadTheoryValue(s) !== null;
        return hasCefr || hasReadTheory;
      });
      
      setStudents(commStudents);
    } catch (error) {
      console.error('Error fetching communication data:', error);
      toast.error('Error loading communication statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunicationData();
  }, [campusId]);

  const cefrStudents = useMemo(() => {
    return students.filter(s => {
      const { speaking, writing } = getCefrValue(s);
      return speaking || writing;
    });
  }, [students]);

  const readTheoryStudents = useMemo(() => {
    return students
      .map(s => ({ ...s, readTheoryNumeric: getReadTheoryValue(s) }))
      .filter(s => s.readTheoryNumeric !== null);
  }, [students]);

  const commReadyPercentage = useMemo(() => {
    if (cefrStudents.length === 0) return 0;
    const ready = cefrStudents.filter(s => {
      const { speaking, writing } = getCefrValue(s);
      return isCommunicationReady(speaking) && isCommunicationReady(writing);
    }).length;
    return Math.round((ready / cefrStudents.length) * 100);
  }, [cefrStudents]);

  const analytics = useMemo(() => {
    // School-wise readiness
    const schoolMap = {};
    cefrStudents.forEach(s => {
      const school = s.studentProfile?.currentSchool || s.resolvedProfile?.currentSchool || 'Unknown';
      if (!schoolMap[school]) schoolMap[school] = { school, total: 0, ready: 0 };
      schoolMap[school].total++;
      const { speaking, writing } = getCefrValue(s);
      if (isCommunicationReady(speaking) && isCommunicationReady(writing)) schoolMap[school].ready++;
    });

    const schoolData = Object.values(schoolMap).map(item => ({
      ...item,
      readyRate: Math.round((item.ready / item.total) * 100)
    })).sort((a, b) => b.readyRate - a.readyRate);

    // CEFR Matrix
    const matrix = cefrLevels.map(speaking => ({
      speaking,
      values: cefrLevels.map(writing => {
        const count = cefrStudents.filter(s => {
          const cefr = getCefrValue(s);
          return cefr.speaking === speaking && cefr.writing === writing;
        }).length;
        return { writing, count };
      })
    }));

    const maxCount = Math.max(0, ...matrix.flatMap(r => r.values.map(v => v.count)));

    return { schoolData, matrix, maxCount };
  }, [cefrStudents]);

  const readTheoryAnalytics = useMemo(() => {
    const buckets = ['0-2.9', '3-4.9', '5-6.9', '7-8.9', '9+'];
    const distribution = buckets.map(b => {
      const count = readTheoryStudents.filter(s => {
        const score = s.readTheoryNumeric;
        if (b === '0-2.9') return score < 3;
        if (b === '3-4.9') return score >= 3 && score < 5;
        if (b === '5-6.9') return score >= 5 && score < 7;
        if (b === '7-8.9') return score >= 7 && score < 9;
        return score >= 9;
      }).length;
      return { 
        bucket: b, 
        count,
        pct: readTheoryStudents.length > 0 ? Math.round((count / readTheoryStudents.length) * 100) : 0
      };
    });

    const average = readTheoryStudents.length > 0
      ? (readTheoryStudents.reduce((sum, s) => sum + s.readTheoryNumeric, 0) / readTheoryStudents.length).toFixed(1)
      : 0;

    return { distribution, average };
  }, [readTheoryStudents]);

  // Skeleton for Communication Dashboard content
  const CommunicationSkeleton = () => (
    <div className="space-y-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border-2 border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-200 animate-pulse flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-2.5 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-300 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart skeleton */}
        <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
          <div className="h-3 w-36 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="h-72 flex items-end gap-2 px-2">
            {[60, 80, 45, 95, 70, 55, 85, 40].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                <div
                  className="rounded-sm bg-gray-200 animate-pulse"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Matrix / secondary chart skeleton */}
        <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
          <div className="h-3 w-44 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="space-y-2">
            {/* Header row */}
            <div className="flex gap-1">
              <div className="w-10 h-6 bg-gray-100 rounded animate-pulse" />
              {[...Array(6)].map((_, j) => (
                <div key={j} className="flex-1 h-6 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
            {/* Matrix rows */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-1">
                <div className="w-10 h-8 bg-gray-200 rounded animate-pulse" />
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="flex-1 h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student table skeleton */}
      <div className="bg-white rounded-3xl border-2 border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-36 bg-gray-200 rounded animate-pulse" />
                <div className="h-2.5 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-5 w-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-5 w-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-5 w-16 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Mini Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('cefr')}
          className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
            subTab === 'cefr' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white text-gray-400 hover:text-gray-600'
          }`}
        >
          CEFR Proficiency
        </button>
        <button
          onClick={() => setSubTab('readTheory')}
          className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
            subTab === 'readTheory' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : 'bg-white text-gray-400 hover:text-gray-600'
          }`}
        >
          Read Theory
        </button>
      </div>

      {loading && <CommunicationSkeleton />}

      {!loading && (subTab === 'cefr' ? (
        <CefrProficiencyView
          cefrStudents={cefrStudents}
          commReadyPercentage={commReadyPercentage}
          analytics={analytics}
        />
      ) : (
        <ReadTheoryView
          readTheoryStudents={readTheoryStudents}
          readTheoryAnalytics={readTheoryAnalytics}
        />
      ))}
    </div>
  );
};

export default CommunicationDashboard;
