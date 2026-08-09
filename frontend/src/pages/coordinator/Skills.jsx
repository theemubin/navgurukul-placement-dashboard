import { useState, useEffect } from 'react';
import { skillAPI, settingsAPI } from '../../services/api';
import { useSchools } from '../../context/SchoolsContext';
import { LoadingSpinner, EmptyState, Modal, ConfirmDialog } from '../../components/common/UIComponents';
import { Search, Plus, Edit2, Trash2, Tag, Layers, Globe, School, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Skills = () => {
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    isCommon: false,
    schools: []
  });
  const [schools, setSchools] = useState([]);
  const [newSchool, setNewSchool] = useState('');
  const { schools: globalSchools, refresh: refreshSchools } = useSchools();

  const allowedSchools = schools;

  useEffect(() => {
    fetchSkills();
    fetchCategoryOptions();
    // load from global provider when available
    if (globalSchools && globalSchools.length > 0) setSchools(globalSchools);
  }, [globalSchools]);

  const fetchCategoryOptions = async () => {
    // Simplified categories as requested: Technical, Soft Skills, Office Skills
    const simplified = [
      { value: 'technical', label: 'Technical Skills (School Specific)' },
      { value: 'soft_skill', label: 'Soft Skills' },
      { value: 'office', label: 'Office/Professional Skills' }
    ];
    setCategoryOptions(simplified);
  };

  // No local fetch; `useSchools` provides the canonical list.

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await skillAPI.getSkills();
      const skillsData = response.data || [];
      setSkills(skillsData);

      // Extract unique categories
      const uniqueCategories = [...new Set(skillsData.map(s => s.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      toast.error('Error fetching skills');
    } finally {
      setLoading(false);
    }
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
      // Refresh schools and skills to ensure UI reflects any school/category changes
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
  const filteredSchoolSkills = allowedSchools.reduce((acc, school) => {
    acc[school] = filteredSkills.filter(s => Array.isArray(s.schools) && s.schools.includes(school) && !s.isCommon);
    return acc;
  }, {});

  // Identify skills that are tagged as 'technical' but have no schools and aren't common
  const untaggedTechnicalSkills = filteredSkills.filter(s =>
    s.category === 'technical' &&
    !s.isCommon &&
    (!Array.isArray(s.schools) || s.schools.length === 0)
  );

  // Group skills by category label for display (excluding technical ones already shown above)
  const groupedSkills = filteredSkills.reduce((acc, skill) => {
    const categoryValue = skill.category || 'other';

    // Skip technical skills and common skills as they are handled in specialized sections above
    if (categoryValue === 'technical' || skill.isCommon) return acc;

    const categoryLabel = categoryOptions.find(opt => opt.value === categoryValue)?.label || 'Uncategorized';
    if (!acc[categoryLabel]) acc[categoryLabel] = [];
    acc[categoryLabel].push(skill);
    return acc;
  }, {});

  const getCategoryColor = (categoryLabel) => {
    const colors = {
      'Technical Skills': 'bg-blue-100 text-blue-800 border-blue-200',
      'Soft Skills': 'bg-pink-100 text-pink-800 border-pink-200',
      'Office/Professional Skills': 'bg-teal-100 text-teal-800 border-teal-200',
      'Languages': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Certifications': 'bg-orange-100 text-orange-800 border-orange-200',
      'Domain Knowledge': 'bg-green-100 text-green-800 border-green-200',
      'Other': 'bg-gray-100 text-gray-800 border-gray-200',
      'Uncategorized': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[categoryLabel] || colors['Other'];
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skill Management</h1>
          <p className="text-gray-600">Manage skill categories and definitions</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add new school"
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            className="w-48"
          />
          <button
                onClick={async () => {
              const name = newSchool.trim();
              if (!name) return;
              try {
                await settingsAPI.addSchool(name);
                toast.success('School added');
                setNewSchool('');
                await refreshSchools();
                await fetchSkills();
              } catch (e) {
                toast.error(e.response?.data?.message || 'Error adding school');
              }
            }}
            className="btn btn-secondary"
            title="Add school"
          >
            Add School
          </button>
          <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2" title="Add skill">
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Tag className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{skills.length}</p>
              <p className="text-sm text-gray-500">Total Skills</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-secondary-100 rounded-lg">
              <Layers className="w-6 h-6 text-secondary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
              <p className="text-sm text-gray-500">Categories</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent-100 rounded-lg">
              <Tag className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{skills.filter(s => s.isCommon).length}</p>
              <p className="text-sm text-gray-500">Common Skills</p>
            </div>
          </div>
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
                    className="p-1 hover:bg-white/50 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSkill(skill);
                      setShowDeleteDialog(true);
                    }}
                    className="p-1 hover:bg-white/50 rounded text-red-600"
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
          {allowedSchools.map((school) => (
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
                        className="p-1 hover:bg-white/50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSkill(skill);
                          setShowDeleteDialog(true);
                        }}
                        className="p-1 hover:bg-white/50 rounded text-red-600"
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

      {/* Untagged Technical Skills */}
      {untaggedTechnicalSkills.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-semibold text-yellow-900">Untagged Technical Skills</h2>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              {untaggedTechnicalSkills.length} untagged
            </span>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            These technical skills are not common and have no school tags. They will not be visible to students in their primary technical skills section.
          </p>
          <div className="flex flex-wrap gap-3">
            {untaggedTechnicalSkills.map((skill) => (
              <div
                key={skill._id}
                className="group relative px-4 py-2 rounded-lg border bg-white text-gray-800 border-yellow-300 flex items-center gap-3 shadow-sm"
              >
                <span className="font-medium">{skill.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(skill)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills List by Category */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : Object.keys(groupedSkills).length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No skills found"
          description="Start by adding some skills to the system"
          action={{ label: 'Add Skill', onClick: openCreateModal }}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSkills).map(([category, categorySkills]) => (
            <div key={category} className="card">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {categorySkills.length} skills
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {categorySkills.map((skill) => (
                  <div
                    key={skill._id}
                    className={`group relative px-4 py-2 rounded-lg border ${getCategoryColor(category)} flex items-center gap-3`}
                  >
                    <span className="font-medium">{skill.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEditModal(skill)}
                        className="p-1 hover:bg-white/50 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSkill(skill);
                          setShowDeleteDialog(true);
                        }}
                        className="p-1 hover:bg-white/50 rounded text-red-600"
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
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={selectedSkill ? 'Edit Skill Definition' : 'Define New Skill'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
            <Layers className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Skill Category</p>
              <div className="flex gap-2 mt-2">
                {categoryOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: opt.value, isCommon: opt.value !== 'technical' })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${formData.category === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    {opt.label.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skill Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., JavaScript, React, Public Speaking"
              className="w-full"
              required
            />
          </div>

          {formData.category === 'technical' ? (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <School className="w-4 h-4" />
                  Target Schools
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isCommon}
                    onChange={(e) => setFormData({ ...formData, isCommon: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-gray-600">Available to all schools</span>
                </label>
              </div>

              {!formData.isCommon && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {allowedSchools.map(school => (
                    <label key={school} className="flex items-center gap-2 p-2 rounded border border-transparent hover:bg-white hover:border-gray-200 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={formData.schools.includes(school)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...formData.schools, school]
                            : formData.schools.filter(s => s !== school);
                          setFormData({ ...formData, schools: updated });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-xs text-gray-700">{school}</span>
                    </label>
                  ))}
                </div>
              )}
              {formData.isCommon && (
                <p className="text-xs text-blue-600 italic mt-1">This skill will be displayed under "Common Technical Skills" for all students.</p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
              <Globe className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-800 font-medium">
                {formData.category === 'soft_skill' ? 'Soft Skills' : 'Office/Professional Skills'} are automatically available to students across all schools.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this skill cover?"
              className="w-full text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="btn btn-secondary px-6"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary px-6" disabled={!formData.category || !formData.name}>
              {selectedSkill ? 'Save Changes' : 'Create Skill'}
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

export const CoordinatorSkills = Skills;
export default Skills;
