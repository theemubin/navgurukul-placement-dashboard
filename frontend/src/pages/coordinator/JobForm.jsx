import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobAPI, skillAPI, campusAPI, userAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import { ArrowLeft, Save, Plus, X, Sparkles, Upload, Link, FileText, AlertCircle, Users, CheckCircle, Search, Building, MapPin, Home } from 'lucide-react';
import toast from 'react-hot-toast';

const JobForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [skills, setSkills] = useState([]); // Technical skills
  const [domainSkills, setDomainSkills] = useState([]); // Domain skills
  const [otherSkills, setOtherSkills] = useState([]); // Other skills
  const [allSkills, setAllSkills] = useState([]); // Combined list for lookup
  const [campuses, setCampuses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [schoolsWithModules, setSchoolsWithModules] = useState([]);
  // const [schoolsWithTracks, setSchoolsWithTracks] = useState([]); // Unused
  const [studentCount, setStudentCount] = useState({ total: 0, eligible: 0 });
  const [coordinators, setCoordinators] = useState([]);
  const [jdUrl, setJdUrl] = useState('');
  const [aiParseInfo, setAiParseInfo] = useState(null);
  const [parsedSuggestion, setParsedSuggestion] = useState(null); // holds parsed JD data for preview

  // Autocomplete States
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [studentLocations, setStudentLocations] = useState({ districts: [], states: [] });
  // Council Post State
  const [councilPostsList, setCouncilPostsList] = useState([]);
  const [showHometownSuggestions, setShowHometownSuggestions] = useState(false);
  const [showHomestateSuggestions, setShowHomestateSuggestions] = useState(false);
  const [showCouncilPostSuggestions, setShowCouncilPostSuggestions] = useState({}); // Keyed by index
  const [roleCategories, setRoleCategories] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    company: { name: '', website: '', description: '' },
    location: '',
    roleCategory: '',
    jobType: 'full_time',
    duration: '', // for internship
    salary: { min: '', max: '', currency: 'INR' },
    applicationDeadline: '',
    maxPositions: '',
    description: '',
    requirements: [''], // List of strings
    responsibilities: [''], // List of strings
    requiredSkills: [], // { skill: ID, proficiencyLevel: 1-5, mandatory: true }
    customRequirements: [], // { requirement: string, isMandatory: boolean }
    eligibility: {
      minCgpa: '',
      tenthGrade: { required: false, minPercentage: '' },
      twelfthGrade: { required: false, minPercentage: '' },
      higherEducation: { required: false, acceptedDegrees: [], level: '', minPercentage: '' },
      gender: 'any',
      campuses: [],
      schools: [], // School names
      minModule: '', // Specific module (hierarchical) or Track (independent)
      certifications: [], // List of strings
      minAttendance: '',
      minMonthsAtNavgurukul: '',
      englishWriting: '',
      englishSpeaking: '',
      hometown: '',
      homestate: '',
      councilPosts: [], // Array of { post: String, minMonths: Number }
      readinessRequirement: 'yes'
    },
    status: 'draft',
    interviewRounds: [{ name: 'Round 1', type: 'other' }] // Initialize with one round
  });

  const proficiencyLevels = [
    { value: 1, label: 'Beginner', description: 'Basic understanding' },
    { value: 2, label: 'Elementary', description: 'Can perform simple tasks' },
    { value: 3, label: 'Intermediate', description: 'Independent problem solving' },
    { value: 4, label: 'Advanced', description: 'Deep knowledge and complexity' },
    { value: 5, label: 'Expert', description: 'Mastery and leadership' }
  ];

  const cefrLevels = [
    { value: 'A1', label: 'A1 - Beginner' },
    { value: 'A2', label: 'A2 - Elementary' },
    { value: 'B1', label: 'B1 - Intermediate' },
    { value: 'B2', label: 'B2 - Upper Intermediate' },
    { value: 'C1', label: 'C1 - Advanced' },
    { value: 'C2', label: 'C2 - Proficient' }
  ];

  const bachelorDegrees = ['B.Tech', 'B.Sc', 'BCA', 'B.Com', 'B.A'];
  const masterDegrees = ['M.Tech', 'M.Sc', 'MCA', 'MBA', 'M.A'];

  // Module breakdown by school
  const schoolModules = {
    'School of Programming': {
      type: 'hierarchical',
      modules: [
        'Introduction to Programming',
        'Data Structures',
        'Algorithms',
        'Web Development Basics',
        'Frontend Development',
        'Backend Development',
        'Full Stack Project'
      ]
    },
    'School of Business': {
      type: 'tracks',
      modules: ['Finance', 'Marketing', 'Operations', 'HR', 'Entrepreneurship']
    },
    'School of Design': {
      type: 'tracks',
      modules: ['Graphic Design', 'UI/UX Design', 'Product Design', 'Motion Graphics']
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchCampuses();
    fetchCompanies();
    fetchLocations();
    fetchStudentLocations();
    fetchRoleCategories();
    fetchCoordinators();
    if (isEdit) fetchJob();
  }, [id]);

  const fetchCoordinators = async () => {
    try {
      const res = await userAPI.getCoordinators();
      setCoordinators(res.data.coordinators || []);
    } catch (err) {
      console.error('Error fetching coordinators', err);
    }
  };

  // Debounce for eligibility count
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudentCount();
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.eligibility]);

  const fetchCompanies = async () => {
    try {
      const response = await jobAPI.getCompanies();
      setAvailableCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await jobAPI.getLocations();
      setAvailableLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchStudentLocations = async () => {
    try {
      const response = await userAPI.getStudentLocations();
      setStudentLocations(response.data);
    } catch (error) {
      console.error('Error fetching student locations:', error);
    }
  };

  const fetchSkills = async () => {
    try {
      const response = await skillAPI.getSkills();
      setAllSkills(response.data);
      setSkills(response.data.filter(s => s.category === 'technical'));
      setDomainSkills(response.data.filter(s => s.category === 'domain'));
      setOtherSkills(response.data.filter(s => s.category === 'other' || s.category === 'soft'));
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await campusAPI.getCampuses();
      setCampuses(response.data);

      const settingsRes = await settingsAPI.getSettings().then(r => r.data.data).catch(() => ({}));

      const allSchools = settingsRes.schools && settingsRes.schools.length > 0
        ? settingsRes.schools
        : ['School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance', 'School of Design'];

      const filteredSchools = allSchools.filter(s => !settingsRes.inactiveSchools?.includes(s));
      setSchools(filteredSchools);
      setSchoolsWithModules(filteredSchools);

      // Also set Council Posts from settings if available
      if (settingsRes.councilPosts) {
        setCouncilPostsList(settingsRes.councilPosts);
      } else {
        // Fallback default list
        setCouncilPostsList(['General Secretary', 'Technical Secretary', 'Cultural Secretary', 'Sports Secretary', 'Health Secretary', 'Mess Secretary', 'Maintenance Secretary', 'Discipline Secretary', 'Academic Secretary', 'Placement Coordinator']);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchRoleCategories = async () => {
    try {
      const response = await settingsAPI.getSettings();
      setRoleCategories(response.data.data.roleCategories || []);
    } catch (error) {
      console.error('Error fetching role categories:', error);
    }
  };

  const fetchStudentCount = async () => {
    try {
      // Pass eligibility details including new fields
      const params = {
        ...formData.eligibility,
        schools: formData.eligibility.schools.join(','),
        campuses: formData.eligibility.campuses.join(','),
        certifications: formData.eligibility.certifications.join(','),
        // Council Post (taking the first one for count estimation if multiple, as API currently handles one 'councilPost' param simplicity)
        // ideally backend should support multiple, but for now let's send the first requirement if exists
        councilPost: formData.eligibility.councilPosts?.[0]?.post || undefined,
        minCouncilMonths: formData.eligibility.councilPosts?.[0]?.minMonths || undefined
      };

      // Clean undefined/null
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      const response = await userAPI.getEligibleCount(params);
      setStudentCount(response.data);
    } catch (error) {
      // console.error(error);
    }
  };

  const fetchJob = async () => {
    setLoading(true);
    try {
      const response = await jobAPI.getJob(id);
      const job = response.data;

      setFormData({
        ...job,
        company: job.company || { name: '', website: '', description: '' },
        salary: job.salary || { min: '', max: '', currency: 'INR' },
        applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().split('T')[0] : '',
        eligibility: {
          ...job.eligibility,
          hometown: job.eligibility?.hometown || '',
          homestate: job.eligibility?.homestate || ''
        },
        interviewRounds: job.interviewRounds || [{ name: 'Round 1', type: 'other' }]
      });
    } catch (error) {
      toast.error('Failed to load job details');
      navigate('/coordinator/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (!formData.title || !formData.company.name || !formData.location || !formData.applicationDeadline) {
      toast.error('Please fill in all required fields');
      setSaving(false);
      return;
    }

    try {
      const payload = { ...formData };

      if (!payload.salary.min) delete payload.salary.min;
      if (!payload.salary.max) delete payload.salary.max;

      if (isEdit) {
        await jobAPI.updateJob(id, payload);
        toast.success('Job updated successfully');
      } else {
        await jobAPI.createJob(payload);
        toast.success('Job created successfully');
      }
      navigate('/coordinator/jobs');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  // Helper to add/remove list items
  const addListItem = (field) => {
    // For structured list types, add object defaults; otherwise add empty string
    const defaultItem = field === 'interviewRounds' ? { name: '', type: 'other' } : '';
    setFormData({ ...formData, [field]: [...formData[field], defaultItem] });
  };

  const updateListItem = (field, index, value) => {
    const list = [...formData[field]];
    list[index] = value;
    setFormData({ ...formData, [field]: list });
  };

  const removeListItem = (field, index) => {
    const list = [...formData[field]];
    list.splice(index, 1);
    setFormData({ ...formData, [field]: list });
  };

  // Skill handlers
  const toggleSkill = (skillId) => {
    const exists = formData.requiredSkills.find(s => s.skill === skillId || s.skill?._id === skillId);
    if (exists) {
      setFormData({
        ...formData,
        requiredSkills: formData.requiredSkills.filter(s => s.skill !== skillId && s.skill?._id !== skillId)
      });
    } else {
      setFormData({
        ...formData,
        requiredSkills: [...formData.requiredSkills, { skill: skillId, proficiencyLevel: 1, mandatory: true }]
      });
    }
  };

  const updateSkillProficiency = (skillId, level) => {
    setFormData({
      ...formData,
      requiredSkills: formData.requiredSkills.map(s =>
        (s.skill === skillId || s.skill?._id === skillId) ? { ...s, proficiencyLevel: level } : s
      )
    });
  };

  // Academic Toggles
  const toggleAcademicRequirement = (type) => {
    setFormData({
      ...formData,
      eligibility: {
        ...formData.eligibility,
        [type]: { ...formData.eligibility[type], required: !formData.eligibility[type]?.required }
      }
    });
  };

  // JD Parsing
  const handleParseJD = async () => {
    if (!jdUrl) return;
    setParsing(true);
    try {
      const res = await jobAPI.parseJDFromUrl(jdUrl);
      setParsedSuggestion(res.data);
      setAiParseInfo({ method: 'url', success: true });
      toast.success('JD Parsed! Review suggestions below.');
    } catch (error) {
      toast.error('Failed to parse JD URL');
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true);
    try {
      const res = await jobAPI.parseJDFromPDF(file);
      setParsedSuggestion(res.data);
      setAiParseInfo({ method: 'file', success: true });
      toast.success('JD Parsed! Review suggestions below.');
    } catch (error) {
      toast.error('Failed to parse PDF');
    } finally {
      setParsing(false);
    }
  };

  const applySuggestion = () => {
    if (!parsedSuggestion) return;
    setFormData(prev => ({
      ...prev,
      title: parsedSuggestion.title || prev.title,
      description: parsedSuggestion.description || prev.description,
      company: {
        ...prev.company,
        name: parsedSuggestion.company?.name || prev.company.name,
        website: parsedSuggestion.company?.website || prev.company.website
      },
      location: parsedSuggestion.location || prev.location,
      salary: {
        ...prev.salary,
        min: parsedSuggestion.salary?.min || prev.salary.min,
        max: parsedSuggestion.salary?.max || prev.salary.max
      },
    }));
    setParsedSuggestion(null);
    toast.success('Applied suggestions to form');
  };

  // Helper for modules
  const getAvailableModules = () => {
    if (formData.eligibility.schools.length !== 1) return [];
    const school = formData.eligibility.schools[0];
    const cleanName = Object.keys(schoolModules).find(k => school.includes(k));
    return cleanName ? schoolModules[cleanName].modules : [];
  };

  const isHierarchical = () => {
    if (formData.eligibility.schools.length !== 1) return false;
    const school = formData.eligibility.schools[0];
    const cleanName = Object.keys(schoolModules).find(k => school.includes(k));
    return cleanName ? schoolModules[cleanName].type === 'hierarchical' : false;
  };

  // Custom Requirements Handlers
  const addCustomRequirement = () => {
    setFormData(prev => ({
      ...prev,
      customRequirements: [...(prev.customRequirements || []), { requirement: '', isMandatory: true }]
    }));
  };

  const updateCustomRequirement = (index, field, value) => {
    const updated = [...(formData.customRequirements || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, customRequirements: updated }));
  };

  const removeCustomRequirement = (index) => {
    const updated = [...(formData.customRequirements || [])];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, customRequirements: updated }));
  };

  if (loading) return <LoadingSpinner />;

  // Calculate hasEligibilityRestrictions
  const hasEligibilityRestrictions =
    formData.eligibility.tenthGrade?.required ||
    formData.eligibility.twelfthGrade?.required ||
    formData.eligibility.higherEducation?.required ||
    formData.eligibility.schools.length > 0 ||
    formData.eligibility.campuses.length > 0 ||
    formData.eligibility.minAttendance ||
    formData.eligibility.minMonthsAtNavgurukul ||
    formData.eligibility.femaleOnly ||
    formData.eligibility.hometown ||
    formData.eligibility.homestate;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/coordinator/jobs')}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? 'Edit Job' : 'Create New Job'}</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setFormData({ ...formData, status: formData.status === 'published' ? 'draft' : 'published' })}
            className={`btn ${formData.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
          >
            {formData.status === 'published' ? 'Published' : 'Draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Job'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* AI Parse Section */}
        {!isEdit && (
          <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
            {/* Same AI UI as before */}
            <div className="flex items-start gap-4">
              <div className="bg-white p-3 rounded-full shadow-sm">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-indigo-900 mb-1">Auto-fill with AI</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        placeholder="Paste Job URL..."
                        className="w-full pl-3 py-2 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={jdUrl}
                        onChange={(e) => setJdUrl(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleParseJD}
                      disabled={parsing || !jdUrl}
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                    >
                      Fetch
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-indigo-300 rounded cursor-pointer hover:bg-white/50 transition bg-white">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-indigo-700 font-medium">Upload PDF</span>
                      <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {parsedSuggestion && (
              <div className="mt-4 p-4 bg-white rounded border border-indigo-100 animate-slideDown">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-medium">Parsed Information</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setParsedSuggestion(null)} className="text-gray-500 text-sm">Discard</button>
                    <button type="button" onClick={applySuggestion} className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">Apply</button>
                  </div>
                </div>
                <div className="text-sm">
                  <p><strong>Title:</strong> {parsedSuggestion.title}</p>
                  <p><strong>Company:</strong> {parsedSuggestion.company?.name}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Basic Information */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Software Engineer"
                required
              />
            </div>

            {/* Company Autocomplete */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.company.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, company: { ...prev.company, name: val } }));
                    setShowCompanySuggestions(true);
                  }}
                  onFocus={() => setShowCompanySuggestions(true)}
                  placeholder="e.g. Google, Microsoft"
                  className="w-full pl-10 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                />
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />

                {showCompanySuggestions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCompanySuggestions(false)}></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableCompanies
                        .filter(c => c.name.toLowerCase().includes(formData.company.name.toLowerCase()))
                        .map((company, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                company: {
                                  name: company.name,
                                  website: company.website || '',
                                  description: company.description || ''
                                }
                              }));
                              setShowCompanySuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 border-b last:border-0"
                          >
                            <Building className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{company.name}</p>
                              {company.website && <p className="text-xs text-gray-500 truncate">{company.website}</p>}
                            </div>
                          </button>
                        ))
                      }

                      {/* Add New Option */}
                      {formData.company.name && !availableCompanies.some(c => c.name.toLowerCase() === formData.company.name.toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => setShowCompanySuggestions(false)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-primary-600 bg-primary-50"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">Add "{formData.company.name}" as new company</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Website</label>
              <input
                type="url"
                value={formData.company.website}
                onChange={(e) => setFormData({ ...formData, company: { ...formData.company, website: e.target.value } })}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coordinator (Lead)</label>
              <select
                value={formData.coordinator || ''}
                onChange={(e) => setFormData({ ...formData, coordinator: e.target.value || null })}
              >
                <option value="">None (Unassigned)</option>
                {coordinators.map(c => (
                  <option key={c._id} value={c._id}>{c.firstName} {c.lastName} {c.email ? `(${c.email})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Description</label>
              <textarea
                rows={2}
                value={formData.company.description}
                onChange={(e) => setFormData({ ...formData, company: { ...formData.company, description: e.target.value } })}
                placeholder="Brief description of the company"
              />
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Job Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Location Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => {
                    setFormData({ ...formData, location: e.target.value });
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  placeholder="e.g., Bangalore, Remote"
                  className="w-full pl-10 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                />
                <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />

                {showLocationSuggestions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowLocationSuggestions(false)}></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableLocations
                        .filter(l => l.toLowerCase().includes(formData.location.toLowerCase()))
                        .map((loc, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, location: loc }));
                              setShowLocationSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 border-b last:border-0"
                          >
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">{loc}</span>
                          </button>
                        ))
                      }
                      {/* Add New Option */}
                      {formData.location && !availableLocations.some(l => l.toLowerCase() === formData.location.toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => setShowLocationSuggestions(false)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-primary-600 bg-primary-50"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">Use "{formData.location}"</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Category</label>
              <select
                value={formData.roleCategory}
                onChange={(e) => setFormData({ ...formData, roleCategory: e.target.value })}
              >
                <option value="">Select Category (Optional)</option>
                {roleCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="internship">Internship</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            {formData.jobType === 'internship' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                >
                  <option value="">Select Duration</option>
                  <option value="1 month">1 Month</option>
                  <option value="2 months">2 Months</option>
                  <option value="3 months">3 Months</option>
                  <option value="6 months">6 Months</option>
                  <option value="1 year">1 Year</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.jobType === 'internship' ? 'Min Stipend (Monthly)' : 'Min Salary (Annual)'}
              </label>
              <input
                type="number"
                value={formData.salary.min}
                onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, min: e.target.value } })}
                placeholder={formData.jobType === 'internship' ? 'e.g., 10000' : 'e.g., 600000'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.jobType === 'internship' ? 'Max Stipend (Monthly)' : 'Max Salary (Annual)'}
              </label>
              <input
                type="number"
                value={formData.salary.max}
                onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, max: e.target.value } })}
                placeholder={formData.jobType === 'internship' ? 'e.g., 25000' : 'e.g., 1000000'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline *</label>
              <input
                type="date"
                value={formData.applicationDeadline}
                onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Positions</label>
              <input
                type="number"
                min="1"
                value={formData.maxPositions}
                onChange={(e) => setFormData({ ...formData, maxPositions: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed job description..."
                required
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Requirements</h2>
            <button type="button" onClick={() => addListItem('requirements')} className="text-primary-600 text-sm">
              + Add Requirement
            </button>
          </div>
          <div className="space-y-2">
            {formData.requirements.map((req, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={req}
                  onChange={(e) => updateListItem('requirements', index, e.target.value)}
                  placeholder="e.g., BS in Computer Science"
                />
                {formData.requirements.length > 1 && (
                  <button type="button" onClick={() => removeListItem('requirements', index)} className="p-2 text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Custom Requirements for Students */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Custom Requirements</h2>
              <p className="text-sm text-gray-500">These will be shown to students who must confirm each one (Yes/No)</p>
            </div>
            <button type="button" onClick={addCustomRequirement} className="text-primary-600 text-sm">
              + Add Requirement
            </button>
          </div>
          <div className="space-y-3">
            {(formData.customRequirements || []).map((req, index) => (
              <div key={index} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  value={req.requirement}
                  onChange={(e) => updateCustomRequirement(index, 'requirement', e.target.value)}
                  placeholder="e.g., Willing to relocate to Bangalore?"
                  className="flex-1"
                />
                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={req.isMandatory}
                    onChange={(e) => updateCustomRequirement(index, 'isMandatory', e.target.checked)}
                  />
                  Mandatory
                </label>
                <button
                  type="button"
                  onClick={() => removeCustomRequirement(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!formData.customRequirements || formData.customRequirements.length === 0) && (
              <p className="text-gray-500 text-sm italic">No custom requirements added yet</p>
            )}
          </div>
        </div>

        {/* Required Skills */}
        <div className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Required Skills</h2>
            <p className="text-sm text-gray-500">Select skills and set the minimum proficiency level required</p>
          </div>
          {/* CEFR Levels */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-2">English Proficiency (CEFR)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">English Writing</label>
                <select
                  value={formData.eligibility.englishWriting || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    eligibility: { ...formData.eligibility, englishWriting: e.target.value }
                  })}
                  className="w-full text-sm mt-1"
                >
                  <option value="">Any</option>
                  {cefrLevels.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">English Speaking</label>
                <select
                  value={formData.eligibility.englishSpeaking || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    eligibility: { ...formData.eligibility, englishSpeaking: e.target.value }
                  })}
                  className="w-full text-sm mt-1"
                >
                  <option value="">Any</option>
                  {cefrLevels.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selected Skills with Proficiency */}
          {formData.requiredSkills.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Selected Skills:</p>
              {formData.requiredSkills.map((selectedSkill) => {
                const skillId = selectedSkill.skill?._id || selectedSkill.skill;
                const skillInfo = allSkills.find(s => s._id === skillId);
                if (!skillInfo) return null;

                // If CEFR English is set, do not show duplicate English in Selected Skills
                const isEnglishSkill = (skillInfo.name || '').toLowerCase() === 'english';
                if (isEnglishSkill && (formData.eligibility.englishSpeaking || formData.eligibility.englishWriting)) {
                  return null;
                }

                return (
                  <div key={skillId} className="flex items-center gap-3 p-2 bg-primary-50 rounded-lg">
                    <span className="font-medium text-primary-800 min-w-32 text-sm">{skillInfo.name}</span>
                    <select
                      value={selectedSkill.proficiencyLevel || 1}
                      onChange={(e) => updateSkillProficiency(skillId, parseInt(e.target.value))}
                      className="text-sm"
                    >
                      {proficiencyLevels.map(level => (
                        <option key={level.value} value={level.value}>
                          {level.label} - {level.description}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleSkill(skillId)}
                      className="ml-auto text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Available Skills to Add */}
          <div className="flex flex-wrap gap-2">
            {allSkills.map((skill) => {
              // Hide English as a selectable 'skill' when CEFR fields are set (we use CEFR instead)
              const isCEFRSet = formData.eligibility.englishSpeaking || formData.eligibility.englishWriting;
              if (isCEFRSet && (skill.name || '').toLowerCase() === 'english') return null;

              const isSelected = formData.requiredSkills.some(s => s.skill === skill._id || s.skill?._id === skill._id);
              if (isSelected) return null;
              return (
                <button
                  key={skill._id}
                  type="button"
                  onClick={() => toggleSkill(skill._id)}
                  className="px-3 py-1 rounded-full text-sm transition bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  + {skill.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Eligibility Criteria */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Eligibility Criteria</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Click to select criteria. Unselected criteria means open for all in that category.
          </p>

          {/* Academic Requirements Section (Collapsible or just standard) */}
          {/* ... [Existing Academic Logic preserved in snippet below] ... */}
          {/* (Re-implementation of existing logic omitted here to save context execution space, assuming write_to_file replaces full content - I will write full content) */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Academic Requirements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 10th */}
              <div
                onClick={() => toggleAcademicRequirement('tenthGrade')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.tenthGrade?.required ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">10th Grade</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${formData.eligibility.tenthGrade?.required ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    {formData.eligibility.tenthGrade?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.tenthGrade?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <input type="number" min="0" max="100" placeholder="Min %" className="w-full text-sm"
                      value={formData.eligibility.tenthGrade?.minPercentage || ''}
                      onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, tenthGrade: { ...formData.eligibility.tenthGrade, minPercentage: e.target.value } } })}
                    />
                  </div>
                )}
              </div>
              {/* 12th */}
              <div
                onClick={() => toggleAcademicRequirement('twelfthGrade')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.twelfthGrade?.required ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">12th Grade</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${formData.eligibility.twelfthGrade?.required ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    {formData.eligibility.twelfthGrade?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.twelfthGrade?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <input type="number" min="0" max="100" placeholder="Min %" className="w-full text-sm"
                      value={formData.eligibility.twelfthGrade?.minPercentage || ''}
                      onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, twelfthGrade: { ...formData.eligibility.twelfthGrade, minPercentage: e.target.value } } })}
                    />
                  </div>
                )}
              </div>
              {/* Higher Ed */}
              <div
                onClick={() => toggleAcademicRequirement('higherEducation')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.higherEducation?.required ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">Higher Education</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${formData.eligibility.higherEducation?.required ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    {formData.eligibility.higherEducation?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.higherEducation?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-2">
                    <select className="w-full text-sm"
                      value={formData.eligibility.higherEducation?.level || ''}
                      onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, higherEducation: { ...formData.eligibility.higherEducation, level: e.target.value } } })}
                    >
                      <option value="">Select Level</option>
                      <option value="bachelor">Bachelor's</option>
                      <option value="master">Master's</option>
                      <option value="any">Any</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Geographic Preferences */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              Geographic Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Home State */}
              <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.homestate ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900 text-sm">Home State</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    className="w-full text-sm rounded border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                    value={formData.eligibility.homestate || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, eligibility: { ...formData.eligibility, homestate: e.target.value } });
                      setShowHomestateSuggestions(true);
                    }}
                    onFocus={() => setShowHomestateSuggestions(true)}
                  />
                  {showHomestateSuggestions && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowHomestateSuggestions(false)}></div>
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {studentLocations.states
                          .filter(s => s.toLowerCase().includes((formData.eligibility.homestate || '').toLowerCase()))
                          .map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, eligibility: { ...formData.eligibility, homestate: s } });
                                setShowHomestateSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                            >
                              {s}
                            </button>
                          ))}
                        {studentLocations.states.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No available data</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Home District/Town */}
              <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.hometown ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900 text-sm">Hometown (District)</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    className="w-full text-sm rounded border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                    value={formData.eligibility.hometown || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, eligibility: { ...formData.eligibility, hometown: e.target.value } });
                      setShowHometownSuggestions(true);
                    }}
                    onFocus={() => setShowHometownSuggestions(true)}
                  />
                  {showHometownSuggestions && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowHometownSuggestions(false)}></div>
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {studentLocations.districts
                          .filter(d => d.toLowerCase().includes((formData.eligibility.hometown || '').toLowerCase()))
                          .map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, eligibility: { ...formData.eligibility, hometown: d } });
                                setShowHometownSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                            >
                              {d}
                            </button>
                          ))}
                        {studentLocations.districts.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No available data</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Council Post Requirements */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                Council Post Requirements
              </h3>
              <button
                type="button"
                onClick={() => {
                  const current = formData.eligibility.councilPosts || [];
                  setFormData({
                    ...formData,
                    eligibility: {
                      ...formData.eligibility,
                      councilPosts: [...current, { post: '', minMonths: 0 }]
                    }
                  });
                }}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                + Add Post Requirement
              </button>
            </div>

            <div className="space-y-2">
              {(formData.eligibility.councilPosts || []).map((req, index) => (
                <div key={index} className="flex gap-2 items-start p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Select Post"
                      className="w-full text-sm rounded border-gray-300"
                      value={req.post}
                      onChange={(e) => {
                        const updated = [...(formData.eligibility.councilPosts || [])];
                        updated[index].post = e.target.value;
                        setFormData({ ...formData, eligibility: { ...formData.eligibility, councilPosts: updated } });
                        setShowCouncilPostSuggestions({ ...showCouncilPostSuggestions, [index]: true });
                      }}
                      onFocus={() => setShowCouncilPostSuggestions({ ...showCouncilPostSuggestions, [index]: true })}
                    />
                    {showCouncilPostSuggestions[index] && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowCouncilPostSuggestions({ ...showCouncilPostSuggestions, [index]: false })}></div>
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {councilPostsList
                            .filter(p => p.toLowerCase().includes(req.post.toLowerCase()))
                            .map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  const updated = [...(formData.eligibility.councilPosts || [])];
                                  updated[index].post = p;
                                  setFormData({ ...formData, eligibility: { ...formData.eligibility, councilPosts: updated } });
                                  setShowCouncilPostSuggestions({ ...showCouncilPostSuggestions, [index]: false });
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                              >
                                {p}
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Months"
                      min="0"
                      className="w-full text-sm rounded border-gray-300"
                      value={req.minMonths}
                      onChange={(e) => {
                        const updated = [...(formData.eligibility.councilPosts || [])];
                        updated[index].minMonths = parseInt(e.target.value) || 0;
                        setFormData({ ...formData, eligibility: { ...formData.eligibility, councilPosts: updated } });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(formData.eligibility.councilPosts || [])];
                      updated.splice(index, 1);
                      setFormData({ ...formData, eligibility: { ...formData.eligibility, councilPosts: updated } });
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!formData.eligibility.councilPosts || formData.eligibility.councilPosts.length === 0) && (
                <p className="text-xs text-gray-500 italic px-2">No council post requirements added</p>
              )}
            </div>
          </div>

          {/* Navgurukul Specific */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Navgurukul Specific
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg border-2 transition-all ${(formData.eligibility.schools || []).length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Schools</span>
                <div className="flex flex-wrap gap-1">
                  {schools.map(school => (
                    <button key={school} type="button"
                      onClick={() => {
                        const current = formData.eligibility.schools || [];
                        const newSchools = current.includes(school) ? current.filter(s => s !== school) : [...current, school];
                        setFormData({ ...formData, eligibility: { ...formData.eligibility, schools: newSchools } });
                      }}
                      className={`px-2 py-1 rounded text-xs transition ${(formData.eligibility.schools || []).includes(school) ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {school.replace('School of ', '')}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 transition-all ${(formData.eligibility.campuses || []).length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Campuses</span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {campuses.map(campus => (
                    <button key={campus._id} type="button"
                      onClick={() => {
                        const current = formData.eligibility.campuses || [];
                        const newCampuses = current.includes(campus._id) ? current.filter(c => c !== campus._id) : [...current, campus._id];
                        setFormData({ ...formData, eligibility: { ...formData.eligibility, campuses: newCampuses } });
                      }}
                      className={`px-2 py-1 rounded text-xs transition ${(formData.eligibility.campuses || []).includes(campus._id) ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {campus.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Job Readiness Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              Job Readiness Requirement
            </h3>
            <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
              <div className="flex flex-col sm:flex-row gap-4">
                <label className={`flex-1 flex items-center justify-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.readinessRequirement === 'yes' ? 'border-rose-500 bg-white' : 'border-rose-200 bg-rose-50 hover:bg-white'}`}
                  onClick={() => setFormData({ ...formData, eligibility: { ...formData.eligibility, readinessRequirement: 'yes' } })}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.eligibility.readinessRequirement === 'yes' ? 'border-rose-500' : 'border-gray-400'}`}>
                    {formData.eligibility.readinessRequirement === 'yes' && <div className="w-2 h-2 bg-rose-500 rounded-full" />}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-rose-900 text-sm">Required (100%)</p>
                    <p className="text-xs text-rose-700">Student must be 100% ready</p>
                  </div>
                </label>

                <label className={`flex-1 flex items-center justify-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.readinessRequirement === 'in_progress' ? 'border-rose-500 bg-white' : 'border-rose-200 bg-rose-50 hover:bg-white'}`}
                  onClick={() => setFormData({ ...formData, eligibility: { ...formData.eligibility, readinessRequirement: 'in_progress' } })}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.eligibility.readinessRequirement === 'in_progress' ? 'border-rose-500' : 'border-gray-400'}`}>
                    {formData.eligibility.readinessRequirement === 'in_progress' && <div className="w-2 h-2 bg-rose-500 rounded-full" />}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-rose-900 text-sm">In Progress (30%+)</p>
                    <p className="text-xs text-rose-700">Must be at least 30% ready</p>
                  </div>
                </label>

                <label className={`flex-1 flex items-center justify-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.readinessRequirement === 'no' ? 'border-gray-500 bg-white' : 'border-rose-200 bg-rose-50 hover:bg-white'}`}
                  onClick={() => setFormData({ ...formData, eligibility: { ...formData.eligibility, readinessRequirement: 'no' } })}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.eligibility.readinessRequirement === 'no' ? 'border-gray-500' : 'border-gray-400'}`}>
                    {formData.eligibility.readinessRequirement === 'no' && <div className="w-2 h-2 bg-gray-500 rounded-full" />}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 text-sm">Not Required</p>
                    <p className="text-xs text-gray-700">Open to all students</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Additional Filters */}
          {/* ... [Additional Filters Logic] ... */}
          {/* Minimizing for brevity, re-inserting existing ... */}
          <div className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div onClick={() => setFormData({ ...formData, eligibility: { ...formData.eligibility, femaleOnly: !formData.eligibility.femaleOnly } })}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.femaleOnly ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-900 text-sm">Female Only</span>
                <div className={`w-10 h-6 rounded-full relative transition-colors mt-1 ${formData.eligibility.femaleOnly ? 'bg-pink-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.eligibility.femaleOnly ? 'left-5' : 'left-1'}`}></div>
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.minAttendance ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Min Attendance %</span>
                <input type="number" min="0" max="100" placeholder="e.g. 75" className="w-full text-sm"
                  value={formData.eligibility.minAttendance || ''}
                  onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minAttendance: e.target.value } })}
                />
              </div>
              <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.minMonthsAtNavgurukul ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Min Months at NG</span>
                <input type="number" min="0" placeholder="e.g. 6" className="w-full text-sm"
                  value={formData.eligibility.minMonthsAtNavgurukul || ''}
                  onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minMonthsAtNavgurukul: e.target.value } })}
                />
              </div>
            </div>
          </div>

          {/* Count Display */}
          <div className={`p-3 rounded-lg flex items-center justify-between ${hasEligibilityRestrictions ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <div className="flex items-center gap-2">
              <Users className={`w-6 h-6 ${hasEligibilityRestrictions ? 'text-amber-500' : 'text-green-500'}`} />
              <div>
                <p className={`font-medium text-sm ${hasEligibilityRestrictions ? 'text-amber-800' : 'text-green-800'}`}>{hasEligibilityRestrictions ? 'Restricted Eligibility' : 'Open for All Students'}</p>
                <p className={`text-xs ${hasEligibilityRestrictions ? 'text-amber-600' : 'text-green-600'}`}>{hasEligibilityRestrictions ? 'Only students matching criteria can apply' : 'All registered students can apply'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${hasEligibilityRestrictions ? 'text-amber-600' : 'text-green-600'}`}>
                ~{studentCount.count || studentCount.total || 0}
              </div>
              <p className="text-xs text-gray-500">{hasEligibilityRestrictions ? 'estimated' : 'total'}</p>
            </div>
          </div>

        </div>

        {/* Interview Rounds */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Interview Rounds</h2>
            <button type="button" onClick={() => addListItem('interviewRounds')} className="text-primary-600 text-sm">+ Add Round</button>
          </div>
          <div className="space-y-4">
            {(formData.interviewRounds || []).map((round, index) => (
              <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold shrink-0">{index + 1}</div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" placeholder="Round name" value={round.name}
                    onChange={(e) => {
                      const updated = [...formData.interviewRounds];
                      updated[index].name = e.target.value;
                      setFormData({ ...formData, interviewRounds: updated });
                    }}
                  />
                  <select value={round.type}
                    onChange={(e) => {
                      const updated = [...formData.interviewRounds];
                      updated[index].type = e.target.value;
                      setFormData({ ...formData, interviewRounds: updated });
                    }}
                  >
                    <option value="aptitude">Aptitude</option>
                    <option value="technical">Technical</option>
                    <option value="coding">Coding</option>
                    <option value="hr">HR</option>
                    <option value="group_discussion">GD</option>
                    <option value="other">Other</option>
                  </select>
                  {formData.interviewRounds.length > 1 && (
                    <button type="button" onClick={() => removeListItem('interviewRounds', index)} className="text-red-500 text-sm">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-48" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="application_stage">Open for Applications</option>
                <option value="hr_shortlisting">HR Shortlisting</option>
                <option value="interviewing">Interviewing</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
                <option value="filled">Filled</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/coordinator/jobs')} className="btn btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};

export default JobForm;
