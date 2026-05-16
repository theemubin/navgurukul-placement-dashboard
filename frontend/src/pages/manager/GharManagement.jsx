import { useState } from 'react';
import GharIntegration from './GharIntegration';
import GharDataViewer from './GharDataViewer';
import { Database, Search, Settings } from 'lucide-react';

const GharManagement = () => {
  const [activeTab, setActiveTab] = useState('integration');

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ghar Dashboard Management</h1>
          <p className="text-gray-600">Configure sync settings and explore raw data from the Ghar (Zoho) platform</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('integration')}
          className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'integration'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          Sync & Integration
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'explorer'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-4 h-4" />
          Data Explorer
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        {activeTab === 'integration' ? (
          <GharIntegration />
        ) : (
          <GharDataViewer />
        )}
      </div>
    </div>
  );
};

export default GharManagement;
