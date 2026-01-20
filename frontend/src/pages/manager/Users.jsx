import { useState, useEffect } from 'react';
import { userAPI, campusAPI } from '../../services/api';
import { LoadingSpinner, Pagination, Modal } from '../../components/common/UIComponents';
import { Edit, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const roleOptions = ['student', 'campus_poc', 'coordinator', 'manager'];

const UsersManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [campuses, setCampuses] = useState([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userAPI.getUsers({ page: pagination.page, limit: 20, search, role: roleFilter });
      setUsers(res.data.users || []);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      toast.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      const res = await campusAPI.getCampuses();
      setCampuses(res.data || []);
    } catch (err) {
      setCampuses([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCampuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, roleFilter]);

  const handleRoleChange = async (userId, newRole) => {
    const prev = users.slice();
    setUsers(prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
    try {
      await userAPI.updateUser(userId, { role: newRole });
      toast.success('Role updated');
    } catch (err) {
      setUsers(prev);
      toast.error(err?.response?.data?.message || 'Failed to update role');
    }
  };

  const openEdit = async (userId) => {
    try {
      const res = await userAPI.getUser(userId);
      setSelectedUser(res.data.user);
      setShowModal(true);
    } catch (err) {
      toast.error('Error loading user');
    }
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    try {
      const payload = {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        role: selectedUser.role,
        isActive: selectedUser.isActive,
        managedCampuses: selectedUser.managedCampuses?.map(c => c._id) || []
      };
      const res = await userAPI.updateUser(selectedUser._id, payload);
      toast.success('User updated');
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error saving user');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-600 text-sm">Manage users and their roles</p>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-3 items-center">
          <input className="pl-3 py-2 border rounded-md flex-1" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="border rounded-md px-2 py-2">
            <option value="">All roles</option>
            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="py-6 flex items-center justify-center"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="py-2">Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Campus</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="border-t">
                      <td className="py-3">{u.firstName} {u.lastName}</td>
                      <td>{u.email}</td>
                      <td>
                        <select className="border rounded px-2 py-1 text-sm" value={u.role} onChange={(e) => handleRoleChange(u._id, e.target.value)}>
                          {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>{u.campus?.name || (u.managedCampuses && u.managedCampuses.length > 0 ? u.managedCampuses.map(c => c.name).join(', ') : '')}</td>
                      <td>
                        <button className="px-3 py-1 rounded bg-gray-100" onClick={() => openEdit(u._id)} title="Edit user"><Edit className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4">
                <Pagination current={pagination.page} total={pagination.pages} onPageChange={(p) => setPagination({ ...pagination, page: p })} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="User details" size="md">
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500">Name</label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 px-3 py-2 border rounded" value={selectedUser.firstName} onChange={(e) => setSelectedUser(prev => ({ ...prev, firstName: e.target.value }))} />
                <input className="flex-1 px-3 py-2 border rounded" value={selectedUser.lastName} onChange={(e) => setSelectedUser(prev => ({ ...prev, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input className="w-full px-3 py-2 border rounded mt-1" value={selectedUser.email} onChange={(e) => setSelectedUser(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Role</label>
              <select className="w-full px-3 py-2 border rounded mt-1" value={selectedUser.role} onChange={(e) => setSelectedUser(prev => ({ ...prev, role: e.target.value }))}>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Active</label>
              <div className="mt-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!selectedUser.isActive} onChange={(e) => setSelectedUser(prev => ({ ...prev, isActive: e.target.checked }))} /> Active</label>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Managed Campuses (for POC)</label>
              <select multiple className="w-full border rounded p-2 mt-1" value={(selectedUser.managedCampuses || []).map(c => c._id)} onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                setSelectedUser(prev => ({ ...prev, managedCampuses: campuses.filter(c => opts.includes(String(c._id))) }));
              }}>
                {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveUser}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersManager;
