import { useState, useEffect } from 'react';
import { UserCheck, UserX, Mail, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const UserApprovals = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/pending-approvals');
      setPendingUsers(response.data);
      // notify other parts of the app that pending list changed
      try { window.dispatchEvent(new CustomEvent('pending:changed')); } catch (e) { /* ignore */ }
    } catch (error) {
      toast.error('Failed to fetch pending approvals');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleApproveUser = async (userId, approvedRole) => {
    try {
      // Normalize role: frontend uses 'campus_poc' but backend expects 'campus-poc'
      const normalizedRole = (approvedRole || '').replace('_', '-');
      await api.post('/auth/approve-user', {
        userId,
        approvedRole: normalizedRole
      });
      toast.success('User approved successfully');
      await fetchPendingUsers(); // Refresh the list
      try { window.dispatchEvent(new CustomEvent('pending:changed')); } catch (e) { /* ignore */ }
    } catch (error) {
      toast.error('Failed to approve user');
      console.error('Approval error:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading pending approvals...</span>
        </div>
      </div>
    );
  }

  if (pendingUsers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
          <p className="text-gray-600">No pending user approvals at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <AlertCircle className="h-6 w-6 text-orange-500 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">
            Pending User Approvals ({pendingUsers.length})
          </h2>
        </div>
        <p className="text-gray-600 mt-1">
          Review and approve new user registrations
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {pendingUsers.map((user) => (
          <div key={user._id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {user.firstName[0]}{user.lastName[0]}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Mail className="h-4 w-4 mr-1" />
                      {user.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      Registered: {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-shrink-0 ml-4">
                <div className="flex flex-col space-y-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Requested Role: {user.role.replace('_', ' ').toUpperCase()}
                  </span>
                  
                  <div className="flex space-x-2">
                    {/* Role selection and approval buttons */}
                    <select
                      id={`role-${user._id}`}
                      defaultValue={user.role}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="student">Student</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="campus_poc">Campus PoC</option>
                      <option value="manager">Manager</option>
                    </select>
                    
                    <button
                      onClick={() => {
                        const selectedRole = document.getElementById(`role-${user._id}`).value;
                        handleApproveUser(user._id, selectedRole);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {user.email.includes('@navgurukul.org') && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      NavGurukul Staff Member
                    </h3>
                    <div className="text-sm text-blue-700 mt-1">
                      This user registered with a NavGurukul email address. Consider assigning coordinator or campus_poc role.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserApprovals;