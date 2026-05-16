import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { gharAPI, campusAPI } from '../../services/api';
import toast from 'react-hot-toast';

const GharIntegration = () => {
    const { user } = useAuth();
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncType, setSyncType] = useState('single'); // 'single' or 'batch'
    const [studentEmail, setStudentEmail] = useState('');
    const [campusId, setCampusId] = useState('');
    const [campuses, setCampuses] = useState([]);
    const [syncResult, setSyncResult] = useState(null);
    const [attendanceConfig, setAttendanceConfig] = useState(null);

    useEffect(() => {
        checkConnection();
        fetchCampuses();
    }, []);

    const checkConnection = async () => {
        try {
            setLoading(true);
            const response = await gharAPI.connectionStatus();
            setConnectionStatus(response.data);
        } catch (error) {
            console.error('Error checking connection:', error);
            setConnectionStatus({
                success: false,
                connected: false,
                message: error.response?.data?.message || 'Failed to check connection'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchCampuses = async () => {
        try {
            const response = await campusAPI.getCampuses();
            setCampuses(response.data);
        } catch (error) {
            console.error('Error fetching campuses:', error);
            toast.error('Failed to load campuses');
        }
    };

    const handleSyncSingle = async (e) => {
        e.preventDefault();
        if (!studentEmail.trim()) {
            toast.error('Please enter a student email');
            return;
        }

        setLoading(true);
        setSyncResult(null);

        try {
            const response = await gharAPI.syncStudent(studentEmail);
            setSyncResult(response.data);
            if (response.data.success) {
                toast.success('Student synced successfully');
                setStudentEmail('');
            }
        } catch (error) {
            console.error('Sync error:', error);
            setSyncResult({
                success: false,
                message: error.response?.data?.message || 'Failed to sync student'
            });
            toast.error('Sync failed');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchSync = async (e) => {
        e.preventDefault();
        if (!campusId) {
            toast.error('Please select a campus');
            return;
        }

        setLoading(true);
        setSyncResult(null);

        try {
            const response = await gharAPI.batchSync(campusId);
            setSyncResult(response.data);
            toast.success('Batch sync completed');
        } catch (error) {
            console.error('Batch sync error:', error);
            setSyncResult({
                success: false,
                message: error.response?.data?.message || 'Failed to batch sync'
            });
            toast.error('Batch sync failed');
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendanceConfig = async () => {
        setLoading(true);
        try {
            const response = await gharAPI.getAttendanceConfig(true);
            setAttendanceConfig(response.data);
            toast.success('Config fetched');
        } catch (error) {
            console.error('Error fetching attendance config:', error);
            setAttendanceConfig({
                success: false,
                message: error.response?.data?.message || 'Failed to fetch attendance configuration'
            });
            toast.error('Fetch failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Connection Status Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        connectionStatus?.connected 
                        ? 'bg-green-50 text-green-700' 
                        : 'bg-red-50 text-red-700'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${connectionStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        {connectionStatus?.connected ? 'Ghar API Connected' : 'Ghar API Disconnected'}
                    </div>
                    {!connectionStatus?.connected && (
                        <button 
                            onClick={checkConnection}
                            className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                        >
                            Retry Connection
                        </button>
                    )}
                </div>
            </div>

            {connectionStatus?.connected ? (
                <div className="space-y-8 animate-fadeIn">
                    {/* Sync Type Selector */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                        {[
                            { id: 'single', label: 'Single Student' },
                            { id: 'batch', label: 'Batch Sync' },
                            { id: 'attendance', label: 'Attendance' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSyncType(tab.id)}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                    syncType === tab.id 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Single Student Sync */}
                    {syncType === 'single' && (
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Sync Single Student</h2>
                            <form onSubmit={handleSyncSingle} className="flex gap-4">
                                <div className="flex-1">
                                    <input
                                        type="email"
                                        value={studentEmail}
                                        onChange={(e) => setStudentEmail(e.target.value)}
                                        placeholder="student@navgurukul.org"
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-8 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Syncing...' : 'Sync Student'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Batch Sync */}
                    {syncType === 'batch' && (
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">Batch Sync Campus</h2>
                            <p className="text-xs text-gray-500 font-medium mb-6">Sync all student profiles for a specific campus from Ghar</p>
                            <form onSubmit={handleBatchSync} className="flex gap-4">
                                <div className="flex-1">
                                    <select
                                        value={campusId}
                                        onChange={(e) => setCampusId(e.target.value)}
                                        disabled={loading}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Select Campus</option>
                                        {campuses.map(campus => (
                                            <option key={campus._id} value={campus._id}>
                                                {campus.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    className="px-8 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Syncing...' : 'Sync All'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Attendance Configuration */}
                    {syncType === 'attendance' && (
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Attendance Config</h2>
                            <button
                                onClick={fetchAttendanceConfig}
                                className="w-full py-4 bg-gray-50 text-gray-900 border border-gray-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all"
                                disabled={loading}
                            >
                                {loading ? 'Fetching...' : 'Fetch Configuration from Ghar'}
                            </button>

                            {attendanceConfig && (
                                <div className="mt-6 p-4 bg-gray-900 rounded-2xl overflow-x-auto">
                                    <pre className="text-[10px] text-green-400 font-mono leading-relaxed">
                                        {JSON.stringify(attendanceConfig, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sync Results */}
                    {syncResult && (
                        <div className={`rounded-3xl p-6 border ${syncResult.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <h3 className={`text-sm font-black uppercase tracking-widest mb-2 ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                {syncResult.success ? '✓ Sync Completed' : '✗ Sync Failed'}
                            </h3>
                            <p className="text-sm font-medium opacity-80 mb-4">{syncResult.message}</p>

                            {syncResult.summary && (
                                <div className="flex gap-8 border-t border-black/5 pt-4">
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Total</p>
                                        <p className="text-lg font-black">{syncResult.summary.total}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-green-600">Success</p>
                                        <p className="text-lg font-black text-green-700">{syncResult.summary.successful}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-red-600">Failed</p>
                                        <p className="text-lg font-black text-red-700">{syncResult.summary.failed}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="w-4 h-4 bg-red-500 rounded-full"></span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2">Integration Inactive</h2>
                    <p className="text-gray-500 text-sm max-w-md mx-auto mb-8">
                        The Ghar Dashboard integration is currently not configured or cannot be reached.
                    </p>
                    
                    <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-6 text-left border border-gray-100">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Setup Requirements</h3>
                        <ul className="space-y-3 text-xs text-gray-600 font-medium">
                            <li className="flex gap-3">
                                <span className="text-blue-600">01.</span>
                                <span>Add <code>NAVGURUKUL_API_TOKEN</code> to your <code>.env</code> file.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-600">02.</span>
                                <span>Ensure the backend server is restarted after changes.</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-blue-600">03.</span>
                                <span>Verify your network can reach the Zoho API endpoints.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GharIntegration;
