import { useEffect, useState } from 'react';
import { jobReadinessAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const JobReadinessCriteriaConfig = () => {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ 
    criteriaId: '', 
    name: '', 
    description: '', 
    type: 'answer',
    pocCommentRequired: false,
    pocCommentTemplate: '',
    pocRatingRequired: false,
    pocRatingScale: 4,
    category: 'other'
  });
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState('School of Programming');
  const [showPreview, setShowPreview] = useState(false);
  const [previewCriteria, setPreviewCriteria] = useState(null);

  const schools = [
    'School of Programming',
    'School of Business', 
    'School of Finance',
    'School of Education',
    'School of Second Chance'
  ];

  const criteriaTypes = [
    { value: 'answer', label: 'Answer (Text Input)' },
    { value: 'link', label: 'Link (URL)' },
    { value: 'yes/no', label: 'Yes/No' },
    { value: 'comment', label: 'Comment (Long Text)' }
  ];

  const categories = [
    { value: 'profile', label: 'Profile' },
    { value: 'skills', label: 'Skills' },
    { value: 'technical', label: 'Technical' },
    { value: 'preparation', label: 'Preparation' },
    { value: 'academic', label: 'Academic' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchConfig();
  }, [selectedSchool]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await jobReadinessAPI.getConfig();
      // Find config for selected school
      let config = null;
      if (Array.isArray(res.data) && res.data.length > 0) {
        config = res.data.find(c => c.school === selectedSchool);
      }
      
      if (config) {
        setConfigId(config._id);
        setCriteria(config.criteria || []);
      } else {
        // No config exists yet, set empty state
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
      category: crit.category || 'other'
    });
  };

  const handleDelete = async (crit) => {
    if (!window.confirm('Delete this criterion?')) return;
    if (!configId) {
      toast.error('No config found');
      return;
    }
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
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      let currentConfigId = configId;
      
      // If no config exists, create one first
      if (!currentConfigId) {
        const createRes = await jobReadinessAPI.createConfig({
          school: selectedSchool,
          criteria: []
        });
        currentConfigId = createRes.data._id;
        setConfigId(currentConfigId);
      }

      // Prepare the data to send
      const dataToSend = {
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        pocCommentRequired: form.pocCommentRequired,
        pocCommentTemplate: form.pocCommentTemplate.trim(),
        pocRatingRequired: form.pocRatingRequired,
        pocRatingScale: form.pocRatingScale,
        category: form.category
      };

      console.log('Sending data:', dataToSend); // Debug log

      if (editingId) {
        await jobReadinessAPI.editCriterion(currentConfigId, editingId, dataToSend);
        toast.success('Criterion updated! Students will see the changes immediately.');
      } else {
        await jobReadinessAPI.addCriterion(currentConfigId, dataToSend);
        toast.success('Criterion added! Students can now fill this in their Job Readiness page.');
      }
      setEditingId(null);
      handleCancel();
      fetchConfig();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
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
      category: 'other'
    });
  };

  const handlePreviewCriterion = (crit) => {
    setPreviewCriteria(crit);
    setShowPreview(true);
  };

  const StudentPreviewModal = ({ criterion, isOpen, onClose }) => {
    if (!isOpen || !criterion) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Student View Preview</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <p className="text-sm text-blue-800 mb-2">📝 This is how students will see this criterion:</p>
          </div>

          {/* Student View Simulation */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{criterion.name}</span>
                <span className={`px-2 py-1 text-xs rounded ${criterion.type === 'yes/no' ? 'bg-green-100 text-green-800' : criterion.type === 'link' ? 'bg-blue-100 text-blue-800' : criterion.type === 'comment' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                  {criterion.type}
                </span>
              </div>
              <span className="text-xs text-gray-500">Not Started</span>
            </div>
            
            {criterion.description && (
              <p className="text-sm text-gray-600 mb-3">{criterion.description}</p>
            )}
            
            {/* Input based on type */}
            {criterion.type === 'yes/no' && (
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary">Yes</button>
                <button className="btn btn-sm btn-outline">No</button>
              </div>
            )}
            
            {criterion.type === 'answer' && (
              <input 
                className="input w-full" 
                placeholder="Enter your answer..." 
                disabled 
              />
            )}
            
            {criterion.type === 'link' && (
              <input 
                className="input w-full" 
                placeholder="Enter URL (https://...)" 
                disabled 
              />
            )}
            
            {criterion.type === 'comment' && (
              <textarea 
                className="input w-full" 
                rows={3}
                placeholder="Enter your detailed response..." 
                disabled 
              />
            )}
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg mt-4">
            <p className="text-sm text-yellow-800 mb-2">🎯 After submission, PoCs will review and may:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {criterion.pocCommentRequired && <li>• Add feedback comments</li>}
              {criterion.pocRatingRequired && <li>• Rate on a 1-4 scale</li>}
              <li>• Approve or request changes</li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn btn-primary">
              Close Preview
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Job Readiness Criteria Configuration</h1>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-800 text-sm mb-2">💡 <strong>How this works:</strong></p>
          <div className="text-blue-700 text-sm space-y-1">
            <p>1. <strong>You configure</strong> criteria here for each school</p>
            <p>2. <strong>Students fill</strong> these criteria in their Job Readiness page</p>
            <p>3. <strong>You review & rate</strong> student submissions in Student Details</p>
            <p>4. <strong>Final approval</strong> makes students job-ready</p>
          </div>
        </div>
      </div>
      
      {/* School Selector */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select School</label>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {schools.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-2">Need to review student submissions?</p>
            <button
              onClick={() => window.open('/campus-poc/students', '_blank')}
              className="btn btn-outline"
            >
              📋 Review Students
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" />
      ) : (
        <>
          <div className="mb-8">
            <h2 className="font-semibold mb-2">Current Criteria</h2>
            {criteria.length > 0 && (
              <div className="bg-green-50 p-3 rounded-lg mb-4">
                <p className="text-green-800 text-sm">
                  📊 <strong>{criteria.length} criteria</strong> configured for <strong>{selectedSchool}</strong>
                  <br />These will appear in all students' Job Readiness pages for this school.
                </p>
              </div>
            )}
            {criteria.length === 0 && <p className="text-gray-500">No criteria defined yet.</p>}
            <div className="space-y-3">
              {criteria
                .sort((a, b) => categories.findIndex(c => c.value === a.category) - categories.findIndex(c => c.value === b.category))
                .map(crit => (
                <div key={crit._id} className="bg-white rounded shadow p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{crit.name}</span>
                        <span className={`px-2 py-1 text-xs rounded ${crit.type === 'yes/no' ? 'bg-green-100 text-green-800' : crit.type === 'link' ? 'bg-blue-100 text-blue-800' : crit.type === 'comment' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                          {crit.type}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800">
                          {categories.find(c => c.value === crit.category)?.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">ID: {crit.criteriaId}</div>
                      <div className="text-gray-700 text-sm">{crit.description}</div>
                      {crit.pocCommentRequired && (
                        <div className="text-xs text-blue-600 mt-1">
                          PoC Comment Required: {crit.pocCommentTemplate || 'Add your feedback here'}
                        </div>
                      )}
                      {crit.pocRatingRequired && (
                        <div className="text-xs text-green-600 mt-1">
                          PoC Rating Required: 1-4 scale
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="btn btn-sm btn-outline" 
                        onClick={() => handlePreviewCriterion(crit)}
                        title="Preview how students will see this"
                      >
                        👁️ Preview
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(crit)}><Edit className="w-4 h-4" /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(crit)} disabled={saving}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
            <div className="bg-gray-50 rounded p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{editingId ? 'Edit Criterion' : 'Add New Criterion'}</h2>
              <div className="text-xs text-gray-600">
                💡 Use "Preview" to see how students will interact with this
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Unique ID</label>
                <input
                  className="input"
                  placeholder="e.g. resume_upload"
                  value={form.criteriaId}
                  onChange={e => setForm({ ...form, criteriaId: e.target.value })}
                  disabled={!!editingId}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="input"
                  placeholder="e.g. Upload Resume"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input"
                  placeholder="Describe what students need to do"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="input"
                >
                  {criteriaTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="input"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2 mt-4">
                <h3 className="text-md font-medium text-gray-800 mb-2">PoC Feedback Options</h3>
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.pocCommentRequired}
                    onChange={e => setForm({ ...form, pocCommentRequired: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Require PoC Comment</span>
                </label>
              </div>
              
              {form.pocCommentRequired && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">PoC Comment Template</label>
                  <textarea
                    className="input"
                    placeholder="e.g. Rate the quality of the resume (1-5) and provide feedback"
                    value={form.pocCommentTemplate}
                    onChange={e => setForm({ ...form, pocCommentTemplate: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
              
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.pocRatingRequired}
                    onChange={e => setForm({ ...form, pocRatingRequired: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Require PoC Rating</span>
                </label>
              </div>
              
              <div className="md:col-span-2 flex gap-2 mt-4">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" /> {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                  <button className="btn btn-secondary" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
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
