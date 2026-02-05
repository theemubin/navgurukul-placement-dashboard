import { useState, useEffect } from 'react';
import { userAPI, campusAPI } from '../../services/api';
import { LoadingSpinner, Modal } from '../common/UIComponents';
import { UserCog, Building2, Mail, Shield, ShieldCheck, MapPin, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ManagerStaff = () => {
    const [staff, setStaff] = useState([]);
    const [campuses, setCampuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchStaff = async () => {
        try {
            setLoading(true);
            // Fetch all users and filter non-students
            const res = await userAPI.getUsers({ limit: 1000 });
            const allUsers = res.data.users || [];
            const staffMembers = allUsers.filter(u => u.role !== 'student');
            setStaff(staffMembers);
        } catch (err) {
            console.error('Error fetching staff:', err);
            toast.error('Failed to load team members');
        } finally {
            setLoading(false);
        }
    };

    const fetchCampuses = async () => {
        try {
            const res = await campusAPI.getCampuses();
            setCampuses(res.data || []);
        } catch (err) {
            console.error('Error fetching campuses:', err);
        }
    };

    useEffect(() => {
        fetchStaff();
        fetchCampuses();
    }, []);

    const handleEdit = (member) => {
        setSelectedStaff({
            ...member,
            managedCampuses: member.managedCampuses?.map(c => c._id || c) || []
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!selectedStaff) return;
        setSaving(true);
        try {
            await userAPI.updateUser(selectedStaff._id, {
                role: selectedStaff.role,
                managedCampuses: selectedStaff.managedCampuses,
                isActive: selectedStaff.isActive
            });
            toast.success('Staff member updated');
            setShowModal(false);
            fetchStaff();
        } catch (err) {
            console.error('Error saving staff:', err);
            toast.error('Failed to update staff member');
        } finally {
            setSaving(false);
        }
    };

    const toggleCampus = (campusId) => {
        setSelectedStaff(prev => {
            const current = prev.managedCampuses || [];
            if (current.includes(campusId)) {
                return { ...prev, managedCampuses: current.filter(id => id !== campusId) };
            } else {
                return { ...prev, managedCampuses: [...current, campusId] };
            }
        });
    };

    if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Team Management</h3>
                    <p className="text-sm text-gray-500">Manage roles and campus assignments for staff members</p>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-3">Member</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Assigned Campuses</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {staff.map(member => (
                            <tr key={member._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                                            {member.firstName?.[0]}{member.lastName?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {member.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${member.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                        member.role === 'coordinator' ? 'bg-blue-100 text-blue-700' :
                                            'bg-teal-100 text-teal-700'
                                        }`}>
                                        {member.role === 'manager' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                                        {member.role.replace('_', ' ').toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {member.managedCampuses?.length > 0 ? (
                                            member.managedCampuses.map(c => (
                                                <span key={c._id || c} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200">
                                                    {c.name || 'Campus'}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-400 text-xs italic">No campuses assigned</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center w-2 h-2 rounded-full mr-2 ${member.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-sm text-gray-600">{member.isActive ? 'Active' : 'Inactive'}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleEdit(member)} className="text-primary-600 hover:text-primary-900 font-medium text-sm inline-flex items-center gap-1">
                                        <UserCog className="w-4 h-4" />
                                        Manage
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Manage Staff Member" size="md">
                {selectedStaff && (
                    <div className="space-y-6">
                        {/* Staff Info Header */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 to-white border border-primary-100 p-5">
                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-200">
                                    {selectedStaff.firstName?.[0]}{selectedStaff.lastName?.[0]}
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-gray-900 leading-tight">{selectedStaff.firstName} {selectedStaff.lastName}</div>
                                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-primary-500" />
                                        {selectedStaff.email}
                                    </div>
                                </div>
                            </div>
                            {/* Subtle background decoration */}
                            <div className="absolute -right-6 -bottom-6 opacity-5">
                                <UserCog className="w-24 h-24" />
                            </div>
                        </div>

                        <div className="space-y-5 px-1">
                            {/* Role Selection */}
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">System Role</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-lg py-2.5 pl-3 pr-10 appearance-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-sm font-medium"
                                        value={selectedStaff.role}
                                        onChange={(e) => setSelectedStaff(prev => ({ ...prev, role: e.target.value }))}
                                    >
                                        <option value="campus_poc">Campus PoC (Manages specific campuses)</option>
                                        <option value="coordinator">Coordinator (Manages placements/jobs)</option>
                                        <option value="manager">Manager (Full administrative access)</option>
                                        <option value="student">Student (Revoke staff access)</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                {selectedStaff.role === 'student' && (
                                    <div className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-600 bg-amber-50 p-2 rounded-md border border-amber-100">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Crucial: This will revoke all administrative privileges.
                                    </div>
                                )}
                            </div>

                            {/* Campus Assignment */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" />
                                        Campus Access
                                    </label>
                                    <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-bold">
                                        {selectedStaff.managedCampuses?.length || 0} Assigned
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                                    {campuses.map(campus => {
                                        const isChecked = selectedStaff.managedCampuses?.includes(campus._id);
                                        return (
                                            <label
                                                key={campus._id}
                                                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${isChecked
                                                    ? 'bg-white border-primary-200 shadow-sm ring-1 ring-primary-100'
                                                    : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-200'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isChecked ? 'bg-primary-600 text-white' : 'border-2 border-gray-200'
                                                    }`}>
                                                    {isChecked && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={isChecked}
                                                        onChange={() => toggleCampus(campus._id)}
                                                    />
                                                </div>
                                                <span className={`text-[13px] font-medium truncate ${isChecked ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {campus.name}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Account Security/Status */}
                            <div className="pt-2">
                                <label
                                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${selectedStaff.isActive
                                        ? 'bg-green-50/30 border-green-100'
                                        : 'bg-red-50/30 border-red-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedStaff.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                            }`}>
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">Account Active</div>
                                            <div className="text-xs text-gray-500">Allow user to sign in and access the system</div>
                                        </div>
                                    </div>
                                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${selectedStaff.isActive ? 'bg-green-500' : 'bg-gray-200'
                                        }`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedStaff.isActive}
                                            onChange={(e) => setSelectedStaff(prev => ({ ...prev, isActive: e.target.checked }))}
                                        />
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedStaff.isActive ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
                                onClick={() => setShowModal(false)}
                            >
                                Discard
                            </button>
                            <button
                                className="flex-[2] px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Updating...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ManagerStaff;
