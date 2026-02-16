import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './GharIntegration.css';

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
            const response = await fetch('/api/ghar/connection-status', {
                credentials: 'include'
            });
            const data = await response.json();
            setConnectionStatus(data);
        } catch (error) {
            console.error('Error checking connection:', error);
            setConnectionStatus({
                success: false,
                connected: false,
                message: 'Failed to check connection'
            });
        }
    };

    const fetchCampuses = async () => {
        try {
            const response = await fetch('/api/campuses', {
                credentials: 'include'
            });
            const data = await response.json();
            setCampuses(data);
        } catch (error) {
            console.error('Error fetching campuses:', error);
        }
    };

    const handleSyncSingle = async (e) => {
        e.preventDefault();
        if (!studentEmail.trim()) {
            alert('Please enter a student email');
            return;
        }

        setLoading(true);
        setSyncResult(null);

        try {
            const response = await fetch('/api/ghar/sync-student', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email: studentEmail })
            });

            const data = await response.json();
            setSyncResult(data);

            if (data.success) {
                setStudentEmail('');
            }
        } catch (error) {
            console.error('Sync error:', error);
            setSyncResult({
                success: false,
                message: 'Failed to sync student: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleBatchSync = async (e) => {
        e.preventDefault();
        if (!campusId) {
            alert('Please select a campus');
            return;
        }

        setLoading(true);
        setSyncResult(null);

        try {
            const response = await fetch('/api/ghar/batch-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ campusId })
            });

            const data = await response.json();
            setSyncResult(data);
        } catch (error) {
            console.error('Batch sync error:', error);
            setSyncResult({
                success: false,
                message: 'Failed to batch sync: ' + error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendanceConfig = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/ghar/attendance-config?isDev=true', {
                credentials: 'include'
            });
            const data = await response.json();
            setAttendanceConfig(data);
        } catch (error) {
            console.error('Error fetching attendance config:', error);
            setAttendanceConfig({
                success: false,
                message: 'Failed to fetch attendance configuration'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ghar-integration">
            <div className="page-header">
                <h1>Ghar Dashboard Integration</h1>
                <p className="subtitle">Sync student data from Ghar Dashboard (Zoho) platform</p>
            </div>

            {/* Connection Status */}
            <div className={`connection-status ${connectionStatus?.connected ? 'connected' : 'disconnected'}`}>
                <div className="status-indicator">
                    <span className={`status-dot ${connectionStatus?.connected ? 'active' : 'inactive'}`}></span>
                    <span className="status-text">
                        {connectionStatus?.connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <p className="status-message">{connectionStatus?.message}</p>
                <button
                    onClick={checkConnection}
                    className="btn-secondary"
                    disabled={loading}
                >
                    Refresh Status
                </button>
            </div>

            {connectionStatus?.connected && (
                <>
                    {/* Sync Type Selector */}
                    <div className="sync-type-selector">
                        <button
                            className={`tab-btn ${syncType === 'single' ? 'active' : ''}`}
                            onClick={() => setSyncType('single')}
                        >
                            Sync Single Student
                        </button>
                        <button
                            className={`tab-btn ${syncType === 'batch' ? 'active' : ''}`}
                            onClick={() => setSyncType('batch')}
                        >
                            Batch Sync Campus
                        </button>
                        <button
                            className={`tab-btn ${syncType === 'attendance' ? 'active' : ''}`}
                            onClick={() => setSyncType('attendance')}
                        >
                            Attendance Config
                        </button>
                    </div>

                    {/* Single Student Sync */}
                    {syncType === 'single' && (
                        <div className="sync-section">
                            <h2>Sync Single Student</h2>
                            <form onSubmit={handleSyncSingle} className="sync-form">
                                <div className="form-group">
                                    <label htmlFor="studentEmail">Student Email</label>
                                    <input
                                        type="email"
                                        id="studentEmail"
                                        value={studentEmail}
                                        onChange={(e) => setStudentEmail(e.target.value)}
                                        placeholder="student@navgurukul.org"
                                        disabled={loading}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Syncing...' : 'Sync Student'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Batch Sync */}
                    {syncType === 'batch' && (
                        <div className="sync-section">
                            <h2>Batch Sync Campus Students</h2>
                            <form onSubmit={handleBatchSync} className="sync-form">
                                <div className="form-group">
                                    <label htmlFor="campus">Select Campus</label>
                                    <select
                                        id="campus"
                                        value={campusId}
                                        onChange={(e) => setCampusId(e.target.value)}
                                        disabled={loading}
                                    >
                                        <option value="">-- Select Campus --</option>
                                        {campuses.map(campus => (
                                            <option key={campus._id} value={campus._id}>
                                                {campus.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Syncing...' : 'Sync All Students'}
                                </button>
                            </form>
                            <div className="info-box">
                                <p>⚠️ This will sync all students from the selected campus. This may take a while.</p>
                            </div>
                        </div>
                    )}

                    {/* Attendance Configuration */}
                    {syncType === 'attendance' && (
                        <div className="sync-section">
                            <h2>Attendance Configuration</h2>
                            <button
                                onClick={fetchAttendanceConfig}
                                className="btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Fetching...' : 'Fetch Attendance Config'}
                            </button>

                            {attendanceConfig && (
                                <div className="config-result">
                                    <h3>Configuration Data:</h3>
                                    <pre>{JSON.stringify(attendanceConfig, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sync Results */}
                    {syncResult && (
                        <div className={`sync-result ${syncResult.success ? 'success' : 'error'}`}>
                            <h3>{syncResult.success ? '✓ Success' : '✗ Error'}</h3>
                            <p>{syncResult.message}</p>

                            {syncResult.summary && (
                                <div className="sync-summary">
                                    <h4>Sync Summary:</h4>
                                    <ul>
                                        <li>Total: {syncResult.summary.total}</li>
                                        <li>Successful: {syncResult.summary.successful}</li>
                                        <li>Failed: {syncResult.summary.failed}</li>
                                    </ul>
                                </div>
                            )}

                            {syncResult.results && (
                                <div className="detailed-results">
                                    <h4>Detailed Results:</h4>
                                    <div className="results-table">
                                        {syncResult.results.map((result, index) => (
                                            <div key={index} className={`result-row ${result.success ? 'success' : 'error'}`}>
                                                <span className="email">{result.email}</span>
                                                <span className="status">
                                                    {result.success ? '✓ Synced' : `✗ ${result.error}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {syncResult.data && syncResult.data.student && (
                                <div className="student-info">
                                    <h4>Student Information:</h4>
                                    <p><strong>Name:</strong> {syncResult.data.student.name}</p>
                                    <p><strong>Email:</strong> {syncResult.data.student.email}</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {!connectionStatus?.connected && (
                <div className="setup-instructions">
                    <h2>Setup Required</h2>
                    <div className="instructions-box">
                        <h3>To connect to Ghar Dashboard API:</h3>
                        <ol>
                            <li>Obtain an API token from Ghar platform</li>
                            <li>Add the token to your backend <code>.env</code> file:
                                <pre>NAVGURUKUL_API_TOKEN=your_token_here</pre>
                            </li>
                            <li>Restart your backend server</li>
                            <li>Refresh this page to check connection status</li>
                        </ol>
                        <p>
                            For detailed instructions, see the{' '}
                            <a href="/GHAR_API_INTEGRATION.md" target="_blank">
                                integration documentation
                            </a>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GharIntegration;
