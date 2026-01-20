import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        navigate('/auth/login?error=' + error);
        return;
      }

      if (code) {
        try {
          console.debug('AuthCallback: code found, document.cookie:', document.cookie);
          console.debug('AuthCallback: exchanging code:', code);
          const response = await authAPI.exchange(code);
          console.debug('AuthCallback: exchange response =>', response?.status, response?.data);

          // Server sets HttpOnly cookie; response includes user info and (temporary) token
          const user = response.data.user;
          const token = response.data.token;

          if (token) {
            console.debug('AuthCallback: storing returned token for fallback auth');
            localStorage.setItem('token', token);
            // Also set default Authorization header for immediate API calls
            try {
              // import api dynamically to avoid circular imports
              const apiModule = await import('../../services/api');
              apiModule.default.defaults.headers.Authorization = `Bearer ${token}`;
            } catch (e) {
              console.warn('AuthCallback: failed to set api default header', e.message);
            }
          }

          // Prefer using the authoritative user object from exchange response.
          if (user) {
            localStorage.setItem('user', JSON.stringify(user));
            // Try to fetch full user from server (using cookie or token) to ensure consistency
            try {
              const meResp = await authAPI.getMe();
              if (meResp?.data) {
                window.dispatchEvent(new CustomEvent('auth:login', { detail: meResp.data }));
              } else {
                window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
              }
            } catch (err) {
              // If getMe fails, still set the user returned by exchange
              window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
            }

            // Redirect based on role
            const finalRole = (user.role || response?.data?.user?.role);
            switch (finalRole) {
              case 'student':
                navigate('/student/dashboard');
                break;
              case 'coordinator':
                navigate('/coordinator/dashboard');
                break;
              case 'campus_poc':
                navigate('/campus-poc/dashboard');
                break;
              case 'manager':
                navigate('/manager/dashboard');
                break;
              default:
                navigate('/');
            }
          } else {
            console.warn('AuthCallback: exchange returned no user:', response?.data);
            navigate('/auth/login?error=oauth_failed');
          }
        } catch (err) {
          console.error('Exchange error:', err?.response?.status, err?.response?.data || err.message);
          navigate('/auth/login?error=oauth_failed');
        }
      } else {
        navigate('/auth/login?error=missing_code');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Signing you in...
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;