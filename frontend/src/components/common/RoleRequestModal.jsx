import { useState } from 'react';
import { authAPI } from '../../services/api';
import { X, Send, ShieldCheck, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';

const RoleRequestModal = ({ isOpen, onClose, currentUser }) => {
  const [role, setRole] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!role) {
      toast.error('Please select a role');
      return;
    }

    try {
      setIsSubmitting(true);
      await authAPI.requestRole({ role, reason });
      toast.success('Role change request submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Role request error:', error);
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roles = [
    { value: 'campus_poc', label: 'Campus POC', description: 'Manage a specific campus and its students' },
    { value: 'coordinator', label: 'Coordinator', description: 'Oversee multiple campuses and placement cycles' },
    { value: 'manager', label: 'Manager', description: 'Full platform administration access' }
  ].filter(r => r.value !== currentUser?.role);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white shadow-sm text-gray-400 hover:text-gray-600 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 leading-none">Request Role Change</h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Your request will be reviewed by a manager</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Desired Role
            </label>
            <div className="grid gap-3">
              {roles.map((r) => (
                <label 
                  key={r.value}
                  className={`relative flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    role === r.value 
                      ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-50' 
                      : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={(e) => setRole(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <p className={`font-bold text-sm ${role === r.value ? 'text-indigo-900' : 'text-gray-900'}`}>{r.label}</p>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed mt-0.5">{r.description}</p>
                  </div>
                  {role === r.value && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Reason for Request
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need this role? E.g., 'I am the POC for Dharmshala campus'"
              className="w-full h-32 px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none text-sm font-medium placeholder:text-gray-300"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !role}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Request
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RoleRequestModal;
