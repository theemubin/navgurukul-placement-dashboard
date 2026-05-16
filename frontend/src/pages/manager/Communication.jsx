import React, { useState, useEffect } from 'react';
import CommunicationDashboard from '../../components/manager/CommunicationDashboard';
import { campusAPI } from '../../services/api';
import { MessageCircle } from 'lucide-react';

const ManagerCommunication = () => {
  const [selectedCampus, setSelectedCampus] = useState('');
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const res = await campusAPI.getCampuses();
        setCampuses(res.data || []);
      } catch (err) {
        console.error('Error fetching campuses:', err);
      }
    };
    fetchCampuses();
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-xl text-primary-600">
              <MessageCircle className="w-6 h-6" />
            </div>
            Communication Dashboard
          </h1>
          <p className="text-gray-500 font-medium mt-1">Track English proficiency and ReadTheory progress across all campuses</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border-2 border-gray-100 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Filter Campus:</span>
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="text-xs font-black uppercase tracking-widest border-none focus:ring-0 bg-transparent cursor-pointer"
          >
            <option value="">All Campuses</option>
            {campuses.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <CommunicationDashboard campusId={selectedCampus} />
    </div>
  );
};

export default ManagerCommunication;
