import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { gharAPI } from '../../services/api';

const GharSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await gharAPI.getSyncStatus();
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const response = await gharAPI.dailyBulkSync();
      
      if (response.data.alreadySynced) {
        alert('Data already synced today! Next sync available tomorrow.');
      } else {
        alert(`Sync completed! ${response.data.summary.successful} students synced successfully.`);
      }
      
      // Refresh status
      await fetchSyncStatus();
    } catch (error) {
      console.error('Error triggering sync:', error);
      alert('Failed to sync data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading sync status...</div>;

  const lastSyncDate = syncStatus?.lastSyncDate ? new Date(syncStatus.lastSyncDate) : null;
  const syncedToday = syncStatus?.syncedToday;

  return (
    <div className="card bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Ghar Data Sync
        </h3>
        {syncedToday ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-600" />
        )}
      </div>

      <div className="space-y-2">
        {lastSyncDate ? (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              Last synced: {lastSyncDate.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Never synced</p>
        )}

        {syncedToday ? (
          <div className="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold">
            ✓ Data is up to date
          </div>
        ) : (
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-black uppercase tracking-wide hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          Auto-syncs on first login each day
        </p>
      </div>
    </div>
  );
};

export default GharSyncStatus;
