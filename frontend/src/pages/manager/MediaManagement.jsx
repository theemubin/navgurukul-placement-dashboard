import { useState } from 'react';
import CarouselManagement from './CarouselManagement';
import LoginBackgrounds from './LoginBackgrounds';
import { ImageIcon, Layout, Image as ImageIcon2 } from 'lucide-react';

const MediaManagement = () => {
  const [activeTab, setActiveTab] = useState('carousel');

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Assets</h1>
          <p className="text-gray-600">Manage the hero carousel and login page backgrounds</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('carousel')}
          className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'carousel'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layout className="w-4 h-4" />
          Hero Carousel
        </button>
        <button
          onClick={() => setActiveTab('backgrounds')}
          className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'backgrounds'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ImageIcon2 className="w-4 h-4" />
          Login Backgrounds
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        {activeTab === 'carousel' ? (
          <CarouselManagement />
        ) : (
          <LoginBackgrounds />
        )}
      </div>
    </div>
  );
};

export default MediaManagement;
