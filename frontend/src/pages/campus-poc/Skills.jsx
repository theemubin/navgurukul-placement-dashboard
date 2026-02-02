import { useState, useEffect } from 'react';
import { skillAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner, EmptyState, Modal, ConfirmDialog } from '../../components/common/UIComponents';
import { Search, Plus, Edit2, Trash2, Tag, Layers, Globe, School } from 'lucide-react';
import toast from 'react-hot-toast';

const POCSkills = () => {
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [newSchool, setNewSchool] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    isCommon: false,
    schools: []
  });

  useEffect(() => {
    fetchSkills();
    fetchCategoryOptions();
    fetchSchools();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await skillAPI.getSkills();
      const skillsData = response.data || [];
      setSkills(skillsData);
      const uniqueCategories = [...new Set(skillsData.map(s => s.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      toast.error('Error fetching skills');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryOptions = async () => {
    try {
      const res = await skillAPI.getCategories();
      setCategoryOptions(res.data || []);
    } catch (e) { }
  };

  const fetchSchools = async () => {
    try {
      const res = await settingsAPI.getSettings();
      const list = res.data?.data?.schools || Object.keys(res.data?.data?.schoolModules || {});
      setSchools(list);
    } catch (e) { }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedSkill) {
        await skillAPI.updateSkill(selectedSkill._id, formData);
        toast.success('Skill updated successfully');
      } else {
        await skillAPI.createSkill(formData);
        toast.success('Skill created successfully');
      }
      setShowModal(false);
      resetForm();
      // Refresh schools first (in case skill was moved to a different school)
      await fetchSchools();
      await fetchSkills();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving skill');
    }
  };

  const handleDelete = async () => {
    if (!selectedSkill) return;
    try {
      await skillAPI.deleteSkill(selectedSkill._id);
      toast.success('Skill deleted successfully');
      setShowDeleteDialog(false);
      setSelectedSkill(null);
      await fetchSchools();
      await fetchSkills();
    } catch (error) {
      toast.error('Error deleting skill');
    }
  };

  const openEditModal = (skill) => {
    setSelectedSkill(skill);
    setFormData({
      name: skill.name,
      category: skill.category || '',
      description: skill.description || '',
      isCommon: Boolean(skill.isCommon),
      schools: Array.isArray(skill.schools) ? skill.schools : []
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setSelectedSkill(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', description: '', isCommon: false, schools: [] });
    setSelectedSkill(null);
  };

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredCommonSkills = filteredSkills.filter(s => s.isCommon);
  const filteredSchoolSkills = schools.reduce((acc, school) => {
    acc[school] = filteredSkills.filter(s => Array.isArray(s.schools) && s.schools.includes(school) && !s.isCommon);
    return acc;
  }, {});

  const handleAddSchool = async () => {
    const name = newSchool.trim();
    if (!name) return;
    try {
      await settingsAPI.addSchool(name);
      toast.success('School added');
      setNewSchool('');
      await fetchSchools();
      // Refresh skills in case UI grouping depends on updated schools
      await fetchSkills();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error adding school');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skill Management (Campus POC)</h1>
          <p className="text-gray-600">Manage common and school-wise skills</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add new school"
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            className="w-48"
          />
          <button onClick={handleAddSchool} className="btn btn-secondary" title="Add school">
            Add School
          </button>
          <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2" title="Add skill">
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="md:w-48"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Common Skills */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Common Skills</h2>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
            {filteredCommonSkills.length} skills
          </span>
        </div>
        {filteredCommonSkills.length === 0 ? (
          <p className="text-sm text-gray-500">No common skills found.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredCommonSkills.map((skill) => (
              <div
                key={skill._id}
                className={`group relative px-4 py-2 rounded-lg border bg-gray-100 text-gray-800 border-gray-200 flex items-center gap-3`}
              >
                <span className="font-medium">{skill.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(skill)}
                    className="p-1.5 hover:bg-white/50 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSkill(skill);
                      setShowDeleteDialog(true);
                    }}
                    className="p-1.5 hover:bg-white/50 rounded text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* School-wise Skills */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <School className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">School-wise Skills</h2>
        </div>
        <div className="space-y-4">
          {schools.map((school) => (
            <div key={school}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">{school}</span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {filteredSchoolSkills[school]?.length || 0} skills
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {(filteredSchoolSkills[school] || []).map((skill) => (
                  <div
                    key={skill._id}
                    className={`group relative px-4 py-2 rounded-lg border bg-gray-100 text-gray-800 border-gray-200 flex items-center gap-3`}
                  >
                    <span className="font-medium">{skill.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(skill)}
                        className="p-1.5 hover:bg-white/50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSkill(skill);
                          setShowDeleteDialog(true);
                        }}
                        className="p-1.5 hover:bg-white/50 rounded text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={selectedSkill ? 'Edit Skill' : 'Add New Skill'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., JavaScript, Python, React"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            >
              <option value="">Select category</option>
              {categoryOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isCommon"
              type="checkbox"
              checked={formData.isCommon}
              onChange={(e) => setFormData({ ...formData, isCommon: e.target.checked })}
            />
            <label htmlFor="isCommon" className="text-sm text-gray-700">Mark as Common Skill</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School Tags
            </label>
            <select
              multiple
              value={formData.schools}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
                setFormData({ ...formData, schools: options });
              }}
              className="w-full"
            >
              {schools.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Cmd/Ctrl to select multiple schools</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {selectedSkill ? 'Update Skill' : 'Add Skill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedSkill(null);
        }}
        onConfirm={handleDelete}
        title="Delete Skill"
        message={`Are you sure you want to delete "${selectedSkill?.name}"? This action cannot be undone and may affect jobs and student profiles.`}
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
};

export const POCSkillsComponent = POCSkills;
export default POCSkills;