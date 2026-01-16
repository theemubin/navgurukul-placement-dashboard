import { useEffect, useState } from 'react';
import { jobReadinessAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner, Badge } from '../../components/common/UIComponents';
import { Plus, Edit, Trash2, Save, X, Eye, Info, CheckCircle2, AlertCircle, ChevronRight, Layout, Settings2, Sparkles, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const JobReadinessCriteriaConfig = () => {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    criteriaId: '',
    name: '',
    description: '',
    type: 'answer',
    pocCommentRequired: false,
    pocCommentTemplate: '',
    pocRatingRequired: false,
    pocRatingScale: 4,
    category: 'other',
    isMandatory: true
  });
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState('School of Programming');
  const [schools, setSchools] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCriteria, setPreviewCriteria] = useState(null);

  const criteriaTypes = [
    { value: 'answer', label: 'Answer (Text Input)' },
    { value: 'link', label: 'Link (URL)' },
    { value: 'yes/no', label: 'Yes/No' },
    { value: 'comment', label: 'Comment (Long Text)' }
  ];

  const categories = [
    { value: 'profile', label: 'Profile Build', color: 'blue' },
    { value: 'skills', label: 'Key Skills', color: 'indigo' },
    { value: 'technical', label: 'Technical Rounds', color: 'purple' },
    { value: 'preparation', label: 'Interview Prep', color: 'orange' },
    { value: 'academic', label: 'Academic Details', color: 'green' },
    { value: 'other', label: 'Other', color: 'gray' }
  ];

  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [selectedSchool]);

  const fetchSchools = async () => {
    try {
      const res = await settingsAPI.getSettings();
      const allSchools = res.data.data.schools || [];
      const inactive = res.data.data.inactiveSchools || [];
      const activeSchools = allSchools.filter(s => !inactive.includes(s));
      setSchools(activeSchools);
      if (activeSchools.length > 0 && !activeSchools.includes(selectedSchool)) {
        setSelectedSchool(activeSchools[0]);
      }
    } catch (err) {
      console.error('Error fetching schools:', err);
      setSchools(['School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance']);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await jobReadinessAPI.getConfig();
      let config = null;
      if (Array.isArray(res.data) && res.data.length > 0) {
        config = res.data.find(c => c.school === selectedSchool);
      }

      if (config) {
        setConfigId(config._id);
        setCriteria(config.criteria || []);
      } else {
        setConfigId(null);
        setCriteria([]);
      }
    } catch (err) {
      toast.error('Failed to load criteria');
      setConfigId(null);
      setCriteria([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      criteriaId: '',
      name: '',
      description: '',
      type: 'answer',
      pocCommentRequired: false,
      pocCommentTemplate: '',
      pocRatingRequired: false,
      pocRatingScale: 4,
      category: 'other',
      isMandatory: true
    });
    setShowModal(true);
  };

  const handleEdit = (crit) => {
    setEditingId(crit.criteriaId);
    setForm({
      criteriaId: crit.criteriaId,
      name: crit.name,
      description: crit.description || '',
      type: crit.type || 'answer',
      pocCommentRequired: crit.pocCommentRequired || false,
      pocCommentTemplate: crit.pocCommentTemplate || '',
      pocRatingRequired: crit.pocRatingRequired || false,
      pocRatingScale: crit.pocRatingScale || 4,
      category: crit.category || 'other',
      isMandatory: crit.isMandatory !== undefined ? crit.isMandatory : true
    });
    setShowModal(true);
  };

  const handleDelete = async (crit) => {
    if (!window.confirm('Are you sure you want to delete this criterion? This will remove it for all students in this school.')) return;
    if (!configId) return;

    setSaving(true);
    try {
      await jobReadinessAPI.deleteCriterion(configId, crit.criteriaId);
      toast.success('Criterion deleted');
      fetchConfig();
    } catch {
      toast.error('Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!editingId && !form.criteriaId.trim()) return toast.error('Unique ID is required');

    setSaving(true);
    try {
      let currentConfigId = configId;
      if (!currentConfigId) {
        const createRes = await jobReadinessAPI.createConfig({
          school: selectedSchool,
          criteria: []
        });
        currentConfigId = createRes.data._id;
        setConfigId(currentConfigId);
      }

      const dataToSend = {
        criteriaId: form.criteriaId.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        pocCommentRequired: form.pocCommentRequired,
        pocCommentTemplate: form.pocCommentTemplate.trim(),
        pocRatingRequired: form.pocRatingRequired,
        pocRatingScale: form.pocRatingScale,
        category: form.category,
        isMandatory: form.isMandatory
      };

      if (editingId) {
        await jobReadinessAPI.editCriterion(currentConfigId, editingId, dataToSend);
        toast.success('Criterion updated successfully');
      } else {
        await jobReadinessAPI.addCriterion(currentConfigId, dataToSend);
        toast.success('New criterion added successfully');
      }

      setShowModal(false);
      fetchConfig();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const groupedCriteria = categories.map(cat => ({
    ...cat,
    items: criteria.filter(c => c.category === cat.value)
  })).filter(group => group.items.length > 0 || group.value === 'other');

  const StudentPreviewModal = ({ criterion, isOpen, onClose }) => {
    if (!isOpen || !criterion) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" /> Student View Preview
            </h2>
            <button onClick={onClose} className="text-white/80 hover:text-white transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {criterion.name}
                    {criterion.isMandatory && <span className="text-rose-500 text-sm">*</span>}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{criterion.description}</p>
                </div>
                <Badge variant="outline" className="capitalize">{criterion.type}</Badge>
              </div>

              <div className="mt-4">
                {criterion.type === 'yes/no' && (
                  <div className="flex gap-3">
                    <button className="flex-1 py-2 px-4 rounded-lg bg-green-100 text-green-700 font-medium border border-green-200">Yes</button>
                    <button className="flex-1 py-2 px-4 rounded-lg bg-white text-gray-600 font-medium border border-gray-200">No</button>
                  </div>
                )}

                {criterion.type === 'answer' && (
                  <input className="input w-full bg-white" placeholder="Enter your answer..." disabled />
                )}

                {criterion.type === 'link' && (
                  <div className="relative">
                    <input className="input w-full bg-white pl-10" placeholder="https://..." disabled />
                    <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                )}

                {criterion.type === 'comment' && (
                  <textarea className="input w-full bg-white" rows={3} placeholder="Enter your response..." disabled />
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-indigo-100/50">
                <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium mb-3">
                  <CheckCircle2 className="w-4 h-4" /> PoC Feedback (After Review)
                </div>
                <div className="space-y-3">
                  {criterion.pocRatingRequired && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Rating:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(n => (
                          <div key={n} className="w-6 h-6 rounded bg-gray-100 border border-gray-200"></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {criterion.pocCommentRequired && (
                    <div className="p-3 bg-white rounded-lg border border-gray-100 text-sm text-gray-500 italic">
                      {criterion.pocCommentTemplate || "PoC's feedback will appear here..."}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition font-medium">
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Settings2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Readiness Configuration</h1>
          </div>
          <p className="text-gray-500 max-w-2xl">
            Design the job readiness roadmap for students. Define criteria, set categories,
            and configure how Campus PoCs will review and rate student progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.open('/campus-poc/students', '_blank')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Review Submissions
          </button>
          <button
            onClick={openAddModal}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Criterion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: School Selection */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-2">Schools</h3>
          <div className="space-y-1">
            {schools.map(school => (
              <button
                key={school}
                onClick={() => setSelectedSchool(school)}
                className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl transition-all duration-200 group ${selectedSchool === school
                  ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 shadow-sm'
                  : 'bg-white text-gray-600 border-2 border-transparent hover:bg-gray-50 hover:border-gray-200'
                  }`}
              >
                <span className="font-semibold text-sm truncate">{school}</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${selectedSchool === school ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
              </button>
            ))}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-6">
            <h4 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Tips
            </h4>
            <ul className="text-xs text-amber-700 space-y-2 leading-relaxed">
              <li>• Criteria are specific to each school.</li>
              <li>• Mandatory items filter job eligibility.</li>
              <li>• Use <strong>Preview</strong> to check student UX.</li>
            </ul>
          </div>
        </div>

        {/* Main Content: Criteria List */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-gray-100">
              <LoadingSpinner size="lg" />
              <p className="text-gray-400 mt-4 animate-pulse">Loading roadmap...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {criteria.length === 0 ? (
                <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">No roadmap defined for {selectedSchool}</h3>
                  <p className="text-gray-500 mb-6">Start by adding the first criterion to the readiness track.</p>
                  <button onClick={openAddModal} className="text-indigo-600 font-bold hover:underline">
                    + Create First Criterion
                  </button>
                </div>
              ) : (
                groupedCriteria.map((group) => (
                  <div key={group.value} className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <div className={`w-2 h-6 rounded-full bg-${group.color}-500`}></div>
                      <h3 className="text-lg font-bold text-gray-900">{group.label}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.items.map((crit) => (
                        <div key={crit.criteriaId} className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                          <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-gray-900">{crit.name}</h4>
                                  {crit.isMandatory && <span className="text-rose-500" title="Mandatory">*</span>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="text-[10px] py-0">{crit.type}</Badge>
                                  {crit.pocRatingRequired && <Badge variant="info" className="text-[10px] py-0">Rating Required</Badge>}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePreviewCriterion(crit)}
                                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(crit)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(crit)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                              {crit.description || 'No description provided.'}
                            </p>

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                              <span>ID: {crit.criteriaId}</span>
                              <div className="flex gap-2">
                                {crit.pocCommentRequired && <span className="text-indigo-500">Comment Req.</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? 'Edit Criterion' : 'Create Criterion'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Configure how students achieve readiness</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white rounded-xl transition text-gray-400 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Unique Identifier</label>
                  <input
                    className="input w-full bg-gray-50 border-transparent focus:bg-white"
                    placeholder="e.g. mock_interview_1"
                    value={form.criteriaId}
                    onChange={e => setForm({ ...form, criteriaId: e.target.value })}
                    disabled={!!editingId}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 ml-1">Cannot be changed later</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Display Name</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Communication Skills"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Description & Instructions</label>
                  <textarea
                    className="input w-full"
                    placeholder="What should students do? e.g. Upload your video pitch link"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Input Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="input w-full"
                  >
                    {criteriaTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="input w-full"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 p-4 bg-gray-50 rounded-2xl space-y-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Requirements & Review
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition">
                      <input
                        type="checkbox"
                        checked={form.isMandatory}
                        onChange={e => setForm({ ...form, isMandatory: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-700 block">Mandatory</span>
                        <span className="text-[10px] text-gray-400">Required for job eligibility</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition">
                      <input
                        type="checkbox"
                        checked={form.pocRatingRequired}
                        onChange={e => setForm({ ...form, pocRatingRequired: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-700 block">Require Rating</span>
                        <span className="text-[10px] text-gray-400">PoC must rate (1-4 scale)</span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-200 transition">
                      <input
                        type="checkbox"
                        checked={form.pocCommentRequired}
                        onChange={e => setForm({ ...form, pocCommentRequired: e.target.checked })}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-700 block">Require Feedback Comment</span>
                        <span className="text-[10px] text-gray-400">PoC must provide text feedback</span>
                      </div>
                    </label>

                    {form.pocCommentRequired && (
                      <div className="animate-in slide-in-from-top-2 duration-200 pb-2">
                        <textarea
                          className="input w-full text-sm"
                          placeholder="e.g. Provide specific tips for improvement..."
                          value={form.pocCommentTemplate}
                          onChange={e => setForm({ ...form, pocCommentTemplate: e.target.value })}
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-3xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 text-gray-600 font-bold hover:bg-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition flex items-center gap-2 shadow-lg shadow-gray-200"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingId ? 'Update Criterion' : 'Create Criterion'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentPreviewModal
        criterion={previewCriteria}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  );
};

export default JobReadinessCriteriaConfig;
