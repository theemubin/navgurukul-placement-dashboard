import { useState, useEffect } from 'react';
import { settingsAPI, placementCycleAPI, campusAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert } from '../../components/common/UIComponents';
import toast from 'react-hot-toast';
import { Plus, MessageSquare, Edit, Save, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('modules');

  // Campus Edit State
  const [editingCampusId, setEditingCampusId] = useState(null);
  const [tempDiscordChannelId, setTempDiscordChannelId] = useState('');

  const handleSaveCampusDiscord = async (campusId) => {
    try {
      await campusAPI.updateCampus(campusId, { discordChannelId: tempDiscordChannelId });
      toast.success('Campus Discord channel updated');
      setEditingCampusId(null);
      fetchCampuses();
    } catch (e) {
      toast.error('Failed to update campus');
    }
  };

  // Edit states
  const [editingSchool, setEditingSchool] = useState(null);
  const [newModule, setNewModule] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newDegree, setNewDegree] = useState('');
  const [newSpecialization, setNewSpecialization] = useState({}); // degree -> string
  const [newRoleCategory, setNewRoleCategory] = useState('');
  const [newSoftSkill, setNewSoftSkill] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [newInstitutionPincode, setNewInstitutionPincode] = useState('');
  const [educationStats, setEducationStats] = useState({ institutes: {}, departments: {} });
  const [loadingStats, setLoadingStats] = useState(false);

  // Placement cycle states
  const [placementCycles, setPlacementCycles] = useState([]);
  const [newCycle, setNewCycle] = useState({ month: '', year: '', description: '' });
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [campuses, setCampuses] = useState([]);

  // AI Config states
  const [aiConfig, setAiConfig] = useState({ hasApiKey: false, enabled: true, apiKeyPreview: null });
  const [newApiKey, setNewApiKey] = useState('');
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  // New Dynamic Lists states
  const [newLocation, setNewLocation] = useState('');
  const [editingRubric, setEditingRubric] = useState({}); // Stores local edits before save
  const [companyFilters, setCompanyFilters] = useState({ search: '' });

  useEffect(() => {
    fetchSettings();
    fetchPlacementCycles();
    fetchCampuses();
    fetchAiConfig();
    fetchAiStatus();
    fetchEducationAnalytics();
  }, []);

  const [aiStatus, setAiStatus] = useState(null);  // runtime status (working/quota/etc)

  const fetchAiConfig = async () => {
    try {
      const response = await settingsAPI.getAIConfig();
      setAiConfig(response.data.data);
    } catch (err) {
      console.error('Error fetching AI config:', err);
    }
  };

  const fetchAiStatus = async () => {
    try {
      const response = await settingsAPI.getAIStatus();
      setAiStatus(response.data.data);
    } catch (err) {
      console.error('Error fetching AI status:', err);
    }
  };

  const saveAiConfig = async () => {
    try {
      setSavingAiConfig(true);
      await settingsAPI.updateAIConfig({
        googleApiKey: newApiKey || undefined,
        enabled: aiConfig.enabled
      });
      setSuccess('AI configuration saved successfully');
      setNewApiKey('');
      await fetchAiConfig();
      await fetchAiStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save AI configuration');
    } finally {
      setSavingAiConfig(false);
    }
  };

  const toggleAiEnabled = async () => {
    try {
      await settingsAPI.updateAIConfig({ enabled: !aiConfig.enabled });
      setAiConfig(prev => ({ ...prev, enabled: !prev.enabled }));
      setSuccess(aiConfig.enabled ? 'AI disabled' : 'AI enabled');
      await fetchAiStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update AI status');
    }
  };

  const fetchPlacementCycles = async () => {
    try {
      const response = await placementCycleAPI.getCycles();
      setPlacementCycles(response.data);
    } catch (err) {
      console.error('Error fetching placement cycles:', err);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await campusAPI.getCampuses();
      setCampuses(response.data);
    } catch (err) {
      console.error('Error fetching campuses:', err);
    }
  };

  const createPlacementCycle = async () => {
    if (!newCycle.month || !newCycle.year) {
      setError('Please select month and year');
      return;
    }
    try {
      setCreatingCycle(true);
      await placementCycleAPI.createCycle({
        month: parseInt(newCycle.month),
        year: parseInt(newCycle.year),
        description: newCycle.description
      });
      setSuccess('Placement cycle created');
      setNewCycle({ month: '', year: '', description: '' });
      fetchPlacementCycles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create placement cycle');
    } finally {
      setCreatingCycle(false);
    }
  };

  const toggleCycleActive = async (cycleId, isActive) => {
    try {
      await placementCycleAPI.updateCycle(cycleId, { isActive: !isActive });
      setSuccess(isActive ? 'Cycle deactivated' : 'Cycle activated');
      fetchPlacementCycles();
    } catch (err) {
      setError('Failed to update cycle status');
    }
  };

  const deletePlacementCycle = async (cycleId) => {
    if (!confirm('Are you sure you want to delete this placement cycle?')) return;
    try {
      await placementCycleAPI.deleteCycle(cycleId);
      setSuccess('Placement cycle deleted');
      fetchPlacementCycles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete placement cycle');
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings();
      setSettings(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const { user } = useAuth();

  const copyAdminCommands = () => {
    const text = `cd backend
node scripts/backfill_normalized_skill_name.js
node scripts/check_skill_duplicates.js
node scripts/find_skill_mismatches.js
node scripts/migrate_skill_ids.js --dry-run
node scripts/migrate_skill_ids.js
node scripts/promote_normalized_index_unique.js`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Admin commands copied to clipboard');
      }).catch(() => {
        toast.error('Failed to copy commands');
      });
    } else {
      toast('Please copy manually from the docs (clipboard not available)');
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      await settingsAPI.updateSettings(settings, user?._id);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Module management
  const addModule = (school) => {
    if (!newModule.trim()) return;
    const updatedModules = { ...settings.schoolModules };
    updatedModules[school] = [...(updatedModules[school] || []), newModule.trim()];
    setSettings({ ...settings, schoolModules: updatedModules });
    setNewModule('');
  };

  const removeModule = (school, module) => {
    const updatedModules = { ...settings.schoolModules };
    updatedModules[school] = updatedModules[school].filter(m => m !== module);
    setSettings({ ...settings, schoolModules: updatedModules });
  };

  const moveModule = (school, index, direction) => {
    const updatedModules = { ...settings.schoolModules };
    const modules = [...updatedModules[school]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= modules.length) return;
    [modules[index], modules[newIndex]] = [modules[newIndex], modules[index]];
    updatedModules[school] = modules;
    setSettings({ ...settings, schoolModules: updatedModules });
  };

  // Role preferences management
  const addRole = () => {
    if (!newRole.trim() || settings.rolePreferences.includes(newRole.trim())) return;
    setSettings({ ...settings, rolePreferences: [...settings.rolePreferences, newRole.trim()] });
    setNewRole('');
  };

  const removeRole = (role) => {
    setSettings({ ...settings, rolePreferences: settings.rolePreferences.filter(r => r !== role) });
  };

  // Technical skills management
  const addSkill = () => {
    if (!newSkill.trim() || settings.technicalSkills.includes(newSkill.trim())) return;
    setSettings({ ...settings, technicalSkills: [...settings.technicalSkills, newSkill.trim()] });
    setNewSkill('');
  };

  const removeSkill = (skill) => {
    setSettings({ ...settings, technicalSkills: settings.technicalSkills.filter(s => s !== skill) });
  };

  // Degree & Higher Education management
  const addDegree = () => {
    const degree = newDegree.trim();
    if (!degree) return;

    // Update old degreeOptions for compatibility
    const oldOptions = settings.degreeOptions || [];
    const newOldOptions = oldOptions.includes(degree) ? oldOptions : [...oldOptions, degree];

    // Update new higherEducationOptions
    const higherEdu = { ...(settings.higherEducationOptions || {}) };
    if (!higherEdu[degree]) {
      higherEdu[degree] = [];
    }

    setSettings({
      ...settings,
      degreeOptions: newOldOptions,
      higherEducationOptions: higherEdu
    });
    setNewDegree('');
  };

  const removeDegree = (degree) => {
    const higherEdu = { ...(settings.higherEducationOptions || {}) };
    delete higherEdu[degree];

    setSettings({
      ...settings,
      degreeOptions: (settings.degreeOptions || []).filter(d => d !== degree),
      higherEducationOptions: higherEdu
    });
  };

  const addSpecialization = (degree) => {
    const spec = (newSpecialization[degree] || '').trim();
    if (!spec) return;

    const higherEdu = { ...(settings.higherEducationOptions || {}) };
    if (!higherEdu[degree]) higherEdu[degree] = [];

    if (!higherEdu[degree].includes(spec)) {
      higherEdu[degree] = [...higherEdu[degree], spec];
    }

    setSettings({ ...settings, higherEducationOptions: higherEdu });
    setNewSpecialization({ ...newSpecialization, [degree]: '' });
  };

  const removeSpecialization = (degree, spec) => {
    const higherEdu = { ...(settings.higherEducationOptions || {}) };
    if (higherEdu[degree]) {
      higherEdu[degree] = higherEdu[degree].filter(s => s !== spec);
    }
    setSettings({ ...settings, higherEducationOptions: higherEdu });
  };

  // Soft skills management
  const addSoftSkill = () => {
    if (!newSoftSkill.trim() || settings.softSkills?.includes(newSoftSkill.trim())) return;
    setSettings({ ...settings, softSkills: [...(settings.softSkills || []), newSoftSkill.trim()] });
    setNewSoftSkill('');
  };

  const removeSoftSkill = (skill) => {
    setSettings({ ...settings, softSkills: settings.softSkills.filter(s => s !== skill) });
  };

  // Role Categories management
  const addRoleCategory = () => {
    if (!newRoleCategory.trim() || settings.roleCategories?.includes(newRoleCategory.trim())) return;
    setSettings({ ...settings, roleCategories: [...(settings.roleCategories || []), newRoleCategory.trim()] });
    setNewRoleCategory('');
  };

  const removeRoleCategory = (category) => {
    setSettings({ ...settings, roleCategories: settings.roleCategories.filter(c => c !== category) });
  };

  // Institution management
  const addInstitution = () => {
    const institution = newInstitution.trim();
    if (!institution || (settings.institutionOptions || {})[institution]) return;
    setSettings({
      ...settings,
      institutionOptions: {
        ...(settings.institutionOptions || {}),
        [institution]: newInstitutionPincode.trim()
      }
    });
    setNewInstitution('');
    setNewInstitutionPincode('');
  };

  const removeInstitution = (institution) => {
    const updated = { ...(settings.institutionOptions || {}) };
    delete updated[institution];
    setSettings({
      ...settings,
      institutionOptions: updated
    });
  };

  const updateInstitutionPincode = (institution, pincode) => {
    setSettings({
      ...settings,
      institutionOptions: {
        ...(settings.institutionOptions || {}),
        [institution]: pincode
      }
    });
  };

  const fetchEducationAnalytics = async () => {
    try {
      setLoadingStats(true);
      const response = await settingsAPI.getEducationAnalytics();
      setEducationStats(response.data.data);
    } catch (err) {
      console.error('Error fetching education analytics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleRename = async (type, oldName) => {
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName === oldName) return;

    try {
      setSaving(true);
      await settingsAPI.renameEducationItem({ type, oldName, newName });
      setSuccess(`Renamed successfully`);
      fetchSettings(); // Refresh global settings
      fetchEducationAnalytics(); // Refresh stats
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to rename item');
    } finally {
      setSaving(false);
    }
  };

  const schools = settings?.schoolModules
    ? Object.keys(settings.schoolModules).sort((a, b) => a.localeCompare(b))
    : [];

  useEffect(() => {
    if (settings && !settings.schoolModules) {
      setSettings(prev => ({ ...prev, schoolModules: {} }));
    }
  }, [settings]);

  const tabs = [
    { id: 'modules', label: 'School Modules', icon: '📚' },
    { id: 'roleCategories', label: 'Role Categories', icon: '🏷️' },
    { id: 'roles', label: 'Role Preferences', icon: '💼' },
    { id: 'skills', label: 'Technical Skills', icon: '🔧' },
    { id: 'degrees', label: 'Departments', icon: '🎓' },
    { id: 'institutions', label: 'Institutions', icon: '🏛️' },
    { id: 'analytics', label: 'Education Analytics', icon: '📊' },
    { id: 'softskills', label: 'Soft Skills', icon: '🤝' },
    { id: 'rubrics', label: 'Proficiency Rubrics', icon: '💎' },
    { id: 'locations', label: 'Locations', icon: '📍' },
    { id: 'companies', label: 'Company Registry', icon: '🏢' },
    { id: 'cycles', label: 'Placement Cycles', icon: '📅' },
    { id: 'campuses', label: 'Campuses', icon: '🏫' },
    { id: 'ai', label: 'AI Integration', icon: '🤖' },
    { id: 'discord', label: 'Discord Integration', icon: <MessageSquare className="w-4 h-4" /> }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <Alert type="error">Failed to load settings. Please refresh the page.</Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-600 mt-1">Configure modules, roles, skills, and other platform options</p>
        </div>
        <Button
          variant="primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" onClose={() => setSuccess(null)} className="mb-4">
          {success}
        </Alert>
      )}

      {/* Skills admin guidance card (manager) */}
      <div className="mb-4">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Skills Data & Maintenance</h3>
          <p className="text-sm text-gray-500 mb-3">Managers can review and help maintain skills data integrity. These operations are generally run by dev/ops on the server; the commands are available in the repository <code>docs/skills-manager.md</code>.</p>
          <ul className="text-sm text-gray-700 list-disc pl-4 mb-3">
            <li>Backfill `normalizedName` and promote unique index.</li>
            <li>Run mismatch report to find unlinked skill names in student profiles.</li>
            <li>Dry-run skill id migration before applying it.</li>
          </ul>
          <div className="flex gap-2">
            <Button onClick={copyAdminCommands} variant="outline">Copy admin commands</Button>
            <Button onClick={() => window.open('https://github.com/your-repo/path-to-repo/blob/main/docs/skills-manager.md', '_blank')} variant="secondary">Open docs</Button>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Add New School Button (Only for modules tab) */}
      {activeTab === 'modules' && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              const name = prompt('Enter new school name:');
              if (name) {
                const updated = { ...settings.schoolModules };
                updated[name] = [];
                setSettings({ ...settings, schoolModules: updated });
              }
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New School
          </Button>
        </div>
      )}

      {/* School Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          <p className="text-gray-600">
            Manage the modules/phases for each Navgurukul school. The order of modules represents the learning progression.
          </p>

          {schools.map((school) => (
            <Card key={school} className="overflow-hidden">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setEditingSchool(editingSchool === school ? null : school)}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{school}</h3>
                    <Badge variant={settings.inactiveSchools?.includes(school) ? 'danger' : 'success'}>
                      {settings.inactiveSchools?.includes(school) ? 'Inactive' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {settings.schoolModules?.[school]?.length || 0} modules
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isInactive = settings.inactiveSchools?.includes(school);
                      const updatedInactive = isInactive
                        ? settings.inactiveSchools.filter(s => s !== school)
                        : [...(settings.inactiveSchools || []), school];
                      setSettings({ ...settings, inactiveSchools: updatedInactive });
                    }}
                  >
                    {settings.inactiveSchools?.includes(school) ? 'Activate' : 'Deactivate'}
                  </Button>
                  <svg
                    className={`w-5 h-5 transform transition-transform ${editingSchool === school ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {editingSchool === school && (
                <div className="mt-4 pt-4 border-t">
                  {/* Add new module */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newModule}
                      onChange={(e) => setNewModule(e.target.value)}
                      placeholder="Add new module..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && addModule(school)}
                    />
                    <Button variant="primary" onClick={() => addModule(school)}>
                      Add
                    </Button>
                  </div>

                  {/* Module list */}
                  <div className="space-y-2">
                    {(settings.schoolModules?.[school] || []).map((module, index) => (
                      <div
                        key={module}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <span className="text-gray-400 mr-3 font-mono text-sm">{index + 1}.</span>
                          <span className="text-gray-900">{module}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveModule(school, index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveModule(school, index, 'down')}
                            disabled={index === settings.schoolModules[school].length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeModule(school, module)}
                            className="p-1 text-red-400 hover:text-red-600 ml-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!settings.schoolModules?.[school] || settings.schoolModules[school].length === 0) && (
                      <p className="text-gray-500 text-center py-4">No modules added yet</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Role Categories Tab */}
      {activeTab === 'roleCategories' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Role Categories</h3>
          <p className="text-gray-600 mb-4">
            These categories are used to classify job and internship postings for better student filtering.
          </p>

          {/* Add new category */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newRoleCategory}
              onChange={(e) => setNewRoleCategory(e.target.value)}
              placeholder="Add new role category (e.g. Full Stack Developer)..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addRoleCategory()}
            />
            <Button variant="primary" onClick={addRoleCategory}>
              Add Category
            </Button>
          </div>

          {/* Category list */}
          <div className="flex flex-wrap gap-2">
            {settings.roleCategories?.map((category) => (
              <span
                key={category}
                className="inline-flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-sm"
              >
                {category}
                <button
                  onClick={() => removeRoleCategory(category)}
                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          {(!settings.roleCategories || settings.roleCategories.length === 0) && (
            <p className="text-gray-500 text-center py-4">No role categories added yet</p>
          )}
        </Card>
      )}

      {/* Role Preferences Tab */}
      {activeTab === 'roles' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Placement Role Options</h3>
          <p className="text-gray-600 mb-4">
            These roles will be available for students to select as their placement preferences.
          </p>

          {/* Add new role */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Add new role..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addRole()}
            />
            <Button variant="primary" onClick={addRole}>
              Add Role
            </Button>
          </div>

          {/* Role list */}
          <div className="flex flex-wrap gap-2">
            {settings.rolePreferences?.map((role) => (
              <span
                key={role}
                className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {role}
                <button
                  onClick={() => removeRole(role)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          {(!settings.rolePreferences || settings.rolePreferences.length === 0) && (
            <p className="text-gray-500 text-center py-4">No roles added yet</p>
          )}
        </Card>
      )}

      {/* Institutions Tab */}
      {activeTab === 'institutions' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Education Institutions</h3>
              <p className="text-sm text-gray-600">Manage the master list of universities and colleges available to students.</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter institution name..."
              value={newInstitution}
              onChange={(e) => setNewInstitution(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addInstitution()}
            />
            <input
              type="text"
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Pincode"
              value={newInstitutionPincode}
              onChange={(e) => setNewInstitutionPincode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addInstitution()}
            />
            <Button
              variant="primary"
              onClick={addInstitution}
              disabled={!newInstitution.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(settings.institutionOptions || {}).sort((a, b) => a[0].localeCompare(b[0])).map(([name, pincode], index) => (
              <div
                key={index}
                className="flex flex-col p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-900 font-bold truncate pr-2 uppercase text-xs tracking-wider">{name}</span>
                  <button
                    onClick={() => removeInstitution(name)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">PIN:</span>
                  <input
                    type="text"
                    value={pincode || ''}
                    onChange={(e) => updateInstitutionPincode(name, e.target.value)}
                    className="text-xs bg-gray-50 border-none rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-400 w-20"
                    placeholder="Not set"
                  />
                </div>
              </div>
            ))}
          </div>

          {Object.keys(settings.institutionOptions || {}).length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              No institutions added to the list yet.
            </div>
          )}
        </Card>
      )}

      {/* Education Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Institute Distribution</h3>
                <p className="text-sm text-gray-600">Total students per institute. Use edit to rename or merge duplicate entries.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchEducationAnalytics} disabled={loadingStats}>
                {loadingStats ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(educationStats.institutes || {}).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="p-4 bg-white border border-gray-200 rounded-lg flex justify-between items-center hover:shadow-sm transition-shadow">
                  <div>
                    <span className="block font-medium text-gray-900 truncate max-w-[200px]" title={name}>{name}</span>
                    <span className="text-sm text-gray-500 font-semibold">{count} students</span>
                  </div>
                  <button
                    onClick={() => handleRename('institution', name)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Rename / Merge"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ))}
              {Object.keys(educationStats.institutes || {}).length === 0 && !loadingStats && (
                <div className="col-span-full text-center py-8 text-gray-500">No institute data available.</div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Department Distribution</h3>
                <p className="text-sm text-gray-600">Total students per department globally across all institutes.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(educationStats.departments || {}).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="p-4 bg-white border border-gray-200 rounded-lg flex justify-between items-center hover:shadow-sm transition-shadow">
                  <div>
                    <span className="block font-medium text-gray-900 truncate max-w-[200px]" title={name}>{name}</span>
                    <span className="text-sm text-gray-500 font-semibold">{count} students</span>
                  </div>
                  <button
                    onClick={() => handleRename('department', name)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Rename / Merge"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ))}
              {Object.keys(educationStats.departments || {}).length === 0 && !loadingStats && (
                <div className="col-span-full text-center py-8 text-gray-500">No department data available.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Technical Skills Tab */}
      {activeTab === 'skills' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Skills</h3>
          <p className="text-gray-600 mb-4">
            Skills that students can add to their profile with self-assessed proficiency levels.
          </p>

          {/* Add new skill */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add new skill..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addSkill()}
            />
            <Button variant="primary" onClick={addSkill}>
              Add Skill
            </Button>
          </div>

          {/* Skill list */}
          <div className="flex flex-wrap gap-2">
            {settings.technicalSkills?.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          {(!settings.technicalSkills || settings.technicalSkills.length === 0) && (
            <p className="text-gray-500 text-center py-4">No skills added yet</p>
          )}
        </Card>
      )}

      {/* Higher Education Options Tab */}
      {activeTab === 'degrees' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Departments & Specializations</h3>
            <p className="text-gray-600 mb-4">
              Add departments and their corresponding specializations that students can select in their profiles.
            </p>

            {/* Add new department */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDegree}
                onChange={(e) => setNewDegree(e.target.value)}
                placeholder="Add new department (e.g., Computer Science, Commerce, Science)..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && addDegree()}
              />
              <Button variant="primary" onClick={addDegree}>
                <Plus className="w-5 h-5 mr-2" />
                Add Department
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.keys(settings.higherEducationOptions || {}).sort().map((degree) => (
              <Card key={degree} className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <h4 className="font-bold text-gray-900 text-lg">{degree}</h4>
                  <button
                    onClick={() => removeDegree(degree)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    title={`Remove ${degree}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Specializations</p>

                  {/* Add Specialization */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newSpecialization[degree] || ''}
                      onChange={(e) => setNewSpecialization({ ...newSpecialization, [degree]: e.target.value })}
                      placeholder={`Add specialization for ${degree}...`}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addSpecialization(degree)}
                    />
                    <button
                      onClick={() => addSpecialization(degree)}
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {settings.higherEducationOptions[degree]?.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200"
                      >
                        {spec}
                        <button
                          onClick={() => removeSpecialization(degree, spec)}
                          className="ml-1.5 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    {(settings.higherEducationOptions[degree]?.length === 0 || !settings.higherEducationOptions[degree]) && (
                      <p className="text-gray-400 text-xs italic">No specializations added yet</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {(!settings.higherEducationOptions || Object.keys(settings.higherEducationOptions).length === 0) && (
            <Card className="text-center py-12">
              <p className="text-gray-500">No degree options added yet. Add your first degree above.</p>
            </Card>
          )}
        </div>
      )}

      {/* Soft Skills Tab */}
      {activeTab === 'softskills' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Soft Skills</h3>
          <p className="text-gray-600 mb-4">
            Interpersonal and professional skills that students can select for their profile.
          </p>

          {/* Add new soft skill */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSoftSkill}
              onChange={(e) => setNewSoftSkill(e.target.value)}
              placeholder="Add new soft skill..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && addSoftSkill()}
            />
            <Button variant="primary" onClick={addSoftSkill}>
              Add Skill
            </Button>
          </div>

          {/* Soft skill list */}
          <div className="flex flex-wrap gap-2">
            {settings.softSkills?.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm"
              >
                {skill}
                <button
                  onClick={() => removeSoftSkill(skill)}
                  className="ml-2 text-purple-600 hover:text-purple-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          {(!settings.softSkills || settings.softSkills.length === 0) && (
            <p className="text-gray-500 text-center py-4">No soft skills added yet</p>
          )}
        </Card>
      )}

      {/* Placement Cycles Tab */}
      {activeTab === 'cycles' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Placement Cycles</h3>
          <p className="text-gray-600 mb-4">
            Manage monthly placement cycles. Each month is counted as one cycle for tracking placements.
          </p>

          {/* Add new cycle */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Create New Cycle</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={newCycle.month}
                  onChange={(e) => setNewCycle({ ...newCycle, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Month</option>
                  {['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={newCycle.year}
                  onChange={(e) => setNewCycle({ ...newCycle, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Year</option>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newCycle.description}
                  onChange={(e) => setNewCycle({ ...newCycle, description: e.target.value })}
                  placeholder="E.g., Summer hiring drive"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <Button
              variant="primary"
              onClick={createPlacementCycle}
              disabled={creatingCycle}
              className="mt-4"
            >
              {creatingCycle ? 'Creating...' : 'Create Cycle'}
            </Button>
          </div>

          {/* Cycles list */}
          <div className="space-y-3">
            {placementCycles.map((cycle) => (
              <div
                key={cycle._id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{cycle.name}</span>
                    <Badge variant={cycle.isActive ? 'success' : 'secondary'}>
                      {cycle.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {cycle.status === 'completed' && (
                      <Badge variant="primary">Completed</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {cycle.studentCount || 0} students | {cycle.placedCount || 0} placed
                    {cycle.description && ` | ${cycle.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={cycle.isActive ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => toggleCycleActive(cycle._id, cycle.isActive)}
                  >
                    {cycle.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deletePlacementCycle(cycle._id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {placementCycles.length === 0 && (
            <p className="text-gray-500 text-center py-4">No placement cycles created yet</p>
          )}
        </Card>
      )}

      {/* Campuses Tab */}
      {activeTab === 'campuses' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Navgurukul Campuses</h3>
          <p className="text-gray-600 mb-4">
            View and manage campus locations. Students select their campus from this list.
          </p>

          {/* Campus list */}
          <div className="space-y-3">
            {campuses.map((campus) => (
              <div
                key={campus._id}
                className="flex items-center justify-between p-4 bg-white border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{campus.name}</span>
                    <Badge variant="secondary">{campus.code}</Badge>
                    {campus.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>
                  {campus.location && (
                    <p className="text-sm text-gray-500 mt-1">
                      {typeof campus.location === 'object'
                        ? `${campus.location.city || ''}${campus.location.city && campus.location.state ? ', ' : ''}${campus.location.state || ''}`
                        : campus.location}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1 text-indigo-600">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs font-semibold">Notifications:</span>
                    </div>
                    {editingCampusId === campus._id ? (
                      <div className="flex items-center gap-2 animate-fadeIn">
                        <input
                          type="text"
                          value={tempDiscordChannelId}
                          onChange={(e) => setTempDiscordChannelId(e.target.value)}
                          placeholder="Channel ID"
                          className="border rounded px-2 py-1 text-xs w-48 focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button onClick={() => handleSaveCampusDiscord(campus._id)} className="p-1 hover:bg-green-100 text-green-600 rounded" title="Save"><Save className="w-3 h-3" /></button>
                        <button onClick={() => setEditingCampusId(null)} className="p-1 hover:bg-red-100 text-red-600 rounded" title="Cancel"><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group cursor-pointer hover:bg-gray-50 px-2 py-0.5 rounded -ml-2" onClick={() => { setEditingCampusId(campus._id); setTempDiscordChannelId(campus.discordChannelId || ''); }}>
                        <span className="text-xs font-mono">{campus.discordChannelId ? campus.discordChannelId : 'Global Default'}</span>
                        <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {campuses.length === 0 && (
            <p className="text-gray-500 text-center py-4">No campuses found</p>
          )}

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Campus management is configured during initial setup.
              Contact the system administrator to add or modify campuses.
            </p>
          </div>
        </Card>
      )}

      {/* AI Integration Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Job Description Parsing</h3>
            <p className="text-gray-600 mb-4">
              Enable AI to automatically extract job details from PDFs and URLs when creating new jobs.
            </p>

            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <p className="font-medium text-gray-900">AI Auto-Fill</p>
                  <p className="text-sm text-gray-500">
                    {aiConfig.hasApiKey
                      ? `API Key: ${aiConfig.apiKeyPreview}`
                      : 'No API key configured'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={aiConfig.enabled ? 'success' : 'danger'}>
                  {aiConfig.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <button
                  onClick={toggleAiEnabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiConfig.enabled ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            {/* AI Runtime Status (operational / quota / errors) */}
            <div className="mt-4 p-4 bg-white border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">AI Runtime Status</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {aiStatus ? (
                      aiStatus.configured ? (
                        aiStatus.working ? 'Operational' : `Configured but not operational: ${aiStatus.message || 'unknown'}`
                      ) : 'Not configured'
                    ) : 'Unknown - click Refresh to check'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchAiStatus}
                    className="px-3 py-1 rounded bg-gray-100 text-sm"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              {aiStatus?.message && (
                <div className="text-xs text-yellow-700 mt-2">Details: {aiStatus.message}</div>
              )}
            </div>

            {/* API Key Input */}
            <div className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); saveAiConfig(); }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google AI Studio API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder={aiConfig.hasApiKey ? 'Enter new key to replace' : 'Enter your API key'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingAiConfig || !newApiKey.trim()}
                  >
                    {savingAiConfig ? 'Saving...' : 'Save Key'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your free API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </form>
            </div>

            {/* Features */}
            <div className="mt-6 border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">What AI can extract:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  'Job Title', 'Company Name', 'Location', 'Job Type',
                  'Salary Range', 'Requirements', 'Responsibilities',
                  'Skills', 'Experience Level', 'No. of Positions'
                ].map(feature => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Fallback Info */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Fallback Mode:</strong> If AI is disabled or API key is not set,
                the system will use basic text extraction (regex-based) which provides
                limited but still useful auto-fill functionality.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Proficiency Rubrics Tab */}
      {activeTab === 'rubrics' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Skill Proficiency Rubrics</h3>
              <p className="text-sm text-gray-600">Define what each level (1-4) means for student self-assessments.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const rubrics = settings.proficiencyRubrics || {};
                settingsAPI.updateProficiencyRubrics(rubrics)
                  .then(() => toast.success('Rubrics updated'))
                  .catch(() => toast.error('Failed to update'));
              }}
            >
              Update Mastery Labels
            </Button>
          </div>

          <div className="space-y-6">
            {[1, 2, 3, 4].map(level => {
              const rubric = settings.proficiencyRubrics?.[level.toString()] || { label: '', description: '' };
              return (
                <div key={level} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-center">
                      <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg mr-3">
                        {level}
                      </span>
                      <input
                        type="text"
                        className="flex-1 font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                        value={rubric.label}
                        onChange={(e) => {
                          const updated = { ...settings.proficiencyRubrics };
                          updated[level.toString()] = { ...rubric, label: e.target.value };
                          setSettings({ ...settings, proficiencyRubrics: updated });
                        }}
                        placeholder={`Label for Level ${level}`}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <textarea
                        className="w-full text-sm text-gray-600 border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                        rows={2}
                        value={rubric.description}
                        onChange={(e) => {
                          const updated = { ...settings.proficiencyRubrics };
                          updated[level.toString()] = { ...rubric, description: e.target.value };
                          setSettings({ ...settings, proficiencyRubrics: updated });
                        }}
                        placeholder={`Detailed description of what Level ${level} expertise looks like...`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Locations</h3>
          <p className="text-sm text-gray-600 mb-4">Manage the master list of cities and regions available for job postings.</p>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Noida, Gurgaon, London..."
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (async () => {
                if (!newLocation.trim()) return;
                const updated = [...(settings.jobLocations || []), newLocation.trim().split(',')[0].trim()];
                setSettings({ ...settings, jobLocations: [...new Set(updated)] });
                setNewLocation('');
              })()}
            />
            <Button
              variant="primary"
              onClick={() => {
                if (!newLocation.trim()) return;
                const updated = [...(settings.jobLocations || []), newLocation.trim().split(',')[0].trim()];
                setSettings({ ...settings, jobLocations: [...new Set(updated)] });
                setNewLocation('');
              }}
            >
              Add Location
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(settings.jobLocations || []).sort().map((loc) => (
              <span
                key={loc}
                className="inline-flex items-center px-3 py-1.5 bg-teal-100 text-teal-800 rounded-full text-sm"
              >
                {loc}
                <button
                  onClick={() => {
                    const updated = settings.jobLocations.filter(l => l !== loc);
                    setSettings({ ...settings, jobLocations: updated });
                  }}
                  className="ml-2 text-teal-600 hover:text-teal-800"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Companies Tab */}
      {activeTab === 'companies' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Company Registry</h3>
              <p className="text-sm text-gray-600">Master list of registered hiring partners.</p>
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search companies..."
                className="w-full text-sm px-3 py-1.5 border border-gray-300 rounded"
                value={companyFilters.search}
                onChange={(e) => setCompanyFilters({ ...companyFilters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(settings.masterCompanies || {})
              .filter(([name]) => name.toLowerCase().includes((companyFilters.search || '').toLowerCase()))
              .map(([name, data]) => (
                <div key={name} className="p-4 border border-gray-200 rounded-lg flex items-start gap-4 hover:shadow-sm transition">
                  <div className="flex-shrink-0 w-12 h-12 rounded border bg-gray-50 flex items-center justify-center overflow-hidden">
                    {data.logo ? (
                      <img src={data.logo} alt={name} className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="text-gray-400 font-bold text-xl">{name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{name}</h4>
                    {data.website && (
                      <a href={data.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                        {data.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${name}" from registry?`)) {
                          const updated = { ...settings.masterCompanies };
                          delete updated[name];
                          setSettings({ ...settings, masterCompanies: updated });
                        }
                      }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {Object.keys(settings.masterCompanies || {}).length === 0 && (
            <p className="text-center py-12 text-gray-500 italic">No companies registered yet. They will appear here when added via Job Forms.</p>
          )}
        </Card>
      )}

      {/* Discord Integration Tab */}
      {activeTab === 'discord' && (
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Discord Integration
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure the Discord bot for notifications and automation.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">Enable Discord Integration</h4>
                <p className="text-sm text-gray-500">Send notifications to Discord channels.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.discordConfig?.enabled || false}
                  onChange={(e) => setSettings({
                    ...settings,
                    discordConfig: { ...settings.discordConfig, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={settings.discordConfig?.botToken || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    discordConfig: { ...settings.discordConfig, botToken: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Sensitive token..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Server (Guild) ID</label>
                <input
                  type="text"
                  value={settings.discordConfig?.guildId || ''}
                  onChange={(e) => setSettings({
                    ...settings,
                    discordConfig: { ...settings.discordConfig, guildId: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Server ID"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Channel Configuration (IDs)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">New Job Postings</label>
                  <input
                    type="text"
                    value={settings.discordConfig?.channels?.jobPostings || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: {
                        ...settings.discordConfig,
                        channels: { ...settings.discordConfig?.channels, jobPostings: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Channel ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Application Updates</label>
                  <input
                    type="text"
                    value={settings.discordConfig?.channels?.applicationUpdates || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: {
                        ...settings.discordConfig,
                        channels: { ...settings.discordConfig?.channels, applicationUpdates: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Channel ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Profile Updates</label>
                  <input
                    type="text"
                    value={settings.discordConfig?.channels?.profileUpdates || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: {
                        ...settings.discordConfig,
                        channels: { ...settings.discordConfig?.channels, profileUpdates: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Channel ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">General Notifications</label>
                  <input
                    type="text"
                    value={settings.discordConfig?.channels?.general || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: {
                        ...settings.discordConfig,
                        channels: { ...settings.discordConfig?.channels, general: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Channel ID"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Preferences</h4>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={settings.discordConfig?.useThreads ?? true}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: { ...settings.discordConfig, useThreads: e.target.checked }
                    })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Use Threads for Updates
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={settings.discordConfig?.mentionUsers ?? true}
                    onChange={(e) => setSettings({
                      ...settings,
                      discordConfig: { ...settings.discordConfig, mentionUsers: e.target.checked }
                    })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  Mention Users (@)
                </label>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Save reminder */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-yellow-800">
            Don't forget to save your changes by clicking the "Save All Changes" button above.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
