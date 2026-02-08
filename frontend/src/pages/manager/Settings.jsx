import { useState, useEffect } from 'react';
import { settingsAPI, placementCycleAPI, campusAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert } from '../../components/common/UIComponents';
import toast from 'react-hot-toast';
import { Plus, MessageSquare, Edit, Save, X, BookOpen, Globe, Building2, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [initialSettings, setInitialSettings] = useState(null); // snapshot of fetched settings to detect accidental wipes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeCategory, setActiveCategory] = useState('curriculum');
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
  const [selectedRegistryDegree, setSelectedRegistryDegree] = useState(null);
  const [companyFilters, setCompanyFilters] = useState({ search: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', website: '', description: '', logo: '' });

  useEffect(() => {
    fetchSettings();
    fetchPlacementCycles();
    fetchCampuses();
    fetchAiConfig();
    fetchAiStatus();
    fetchEducationAnalytics();
  }, []);

  useEffect(() => {
    if (settings?.degreeOptions?.length > 0 && !selectedRegistryDegree) {
      setSelectedRegistryDegree(settings.degreeOptions[0]);
    }
  }, [settings?.degreeOptions]);

  const [aiStatus, setAiStatus] = useState(null);  // runtime status (working/quota/etc)

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      const response = await settingsAPI.addCompanyOption(newCompany);
      if (response.data.success) {
        setSettings({ ...settings, masterCompanies: response.data.data });
        setNewCompany({ name: '', website: '', description: '', logo: '' });
        setIsAddingCompany(false);
        toast.success('Company added to registry');
      }
    } catch (err) {
      toast.error('Failed to add company');
      console.error(err);
    }
  };

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
      // Keep a snapshot to detect accidental overwrites
      setInitialSettings(JSON.parse(JSON.stringify(response.data.data)));
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
      // Detect accidental wipes: compare lengths of major arrays to the initial snapshot
      if (initialSettings) {
        const keysToCheck = ['rolePreferences', 'technicalSkills', 'degreeOptions', 'softSkills', 'inactiveSchools'];
        const emptied = keysToCheck.filter(k => {
          const before = initialSettings[k] || [];
          const after = settings[k] || [];
          return before.length > 0 && after.length === 0;
        });
        if (emptied.length > 0) {
          const confirmMsg = `The following settings are about to be cleared: ${emptied.join(', ')}. Are you sure you want to continue?`;
          if (!window.confirm(confirmMsg)) return;
        }
      }

      setSaving(true);
      setError(null);
      await settingsAPI.updateSettings(settings, user?._id);
      setSuccess('Settings saved successfully');
      setInitialSettings(JSON.parse(JSON.stringify(settings)));
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
    const updatedOptions = settings.degreeOptions.filter(d => d !== degree);
    const updatedHigherEd = { ...settings.higherEducationOptions };
    delete updatedHigherEd[degree];

    setSettings({
      ...settings,
      degreeOptions: updatedOptions,
      higherEducationOptions: updatedHigherEd
    });

    if (selectedRegistryDegree === degree) {
      setSelectedRegistryDegree(updatedOptions.length > 0 ? updatedOptions[0] : null);
    }
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

  const categories = [
    { id: 'curriculum', label: 'Curriculum & Schools', icon: '🎓', description: 'Modules, Soft Skills, Stats' },
    { id: 'career', label: 'Career & Skills', icon: '💼', description: 'Roles, Skills, Rubrics' },
    { id: 'directory', label: 'Registry & Data', icon: '🏛️', description: 'Degrees, Colleges, Cities' },
    { id: 'platform', label: 'Settings & AI', icon: '⚙️', description: 'AI, Discord, Campuses' }
  ];

  const categoryTabMap = {
    curriculum: ['modules', 'softskills', 'analytics'],
    career: ['roleCategories', 'roles', 'skills', 'rubrics'],
    directory: ['degrees', 'institutions', 'locations', 'companies'],
    platform: ['campuses', 'cycles', 'ai', 'discord']
  };

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

      {/* Categories */}
      <div className="border-b border-gray-100 mb-8 bg-white z-10 -mx-6 px-6 sticky top-0 backdrop-blur-md bg-white/90">
        <nav className="flex space-x-2 py-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-start py-3 px-5 rounded-xl transition-all duration-300 ${activeCategory === cat.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 transform -translate-y-0.5'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-xl">{cat.icon}</span>
                <span className="font-bold text-sm whitespace-nowrap">{cat.label}</span>
              </div>
              <span className={`text-[10px] mt-0.5 font-medium uppercase tracking-wider ${activeCategory === cat.id ? 'text-blue-100' : 'text-gray-400'
                }`}>
                {cat.description}
              </span>
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

      <div className="space-y-8">
        {/* Curriculum Category */}
        {activeCategory === 'curriculum' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Schools & Learning Pathway</h3>
                <Button
                  variant="secondary"
                  size="sm"
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
              <div className="space-y-6">
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
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Soft Skills</h3>
              <p className="text-gray-600 mb-4">Master list of soft skills for student evaluation.</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newSoftSkill}
                  onChange={(e) => setNewSoftSkill(e.target.value)}
                  placeholder="e.g. Communication, Teamwork..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && addSoftSkill()}
                />
                <Button variant="primary" onClick={addSoftSkill}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.softSkills?.map((skill) => (
                  <span key={skill} className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                    {skill}
                    <button onClick={() => removeSoftSkill(skill)} className="ml-2 hover:text-indigo-900"><X className="w-4 h-4" /></button>
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Education Analytics</h3>
                <Button size="sm" variant="secondary" onClick={fetchEducationAnalytics} disabled={loadingStats}>
                  {loadingStats ? 'Refreshing...' : 'Refresh Stats'}
                </Button>
              </div>
              <div className="space-y-8">
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Institute Distribution</h4>
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
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Department Distribution</h4>
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
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Career & Skills Category */}
        {activeCategory === 'career' && (
          <div className="space-y-8 animate-fadeIn">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Role Categories</h3>
              <p className="text-gray-600 mb-4">Categories for job filtering (e.g. Frontend, Backend).</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value)}
                  placeholder="New category..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && addRoleCategory()}
                />
                <Button variant="primary" onClick={addRoleCategory}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.roleCategories?.map((cat) => (
                  <span key={cat} className="inline-flex items-center px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                    {cat}
                    <button onClick={() => removeRoleCategory(cat)} className="ml-2 hover:text-indigo-900"><X className="w-4 h-4" /></button>
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Role Preferences</h3>
              <p className="text-gray-600 mb-4">Roles available for student profiles.</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="New role..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && addRole()}
                />
                <Button variant="primary" onClick={addRole}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.rolePreferences?.map((role) => (
                  <span key={role} className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {role}
                    <button onClick={() => removeRole(role)} className="ml-2 hover:text-blue-900"><X className="w-4 h-4" /></button>
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Skills</h3>
              <p className="text-gray-600 mb-4">Skills for profiling and tracking.</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="New technical skill..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                />
                <Button variant="primary" onClick={addSkill}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.technicalSkills?.sort().map((skill) => (
                  <span key={skill} className="inline-flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-2 hover:text-emerald-900"><X className="w-4 h-4" /></button>
                  </span>
                ))}
              </div>
            </Card>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Proficiency Rubrics</h3>
                  <p className="text-sm text-gray-500 mt-1">Define criteria for skill levels 1 through 5.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3, 4, 5].map((level) => (
                  <Card key={level} className="border-l-4 border-l-blue-600 hover:shadow-md transition-all">
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-100 ring-4 ring-blue-50">
                          {level}
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            Level Title
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                          </label>
                          <input
                            type="text"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all font-display"
                            value={editingRubric[level]?.title || settings.proficiencyRubrics?.[level]?.title || ''}
                            onChange={(e) => setEditingRubric({
                              ...editingRubric,
                              [level]: { ...editingRubric[level], title: e.target.value }
                            })}
                            placeholder={`e.g. ${level === 1 ? 'Beginner' : level === 5 ? 'Expert' : 'Intermediate'}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            Success Criteria
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                          </label>
                          <textarea
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm text-gray-600 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                            rows={2}
                            value={editingRubric[level]?.description || settings.proficiencyRubrics?.[level]?.description || ''}
                            onChange={(e) => setEditingRubric({
                              ...editingRubric,
                              [level]: { ...editingRubric[level], description: e.target.value }
                            })}
                            placeholder="What must a student demonstrate to achieve this level?"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Registry & Data Category */}
        {activeCategory === 'directory' && (
          <div className="space-y-8 animate-fadeIn">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6 font-display">Departments & Degrees</h3>
              <div className="flex flex-col md:flex-row gap-8 min-h-[400px]">
                {/* Left Side: Degrees List */}
                <div className="w-full md:w-1/3 border-r border-gray-100 pr-4">
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newDegree}
                      onChange={(e) => setNewDegree(e.target.value)}
                      placeholder="Add degree..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white transition-all"
                      onKeyPress={(e) => e.key === 'Enter' && addDegree()}
                    />
                    <Button variant="primary" size="sm" onClick={addDegree} className="px-3">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {(settings.degreeOptions || []).map((degree) => (
                      <div
                        key={degree}
                        onClick={() => setSelectedRegistryDegree(degree)}
                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${selectedRegistryDegree === degree
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                          : 'hover:bg-blue-50 text-gray-700 hover:text-blue-600'
                          }`}
                      >
                        <span className="font-medium truncate flex-1">{degree}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDegree(degree);
                          }}
                          className={`ml-2 p-1 rounded-md transition-colors ${selectedRegistryDegree === degree
                            ? 'text-blue-200 hover:text-white hover:bg-blue-500'
                            : 'text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                            }`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side: Specializations */}
                <div className="flex-1">
                  {selectedRegistryDegree ? (
                    <div className="animate-fadeIn">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div>
                          <h4 className="text-xl font-bold text-gray-900 leading-tight">
                            {selectedRegistryDegree}
                          </h4>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Specializations & Branches</p>
                        </div>
                        <Badge variant="primary" className="bg-blue-50 text-blue-700 border-blue-100">
                          {(settings.higherEducationOptions?.[selectedRegistryDegree] || []).length} Entries
                        </Badge>
                      </div>

                      <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-3">Add New Specialization</label>
                        <div className="flex gap-2 mb-6">
                          <input
                            type="text"
                            value={newSpecialization[selectedRegistryDegree] || ''}
                            onChange={(e) => setNewSpecialization({ ...newSpecialization, [selectedRegistryDegree]: e.target.value })}
                            placeholder={`e.g. Artificial Intelligence, Marketing...`}
                            className="flex-1 px-4 py-2 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                            onKeyPress={(e) => e.key === 'Enter' && addSpecialization(selectedRegistryDegree)}
                          />
                          <Button onClick={() => addSpecialization(selectedRegistryDegree)} className="rounded-xl px-6">
                            Add Entry
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(settings.higherEducationOptions?.[selectedRegistryDegree] || []).map((spec) => (
                            <span
                              key={spec}
                              className="group px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 flex items-center shadow-sm hover:border-blue-400 hover:text-blue-600 transition-all cursor-default"
                            >
                              {spec}
                              <button
                                onClick={() => removeSpecialization(selectedRegistryDegree, spec)}
                                className="ml-3 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </span>
                          ))}
                          {(settings.higherEducationOptions?.[selectedRegistryDegree] || []).length === 0 && (
                            <div className="w-full py-12 text-center">
                              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-300">
                                <Plus className="w-8 h-8 text-gray-300" />
                              </div>
                              <p className="text-gray-400 text-sm">No specializations added for this degree yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-gray-100 flex items-center justify-center mb-6">
                        <BookOpen className="w-10 h-10 text-blue-500" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">Select a Department</h4>
                      <p className="text-gray-500 max-w-xs mt-2">Choose a degree from the left or add a new one to manage its specializations.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Institutions</h3>
                  <p className="text-xs text-gray-500 mt-1">Manage the list of schools and colleges.</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <input
                  type="text"
                  value={newInstitution}
                  onChange={(e) => setNewInstitution(e.target.value)}
                  placeholder="Institution name..."
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                />
                <input
                  type="text"
                  value={newInstitutionPincode}
                  onChange={(e) => setNewInstitutionPincode(e.target.value)}
                  placeholder="Pincode"
                  className="w-full md:w-32 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                />
                <Button variant="primary" onClick={addInstitution} className="rounded-xl px-6">Add</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                {Object.entries(settings.institutionOptions || {}).sort().map(([name, pin]) => (
                  <div key={name} className="flex flex-col p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group relative">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm leading-tight mb-2 uppercase tracking-wide truncate pr-6" title={name}>{name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">PINCODE:</span>
                          <input
                            type="text"
                            className="text-xs bg-blue-50/50 border-none rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 text-blue-700 font-bold w-20"
                            value={pin || ''}
                            onChange={(e) => updateInstitutionPincode(name, e.target.value)}
                            placeholder="Not set"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeInstitution(name)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Locations</h3>
                <p className="text-xs text-gray-500 mt-1">Available job placement cities.</p>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Add new city..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                <Button variant="primary" onClick={() => {
                  if (!newLocation.trim()) return;
                  setSettings({ ...settings, jobLocations: [...new Set([...(settings.jobLocations || []), newLocation.trim()])] });
                  setNewLocation('');
                }} className="rounded-xl">Add</Button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[50px]">
                {(settings.jobLocations || []).map((loc) => (
                  <span
                    key={loc}
                    className="group inline-flex items-center px-4 py-2 bg-white border border-gray-100 text-gray-700 rounded-xl text-sm font-medium shadow-sm hover:border-blue-400 hover:text-blue-600 transition-all"
                  >
                    {loc}
                    <button
                      onClick={() => setSettings({ ...settings, jobLocations: settings.jobLocations.filter(l => l !== loc) })}
                      className="ml-2.5 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {(settings.jobLocations || []).length === 0 && (
                  <p className="text-gray-400 text-sm italic">No locations added yet.</p>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Company Registry</h3>
                  <p className="text-xs text-gray-500 mt-1">Master list of visiting companies.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search companies..."
                      className="w-full md:w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                      value={companyFilters.search}
                      onChange={(e) => setCompanyFilters({ ...companyFilters, search: e.target.value })}
                    />
                    <div className="absolute left-3 top-2.5 text-gray-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  <Button variant="primary" onClick={() => setIsAddingCompany(true)} className="rounded-xl flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Company</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar p-1">
                {Object.entries(settings.masterCompanies || {})
                  .filter(([name]) => name.toLowerCase().includes(companyFilters.search.toLowerCase()))
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([name, data]) => (
                    <div
                      key={name}
                      onClick={() => setSelectedCompany({ name, ...data })}
                      className="group flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-400 border border-gray-50 group-hover:from-blue-50 group-hover:to-blue-100 group-hover:text-blue-500 transition-colors">
                        {data.logo ? (
                          <img src={data.logo} alt="" className="w-8 h-8 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                        ) : null}
                        <span style={{ display: data.logo ? 'none' : 'flex' }}>{name[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors" title={name}>{name}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = { ...settings.masterCompanies };
                            delete updated[name];
                            setSettings({ ...settings, masterCompanies: updated });
                          }}
                          className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-red-500 transition-colors flex items-center gap-1 mt-1"
                        >
                          <X className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                {Object.keys(settings.masterCompanies || {}).length === 0 && (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm font-medium">No companies registered yet.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Settings Category */}
        {activeCategory === 'platform' && (
          <div className="space-y-8 animate-fadeIn">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Campuses</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campuses.map((campus) => (
                  <div key={campus._id} className="p-4 border rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900">{campus.name}</h4>
                      <Badge variant="primary">
                        {typeof campus.location === 'object'
                          ? `${campus.location.city || ''}${campus.location.city && campus.location.state ? ', ' : ''}${campus.location.state || ''}`
                          : campus.location || 'Active'}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Discord Channel ID</label>
                        <div className="group relative">
                          <AlertCircle className="w-3 h-3 text-gray-400 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-tight">
                            All notifications for this campus (Job Postings, Application Updates, and Self-Applications) will be sent here. This channel takes priority over global settings.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 text-sm rounded-lg border-gray-200"
                          placeholder="Channel ID (e.g. 123456...)"
                          defaultValue={campus.discordChannelId}
                          onChange={(e) => setTempDiscordChannelId(e.target.value)}
                        />
                        <Button size="sm" onClick={() => handleSaveCampusDiscord(campus._id)} className="rounded-lg"><Save className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Placement Cycles</h3>
              <div className="flex gap-2 mb-6">
                <select className="w-32" value={newCycle.month} onChange={(e) => setNewCycle({ ...newCycle, month: e.target.value })}>
                  <option value="">Month</option>
                  {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
                </select>
                <select className="w-32" value={newCycle.year} onChange={(e) => setNewCycle({ ...newCycle, year: e.target.value })}>
                  <option value="">Year</option>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <input className="flex-1" placeholder="Description..." value={newCycle.description} onChange={(e) => setNewCycle({ ...newCycle, description: e.target.value })} />
                <Button onClick={createPlacementCycle} disabled={creatingCycle}>Create</Button>
              </div>
              <div className="space-y-2">
                {placementCycles.map((cycle) => (
                  <div key={cycle._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{new Date(2000, cycle.month - 1).toLocaleString('default', { month: 'long' })} {cycle.year}</p>
                      <p className="text-xs text-gray-500">{cycle.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant={cycle.isActive ? 'primary' : 'secondary'} onClick={() => toggleCycleActive(cycle._id, cycle.isActive)}>{cycle.isActive ? 'Active' : 'Inactive'}</Button>
                      <Button size="sm" variant="danger" onClick={() => deletePlacementCycle(cycle._id)}><Plus className="w-4 h-4 rotate-45" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Integration (Gemini)</h3>
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl mb-6">
                <div>
                  <h4 className="font-bold text-indigo-900">AI Assistant</h4>
                  <p className="text-sm text-indigo-700">Powers smart insights and student profiling.</p>
                </div>
                <Button variant={aiConfig.enabled ? 'primary' : 'secondary'} onClick={toggleAiEnabled}>{aiConfig.enabled ? 'Enabled' : 'Disabled'}</Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Google AI API Key</label>
                  <div className="flex gap-2">
                    <input type="password" placeholder={aiConfig.hasApiKey ? '••••••••••••••••' : 'Enter API Key'} value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
                    <Button onClick={saveAiConfig} disabled={savingAiConfig}>Update</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Discord Bot</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <h4 className="font-bold">Bot Status</h4>
                    <p className="text-sm text-gray-500">Connected to your workspace.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.discordConfig?.enabled} onChange={(e) => setSettings({ ...settings, discordConfig: { ...settings.discordConfig, enabled: e.target.checked } })} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5 transition-colors">Server ID</label>
                      <input
                        type="text"
                        placeholder="Discord Guild ID"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={settings.discordConfig?.guildId || ''}
                        onChange={(e) => setSettings({ ...settings, discordConfig: { ...settings.discordConfig, guildId: e.target.value } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5 transition-colors">Bot Token</label>
                      <input
                        type="password"
                        placeholder="Bot Token"
                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={settings.discordConfig?.botToken || ''}
                        onChange={(e) => setSettings({ ...settings, discordConfig: { ...settings.discordConfig, botToken: e.target.value } })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" />
                      Global Channels (Fallbacks)
                    </h5>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Job Postings Channel</label>
                          <div className="group relative">
                            <AlertCircle className="w-3 h-3 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-tight">
                              Used for job postings that apply to multiple or all campuses.
                            </div>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Channel ID"
                          className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                          value={settings.discordConfig?.channels?.jobPostings || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            discordConfig: {
                              ...settings.discordConfig,
                              channels: { ...settings.discordConfig.channels, jobPostings: e.target.value }
                            }
                          })}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">General Notifications</label>
                          <div className="group relative">
                            <AlertCircle className="w-3 h-3 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-tight">
                              Used for system-wide announcements and testing integration.
                            </div>
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Channel ID"
                          className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                          value={settings.discordConfig?.channels?.general || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            discordConfig: {
                              ...settings.discordConfig,
                              channels: { ...settings.discordConfig.channels, general: e.target.value }
                            }
                          })}
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-indigo-100/50">
                      <p className="text-[10px] text-indigo-400 leading-relaxed font-medium italic">
                        Note: Self-application and student-specific notifications ALWAYS require a campus-specific channel and will not be sent to global channels.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
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
      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedCompany(null)}></div>

          <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop border border-gray-100">
            {/* Modal Header/Banner */}
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
              <button
                onClick={() => setSelectedCompany(null)}
                className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="px-8 pb-10 -mt-12 relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center p-4 mb-6 border-4 border-white">
                  {selectedCompany.logo ? (
                    <img src={selectedCompany.logo} alt={selectedCompany.name} className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-10 h-10 text-gray-300" />
                  )}
                </div>

                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                  {selectedCompany.name}
                </h2>

                {selectedCompany.website && (
                  <a
                    href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold hover:bg-blue-100 transition-all mb-8 group"
                  >
                    <Globe className="w-4 h-4" />
                    {selectedCompany.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}

                <div className="w-full bg-gray-50 rounded-3xl p-6 text-left border border-gray-100">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-blue-500" />
                    About Company
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {selectedCompany.description || "No description provided for this company."}
                  </p>
                </div>

                <div className="mt-8 flex gap-3 w-full">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedCompany(null)}
                    className="flex-1 rounded-2xl py-4 font-bold"
                  >
                    Close View
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {isAddingCompany && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setIsAddingCompany(false)}></div>

          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-pop border border-gray-100">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Add New Company</h2>
                  <p className="text-sm text-gray-500 mt-1">Register a company in the master list.</p>
                </div>
                <button onClick={() => setIsAddingCompany(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Company Name</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm font-medium"
                    placeholder="e.g. Google India"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Official Website</label>
                  <div className="relative">
                    <Globe className="absolute left-5 top-4 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-12 pr-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm font-medium"
                      placeholder="e.g. www.google.com"
                      value={newCompany.website}
                      onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Description</label>
                  <textarea
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm font-medium min-h-[120px] resize-none"
                    placeholder="Tell us a bit about what this company does..."
                    value={newCompany.description}
                    onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setIsAddingCompany(false)}
                    className="flex-1 rounded-2xl py-4 font-bold border-gray-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAddCompany}
                    className="flex-1 rounded-2xl py-4 font-bold shadow-lg shadow-blue-200"
                    disabled={!newCompany.name.trim()}
                  >
                    Register Company
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
