import { useState, useEffect } from 'react';
import { featuredPlacementAPI } from '../../services/api';
import {
    Plus, Edit2, Trash2, GripVertical, Image as ImageIcon,
    Check, X, Save, AlertCircle, ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const CarouselManagement = () => {
    const [featured, setFeatured] = useState([]);
    const [available, setAvailable] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({
        customQuote: '',
        isActive: true
    });
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [featuredRes, availableRes] = await Promise.all([
                featuredPlacementAPI.getFeaturedPlacements(),
                featuredPlacementAPI.getAvailablePlacements()
            ]);
            setFeatured(featuredRes.data.featuredPlacements || []);
            setAvailable(availableRes.data.applications || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load seasonal placements');
        } finally {
            setLoading(false);
        }
    };

    const handleFeature = async (applicationId) => {
        try {
            await featuredPlacementAPI.createFeaturedPlacement({ applicationId });
            toast.success('Placement added to carousel');
            fetchData();
            setShowAddModal(false);
        } catch (error) {
            toast.error('Failed to feature placement');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this placement from the hero carousel?')) return;
        try {
            await featuredPlacementAPI.deleteFeaturedPlacement(id);
            toast.success('Removed from carousel');
            fetchData();
        } catch (error) {
            toast.error('Failed to remove placement');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await featuredPlacementAPI.updateFeaturedPlacement(id, editForm);
            toast.success('Updated successfully');
            setEditingId(null);
            fetchData();
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const handleImageUpload = async (id, file) => {
        try {
            const formData = new FormData();
            formData.append('heroImage', file);
            await featuredPlacementAPI.uploadHeroImage(id, file);
            toast.success('Hero image updated');
            fetchData();
        } catch (error) {
            toast.error('Failed to upload image');
        }
    };

    const [addTab, setAddTab] = useState('system');
    const [manualForm, setManualForm] = useState({
        manualStudentName: '',
        manualJobTitle: '',
        manualCompanyName: '',
        manualStudentAvatar: '',
        manualPackage: '',
        manualCampus: '',
        manualBatch: '',
        customQuote: ''
    });

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        try {
            await featuredPlacementAPI.createFeaturedPlacement({
                ...manualForm,
                isManual: true
            });
            toast.success('Manual placement added');
            fetchData();
            setShowAddModal(false);
            setManualForm({
                manualStudentName: '',
                manualJobTitle: '',
                manualCompanyName: '',
                manualStudentAvatar: '',
                manualPackage: '',
                manualCampus: '',
                manualBatch: '',
                customQuote: ''
            });
        } catch (error) {
            toast.error('Failed to add manual placement');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Hero Carousel Management</h1>
                    <p className="text-gray-500 text-sm">Manage placements showcased on the public portfolio landing page</p>
                </div>
                <button
                    onClick={() => {
                        setShowAddModal(true);
                        setAddTab('system');
                    }}
                    className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg"
                >
                    <Plus className="w-4 h-4" />
                    Add Placement
                </button>
            </div>

            {/* Featured Placements List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h2 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Showcased Placements ({featured.length})</h2>
                </div>

                {featured.length === 0 ? (
                    <div className="p-20 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No placements featured yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {featured.map((item) => (
                            <div key={item._id} className="p-6 hover:bg-gray-50/50 transition-colors">
                                <div className="flex gap-8">
                                    {/* Hero Image Section */}
                                    <div className="relative group w-64 h-36 flex-shrink-0 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                                        {item.heroImage ? (
                                            <img
                                                src={item.heroImage.startsWith('http') ? item.heroImage : `${import.meta.env.VITE_API_URL}${item.heroImage}`}
                                                alt="Hero"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-white">
                                                <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-center px-4">No custom hero image</span>
                                            </div>
                                        )}
                                        <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[2px]">
                                            <ImageIcon className="w-8 h-8 text-white mb-2" />
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Update Hero BG</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(item._id, e.target.files[0])}
                                            />
                                        </label>
                                    </div>

                                    {/* Student & Job Info */}
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                                                    {item.manualStudentName || (item.student ? `${item.student.firstName} ${item.student.lastName}` : 'Unknown Student')}
                                                </h3>
                                                <p className="text-blue-600 font-bold uppercase tracking-widest text-[11px] mt-1">
                                                    {item.manualJobTitle || item.job?.title} @ {item.manualCompanyName || item.job?.company?.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingId === item._id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdate(item._id)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        >
                                                            <Save className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(item._id);
                                                                setEditForm({
                                                                    customQuote: item.customQuote || '',
                                                                    isActive: item.isActive,
                                                                    heroImage: item.heroImage || ''
                                                                });
                                                            }}
                                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item._id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            {editingId === item._id ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Custom Quote / Testimonial</label>
                                                        <textarea
                                                            value={editForm.customQuote}
                                                            onChange={(e) => setEditForm({ ...editForm, customQuote: e.target.value })}
                                                            placeholder="Add a student testimonial..."
                                                            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none shadow-sm"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Hero Image URL (Optional)</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={editForm.heroImage || ''}
                                                                onChange={(e) => setEditForm({ ...editForm, heroImage: e.target.value })}
                                                                placeholder="Paste direct image link (e.g. from Drive/Cloudinary)..."
                                                                className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 transition-all font-medium shadow-sm"
                                                            />
                                                            {editForm.heroImage && (
                                                                <a
                                                                    href={editForm.heroImage}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors"
                                                                    title="Preview Link"
                                                                >
                                                                    <ExternalLink className="w-5 h-5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                        <p className="mt-2 text-[10px] text-gray-400 font-medium">
                                                            * Google Drive links usually don't work directly. Use a direct image hosting link for best results.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={editForm.isActive}
                                                                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                            <span className="ml-3 text-[10px] font-black text-gray-600 uppercase tracking-widest">Active in Carousel</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-gray-600 font-medium italic leading-relaxed">
                                                        "{item.customQuote || 'No testimonial added yet...'}"
                                                    </p>
                                                    {!item.isActive && (
                                                        <span className="inline-flex mt-3 px-3 py-1 bg-yellow-50 text-yellow-700 text-[9px] font-black uppercase tracking-widest border border-yellow-100 rounded-lg">
                                                            Hidden from public view
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Placement Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-1">Feature a Success</h2>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Add an impactful placement to the front page</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="flex border-b border-gray-100 bg-gray-50/30">
                            <button
                                onClick={() => setAddTab('system')}
                                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${addTab === 'system' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Existing System
                            </button>
                            <button
                                onClick={() => setAddTab('manual')}
                                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${addTab === 'manual' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Manual Entry
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto no-scrollbar">
                            {addTab === 'system' ? (
                                available.length === 0 ? (
                                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                                        <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No new system placements available.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {available.map((app) => (
                                            <div
                                                key={app._id}
                                                className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group cursor-pointer"
                                                onClick={() => handleFeature(app._id)}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center overflow-hidden ring-4 ring-gray-50">
                                                        {app.student?.avatar ? (
                                                            <img src={app.student.avatar} alt="Student" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white text-lg font-black uppercase">{app.student?.firstName?.[0]}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight">{app.student?.firstName} {app.student?.lastName}</h4>
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{app.job?.title} · {app.job?.company?.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Feature</span>
                                                    <Check className="w-5 h-5 text-gray-200 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <form onSubmit={handleManualSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Student Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={manualForm.manualStudentName}
                                                onChange={(e) => setManualForm({ ...manualForm, manualStudentName: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. Priyanshu Maurya"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Job Title</label>
                                            <input
                                                required
                                                type="text"
                                                value={manualForm.manualJobTitle}
                                                onChange={(e) => setManualForm({ ...manualForm, manualJobTitle: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. SDE-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Company Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={manualForm.manualCompanyName}
                                                onChange={(e) => setManualForm({ ...manualForm, manualCompanyName: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. Google"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Profile Photo URL</label>
                                            <input
                                                type="url"
                                                value={manualForm.manualStudentAvatar}
                                                onChange={(e) => setManualForm({ ...manualForm, manualStudentAvatar: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Package (LPA)</label>
                                            <input
                                                type="text"
                                                value={manualForm.manualPackage}
                                                onChange={(e) => setManualForm({ ...manualForm, manualPackage: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. 12"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Campus</label>
                                            <input
                                                type="text"
                                                value={manualForm.manualCampus}
                                                onChange={(e) => setManualForm({ ...manualForm, manualCampus: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. Pune"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Batch</label>
                                            <input
                                                type="text"
                                                value={manualForm.manualBatch}
                                                onChange={(e) => setManualForm({ ...manualForm, manualBatch: e.target.value })}
                                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                                placeholder="e.g. 2024"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Testimonial Quote</label>
                                        <textarea
                                            value={manualForm.customQuote}
                                            onChange={(e) => setManualForm({ ...manualForm, customQuote: e.target.value })}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all font-medium h-32 resize-none"
                                            placeholder="What did the student say?"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-5 bg-gray-950 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black transition-all shadow-xl"
                                    >
                                        Create Manual Placement
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarouselManagement;
