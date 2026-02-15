import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import { Plus, Trash2, Globe, Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const PartnerManagement = () => {
    const [partners, setPartners] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newPartner, setNewPartner] = useState({ name: '', logo: '' });
    const [newTestimonial, setNewTestimonial] = useState({
        authorName: '',
        authorRole: '',
        companyName: '',
        companyLogo: '',
        quote: '',
        isActive: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await settingsAPI.getSettings();
            setPartners(response.data.data.hiringPartners || []);
            setTestimonials(response.data.data.testimonials || []);
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load showcase data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPartner = () => {
        if (!newPartner.name || !newPartner.logo) {
            toast.error('Please provide both name and logo URL');
            return;
        }
        setPartners([...partners, newPartner]);
        setNewPartner({ name: '', logo: '' });
    };

    const handleAddTestimonial = () => {
        if (!newTestimonial.authorName || !newTestimonial.quote || !newTestimonial.companyName) {
            toast.error('Please provide at least author name, company, and quote');
            return;
        }
        setTestimonials([...testimonials, newTestimonial]);
        setNewTestimonial({
            authorName: '',
            authorRole: '',
            companyName: '',
            companyLogo: '',
            quote: '',
            isActive: true
        });
    };

    const handleRemovePartner = (index) => {
        setPartners(partners.filter((_, i) => i !== index));
    };

    const handleRemoveTestimonial = (index) => {
        setTestimonials(testimonials.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await settingsAPI.updateSettings({
                hiringPartners: partners,
                testimonials: testimonials
            });
            toast.success('Showcase data updated successfully');
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-12">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Showcase Management</h1>
                    <p className="text-gray-500 text-sm">Manage partners and testimonials for the public portfolios page.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 disabled:opacity-50 transition-all shadow-xl shadow-gray-200"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Publish Changes
                </button>
            </div>

            {/* Hiring Partners Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Hiring Partners</h2>
                    <div className="h-px flex-1 bg-gray-100"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit sticky top-24">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Add New Partner</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Company Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newPartner.name}
                                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Logo URL</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newPartner.logo}
                                    onChange={(e) => setNewPartner({ ...newPartner, logo: e.target.value })}
                                />
                            </div>
                            <button
                                onClick={handleAddPartner}
                                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all"
                            >
                                Add Partner
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {partners.map((partner, index) => (
                            <div key={index} className="group relative bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col items-center justify-center aspect-square overflow-hidden">
                                <div className="h-12 w-full flex items-center justify-center mb-2">
                                    <img src={partner.logo} alt={partner.name} className="max-h-full max-w-full object-contain transition-all" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center truncate w-full">{partner.name}</span>
                                <button
                                    onClick={() => handleRemovePartner(index)}
                                    className="absolute top-2 right-2 p-2 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Testimonials Section */}
            <div className="space-y-6 pt-12 border-t border-gray-100">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Partner Testimonials</h2>
                    <div className="h-px flex-1 bg-gray-100"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-fit">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Create Testimonial</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Author Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newTestimonial.authorName}
                                    onChange={(e) => setNewTestimonial({ ...newTestimonial, authorName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Role / Designation</label>
                                <input
                                    type="text"
                                    placeholder="e.g. CTO"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newTestimonial.authorRole}
                                    onChange={(e) => setNewTestimonial({ ...newTestimonial, authorRole: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Company Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Google"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newTestimonial.companyName}
                                    onChange={(e) => setNewTestimonial({ ...newTestimonial, companyName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Company Logo URL</label>
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={newTestimonial.companyLogo}
                                    onChange={(e) => setNewTestimonial({ ...newTestimonial, companyLogo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">The Quote</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none min-h-[100px]"
                                    value={newTestimonial.quote}
                                    onChange={(e) => setNewTestimonial({ ...newTestimonial, quote: e.target.value })}
                                ></textarea>
                            </div>
                            <button
                                onClick={handleAddTestimonial}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg shadow-blue-100"
                            >
                                Add Testimonial
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-3 space-y-4">
                        {testimonials.map((t, index) => (
                            <div key={index} className="group relative bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500">
                                <div className="text-blue-600 text-4xl font-serif mb-4 leading-none">"</div>
                                <p className="text-gray-600 italic mb-6 leading-relaxed">
                                    {t.quote}
                                </p>
                                <div className="flex items-center gap-4 pt-6 border-t border-gray-50">
                                    {t.companyLogo ? (
                                        <div className="w-12 h-12 rounded-xl bg-gray-50 p-2 flex items-center justify-center border border-gray-100">
                                            <img src={t.companyLogo} alt={t.companyName} className="max-h-full max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center font-black text-blue-600">
                                            {t.companyName[0]}
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-gray-900">{t.authorName}</div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {t.authorRole} @ {t.companyName}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveTestimonial(index)}
                                    className="absolute top-6 right-6 p-2 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}

                        {testimonials.length === 0 && (
                            <div className="py-20 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center text-gray-400">
                                <Plus className="w-12 h-12 mb-4 opacity-10" />
                                <p className="font-medium italic">No testimonials added yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartnerManagement;
