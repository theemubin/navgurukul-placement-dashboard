import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { statsAPI } from '../../services/api';
import { LoadingSpinner } from './UIComponents';
import { TrendingUp, Users, Award, Calendar, ChevronRight, ChevronDown } from 'lucide-react';

const HistoricalCycleCharts = ({ campusId = null, title = "Historical Placement Performance" }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        const response = await statsAPI.getHistoricalCycles(campusId);
        // Reverse to show chronological order in charts (oldest to newest)
        const sortedData = [...(response.data || [])].reverse();
        setData(sortedData);
      } catch (error) {
        console.error('Error fetching historical stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistoricalData();
  }, [campusId]);

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;
  if (!data.length) return (
    <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No historical snapshot data available yet</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
          <TrendingUp className="w-6 h-6 text-primary-600" />
          {title}
        </h2>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-primary-100">
            {data.length} Cycles Recorded
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placement Volume Chart */}
        <div className="card bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Placement Volume per Cycle</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: '800' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }} />
                <Bar name="Total Students" dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar name="Placed" dataKey="placed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Success Rate Trend Chart */}
        <div className="card bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Success Rate Trend (%)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="successRate" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                  name="Success Rate %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Snapshot Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.slice(-4).reverse().map((cycle) => (
          <div key={cycle._id} className="bg-white p-5 rounded-3xl border-2 border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-gray-50 rounded-xl">
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <span className={`px-2 py-1 text-[9px] font-black rounded-lg uppercase ${cycle.successRate > 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {cycle.successRate}% Success
              </span>
            </div>
            <h4 className="text-sm font-black text-gray-900 mb-1">{cycle.name}</h4>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-gray-900">{cycle.placed}</span>
              <span className="text-[10px] font-bold text-gray-400 mb-1.5 uppercase">Placements</span>
            </div>
            <div className="mt-3 flex gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Total Students</span>
                <span className="text-xs font-bold text-gray-700">{cycle.total}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Released</span>
                <span className="text-xs font-bold text-gray-700">{cycle.released}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Table Toggle */}
      <div className="flex justify-center">
        <button 
          onClick={() => setShowTable(!showTable)}
          className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg active:scale-95"
        >
          {showTable ? 'Hide Detailed Table' : 'Show Detailed Snapshot Table'}
          {showTable ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {showTable && (
        <div className="card overflow-hidden border-2 border-gray-100 rounded-3xl animate-slideDown">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cycle Period</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Snapshot Total</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Placed</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Released</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Success Rate</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Goal Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.slice().reverse().map((cycle) => (
                <tr key={cycle._id} className="hover:bg-primary-50/30 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-black text-gray-900">{cycle.name}</span>
                  </td>
                  <td className="py-4 px-6 text-center font-bold text-gray-700">{cycle.total}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full font-black text-xs">
                      {cycle.placed}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center font-bold text-gray-400">{cycle.released}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-black text-primary-600">{cycle.successRate}%</span>
                      <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500" style={{ width: `${cycle.successRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {cycle.targetPlacements > 0 ? (
                      <span className={`text-[10px] font-black uppercase ${cycle.placed >= cycle.targetPlacements ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {cycle.placed >= cycle.targetPlacements ? 'Goal Met' : `${cycle.targetPlacements - cycle.placed} to Goal`}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HistoricalCycleCharts;
