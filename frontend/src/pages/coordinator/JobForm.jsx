import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobAPI, skillAPI, campusAPI, userAPI, settingsAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import {
  ArrowLeft, Save, Plus, X, Sparkles, Upload, Link, FileText,
  AlertCircle, Users, CheckCircle, Search, Building, MapPin,
  Home, Briefcase, IndianRupee, ExternalLink, Calendar, Clock,
  History, Download, Settings, Trash2, Edit, Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

const JobForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
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
  const [jdRawText, setJdRawText] = useState('');
  const [showRawTextInput, setShowRawTextInput] = useState(false);
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
    company: { name: '', website: '', description: '', logo: '' },
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
      minGharAttendance: '',
      minMonthsAtNavgurukul: '',
      englishWriting: '',
      englishSpeaking: '',
      homestate: '',
      councilPosts: [], // Array of { post: String, minMonths: Number }
      readinessRequirement: 'yes',
      houses: [],
      requiredGharStatuses: [],
      minReadTheoryLevel: '',
      minAtCoderRating: ''
    },
    status: 'draft',
    interviewRounds: [{ name: 'Round 1', type: 'other' }] // Initialize with one round
  });
  const [salaryPeriod, setSalaryPeriod] = useState('yearly'); // 'yearly' or 'monthly'

  const [settings, setSettings] = useState({
    jobLocations: [],
    masterCompanies: {},
    proficiencyRubrics: {
      '1': { label: 'Basic', description: 'Has basic theoretical knowledge and can perform simple tasks with guidance.' },
      '2': { label: 'Intermediate', description: 'Can work independently on routine tasks and understands core principles.' },
      '3': { label: 'Advanced', description: 'Can handle complex problems, optimize workflows, and guide others.' },
      '4': { label: 'Expert', description: 'Deep mastery of the subject with ability to architect systems and lead strategy.' }
    }
  });

  const proficiencyLevels = [1, 2, 3, 4].map(l => ({
    value: l,
    label: settings.proficiencyRubrics?.[l]?.label || `Level ${l} `,
    description: settings.proficiencyRubrics?.[l]?.description || ''
  }));

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
      const res = await settingsAPI.getSettings();
      const master = res.data.data.masterCompanies || {};
      setAvailableCompanies(Object.values(master));
      setSettings(prev => ({ ...prev, ...res.data.data }));
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await settingsAPI.getSettings();
      setAvailableLocations(res.data.data.jobLocations || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const handleAddCompany = async (name) => {
    try {
      const companyData = { name };
      // Website is optional but good for favicon
      const res = await settingsAPI.addCompanyOption(companyData);
      if (res.data.success) {
        toast.success(`Registered "${name}" as a company`);
        await fetchCompanies();
        return true;
      }
    } catch (err) {
      console.error('Failed to add company', err);
    }
    return false;
  };

  const handleAddLocation = async (location) => {
    try {
      const res = await settingsAPI.addLocationOption(location);
      if (res.data.success) {
        toast.success(`Added "${location}" to available locations`);
        await fetchLocations();
        return true;
      }
    } catch (err) {
      console.error('Failed to add location', err);
    }
    return false;
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
      setOtherSkills(response.data.filter(s => s.category === 'other' || s.category === 'soft' || s.category === 'soft_skill' || s.category === 'office' || s.category === 'language'));
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
        schools: formData.eligibility.schools?.length > 0 ? formData.eligibility.schools.join(',') : undefined,
        campuses: formData.eligibility.campuses?.length > 0 ? formData.eligibility.campuses.join(',') : undefined,
        houses: formData.eligibility.houses?.length > 0 ? formData.eligibility.houses.join(',') : undefined,
        certifications: formData.eligibility.certifications?.length > 0 ? formData.eligibility.certifications.join(',') : undefined,
        // Council Post (taking the first one for count estimation if multiple, as API currently handles one 'councilPost' param simplicity)
        // ideally backend should support multiple, but for now let's send the first requirement if exists
        councilPost: formData.eligibility.councilPosts?.[0]?.post || undefined,
        minCouncilMonths: formData.eligibility.councilPosts?.[0]?.minMonths || undefined,
        // Academic requirements - send as booleans and values
        tenthRequired: formData.eligibility.tenthGrade?.required ? 'true' : undefined,
        tenthMinPercentage: formData.eligibility.tenthGrade?.minPercentage || undefined,
        twelfthRequired: formData.eligibility.twelfthGrade?.required ? 'true' : undefined,
        twelfthMinPercentage: formData.eligibility.twelfthGrade?.minPercentage || undefined,
        higherEducationRequired: formData.eligibility.higherEducation?.required ? 'true' : undefined,
        higherEducationMinPercentage: formData.eligibility.higherEducation?.minPercentage || undefined,
        // Required Skills - send as JSON string for complex data structure
        requiredSkills: formData.requiredSkills?.length > 0 ? JSON.stringify(formData.requiredSkills) : undefined,
        // Ghar Dashboard Filters
        minGharAttendance: formData.eligibility.minGharAttendance || undefined,
        requiredGharStatuses: formData.eligibility.requiredGharStatuses?.length > 0 ? formData.eligibility.requiredGharStatuses.join(',') : undefined,
        minReadTheoryLevel: formData.eligibility.minReadTheoryLevel || undefined,
        minAtCoderRating: formData.eligibility.minAtCoderRating || undefined
      };

      // Clean undefined/null/empty values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

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
        company: {
          name: job.company?.name || '',
          website: job.company?.website || '',
          description: job.company?.description || '',
          logo: job.company?.logo || ''
        },
        salary: {
          min: job.salary?.min ?? '',
          max: job.salary?.max ?? '',
          currency: job.salary?.currency || 'INR'
        },
        applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().split('T')[0] : '',
        eligibility: {
          ...job.eligibility,
          minCgpa: job.eligibility?.minCgpa ?? '',
          minAttendance: job.eligibility?.minAttendance ?? '',
          minMonthsAtNavgurukul: job.eligibility?.minMonthsAtNavgurukul ?? '',
          hometown: job.eligibility?.hometown || '',
          homestate: job.eligibility?.homestate || '',
          tenthGrade: {
            required: job.eligibility?.tenthGrade?.required || false,
            minPercentage: job.eligibility?.tenthGrade?.minPercentage ?? ''
          },
          twelfthGrade: {
            required: job.eligibility?.twelfthGrade?.required || false,
            minPercentage: job.eligibility?.twelfthGrade?.minPercentage ?? ''
          },
          higherEducation: {
            required: job.eligibility?.higherEducation?.required || false,
            acceptedDegrees: job.eligibility?.higherEducation?.acceptedDegrees || [],
            level: job.eligibility?.higherEducation?.level || '',
            minPercentage: job.eligibility?.higherEducation?.minPercentage ?? ''
          },
          minGharAttendance: job.eligibility?.minGharAttendance ?? '',
          requiredGharStatuses: job.eligibility?.requiredGharStatuses || [],
          minReadTheoryLevel: job.eligibility?.minReadTheoryLevel ?? '',
          minAtCoderRating: job.eligibility?.minAtCoderRating ?? ''
        },
        interviewRounds: job.interviewRounds?.length > 0 ? job.interviewRounds : [{ name: 'Round 1', type: 'other' }]
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

      // Convert monthly salary to annual before saving to database
      if (salaryPeriod === 'monthly') {
        if (payload.salary.min) payload.salary.min = Number(payload.salary.min) * 12;
        if (payload.salary.max) payload.salary.max = Number(payload.salary.max) * 12;
      }

      if (!payload.salary.min) delete payload.salary.min;
      if (!payload.salary.max) delete payload.salary.max;

      // Sync company details back to master list so they are available for future jobs
      if (formData.company.name) {
        try {
          await settingsAPI.addCompanyOption({
            name: formData.company.name,
            website: formData.company.website || '',
            description: formData.company.description || '',
            logo: formData.company.logo || ''
          });
        } catch (err) {
          console.error('Failed to sync company details to master list', err);
          // Don't block job saving if master list sync fails
        }
      }

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

  const handleCopyLink = () => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/student/jobs/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Shareable student link copied to clipboard!');
  };

  const handleBroadcast = async () => {
    if (!id) return;
    setBroadcasting(true);
    try {
      await jobAPI.broadcastJob(id);
      toast.success('Job broadcasted to Discord!');
    } catch (err) {
      toast.error('Failed to broadcast job');
      console.error(err);
    } finally {
      setBroadcasting(false);
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

    // Check if value contains newlines (from paste)
    if (typeof value === 'string' && (value.includes('\n') || value.includes('\r'))) {
      const parts = value.split(/\r?\n/)
        .map(p => p.trim())
        // Clean up common bullet points: •, -, *, 1. etc
        .map(p => p.replace(/^[•\-\*\d+\.]\s*/, ''))
        .filter(p => p !== '');

      if (parts.length > 1) {
        list.splice(index, 1, ...parts);
        setFormData({ ...formData, [field]: list });
        return;
      }
    }

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
      setParsedSuggestion(res.data.data);
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
      setParsedSuggestion(res.data.data);
      setAiParseInfo({ method: 'file', success: true });
      toast.success('JD Parsed! Review suggestions below.');
    } catch (error) {
      toast.error('Failed to parse PDF');
    } finally {
      setParsing(false);
    }
  };

  const handleParseRawText = async () => {
    if (!jdRawText.trim()) return;
    setParsing(true);
    try {
      const res = await jobAPI.parseJDFromText(jdRawText);
      setParsedSuggestion(res.data.data);
      setAiParseInfo({ method: 'text', success: true });
      toast.success('JD Parsed! Review suggestions below.');
      setShowRawTextInput(false);
    } catch (error) {
      console.error('Parse Raw Text Error:', error);
      toast.error('Failed to parse JD text');
    } finally {
      setParsing(false);
    }
  };

  const applySuggestion = () => {
    if (!parsedSuggestion) return;

    // Map suggested skills to system skills
    const mappedSkills = [];
    if (parsedSuggestion.suggestedSkills) {
      parsedSuggestion.suggestedSkills.forEach(skillName => {
        const existingSkill = allSkills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        if (existingSkill) {
          mappedSkills.push({
            skill: existingSkill._id,
            proficiencyLevel: 1,
            mandatory: true
          });
        }
      });
    }

    // Process custom requirements
    let customReqs = formData.customRequirements || [];
    if (parsedSuggestion.requirements && parsedSuggestion.requirements.length > 0) {
      const parsedReqs = parsedSuggestion.requirements.map(req => ({
        requirement: req,
        isMandatory: true
      }));
      customReqs = [...customReqs, ...parsedReqs].slice(0, 15);
    }

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
      jobType: parsedSuggestion.jobType || prev.jobType,
      salary: {
        ...prev.salary,
        min: parsedSuggestion.salary?.min || prev.salary.min,
        max: parsedSuggestion.salary?.max || prev.salary.max
      },
      // Merge unique skills
      requiredSkills: [...new Map([...prev.requiredSkills, ...mappedSkills].map(item => [item.skill, item])).values()],
      customRequirements: customReqs
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

    // Check if value contains newlines (from paste)
    if (field === 'requirement' && typeof value === 'string' && (value.includes('\n') || value.includes('\r'))) {
      const parts = value.split(/\r?\n/)
        .map(p => p.trim())
        .map(p => p.replace(/^[•\-\*\d+\.]\s*/, ''))
        .filter(p => p !== '');

      if (parts.length > 1) {
        const isMandatory = updated[index]?.isMandatory ?? true;
        const newReqs = parts.map(p => ({ requirement: p, isMandatory }));
        updated.splice(index, 1, ...newReqs);
        setFormData(prev => ({ ...prev, customRequirements: updated }));
        return;
      }
    }

    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, customRequirements: updated }));
  };

  const removeCustomRequirement = (index) => {
    const updated = [...(formData.customRequirements || [])];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, customRequirements: updated }));
  };

  if (loading) return <LoadingSpinner />;

  // Calculate hasEligibilityRestrictions - check if ANY filter/requirement is set
  const hasEligibilityRestrictions =
    // Academic requirements
    formData.eligibility.tenthGrade?.required ||
    formData.eligibility.twelfthGrade?.required ||
    formData.eligibility.higherEducation?.required ||
    // Navgurukul specific
    formData.eligibility.schools.length > 0 ||
    formData.eligibility.campuses.length > 0 ||
    formData.eligibility.houses?.length > 0 ||
    // Attendance and tenure
    formData.eligibility.minAttendance ||
    formData.eligibility.minMonthsAtNavgurukul ||
    // Gender
    formData.eligibility.femaleOnly ||
    // Geographic
    formData.eligibility.hometown ||
    formData.eligibility.homestate ||
    // English proficiency (CEFR)
    formData.eligibility.englishSpeaking ||
    formData.eligibility.englishWriting ||
    // Job readiness
    (formData.eligibility.readinessRequirement && formData.eligibility.readinessRequirement !== 'no') ||
    // Council posts
    (formData.eligibility.councilPosts?.length > 0 && formData.eligibility.councilPosts.some(cp => cp.post)) ||
    // Ghar Status
    (formData.eligibility.requiredGharStatuses?.length > 0) ||
    // Certifications
    formData.eligibility.certifications?.length > 0 ||
    // Required Skills
    formData.requiredSkills.length > 0;

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
            className={`btn ${formData.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} `}
          >
            {formData.status === 'published' ? 'Published' : 'Draft'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100 flex items-center gap-2"
              title="Copy student-facing job link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share Link</span>
            </button>
          )}
          {isEdit && (
            <button
              type="button"
              onClick={handleBroadcast}
              disabled={broadcasting}
              className="btn bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-100 flex items-center gap-2"
              title="Broadcast to Discord"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">{broadcasting ? 'Broadcasting...' : 'Broadcast'}</span>
            </button>
          )}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRawTextInput(!showRawTextInput)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-indigo-300 rounded cursor-pointer hover:bg-white/50 transition bg-white text-sm text-indigo-700 font-medium"
                    >
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Paste Text
                    </button>
                  </div>
                </div>

                {showRawTextInput && (
                  <div className="mt-4 animate-slideDown">
                    <textarea
                      placeholder="Paste the complete Job Description here..."
                      className="w-full p-3 rounded border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[150px] text-sm"
                      value={jdRawText}
                      onChange={(e) => setJdRawText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowRawTextInput(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleParseRawText}
                        disabled={parsing || !jdRawText.trim()}
                        className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2 transition-all"
                      >
                        {parsing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Analyze JD
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Job Title</p>
                    <p className="font-medium truncate" title={parsedSuggestion.title}>{parsedSuggestion.title || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Company</p>
                    <p className="font-medium truncate" title={parsedSuggestion.company?.name}>{parsedSuggestion.company?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Location</p>
                    <p className="font-medium truncate" title={parsedSuggestion.location}>{parsedSuggestion.location || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] uppercase font-bold">Salary (Annual)</p>
                    <p className="font-medium">
                      {parsedSuggestion.salary?.min ? `₹${(parsedSuggestion.salary.min / 100000).toFixed(1)}L` : 'N/A'}
                      {parsedSuggestion.salary?.max && parsedSuggestion.salary.max !== parsedSuggestion.salary.min ? ` - ₹${(parsedSuggestion.salary.max / 100000).toFixed(1)}L` : ''}
                    </p>
                  </div>
                </div>

                {parsedSuggestion.suggestedSkills?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-indigo-50">
                    <p className="text-gray-400 text-[10px] uppercase font-bold mb-1.5">Skills Found</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedSuggestion.suggestedSkills.map((skill, i) => {
                        const isMatch = allSkills.some(s => s.name.toLowerCase() === skill.toLowerCase());
                        return (
                          <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isMatch ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              <SearchableSelect
                label="Company Name"
                required
                placeholder="e.g. Google, Microsoft"
                options={availableCompanies.map(c => c.name)}
                value={formData.company.name}
                onChange={(val) => {
                  const company = availableCompanies.find(c => c.name === val);
                  setFormData(prev => ({
                    ...prev,
                    company: {
                      name: val,
                      website: company?.website || '',
                      description: company?.description || '',
                      logo: company?.logo || ''
                    }
                  }));
                }}
                onAdd={handleAddCompany}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Website</label>
                <input
                  type="url"
                  value={formData.company.website}
                  onChange={(e) => {
                    const website = e.target.value;
                    let logo = formData.company.logo;

                    // Only try to fetch favicon if website contains a dot and is not just "www." or similar
                    if (website && website.includes('.') && website.length > 5 && !logo) {
                      try {
                        const domain = website.replace(/^https?:\/\//, '').split('/')[0];
                        if (domain && domain.includes('.')) {
                          logo = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                        }
                      } catch (e) { /* ignore */ }
                    }

                    setFormData({ ...formData, company: { ...formData.company, website, logo } });
                  }}
                  placeholder="https://..."
                />
              </div>
              <div className="w-20">
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                <div className="w-full h-[38px] flex items-center justify-center bg-gray-50 border rounded-lg overflow-hidden">
                  {formData.company.logo ? (
                    <img src={formData.company.logo} alt="Logo" className="w-6 h-6 object-contain" />
                  ) : (
                    <Building className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
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
        <div className="card" >
          <h2 className="text-lg font-semibold mb-4">Job Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Location Autocomplete */}
            <div>
              <SearchableSelect
                label="Location"
                placeholder="e.g., Bangalore, Remote"
                options={availableLocations}
                value={formData.location}
                onChange={(val) => setFormData({ ...formData, location: val })}
                onAdd={handleAddLocation}
                required
              />
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
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Salary Details ({formData.salary.currency || 'INR'})</label>
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSalaryPeriod('monthly')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${salaryPeriod === 'monthly' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalaryPeriod('yearly')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${salaryPeriod === 'yearly' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Yearly
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min {salaryPeriod === 'monthly' ? 'Monthly' : 'Annual'} {formData.jobType === 'internship' ? 'Stipend' : 'Salary'}
              </label>
              <div className="relative group">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="number"
                  className="pl-7"
                  value={formData.salary.min}
                  onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, min: e.target.value } })}
                  placeholder={salaryPeriod === 'monthly' ? 'e.g., 25000' : 'e.g., 300000'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max {salaryPeriod === 'monthly' ? 'Monthly' : 'Annual'} {formData.jobType === 'internship' ? 'Stipend' : 'Salary'}
              </label>
              <div className="relative group">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="number"
                  className="pl-7"
                  value={formData.salary.max}
                  onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, max: e.target.value } })}
                  placeholder={salaryPeriod === 'monthly' ? 'e.g., 50000' : 'e.g., 600000'}
                />
              </div>
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
        <div className="card" >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Requirements</h2>
            <button type="button" onClick={() => addListItem('requirements')} className="text-primary-600 text-sm">
              + Add Requirement
            </button>
          </div>
          <div className="space-y-2">
            {formData.requirements.map((req, index) => (
              <div key={index} className="flex gap-3 items-start group">
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={req}
                    ref={el => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                    onChange={(e) => updateListItem('requirements', index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const newList = [...formData.requirements];
                        newList.splice(index + 1, 0, '');
                        setFormData({ ...formData, requirements: newList });
                        setTimeout(() => {
                          const inputs = document.querySelectorAll('textarea[placeholder="e.g., BS in Computer Science"]');
                          if (inputs[index + 1]) inputs[index + 1].focus();
                        }, 0);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none overflow-hidden text-sm bg-white hover:border-gray-300 transition-colors"
                    placeholder="e.g., BS in Computer Science"
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                </div>
                {formData.requirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem('requirements', index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove requirement"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Custom Requirements for Students */}
        <div className="card" >
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
              <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg group">
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={req.requirement}
                    ref={el => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                    onChange={(e) => updateCustomRequirement(index, 'requirement', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const updated = [...(formData.customRequirements || [])];
                        updated.splice(index + 1, 0, { requirement: '', isMandatory: true });
                        setFormData(prev => ({ ...prev, customRequirements: updated }));
                        setTimeout(() => {
                          const inputs = document.querySelectorAll('textarea[placeholder="e.g., Willing to relocate to Bangalore?"]');
                          if (inputs[index + 1]) inputs[index + 1].focus();
                        }, 0);
                      }
                    }}
                    placeholder="e.g., Willing to relocate to Bangalore?"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none overflow-hidden text-sm bg-white hover:border-gray-300 transition-colors"
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2 shrink-0 pt-1">
                  <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-primary-600 focus:ring-primary-500"
                      checked={req.isMandatory}
                      onChange={(e) => updateCustomRequirement(index, 'isMandatory', e.target.checked)}
                    />
                    <span className="text-gray-600">Mandatory</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeCustomRequirement(index)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Remove
                  </button>
                </div>
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

          {/* Academic Requirements Section */}
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

          {/* Job Readiness Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              Job Readiness Requirement
            </h3>
            <div className="bg-rose-50 p-4 rounded-lg border border-rose-100">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
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

              {/* Global Readiness Metrics Note */}
              <div className="bg-white/60 rounded-lg p-3 border border-rose-100/50">
                <p className="text-[10px] font-bold text-rose-800 uppercase mb-2 tracking-wide">Common Readiness Standards (Apply to All Schools):</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] text-rose-700 font-medium">Attendance: Verified mandatory min.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] text-rose-700 font-medium">English: B2 Level (Speaking & Writing)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] text-rose-700 font-medium">Read Theory: Level 6+ (&gt;5)</span>
                  </div>
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

          {/* Additional Internal Filters */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              Internal Filtering
            </h3>
            <div className={`p-3 rounded-lg border-2 transition-all ${(formData.eligibility.houses || []).length > 0 ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900 text-sm">House Selection</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {['Bageshree House', 'Bhairav House', 'Malhar House'].map(house => (
                  <button key={house} type="button"
                    onClick={() => {
                      const current = formData.eligibility.houses || [];
                      const newHouses = current.includes(house) ? current.filter(h => h !== house) : [...current, house];
                      setFormData({ ...formData, eligibility: { ...formData.eligibility, houses: newHouses } });
                    }}
                    className={`px-2 py-1 rounded text-[10px] transition ${(formData.eligibility.houses || []).includes(house) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {house}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Verified Dashboard Filters (Grouped) */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Verified Sync Filters (Ghar Dashboard)
            </h3>
            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Schools */}
                <div className={`p-3 rounded-lg border-2 transition-all ${(formData.eligibility.schools || []).length > 0 ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Schools</span>
                  <div className="flex flex-wrap gap-1">
                    {schools.map(school => (
                      <button key={school} type="button"
                        onClick={() => {
                          const current = formData.eligibility.schools || [];
                          const next = current.includes(school) ? current.filter(s => s !== school) : [...current, school];
                          setFormData({ ...formData, eligibility: { ...formData.eligibility, schools: next } });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition ${(formData.eligibility.schools || []).includes(school) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {school.replace('School of ', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Campuses */}
                <div className={`p-3 rounded-lg border-2 transition-all ${(formData.eligibility.campuses || []).length > 0 ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Campuses</span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {campuses.map(campus => (
                      <button key={campus._id} type="button"
                        onClick={() => {
                          const current = formData.eligibility.campuses || [];
                          const next = current.includes(campus._id) ? current.filter(c => c !== campus._id) : [...current, campus._id];
                          setFormData({ ...formData, eligibility: { ...formData.eligibility, campuses: next } });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] transition ${(formData.eligibility.campuses || []).includes(campus._id) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {campus.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Geographical */}
                <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.homestate || formData.eligibility.hometown ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Location (State/District)</span>
                  <div className="space-y-2">
                    <div className="relative">
                      <input type="text" placeholder="State..." className="w-full text-xs py-1" value={formData.eligibility.homestate || ''} onChange={(e) => { setFormData({ ...formData, eligibility: { ...formData.eligibility, homestate: e.target.value } }); setShowHomestateSuggestions(true); }} onFocus={() => setShowHomestateSuggestions(true)} />
                      {showHomestateSuggestions && (
                        <div className="absolute z-30 w-full mt-1 bg-white border rounded shadow-lg max-h-32 overflow-y-auto">
                          {studentLocations.states.filter(s => s.toLowerCase().includes((formData.eligibility.homestate || '').toLowerCase())).map(s => (
                            <button key={s} type="button" onClick={() => { setFormData({ ...formData, eligibility: { ...formData.eligibility, homestate: s } }); setShowHomestateSuggestions(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-50 text-[10px] border-b">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <input type="text" placeholder="District..." className="w-full text-xs py-1" value={formData.eligibility.hometown || ''} onChange={(e) => { setFormData({ ...formData, eligibility: { ...formData.eligibility, hometown: e.target.value } }); setShowHometownSuggestions(true); }} onFocus={() => setShowHometownSuggestions(true)} />
                      {showHometownSuggestions && (
                        <div className="absolute z-30 w-full mt-1 bg-white border rounded shadow-lg max-h-32 overflow-y-auto">
                          {studentLocations.districts.filter(d => d.toLowerCase().includes((formData.eligibility.hometown || '').toLowerCase())).map(d => (
                            <button key={d} type="button" onClick={() => { setFormData({ ...formData, eligibility: { ...formData.eligibility, hometown: d } }); setShowHometownSuggestions(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-50 text-[10px] border-b">{d}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. English Proficiency */}
                <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.englishWriting || formData.eligibility.englishSpeaking ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">English Level (CEFR)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="text-[10px] py-1" value={formData.eligibility.englishWriting || ''} onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, englishWriting: e.target.value } })}>
                      <option value="">Writing</option>
                      {cefrLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <select className="text-[10px] py-1" value={formData.eligibility.englishSpeaking || ''} onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, englishSpeaking: e.target.value } })}>
                      <option value="">Speaking</option>
                      {cefrLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* 5. Attendance & Status */}
                <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.minGharAttendance || (formData.eligibility.requiredGharStatuses || []).length > 0 ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Attendance & Status</span>
                  <input type="number" placeholder="Min %" className="w-full text-[10px] py-1 mb-2" value={formData.eligibility.minGharAttendance || ''} onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minGharAttendance: e.target.value } })} />
                  <div className="flex flex-wrap gap-1">
                    {['Active', 'Placed', 'Intern (Out Campus)', 'Intern (In Campus)', 'Dropout'].map(s => (
                      <button key={s} type="button" onClick={() => {
                        const current = formData.eligibility.requiredGharStatuses || [];
                        const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                        setFormData({ ...formData, eligibility: { ...formData.eligibility, requiredGharStatuses: next } });
                      }} className={`px-1 rounded-[2px] text-[8px] border ${(formData.eligibility.requiredGharStatuses || []).includes(s) ? 'bg-green-600 border-green-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* 6. Academic Metrics (ReadTheory/Atcoder) */}
                <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.minReadTheoryLevel || formData.eligibility.minAtCoderRating ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Academic Metrics</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-gray-400 uppercase block mb-0.5">ReadTheory Level</span>
                      <input type="number" placeholder="Level" className="w-full text-[10px] py-1" value={formData.eligibility.minReadTheoryLevel || ''} onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minReadTheoryLevel: e.target.value } })} />
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-400 uppercase block mb-0.5">AtCoder Rating</span>
                      <input type="number" placeholder="Rating" className="w-full text-[10px] py-1" value={formData.eligibility.minAtCoderRating || ''} onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minAtCoderRating: e.target.value } })} />
                    </div>
                  </div>
                </div>

                {/* 7. Gender (Verified) */}
                <div onClick={() => setFormData({ ...formData, eligibility: { ...formData.eligibility, femaleOnly: !formData.eligibility.femaleOnly } })}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${formData.eligibility.femaleOnly ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Gender (Ghar)</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600">Female Only</span>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.eligibility.femaleOnly ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formData.eligibility.femaleOnly ? 'left-4.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>
                </div>

                {/* 8. Tenure at Navgurukul (Verified) */}
                <div className={`p-3 rounded-lg border-2 transition-all ${formData.eligibility.minMonthsAtNavgurukul ? 'border-green-500 bg-white' : 'border-gray-200 bg-white'}`}>
                  <span className="font-medium text-gray-900 text-xs block mb-1 uppercase tracking-wider">Min Tenure (Months)</span>
                  <input type="number" min="0" placeholder="e.g. 6" className="w-full text-[10px] py-1"
                    value={formData.eligibility.minMonthsAtNavgurukul || ''}
                    onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, minMonthsAtNavgurukul: e.target.value } })}
                  />
                  <p className="text-[8px] text-gray-400 mt-1">* Calculated from admission date</p>
                </div>
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
            <button type="button" onClick={() => addListItem('interviewRounds')} className="text-primary-600 text-sm flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4" /> Add Round
            </button>
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
