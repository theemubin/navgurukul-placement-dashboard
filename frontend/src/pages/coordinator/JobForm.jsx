import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobAPI, skillAPI, campusAPI, userAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import { ArrowLeft, Save, Plus, X, Sparkles, Upload, Link, FileText, AlertCircle, Users, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const JobForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [allSkills, setAllSkills] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [jdUrl, setJdUrl] = useState('');
  const [aiParseInfo, setAiParseInfo] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    company: { name: '', website: '', description: '' },
    description: '',
    requirements: [''],
    responsibilities: [''],
    customRequirements: [], // New: visible requirements for students
    location: '',
    jobType: 'full_time',
    duration: '', // For internships
    salary: { min: '', max: '', currency: 'INR' },
    requiredSkills: [], // Now includes proficiencyLevel
    eligibility: { 
      openForAll: true,
      // Academic requirements
      tenthGrade: { required: false, minPercentage: '' },
      twelfthGrade: { required: false, minPercentage: '' },
      higherEducation: { required: false, level: '', acceptedDegrees: [] }, // level: 'bachelor', 'master', 'any'
      // Navgurukul specific
      schools: [],
      campuses: [],
      minModule: '', // Will store the minimum required module
      // Other requirements
      certifications: [],
      // English proficiency (CEFR)
      englishWriting: '',
      englishSpeaking: '',
      // Additional filters
      femaleOnly: false,
      minAttendance: null,
      minMonthsAtNavgurukul: null,
      // Deadline
      shortlistDeadline: ''
    },
    applicationDeadline: '',
    maxPositions: 1,
    status: 'draft',
    interviewRounds: [{ name: '', type: 'technical', description: '' }]
  });

  // Available degree options - organized by level
  const bachelorDegrees = ['BA', 'BSc', 'BCom', 'BCA', 'BTech', 'BE', 'BBA', 'BEd', 'LLB'];
  const masterDegrees = ['MA', 'MSc', 'MCom', 'MCA', 'MTech', 'ME', 'MBA', 'MEd', 'LLM', 'PhD'];
  const otherQualifications = ['Diploma', 'ITI', 'Certification', 'Any Graduate'];

  // CEFR levels for English proficiency
  const cefrLevels = [
    { value: '', label: 'Not Required' },
    { value: 'A1', label: 'A1 - Beginner' },
    { value: 'A2', label: 'A2 - Elementary' },
    { value: 'B1', label: 'B1 - Intermediate' },
    { value: 'B2', label: 'B2 - Upper Intermediate' },
    { value: 'C1', label: 'C1 - Advanced' },
    { value: 'C2', label: 'C2 - Proficient' }
  ];

  // Module hierarchy per school - MUST match Profile.jsx modules
  // Note: Only Programming and Business have hierarchical modules
  // Second Chance has separate tracks (not hierarchy)
  // Finance and Education use custom descriptions in student profiles
  const schoolModules = {
    'School of Programming': [
      'Programming Foundations',
      'Problem Solving & Flowcharts',
      'Web Fundamentals',
      'JavaScript Fundamentals',
      'Advanced JavaScript',
      'DOM & Browser APIs',
      'Python Fundamentals',
      'Advanced Python',
      'Data Structures & Algorithms',
      'Advanced Data Structures',
      'React & Frontend Frameworks'
    ],
    'School of Business': [
      'CRM',
      'Digital Marketing',
      'Data Analytics',
      'Advanced Google Sheets'
    ],
    'School of Second Chance': [
      'Master Chef',
      'Fashion Designing'
    ]
    // Note: School of Finance and School of Education don't have predefined modules
  };

  // Schools that have hierarchical modules (where order matters)
  const schoolsWithHierarchy = ['School of Programming', 'School of Business'];
  
  // Schools that have non-hierarchical tracks (can select any)
  const schoolsWithTracks = ['School of Second Chance'];

  // Schools that have any predefined modules
  const schoolsWithModules = ['School of Programming', 'School of Business', 'School of Second Chance'];

  // Get modules for selected school (only show if exactly one school with modules is selected)
  const getAvailableModules = () => {
    const selectedSchools = formData.eligibility.schools || [];
    if (selectedSchools.length === 1 && schoolsWithModules.includes(selectedSchools[0])) {
      return schoolModules[selectedSchools[0]] || [];
    }
    return [];
  };

  // Check if selected school has hierarchical modules
  const isHierarchical = () => {
    const selectedSchools = formData.eligibility.schools || [];
    return selectedSchools.length === 1 && schoolsWithHierarchy.includes(selectedSchools[0]);
  };

  // Proficiency level labels
  const proficiencyLevels = [
    { value: 0, label: 'None', description: 'Not required' },
    { value: 1, label: 'Beginner', description: 'Basic understanding' },
    { value: 2, label: 'Intermediate', description: 'Can work independently' },
    { value: 3, label: 'Advanced', description: 'Deep expertise' },
    { value: 4, label: 'Expert', description: 'Industry expert level' }
  ];

  useEffect(() => {
    fetchSkills();
    fetchCampuses();
    fetchStudentCount();
    if (isEdit) fetchJob();
  }, [id]);

  const fetchSkills = async () => {
    try {
      const response = await skillAPI.getSkills();
      setAllSkills(response.data);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await campusAPI.getCampuses();
      setCampuses(response.data);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  // Fetch total student count for eligible estimation
  const [totalStudents, setTotalStudents] = useState(0);
  const [eligibleCount, setEligibleCount] = useState(0);
  
  const fetchStudentCount = async () => {
    try {
      const response = await userAPI.getStudents({ limit: 1 });
      setTotalStudents(response.data.pagination?.total || 0);
      setEligibleCount(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching student count:', error);
    }
  };

  // Update eligible count when eligibility changes
  useEffect(() => {
    // Simple estimation based on restrictions
    let estimate = totalStudents;
    
    if (formData.eligibility.tenthGrade?.required && formData.eligibility.tenthGrade?.minPercentage) {
      estimate = Math.round(estimate * (1 - (formData.eligibility.tenthGrade.minPercentage / 200)));
    }
    if (formData.eligibility.twelfthGrade?.required && formData.eligibility.twelfthGrade?.minPercentage) {
      estimate = Math.round(estimate * (1 - (formData.eligibility.twelfthGrade.minPercentage / 200)));
    }
    if (formData.eligibility.higherEducation?.required) {
      estimate = Math.round(estimate * 0.6); // Assume 60% have higher education
    }
    if (formData.eligibility.schools?.length > 0) {
      estimate = Math.round(estimate * (formData.eligibility.schools.length / 5));
    }
    if (formData.eligibility.campuses?.length > 0 && campuses.length > 0) {
      estimate = Math.round(estimate * (formData.eligibility.campuses.length / campuses.length));
    }
    if (formData.eligibility.minModule) {
      const moduleIndex = moduleHierarchy.indexOf(formData.eligibility.minModule);
      estimate = Math.round(estimate * (1 - (moduleIndex / moduleHierarchy.length) * 0.5));
    }
    if (formData.eligibility.minCgpa) {
      estimate = Math.round(estimate * (1 - (formData.eligibility.minCgpa / 20)));
    }
    
    setEligibleCount(Math.max(0, estimate));
  }, [formData.eligibility, totalStudents, campuses.length]);

  // Handle toggling academic requirements with auto-select logic
  const toggleAcademicRequirement = (type) => {
    if (type === 'tenth') {
      setFormData({
        ...formData,
        eligibility: {
          ...formData.eligibility,
          tenthGrade: { 
            ...formData.eligibility.tenthGrade, 
            required: !formData.eligibility.tenthGrade?.required 
          }
        }
      });
    } else if (type === 'twelfth') {
      const newValue = !formData.eligibility.twelfthGrade?.required;
      setFormData({
        ...formData,
        eligibility: {
          ...formData.eligibility,
          // Auto-select 10th if 12th is selected
          tenthGrade: newValue ? { ...formData.eligibility.tenthGrade, required: true } : formData.eligibility.tenthGrade,
          twelfthGrade: { ...formData.eligibility.twelfthGrade, required: newValue }
        }
      });
    } else if (type === 'higher') {
      const newValue = !formData.eligibility.higherEducation?.required;
      setFormData({
        ...formData,
        eligibility: {
          ...formData.eligibility,
          // Auto-select 10th and 12th if higher education is selected
          tenthGrade: newValue ? { ...formData.eligibility.tenthGrade, required: true } : formData.eligibility.tenthGrade,
          twelfthGrade: newValue ? { ...formData.eligibility.twelfthGrade, required: true } : formData.eligibility.twelfthGrade,
          higherEducation: { ...formData.eligibility.higherEducation, required: newValue }
        }
      });
    }
  };

  // AI Auto-fill from URL
  const handleParseFromUrl = async () => {
    if (!jdUrl.trim()) {
      toast.error('Please enter a JD URL');
      return;
    }

    setParsing(true);
    setAiParseInfo(null);
    
    try {
      const response = await jobAPI.parseJDFromUrl(jdUrl);
      if (response.data.success) {
        applyParsedData(response.data.data);
        setAiParseInfo({
          type: response.data.data.parsedWith,
          message: response.data.message
        });
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to parse JD from URL');
    } finally {
      setParsing(false);
    }
  };

  // AI Auto-fill from PDF
  const handleParseFromPDF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setParsing(true);
    setAiParseInfo(null);
    
    try {
      const response = await jobAPI.parseJDFromPDF(file);
      if (response.data.success) {
        applyParsedData(response.data.data);
        setAiParseInfo({
          type: response.data.data.parsedWith,
          message: response.data.message
        });
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to parse PDF');
    } finally {
      setParsing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply parsed data to form
  const applyParsedData = (data) => {
    setFormData(prev => ({
      ...prev,
      title: data.title || prev.title,
      company: {
        name: data.company?.name || prev.company.name,
        website: data.company?.website || prev.company.website,
        description: data.company?.description || prev.company.description
      },
      description: data.description || prev.description,
      requirements: data.requirements?.length > 0 ? data.requirements : prev.requirements,
      responsibilities: data.responsibilities?.length > 0 ? data.responsibilities : prev.responsibilities,
      location: data.location || prev.location,
      jobType: data.jobType || prev.jobType,
      duration: data.duration || prev.duration,
      salary: {
        min: data.salary?.min || prev.salary.min,
        max: data.salary?.max || prev.salary.max,
        currency: data.salary?.currency || prev.salary.currency
      },
      maxPositions: data.maxPositions || prev.maxPositions,
      // Add matched skills
      requiredSkills: data.matchedSkillIds?.length > 0 
        ? data.matchedSkillIds.map(id => ({ skill: id, required: true }))
        : prev.requiredSkills
    }));
  };

  const fetchJob = async () => {
    try {
      const response = await jobAPI.getJob(id);
      const job = response.data;
      setFormData({
        ...job,
        duration: job.duration || '',
        salary: job.salary || { min: '', max: '', currency: 'INR' },
        customRequirements: job.customRequirements || [],
        eligibility: {
          openForAll: job.eligibility?.openForAll ?? true,
          tenthGrade: job.eligibility?.tenthGrade || { required: false, minPercentage: '' },
          twelfthGrade: job.eligibility?.twelfthGrade || { required: false, minPercentage: '' },
          higherEducation: job.eligibility?.higherEducation || { required: false, acceptedDegrees: [] },
          schools: job.eligibility?.schools || [],
          campuses: job.eligibility?.campuses || [],
          minModule: job.eligibility?.minModule || '',
          minCgpa: job.eligibility?.minCgpa || '',
          certifications: job.eligibility?.certifications || [],
          englishWriting: job.eligibility?.englishWriting || '',
          englishSpeaking: job.eligibility?.englishSpeaking || '',
          femaleOnly: job.eligibility?.femaleOnly || false,
          minAttendance: job.eligibility?.minAttendance || null,
          minMonthsAtNavgurukul: job.eligibility?.minMonthsAtNavgurukul || null,
          shortlistDeadline: job.eligibility?.shortlistDeadline ? job.eligibility.shortlistDeadline.split('T')[0] : ''
        },
        requirements: job.requirements?.length ? job.requirements : [''],
        responsibilities: job.responsibilities?.length ? job.responsibilities : [''],
        interviewRounds: job.interviewRounds?.length ? job.interviewRounds : [{ name: '', type: 'technical', description: '' }],
        applicationDeadline: job.applicationDeadline?.split('T')[0] || ''
      });
    } catch (error) {
      toast.error('Error loading job');
      navigate('/coordinator/jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Clean up empty entries
      const cleanedData = {
        ...formData,
        requirements: formData.requirements.filter(r => r.trim()),
        responsibilities: formData.responsibilities.filter(r => r.trim()),
        customRequirements: (formData.customRequirements || []).filter(r => r.requirement?.trim()),
        interviewRounds: formData.interviewRounds.filter(r => r.name.trim()),
        duration: formData.jobType === 'internship' ? formData.duration : null,
        salary: {
          min: formData.salary.min ? Number(formData.salary.min) : undefined,
          max: formData.salary.max ? Number(formData.salary.max) : undefined,
          currency: formData.salary.currency
        },
        eligibility: {
          // Academic requirements
          tenthGrade: {
            required: formData.eligibility.tenthGrade?.required || false,
            minPercentage: formData.eligibility.tenthGrade?.minPercentage ? 
              Number(formData.eligibility.tenthGrade.minPercentage) : null
          },
          twelfthGrade: {
            required: formData.eligibility.twelfthGrade?.required || false,
            minPercentage: formData.eligibility.twelfthGrade?.minPercentage ? 
              Number(formData.eligibility.twelfthGrade.minPercentage) : null
          },
          higherEducation: {
            required: formData.eligibility.higherEducation?.required || false,
            acceptedDegrees: formData.eligibility.higherEducation?.acceptedDegrees || []
          },
          // Navgurukul specific
          schools: formData.eligibility.schools || [],
          campuses: formData.eligibility.campuses || [],
          minModule: formData.eligibility.minModule || null,
          // Other requirements
          certifications: formData.eligibility.certifications || [],
          englishWriting: formData.eligibility.englishWriting || '',
          englishSpeaking: formData.eligibility.englishSpeaking || '',
          shortlistDeadline: formData.eligibility.shortlistDeadline || null,
          // Additional filters
          femaleOnly: formData.eligibility.femaleOnly || false,
          minAttendance: formData.eligibility.minAttendance ? Number(formData.eligibility.minAttendance) : null,
          minMonthsAtNavgurukul: formData.eligibility.minMonthsAtNavgurukul ? Number(formData.eligibility.minMonthsAtNavgurukul) : null,
          // Legacy
          minCgpa: formData.eligibility.minCgpa ? Number(formData.eligibility.minCgpa) : null,
          // Calculate openForAll
          openForAll: !formData.eligibility.tenthGrade?.required && 
                     !formData.eligibility.twelfthGrade?.required &&
                     !formData.eligibility.higherEducation?.required &&
                     (!formData.eligibility.schools || formData.eligibility.schools.length === 0) &&
                     (!formData.eligibility.campuses || formData.eligibility.campuses.length === 0) &&
                     !formData.eligibility.minModule &&
                     !formData.eligibility.minCgpa &&
                     !formData.eligibility.femaleOnly &&
                     !formData.eligibility.minAttendance &&
                     !formData.eligibility.minMonthsAtNavgurukul
        }
      };

      if (isEdit) {
        await jobAPI.updateJob(id, cleanedData);
        toast.success('Job updated successfully');
      } else {
        await jobAPI.createJob(cleanedData);
        toast.success('Job created successfully');
      }
      navigate('/coordinator/jobs');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving job');
    } finally {
      setSaving(false);
    }
  };

  const addListItem = (field) => {
    if (field === 'interviewRounds') {
      setFormData({
        ...formData,
        interviewRounds: [...formData.interviewRounds, { name: '', type: 'technical', description: '' }]
      });
    } else {
      setFormData({ ...formData, [field]: [...formData[field], ''] });
    }
  };

  const removeListItem = (field, index) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter((_, i) => i !== index)
    });
  };

  const updateListItem = (field, index, value) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData({ ...formData, [field]: updated });
  };

  const toggleSkill = (skillId, required = true) => {
    const exists = formData.requiredSkills.find(s => s.skill === skillId || s.skill?._id === skillId);
    if (exists) {
      setFormData({
        ...formData,
        requiredSkills: formData.requiredSkills.filter(s => s.skill !== skillId && s.skill?._id !== skillId)
      });
    } else {
      setFormData({
        ...formData,
        requiredSkills: [...formData.requiredSkills, { skill: skillId, required, proficiencyLevel: 1 }]
      });
    }
  };

  const updateSkillProficiency = (skillId, proficiencyLevel) => {
    setFormData({
      ...formData,
      requiredSkills: formData.requiredSkills.map(s => {
        if (s.skill === skillId || s.skill?._id === skillId) {
          return { ...s, proficiencyLevel };
        }
        return s;
      })
    });
  };

  const addCustomRequirement = () => {
    setFormData({
      ...formData,
      customRequirements: [...(formData.customRequirements || []), { requirement: '', isMandatory: true }]
    });
  };

  const updateCustomRequirement = (index, field, value) => {
    const updated = [...(formData.customRequirements || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, customRequirements: updated });
  };

  const removeCustomRequirement = (index) => {
    setFormData({
      ...formData,
      customRequirements: (formData.customRequirements || []).filter((_, i) => i !== index)
    });
  };

  const schools = [
    'School of Programming',
    'School of Business', 
    'School of Finance',
    'School of Education',
    'School of Second Chance'
  ];

  // Check if eligibility has any restrictions
  const hasEligibilityRestrictions = formData.eligibility.tenthGrade?.required ||
    formData.eligibility.twelfthGrade?.required ||
    formData.eligibility.higherEducation?.required ||
    (formData.eligibility.schools && formData.eligibility.schools.length > 0) ||
    (formData.eligibility.campuses && formData.eligibility.campuses.length > 0) ||
    formData.eligibility.minModule ||
    (formData.eligibility.certifications && formData.eligibility.certifications.length > 0) ||
    formData.eligibility.englishWriting ||
    formData.eligibility.englishSpeaking;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Button */}
      <button
        onClick={() => navigate('/coordinator/jobs')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Job' : 'Create New Job'}</h1>
        <p className="text-gray-600">Fill in the job details below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* AI Auto-Fill Section */}
        {!isEdit && (
          <div className="card bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-purple-900">AI Auto-Fill</h2>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Beta</span>
            </div>
            <p className="text-sm text-purple-700 mb-4">
              Upload a JD PDF or paste a job posting URL to automatically fill the form using AI.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-purple-800 mb-1">
                  <Link className="w-4 h-4 inline mr-1" />
                  JD URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                    placeholder="https://careers.example.com/job/..."
                    className="flex-1"
                    disabled={parsing}
                  />
                  <button
                    type="button"
                    onClick={handleParseFromUrl}
                    disabled={parsing || !jdUrl.trim()}
                    className="btn btn-primary whitespace-nowrap flex items-center gap-2"
                  >
                    {parsing ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Parse URL
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-purple-800 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Upload JD PDF
                </label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleParseFromPDF}
                    className="hidden"
                    disabled={parsing}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsing}
                    className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    {parsing ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Choose PDF File
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Parse Info */}
            {aiParseInfo && (
              <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
                aiParseInfo.type === 'ai' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <AlertCircle className={`w-5 h-5 shrink-0 ${
                  aiParseInfo.type === 'ai' ? 'text-green-600' : 'text-yellow-600'
                }`} />
                <div className="text-sm">
                  <p className={aiParseInfo.type === 'ai' ? 'text-green-700' : 'text-yellow-700'}>
                    {aiParseInfo.message}
                  </p>
                  {aiParseInfo.type === 'fallback' && (
                    <p className="text-yellow-600 mt-1">
                      💡 Tip: Add your Google AI API key in Manager Settings for better results.
                    </p>
                  )}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                value={formData.company.name}
                onChange={(e) => setFormData({ ...formData, company: { ...formData.company, name: e.target.value } })}
                placeholder="Company name"
                required
              />
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Bangalore, Remote"
                required
              />
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

        {/* Required Skills with Proficiency Levels */}
        <div className="card">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Required Skills</h2>
            <p className="text-sm text-gray-500">Select skills and set the minimum proficiency level required</p>
          </div>

          {/* English Proficiency (CEFR) */}
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

        {/* Eligibility */}
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
              {/* 10th Grade */}
              <div 
                onClick={() => toggleAcademicRequirement('tenth')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.eligibility.tenthGrade?.required 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">10th Grade</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    formData.eligibility.tenthGrade?.required ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                    {formData.eligibility.tenthGrade?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.tenthGrade?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.eligibility.tenthGrade?.minPercentage || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        eligibility: {
                          ...formData.eligibility,
                          tenthGrade: { ...formData.eligibility.tenthGrade, minPercentage: e.target.value }
                        }
                      })}
                      placeholder="Min %"
                      className="w-full text-sm"
                    />
                  </div>
                )}
              </div>

              {/* 12th Grade */}
              <div 
                onClick={() => toggleAcademicRequirement('twelfth')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.eligibility.twelfthGrade?.required 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">12th Grade</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    formData.eligibility.twelfthGrade?.required ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                    {formData.eligibility.twelfthGrade?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.twelfthGrade?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.eligibility.twelfthGrade?.minPercentage || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        eligibility: {
                          ...formData.eligibility,
                          twelfthGrade: { ...formData.eligibility.twelfthGrade, minPercentage: e.target.value }
                        }
                      })}
                      placeholder="Min %"
                      className="w-full text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Higher Education */}
              <div 
                onClick={() => toggleAcademicRequirement('higher')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.eligibility.higherEducation?.required 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">Higher Education</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    formData.eligibility.higherEducation?.required ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                    {formData.eligibility.higherEducation?.required && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                </div>
                {formData.eligibility.higherEducation?.required && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-2 space-y-2">
                    {/* Level Selection */}
                    <select
                      value={formData.eligibility.higherEducation?.level || ''}
                      onChange={(e) => {
                        const level = e.target.value;
                        let degrees = [];
                        if (level === 'bachelor') degrees = [...bachelorDegrees];
                        else if (level === 'master') degrees = [...masterDegrees];
                        else if (level === 'any') degrees = [...bachelorDegrees, ...masterDegrees];
                        setFormData({
                          ...formData,
                          eligibility: {
                            ...formData.eligibility,
                            higherEducation: { ...formData.eligibility.higherEducation, level, acceptedDegrees: degrees }
                          }
                        });
                      }}
                      className="w-full text-sm"
                    >
                      <option value="">Select Level</option>
                      <option value="bachelor">Bachelor's Degree</option>
                      <option value="master">Master's Degree</option>
                      <option value="any">Any Graduate</option>
                    </select>
                    {/* Degree chips */}
                    {formData.eligibility.higherEducation?.level && (
                      <div className="flex flex-wrap gap-1">
                        {(formData.eligibility.higherEducation?.level === 'bachelor' ? bachelorDegrees :
                          formData.eligibility.higherEducation?.level === 'master' ? masterDegrees :
                          [...bachelorDegrees, ...masterDegrees]).map(degree => (
                          <button
                            key={degree}
                            type="button"
                            onClick={() => {
                              const current = formData.eligibility.higherEducation?.acceptedDegrees || [];
                              const updated = current.includes(degree)
                                ? current.filter(d => d !== degree)
                                : [...current, degree];
                              setFormData({
                                ...formData,
                                eligibility: {
                                  ...formData.eligibility,
                                  higherEducation: { ...formData.eligibility.higherEducation, acceptedDegrees: updated }
                                }
                              });
                            }}
                            className={`px-2 py-0.5 rounded text-xs transition ${
                              (formData.eligibility.higherEducation?.acceptedDegrees || []).includes(degree)
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {degree}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navgurukul Specific Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Navgurukul Specific
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Schools */}
              <div className={`p-3 rounded-lg border-2 transition-all ${
                (formData.eligibility.schools || []).length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 text-sm">Schools</span>
                  {(formData.eligibility.schools || []).length > 0 && (
                    <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                      {formData.eligibility.schools.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {schools.map(school => (
                    <button
                      key={school}
                      type="button"
                      onClick={() => {
                        const current = formData.eligibility.schools || [];
                        const newSchools = current.includes(school)
                          ? current.filter(s => s !== school)
                          : [...current, school];
                        // Clear minModule if school changes
                        setFormData({
                          ...formData,
                          eligibility: { 
                            ...formData.eligibility, 
                            schools: newSchools,
                            minModule: newSchools.length === 1 ? formData.eligibility.minModule : ''
                          }
                        });
                      }}
                      className={`px-2 py-1 rounded text-xs transition ${
                        (formData.eligibility.schools || []).includes(school)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {school.replace('School of ', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campuses */}
              <div className={`p-3 rounded-lg border-2 transition-all ${
                (formData.eligibility.campuses || []).length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 text-sm">Campuses</span>
                  {(formData.eligibility.campuses || []).length > 0 && (
                    <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                      {formData.eligibility.campuses.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {campuses.map(campus => (
                    <button
                      key={campus._id}
                      type="button"
                      onClick={() => {
                        const current = formData.eligibility.campuses || [];
                        const newCampuses = current.includes(campus._id)
                          ? current.filter(c => c !== campus._id)
                          : [...current, campus._id];
                        setFormData({
                          ...formData,
                          eligibility: { ...formData.eligibility, campuses: newCampuses }
                        });
                      }}
                      className={`px-2 py-1 rounded text-xs transition ${
                        (formData.eligibility.campuses || []).includes(campus._id)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {campus.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Module Requirement - Different UI for hierarchical vs track-based schools */}
            {(formData.eligibility.schools || []).length === 1 && schoolsWithModules.includes(formData.eligibility.schools[0]) && (
              <div className={`mt-3 p-3 rounded-lg border-2 transition-all ${
                formData.eligibility.minModule ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 text-sm">
                    {isHierarchical() ? 'Minimum Module' : 'Required Track'} ({formData.eligibility.schools[0].replace('School of ', '')})
                  </span>
                  {formData.eligibility.minModule && (
                    <button 
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        eligibility: { ...formData.eligibility, minModule: '' }
                      })}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {isHierarchical() 
                    ? 'Click a module to set minimum requirement. Students must have completed up to this module.'
                    : 'Select the required track. These are independent programs, not a progression.'}
                </p>
                <div className="flex flex-wrap gap-1">
                  {getAvailableModules().map((module, index) => {
                    const modules = getAvailableModules();
                    const selectedIndex = modules.indexOf(formData.eligibility.minModule);
                    const isSelected = formData.eligibility.minModule === module;
                    // For hierarchical schools, highlight all modules up to selected
                    // For track-based schools, only highlight the selected one
                    const isIncluded = isHierarchical() && selectedIndex >= 0 && index <= selectedIndex;
                    
                    return (
                      <button
                        key={module}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            eligibility: { 
                              ...formData.eligibility, 
                              minModule: formData.eligibility.minModule === module ? '' : module 
                            }
                          });
                        }}
                        className={`px-2 py-1 rounded text-xs transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                            : isIncluded
                            ? 'bg-purple-400 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {isHierarchical() && (
                          <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </span>
                        )}
                        {module}
                        {isSelected && <CheckCircle className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
                {formData.eligibility.minModule && isHierarchical() && (
                  <p className="text-xs text-purple-600 mt-2">
                    Students must have completed: {getAvailableModules().slice(0, getAvailableModules().indexOf(formData.eligibility.minModule) + 1).join(' → ')}
                  </p>
                )}
                {formData.eligibility.minModule && !isHierarchical() && (
                  <p className="text-xs text-purple-600 mt-2">
                    Only students enrolled in "{formData.eligibility.minModule}" track are eligible
                  </p>
                )}
              </div>
            )}
            {(formData.eligibility.schools || []).length === 1 && !schoolsWithModules.includes(formData.eligibility.schools[0]) && (
              <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                {formData.eligibility.schools[0]} doesn't have predefined modules. Student eligibility will be based on school selection only.
              </p>
            )}
            {(formData.eligibility.schools || []).length > 1 && (
              <p className="text-xs text-amber-600 mt-2">Select only one school to set module requirements</p>
            )}
          </div>

          {/* Other Requirements */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Other Requirements
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {/* Certifications */}
              <div className={`p-3 rounded-lg border-2 transition-all ${
                (formData.eligibility.certifications || []).length > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900 text-sm">Required Certifications</span>
                  {(formData.eligibility.certifications || []).length > 0 && (
                    <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                      {formData.eligibility.certifications.length}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., AWS, Google Cloud"
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault();
                        const cert = e.target.value.trim();
                        if (!(formData.eligibility.certifications || []).includes(cert)) {
                          setFormData({
                            ...formData,
                            eligibility: {
                              ...formData.eligibility,
                              certifications: [...(formData.eligibility.certifications || []), cert]
                            }
                          });
                        }
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.target.previousElementSibling;
                      if (input.value.trim()) {
                        const cert = input.value.trim();
                        if (!(formData.eligibility.certifications || []).includes(cert)) {
                          setFormData({
                            ...formData,
                            eligibility: {
                              ...formData.eligibility,
                              certifications: [...(formData.eligibility.certifications || []), cert]
                            }
                          });
                        }
                        input.value = '';
                      }
                    }}
                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                  >
                    Add
                  </button>
                </div>
                {(formData.eligibility.certifications || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.eligibility.certifications.map((cert, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        {cert}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            eligibility: {
                              ...formData.eligibility,
                              certifications: formData.eligibility.certifications.filter((_, i) => i !== idx)
                            }
                          })}
                          className="text-green-500 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shortlist Deadline */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Shortlist Deadline
            </h3>
            <div className={`p-3 rounded-lg border-2 transition-all ${
              formData.eligibility.shortlistDeadline ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
            }`}>
              <p className="text-xs text-gray-600 mb-2">Students must complete their profiles before this date to be considered</p>
              <input
                type="datetime-local"
                value={formData.eligibility.shortlistDeadline || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  eligibility: { ...formData.eligibility, shortlistDeadline: e.target.value }
                })}
                className="w-full text-sm"
              />
              {formData.eligibility.shortlistDeadline && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Students will see this deadline prominently
                </p>
              )}
            </div>
          </div>

          {/* Additional Filters */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Additional Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Female Only Toggle */}
              <div 
                onClick={() => setFormData({
                  ...formData,
                  eligibility: { ...formData.eligibility, femaleOnly: !formData.eligibility.femaleOnly }
                })}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.eligibility.femaleOnly
                    ? 'border-pink-500 bg-pink-50' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">Female Only</span>
                  <div className={`w-10 h-6 rounded-full relative transition-colors ${
                    formData.eligibility.femaleOnly ? 'bg-pink-500' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      formData.eligibility.femaleOnly ? 'left-5' : 'left-1'
                    }`}></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Only female students can apply</p>
              </div>

              {/* Minimum Attendance */}
              <div className={`p-3 rounded-lg border-2 transition-all ${
                formData.eligibility.minAttendance ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
              }`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Min Attendance %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.eligibility.minAttendance || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    eligibility: { ...formData.eligibility, minAttendance: e.target.value ? Number(e.target.value) : null }
                  })}
                  placeholder="e.g., 75"
                  className="w-full text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum attendance required</p>
              </div>

              {/* Minimum Months at Navgurukul */}
              <div className={`p-3 rounded-lg border-2 transition-all ${
                formData.eligibility.minMonthsAtNavgurukul ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
              }`}>
                <span className="font-medium text-gray-900 text-sm block mb-1">Min Months at NG</span>
                <input
                  type="number"
                  min="0"
                  value={formData.eligibility.minMonthsAtNavgurukul || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    eligibility: { ...formData.eligibility, minMonthsAtNavgurukul: e.target.value ? Number(e.target.value) : null }
                  })}
                  placeholder="e.g., 6"
                  className="w-full text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Months since joining</p>
              </div>
            </div>
          </div>

          {/* Eligible Students Count */}
          <div className={`p-3 rounded-lg flex items-center justify-between ${
            hasEligibilityRestrictions 
              ? 'bg-amber-50 border border-amber-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center gap-2">
              <Users className={`w-6 h-6 ${hasEligibilityRestrictions ? 'text-amber-500' : 'text-green-500'}`} />
              <div>
                <p className={`font-medium text-sm ${hasEligibilityRestrictions ? 'text-amber-800' : 'text-green-800'}`}>
                  {hasEligibilityRestrictions ? 'Restricted Eligibility' : 'Open for All Students'}
                </p>
                <p className={`text-xs ${hasEligibilityRestrictions ? 'text-amber-600' : 'text-green-600'}`}>
                  {hasEligibilityRestrictions 
                    ? 'Only students matching criteria can apply' 
                    : 'All registered students can apply'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${hasEligibilityRestrictions ? 'text-amber-600' : 'text-green-600'}`}>
                ~{eligibleCount}
              </div>
              <p className="text-xs text-gray-500">
                {hasEligibilityRestrictions ? 'estimated' : 'total'}
              </p>
            </div>
          </div>
        </div>

        {/* Interview Rounds */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Interview Rounds</h2>
            <button type="button" onClick={() => addListItem('interviewRounds')} className="text-primary-600 text-sm">
              + Add Round
            </button>
          </div>
          <div className="space-y-4">
            {formData.interviewRounds.map((round, index) => (
              <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={round.name}
                    onChange={(e) => {
                      const updated = [...formData.interviewRounds];
                      updated[index].name = e.target.value;
                      setFormData({ ...formData, interviewRounds: updated });
                    }}
                    placeholder="Round name"
                  />
                  <select
                    value={round.type}
                    onChange={(e) => {
                      const updated = [...formData.interviewRounds];
                      updated[index].type = e.target.value;
                      setFormData({ ...formData, interviewRounds: updated });
                    }}
                  >
                    <option value="aptitude">Aptitude Test</option>
                    <option value="technical">Technical Interview</option>
                    <option value="coding">Coding Test</option>
                    <option value="hr">HR Interview</option>
                    <option value="group_discussion">Group Discussion</option>
                    <option value="other">Other</option>
                  </select>
                  {formData.interviewRounds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeListItem('interviewRounds', index)}
                      className="text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status & Submit */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-48"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/coordinator/jobs')} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : isEdit ? 'Update Job' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default JobForm;
