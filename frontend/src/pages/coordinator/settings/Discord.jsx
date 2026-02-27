import { useState, useEffect } from 'react';
import { userAPI, authAPI } from '../../../services/api';
import { Button } from '../../../components/common/UIComponents';
import { MessageSquare, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const DiscordSettings = () => {
    const [discordData, setDiscordData] = useState({ userId: '', username: '', verified: false });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await authAPI.getMe();
            if (res.data.discord) {
                setDiscordData({
                    userId: res.data.discord.userId || '',
                    username: res.data.discord.username || '',
                    verified: res.data.discord.verified || false
                });
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await userAPI.updateProfile({
                discord: {
                    userId: discordData.userId,
                    username: discordData.username
                }
            });
            toast.success('Discord settings updated');
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update Discord settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-900">
                        <MessageSquare className="w-5 h-5" />
                        Discord Integration
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Configure your Discord account to receive real-time notifications about jobs and applications.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Discord User ID
                            <span className="text-xs text-gray-500 ml-1 font-normal">(Required)</span>
                        </label>
                        <input
                            type="text"
                            value={discordData.userId}
                            onChange={(e) => setDiscordData({ ...discordData, userId: e.target.value })}
                            placeholder="e.g. 748123456789012345"
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Enable Developer Mode in Discord → Right-click profile → Copy User ID
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discord Username</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={discordData.username}
                                onChange={(e) => setDiscordData({ ...discordData, username: e.target.value })}
                                placeholder="e.g. user_name"
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                            {discordData.verified && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 flex items-center gap-1 text-xs font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                    <CheckCircle className="w-3 h-3" /> Verified
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Used for mentions in notifications</p>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button onClick={handleSave} disabled={saving} variant="primary">
                        {saving ? 'Saving...' : 'Save Discord Settings'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DiscordSettings;
