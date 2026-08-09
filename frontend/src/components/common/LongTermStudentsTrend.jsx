import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { statsAPI } from '../../services/api';
import { LoadingSpinner } from './UIComponents';
import { AlertTriangle, Clock } from 'lucide-react';

// Color palette for campus lines
const CAMPUS_COLORS = [
  '#ef4444', // Red (warning color for stuck students)
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
];

const LongTermStudentsTrend = () => {
  const [data, setData] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await statsAPI.getLongTermStudentsTrend();
        const { chartData, campuses: campusList, description: desc } = response.data.data || {};
        setData(chartData || []);
        setCampuses(campusList || []);
        setDescription(desc || '');
      } catch (error) {
        console.error('Error fetching long-term students trend:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;
  if (!data.length) return (
    <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No long-term student data available yet</p>
    </div>
  );

  // Calculate total current long-term students (last month data)
  const latestMonth = data[data.length - 1];
  const totalCurrent = campuses.reduce((sum, campus) => sum + (latestMonth[campus] || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            Long-Term Students Trend
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">{description}</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-amber-100">
            {totalCurrent} Students Currently
          </span>
        </div>
      </div>

      <div className="card bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">
          Students with &gt;12 Months Tenure (Not Placed) by Campus
        </h3>
        <div className="h-[400px] w-full min-h-[400px]">
          <ResponsiveContainer width="99%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                label={{ 
                  value: 'Students', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 10, fontWeight: 700, fill: '#64748b' }
                }}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                  padding: '12px' 
                }}
                itemStyle={{ fontSize: '12px', fontWeight: '800' }}
              />
              <Legend 
                iconType="line" 
                wrapperStyle={{ 
                  paddingTop: '20px', 
                  fontSize: '10px', 
                  fontWeight: '900', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px' 
                }} 
              />
              {campuses.map((campus, index) => (
                <Line
                  key={campus}
                  type="monotone"
                  dataKey={campus}
                  name={campus}
                  stroke={CAMPUS_COLORS[index % CAMPUS_COLORS.length]}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {campuses.map((campus, index) => {
          const currentCount = latestMonth[campus] || 0;
          const firstMonth = data[0];
          const firstCount = firstMonth[campus] || 0;
          const change = currentCount - firstCount;
          const trend = change > 0 ? '↑' : change < 0 ? '↓' : '→';
          const trendColor = change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-600';
          
          return (
            <div 
              key={campus} 
              className="card bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: CAMPUS_COLORS[index % CAMPUS_COLORS.length] }}
                />
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest truncate">
                  {campus}
                </h4>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-gray-900">{currentCount}</p>
                <p className={`text-[10px] font-bold ${trendColor}`}>
                  {trend} {Math.abs(change)} from 12 months ago
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning Message */}
      <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-wide">Retention Alert</h4>
            <p className="text-xs text-amber-700 mt-1">
              These students have been in the system for over 12 months without placement. 
              Consider additional support, skill development programs, or placement strategy review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LongTermStudentsTrend;
