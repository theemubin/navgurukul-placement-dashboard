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
      try {
        // Prefer cookie-based session (server sets HttpOnly cookie)
        const response = await authAPI.getMe();
        if (response?.data) {
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
          setLoading(false);
          return;
        }
      } catch (error) {
        // If cookie-based auth fails, fall back to token in localStorage
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const response2 = await authAPI.getMe();
            setUser(response2.data);
            localStorage.setItem('user', JSON.stringify(response2.data));
          } catch (err) {
            console.error('Auth init fallback error:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      }
      setLoading(false);
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
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
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
