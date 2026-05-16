import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, updateUser } = useAuth();

  const handledRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // prevent double execution (React 18 StrictMode/dev double mount) or duplicate calls
      if (handledRef.current) return;
      handledRef.current = true;

      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        navigate('/login?error=' + error);
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
            updateUser(user);
            // Try to fetch full user from server (using cookie or token) to ensure consistency
            try {
              const meResp = await authAPI.getMe();
              if (meResp?.data) {
                updateUser(meResp.data);
                window.dispatchEvent(new CustomEvent('auth:login', { detail: meResp.data }));
              } else {
                window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
              }
            } catch (err) {
              // If getMe fails, still set the user returned by exchange
              window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
            }

            // Give React a chance to flush auth state before changing routes.
            await new Promise(resolve => setTimeout(resolve, 0));

            const finalRole = (user.role || response?.data?.user?.role);
            switch (finalRole) {
              case 'student':
                navigate('/student');
                break;
              case 'coordinator':
                navigate('/coordinator');
                break;
              case 'campus_poc':
              case 'campus-poc':
                // accept both variants (underscore or hyphen) and normalize to the hyphenated path
                navigate('/campus-poc');
                break;
              case 'manager':
                navigate('/manager');
                break;
              default:
                navigate('/');
            }
          } else {
            console.warn('AuthCallback: exchange returned no user:', response?.data);
            navigate('/auth/login?error=oauth_failed');
          }
        } catch (err) {
          const status = err?.response?.status || 'unknown';
          console.error('Exchange error:', status, err?.response?.data || err.message);
          // Include status to make debugging easier in the UI
          navigate(`/login?error=oauth_failed&status=${status}`);
        }
      } else {
        navigate('/auth/login?error=missing_code');
      }
    };

    handleCallback();
  }, [searchParams, navigate, updateUser]);

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