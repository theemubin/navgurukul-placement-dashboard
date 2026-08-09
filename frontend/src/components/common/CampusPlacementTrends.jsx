import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { statsAPI } from '../../services/api';
import { LoadingSpinner } from './UIComponents';
import { TrendingUp, Building2 } from 'lucide-react';

// Color palette for campus lines
const CAMPUS_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#14b8a6', // Teal
];

const CampusPlacementTrends = () => {
  const [data, setData] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await statsAPI.getCampusPlacementTrends();
        const { chartData, campuses: campusList } = response.data.data || {};
        setData(chartData || []);
        setCampuses(campusList || []);
      } catch (error) {
        console.error('Error fetching campus placement trends:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  if (loading) return <div className="flex justify-center p-12"><LoadingSpinner /></div>;
  if (!data.length) return (
    <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No placement trend data available yet</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
          <TrendingUp className="w-6 h-6 text-primary-600" />
          Campus-Wise Placement Trends
        </h2>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-black rounded-full uppercase tracking-widest border border-primary-100">
            {campuses.length} Campuses Tracked
          </span>
        </div>
      </div>

      <div className="card bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Monthly Placements by Campus</h3>
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
                  value: 'Placements', 
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
          const totalPlacements = data.reduce((sum, month) => sum + (month[campus] || 0), 0);
          const avgPerMonth = data.length > 0 ? (totalPlacements / data.length).toFixed(1) : 0;
          
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
                <p className="text-2xl font-black text-gray-900">{totalPlacements}</p>
                <p className="text-[10px] text-gray-500 font-bold">
                  Avg: {avgPerMonth}/month
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CampusPlacementTrends;
