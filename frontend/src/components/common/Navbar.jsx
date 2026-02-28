import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI, questionAPI } from '../../services/api';
import { Menu, Bell, LogOut, ChevronDown, User, MessageCircle, Heart } from 'lucide-react';
import { getNotificationUrl } from '../../utils/notificationUtils';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [forumUnreadCount, setForumUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const initNavbar = async () => {
      await fetchNotifications();
      if (user?.role === 'coordinator') {
        await fetchForumCount();
      }
    };
    initNavbar();

    const interval = setInterval(() => {
      fetchUnreadCount();
      if (user?.role === 'coordinator') fetchForumCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchForumCount = async () => {
    try {
      const response = await questionAPI.getQuestions();
      const count = response.data.filter(q => !q.answer).length;
      setForumUnreadCount(count);
    } catch (error) {
      console.error('Error fetching forum unread count:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getNotifications({ limit: 5 });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    const url = getNotificationUrl(notification, user?.role);
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    setShowNotifications(false);
    if (url) {
      navigate(url);
    }
  };

  const getBasePath = () => {
    const paths = {
      student: '/student',
      campus_poc: '/campus-poc',
      coordinator: '/coordinator',
      manager: '/manager'
    };
    return paths[user?.role] || '/';
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Mobile menu button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="md:hidden flex flex-col items-center gap-0.5">
            <img 
              src="/ng-logo-horizontal.avif" 
              alt="NavGurukul" 
              className="h-6 w-auto object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
            <span className="text-gray-900 font-semibold text-[10px] leading-tight whitespace-nowrap">Placement Dashboard</span>
          </div>
        </div>

        {/* Spacer to keep right alignment */}
        <div className="hidden md:block flex-1" />

        {/* Right section */}
        <div className="flex items-center gap-0.5 md:gap-2">
          {/* Quick Action: Forum (Coordinator only - Mobile Only) */}
          {(user?.role === 'coordinator') && (
            <Link
              to="/coordinator/forum"
              className="p-2 rounded-xl hover:bg-gray-100 relative md:hidden transition-colors"
              title="Q&A Forum"
            >
              <MessageCircle className="w-6 h-6 text-gray-700" />
              {forumUnreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </Link>
          )}

          {/* Quick Action: Interest Requests (POC/Coordinator - Mobile Only) */}
          {(user?.role === 'coordinator' || user?.role === 'campus_poc') && (
            <Link
              to={user?.role === 'coordinator' ? '/coordinator/interest-requests' : '/campus-poc/interest-requests'}
              className="p-2 rounded-xl hover:bg-gray-100 md:hidden transition-colors"
              title="Interest Requests"
            >
              <Heart className="w-6 h-6 text-gray-700" />
            </Link>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-6 h-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  <Link
                    to={`${getBasePath()}/notifications`}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider"
                    onClick={() => setShowNotifications(false)}
                  >
                    View all
                  </Link>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!notif.isRead ? 'bg-indigo-50/50' : ''
                          }`}
                      >
                        <p className="font-bold text-sm text-gray-900">{notif.title}</p>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-tight">
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">No notifications yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 overflow-hidden">
                <span className="font-bold text-sm">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm font-bold text-gray-900">{user?.firstName}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{user?.role?.replace('_', ' ')}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block ml-1" />
            </button>

            {/* User dropdown menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 z-50 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                  <p className="font-bold text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
                </div>
                <div className="p-2">
                  {user?.role === 'student' && (
                    <Link
                      to="/student/profile"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
