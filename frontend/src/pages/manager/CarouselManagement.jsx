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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hero Carousel Management</h1>
                    <p className="text-gray-500">Manage placements showcased on the public portfolio landing page</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Placement
                </button>
            </div>

            {/* Featured Placements List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-semibold text-gray-900">Showcased Placements ({featured.length})</h2>
                </div>

                {featured.length === 0 ? (
                    <div className="p-12 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 italic">No placements featured yet. Use the button above to add some!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {featured.map((item) => (
                            <div key={item._id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex gap-6">
                                    {/* Hero Image Section */}
                                    <div className="relative group w-48 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                        {item.heroImage ? (
                                            <img
                                                src={`${import.meta.env.VITE_API_URL}${item.heroImage}`}
                                                alt="Hero"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                <ImageIcon className="w-8 h-8 mb-1" />
                                                <span className="text-[10px] text-center px-2">No custom hero image</span>
                                            </div>
                                        )}
                                        <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <Plus className="w-6 h-6 text-white" />
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
                                                <h3 className="font-bold text-lg text-gray-900">
                                                    {item.student?.firstName} {item.student?.lastName}
                                                </h3>
                                                <p className="text-primary-600 font-medium">
                                                    {item.job?.title} at {item.job?.company?.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {editingId === item._id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdate(item._id)}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                        >
                                                            <Save className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
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
                                                                    isActive: item.isActive
                                                                });
                                                            }}
                                                            className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                                                        >
                                                            <Edit2 className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item._id)}
                                                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            {editingId === item._id ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-xs font-semibold text-gray-500 uppercase px-1">Custom Quote / Testimonial</label>
                                                        <textarea
                                                            value={editForm.customQuote}
                                                            onChange={(e) => setEditForm({ ...editForm, customQuote: e.target.value })}
                                                            placeholder="Add a student testimonial..."
                                                            className="w-full mt-1 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`active-${item._id}`}
                                                            checked={editForm.isActive}
                                                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                                                            className="rounded text-primary-600 focus:ring-primary-500"
                                                        />
                                                        <label htmlFor={`active-${item._id}`} className="text-sm text-gray-700">Display in carousel</label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-sm text-gray-600 italic">
                                                        "{item.customQuote || 'Using default placement quote'}"
                                                    </p>
                                                    {!item.isActive && (
                                                        <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase rounded">
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Feature a Placement</h2>
                                <p className="text-sm text-gray-500">Select an accepted student application to add to the hero carousel</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {available.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 italic">No new accepted applications available to feature.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {available.map((app) => (
                                        <div
                                            key={app._id}
                                            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50/50 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                                    {app.student?.avatar ? (
                                                        <img src={app.student.avatar} alt="Student" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-gray-400 font-bold">{app.student?.firstName?.[0]}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{app.student?.firstName} {app.student?.lastName}</h4>
                                                    <p className="text-sm text-gray-500">{app.job?.title} @ {app.job?.company?.name}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleFeature(app._id)}
                                                className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Feature
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarouselManagement;
