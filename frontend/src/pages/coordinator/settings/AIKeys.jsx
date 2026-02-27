import { useState, useEffect } from 'react';
import { userAPI } from '../../../services/api';
import { LoadingSpinner } from '../../../components/common/UIComponents';
import { Key, Trash2, CheckCircle, XCircle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const AIKeysSettings = () => {
    const [aiKeys, setAiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddKey, setShowAddKey] = useState(false);
    const [newKey, setNewKey] = useState({ key: '', label: '' });

    useEffect(() => {
        fetchAIKeys();
    }, []);

    const fetchAIKeys = async () => {
        try {
            setLoading(true);
            const response = await userAPI.getAIKeys();
            setAiKeys(response.data.keys || []);
        } catch (error) {
            toast.error('Failed to load AI keys');
        } finally {
            setLoading(false);
        }
    };

    const handleAddKey = async () => {
        if (!newKey.key.trim()) {
            toast.error('API key is required');
            return;
        }
        try {
            setSaving(true);
            const response = await userAPI.addAIKey({
                key: newKey.key.trim(),
                label: newKey.label.trim() || `Key ${aiKeys.length + 1}`
            });
            setAiKeys(response.data.keys);
            setNewKey({ key: '', label: '' });
            setShowAddKey(false);
            toast.success('API key added successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add API key');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (keyId, isActive) => {
        try {
            const response = await userAPI.updateAIKey(keyId, { isActive: !isActive });
            setAiKeys(response.data.keys);
            toast.success(isActive ? 'Key disabled' : 'Key enabled');
        } catch (error) {
            toast.error('Failed to update key status');
        }
    };

    const handleDeleteKey = async (keyId) => {
        if (!confirm('Are you sure you want to delete this API key?')) return;
        try {
            const response = await userAPI.deleteAIKey(keyId);
            setAiKeys(response.data.keys);
            toast.success('API key deleted');
        } catch (error) {
            toast.error('Failed to delete API key');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Key className="w-5 h-5 text-purple-600" />
                            Your AI API Keys
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Add your personal Google AI API keys to use for JD parsing. Your keys are tried first before global keys.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddKey(!showAddKey)}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Key
                    </button>
                </div>

                {showAddKey && (
                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h3 className="text-sm font-medium text-purple-900 mb-3">Add New API Key</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key *</label>
                                <input
                                    type="password"
                                    value={newKey.key}
                                    onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                                    placeholder="AIzaSy..."
                                    className="w-full"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Get your free API key from{' '}
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        Google AI Studio
                                    </a>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Label (Optional)</label>
                                <input
                                    type="text"
                                    value={newKey.label}
                                    onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                                    placeholder="e.g., Primary, Backup"
                                    className="w-full"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleAddKey} disabled={saving || !newKey.key.trim()} className="btn btn-primary">
                                    {saving ? 'Adding...' : 'Add Key'}
                                </button>
                                <button onClick={() => { setShowAddKey(false); setNewKey({ key: '', label: '' }); }} className="btn btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {aiKeys.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No API keys added yet</p>
                        <p className="text-sm mt-1">Add your first key to enable AI-powered JD parsing</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {aiKeys.map((key) => (
                            <div
                                key={key._id}
                                className={`p-4 rounded-lg border-2 flex items-center justify-between ${key.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${key.isActive ? 'bg-green-200' : 'bg-gray-200'}`}>
                                        {key.isActive ? <CheckCircle className="w-5 h-5 text-green-700" /> : <XCircle className="w-5 h-5 text-gray-500" />}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{key.label}</div>
                                        <div className="text-sm text-gray-600 font-mono">{key.keyPreview}</div>
                                        <div className="text-xs text-gray-500">Added {new Date(key.addedAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleActive(key._id, key.isActive)}
                                        className={`px-3 py-1 rounded text-sm ${key.isActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                    >
                                        {key.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                    <button onClick={() => handleDeleteKey(key._id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                    <strong>💡 Priority:</strong> When parsing JDs, your personal API keys are tried first. If they fail (quota/error), the system falls back to global keys configured by managers.
                    <br />
                    <strong>Limit:</strong> You can add up to 5 API keys.
                </div>
            </div>
        </div>
    );
};

export default AIKeysSettings;
