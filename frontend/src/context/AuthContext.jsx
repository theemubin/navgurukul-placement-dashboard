import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Check if we're on a public route first, before attempting authentication
      const pathname = window.location.pathname || '';
      const publicRoutes = ['/auth', '/login', '/register', '/portfolios'];
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

      // If on a public route, skip authentication check and just set loading to false
      if (isPublicRoute) {
        console.debug('Auth init: on public route, skipping auth check');
        setLoading(false);
        return;
      }

      try {
        console.debug('Auth init: document.cookie =>', document.cookie);
        const localToken = localStorage.getItem('token');
        console.debug('Auth init: local token present =>', !!localToken);

        // Prefer cookie-based session (server sets HttpOnly cookie)
        console.debug('Auth init: calling GET /auth/me');
        const response = await authAPI.getMe();
        console.debug('Auth init: /auth/me response =>', response?.status, response?.data);
        if (response?.data) {
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
          setLoading(false);
          return;
        }
      } catch (error) {
        console.warn('Auth init: cookie-based getMe failed:', error?.response?.status, error?.response?.data || error.message);
        // If cookie-based auth fails, fall back to token in localStorage
        const token = localStorage.getItem('token');
        console.debug('Auth init fallback: token present =>', !!token);
        if (token) {
          try {
            console.debug('Auth init fallback: trying getMe with token');
            const response2 = await authAPI.getMe();
            console.debug('Auth init fallback: /auth/me response =>', response2?.status, response2?.data);
            setUser(response2.data);
            localStorage.setItem('user', JSON.stringify(response2.data));
          } catch (err) {
            console.error('Auth init fallback error:', err?.response?.status, err?.response?.data || err.message);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
      setLoading(false);

      // If neither cookie-based getMe nor local token/user yielded a session,
      // redirect to login (we already checked for public routes above)
      try {
        const finalToken = localStorage.getItem('token');
        const finalUser = localStorage.getItem('user');
        if (!finalToken && !finalUser) {
          console.info('Auth init: not authenticated, redirecting to /login');
          window.location.replace('/login');
        }
      } catch (e) {
        // ignore any window/localStorage access errors
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token, user: userData } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { token, user: newUser } = response.data;
    if (token) {
      localStorage.setItem('token', token);
    }
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    }
    return newUser;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.warn('Logout request failed, clearing client state anyway');
    }
    // Clear client state
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);

    // Notify other tabs/windows and ensure UI navigates to login
    window.dispatchEvent(new CustomEvent('auth:logout'));
    // Replace location to avoid adding history entry
    window.location.replace('/login');
  };

  // Listen for cross-tab login events (AuthCallback dispatches a custom event)
  useEffect(() => {
    const onAuthLogin = (e) => {
      if (e?.detail) setUser(e.detail);
    };
    const onAuthLogout = () => {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    };

    window.addEventListener('auth:login', onAuthLogin);
    window.addEventListener('auth:logout', onAuthLogout);
    return () => {
      window.removeEventListener('auth:login', onAuthLogin);
      window.removeEventListener('auth:logout', onAuthLogout);
    };
  }, []);

  const updateUser = (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isStudent: user?.role === 'student',
    isCampusPOC: user?.role === 'campus_poc',
    isCoordinator: user?.role === 'coordinator',
    isManager: user?.role === 'manager'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
