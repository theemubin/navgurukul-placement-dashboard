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
        // Backend returns { success: true, data: [...] }
        const rawData = response.data.data || [];
        // Reverse to show chronological order in charts (oldest to newest)
        const sortedData = [...rawData].reverse();
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
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="99%" height="100%">
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
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="99%" height="100%">
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
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: '800' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }} />
                <Area 
                  type="monotone" 
                  dataKey="successRate" 
                  name="Success Rate" 
                  stroke="#6366f1" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical Data Table Toggle */}
      <div className="flex justify-center mt-4">
        <button 
          onClick={() => setShowTable(!showTable)}
          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-100 rounded-2xl text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          {showTable ? (
            <>Hide Historical Data <ChevronDown className="w-4 h-4" /></>
          ) : (
            <>View Detailed Historical Data <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>

      {/* Historical Data Table */}
      {showTable && (
        <div className="card bg-white rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-100">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Cycle Name</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Students</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Placed</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{row.name}</p>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-600">{row.total}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                        {row.placed}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-black text-indigo-600">{row.successRate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalCycleCharts;
