import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Mail, Lock, Eye, EyeOff, RefreshCw, Database, Server, Clock, AlertCircle, CheckCircle, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const Login = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const isLocalHost = (typeof window !== 'undefined' && (() => {
    try {
      const h = window.location.hostname || '';
      return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
    } catch (e) {
      return false;
    }
  })());

  // Demo accounts for quick login
  const demoAccounts = [
    { email: "manager@placement.edu", role: "Manager" },
    { email: "coordinator@placement.edu", role: "Coordinator" },
    { email: "poc.jashpur@placement.edu", role: "Campus PoC (Jashpur)" },
    { email: "poc.dharamshala@placement.edu", role: "Campus PoC (Dharamshala)" },
    { email: "john.doe@student.edu", role: "Student (John Doe)" },
    { email: "jane.smith@student.edu", role: "Student (Jane Smith)" },
    { email: "mike.wilson@student.edu", role: "Student (Mike Wilson)" },
    { email: "priya.sharma@student.edu", role: "Student (Priya Sharma)" },
  ];

  // Autofill demo account credentials
  const handleDemoLogin = (demoEmail) => {
    setFormData({ email: demoEmail, password: "password123" });
  };

  // Status checker state
  const [showStatus, setShowStatus] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [productionUri, setProductionUri] = useState('');
  const [syncing, setSyncing] = useState(false);

  const checkHealth = async () => {
    setStatusLoading(true);
    setStatusError(null);
    const startTime = Date.now();
    try {
      const response = await api.get('/health');
      setHealthStatus({
        ...response.data,
        clientLatency: (Date.now() - startTime) + ' ms'
      });
    } catch (err) {
      setStatusError(err.message || 'Failed to connect to server');
      setHealthStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSync = async () => {
    if (!productionUri.trim()) {
      toast.error('Please enter production MongoDB URI');
      return;
    }
    
    setSyncing(true);
    try {
      await api.post('/sync-from-production', { productionUri });
      toast.success('Database synced successfully!');
      setShowSyncModal(false);
      setProductionUri('');
      checkHealth(); // Refresh status
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (showStatus && !healthStatus && !statusLoading) {
      checkHealth();
    }
  }, [showStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(formData.email, formData.password);
      toast.success('Login successful!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <GraduationCap className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Placement Dashboard</h1>
          <p className="text-primary-200 mt-1">Welcome back! Please sign in.</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={() => {
              const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '');
              const authUrl = apiBase.endsWith('/api') ? `${apiBase}/auth/google` : `${apiBase}/api/auth/google`;
              window.location.href = authUrl;
            }}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 font-medium hover:underline">
                Register here
              </Link>
            </p>
          </div>

          {/* Demo Accounts (visible in development only) */}
          {isLocalHost && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 text-center mb-3">Demo Accounts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="demo-login-list mb-4 p-3 bg-gray-50 rounded shadow">
                <div className="font-semibold mb-2">Quick Login (Demo Accounts):</div>
                <ul className="space-y-1">
                  {demoAccounts.map((acc) => (
                    <li key={acc.email}>
                      <button
                        type="button"
                        className="px-3 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm mr-2"
                        onClick={() => handleDemoLogin(acc.email)}
                      >
                        {acc.role}: {acc.email}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 mt-2">Password for all demo accounts: <span className="font-mono">password123</span></div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="font-medium">Student</p>
                <p className="text-gray-500">john.doe@student.edu</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="font-medium">Campus POC</p>
                <p className="text-gray-500">poc.jashpur@placement.edu</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="font-medium">Coordinator</p>
                <p className="text-gray-500">coordinator@placement.edu</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="font-medium">Manager</p>
                <p className="text-gray-500">manager@placement.edu</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">Password: password123</p>
          </div>
          )}
        </div>

        {/* Status & Sync Section */}
        <div className="mt-4 space-y-2">
            <div className="flex gap-2">
            <button
              onClick={() => setShowStatus(!showStatus)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              <Server className="w-4 h-4" />
              {showStatus ? 'Hide Status' : 'Check Status'}
            </button>
            {isLocalHost && (
              <button
                onClick={() => setShowSyncModal(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Sync from Production
              </button>
            )}
          </div>

          {/* Status Panel */}
          {showStatus && (
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-white text-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  System Status
                </h3>
                <button
                  onClick={checkHealth}
                  disabled={statusLoading}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {statusLoading && (
                <div className="text-center py-4 text-primary-200">Checking status...</div>
              )}

              {statusError && (
                <div className="flex items-center gap-2 text-red-300 bg-red-500/20 p-3 rounded">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Connection Failed</p>
                    <p className="text-xs opacity-80">{statusError}</p>
                  </div>
                </div>
              )}

              {healthStatus && (
                <div className="space-y-3">
                  {/* Server Status */}
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Server</span>
                    </div>
                    <span className="text-green-400 text-xs">{healthStatus.status}</span>
                  </div>

                  {/* Database Status */}
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div className="flex items-center gap-2">
                      <Database className={`w-4 h-4 ${healthStatus.database?.status === 'connected' ? 'text-green-400' : 'text-red-400'}`} />
                      <span>Database</span>
                    </div>
                    <div className="text-right text-xs">
                      <p className={healthStatus.database?.status === 'connected' ? 'text-green-400' : 'text-red-400'}>
                        {healthStatus.database?.status}
                      </p>
                      <p className="text-primary-200">{healthStatus.database?.type}</p>
                    </div>
                  </div>

                  {/* Latency */}
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span>Latency</span>
                    </div>
                    <div className="text-right text-xs">
                      <p>Client → Server: <span className="text-yellow-400">{healthStatus.clientLatency}</span></p>
                      <p>Server → DB: <span className="text-yellow-400">{healthStatus.database?.latency || 'N/A'}</span></p>
                    </div>
                  </div>

                  {/* Memory & Uptime */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white/5 rounded">
                      <p className="text-primary-200">Memory</p>
                      <p>{healthStatus.server?.memoryUsage}</p>
                    </div>
                    <div className="p-2 bg-white/5 rounded">
                      <p className="text-primary-200">Uptime</p>
                      <p>{Math.round(healthStatus.server?.uptime / 60)} min</p>
                    </div>
                  </div>

                  {/* DB Name */}
                  <div className="text-xs text-primary-200 text-center">
                    Database: {healthStatus.database?.name || 'Unknown'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sync Modal (localhost only) */}
        {isLocalHost && showSyncModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sync from Production</h3>
              <p className="text-sm text-gray-500 mb-4">
                This will copy all data from production database to your local database.
                <span className="text-red-500 font-medium"> Local data will be replaced!</span>
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Production MongoDB URI
                </label>
                <input
                  type="password"
                  value={productionUri}
                  onChange={(e) => setProductionUri(e.target.value)}
                  placeholder="mongodb+srv://user:pass@cluster..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Find this in Render Dashboard → Environment → MONGODB_URI
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    'Sync Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
