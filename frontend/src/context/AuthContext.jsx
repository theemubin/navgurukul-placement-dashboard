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
      const pathname = window.location.pathname || '';
      const publicRoutes = ['/auth', '/login', '/register', '/portfolios'];
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

      if (isPublicRoute) {
        console.debug('Auth init: on public route, skipping auth check');
        setLoading(false);
        return;
      }

      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && !user) {
            setUser(parsedUser);
            console.debug('Auth init: restored user from localStorage before validation', parsedUser.email);
          }
        } catch (parseError) {
          console.warn('Auth init: failed to parse stored user', parseError.message);
          localStorage.removeItem('user');
        }
      }

      try {
        console.debug('Auth init: document.cookie =>', document.cookie);
        console.debug('Auth init: local token present =>', !!storedToken);
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
        if (storedToken) {
          try {
            console.debug('Auth init fallback: token present => true');
            const response2 = await authAPI.getMe();
            console.debug('Auth init fallback: /auth/me response =>', response2?.status, response2?.data);
            setUser(response2.data);
            localStorage.setItem('user', JSON.stringify(response2.data));
          } catch (err) {
            console.error('Auth init fallback error:', err?.response?.status, err?.response?.data || err.message);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        } else if (storedUser) {
          // Keep the locally stored user while the session is restored.
          console.debug('Auth init: no token present, keeping stored user until a protected request verifies auth');
        }
      }

      setLoading(false);

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);

    window.dispatchEvent(new CustomEvent('auth:logout'));
    window.location.replace('/login');
  };

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
