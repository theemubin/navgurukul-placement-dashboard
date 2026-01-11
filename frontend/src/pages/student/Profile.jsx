import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI, userAPI, settingsAPI, campusAPI, placementCycleAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import { 
  User, Mail, Phone, GraduationCap, Upload, Save, Send,
  Linkedin, Github, Globe, BookOpen, Languages, Brain,
  MapPin, Calendar, Briefcase, CheckCircle, Clock, AlertCircle,
  Plus, Trash2, Award, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

// Indian States
const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const boards = ['State', 'CBSE', 'ICSE', 'Other'];

const schools = [
  'School of Programming',
  'School of Business', 
  'School of Finance',
  'School of Education',
  'School of Second Chance'
];

const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const cefrDescriptions = {
  'A1': 'Beginner',
  'A2': 'Elementary', 
  'B1': 'Intermediate',
  'B2': 'Upper Intermediate',
  'C1': 'Advanced',
  'C2': 'Proficient'
};

const softSkillsList = [
  { key: 'communication', label: 'Communication', description: 'Ability to express ideas clearly' },
  { key: 'collaboration', label: 'Collaboration', description: 'Working effectively with others' },
  { key: 'creativity', label: 'Creativity', description: 'Generating innovative ideas' },
  { key: 'criticalThinking', label: 'Critical Thinking', description: 'Analyzing and evaluating information' },
  { key: 'problemSolving', label: 'Problem Solving', description: 'Finding solutions to challenges' },
  { key: 'adaptability', label: 'Adaptability', description: 'Adjusting to new situations' },
  { key: 'timeManagement', label: 'Time Management', description: 'Organizing and prioritizing tasks' },
  { key: 'leadership', label: 'Leadership', description: 'Guiding and motivating others' },
  { key: 'teamwork', label: 'Teamwork', description: 'Contributing to team goals' },
  { key: 'emotionalIntelligence', label: 'Emotional Intelligence', description: 'Understanding and managing emotions' }
];

const levelLabels = ['', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
const ratingLabels = ['', '1 - Basic', '2 - Intermediate', '3 - Advanced', '4 - Expert'];

const defaultSettings = {
  programmingModules: [
    'Programming Foundations', 'Problem Solving & Flowcharts', 'Web Fundamentals',
    'JavaScript Fundamentals', 'Advanced JavaScript', 'DOM & Browser APIs',
    'Python Fundamentals', 'Advanced Python', 'Data Structures & Algorithms',
    'Advanced Data Structures', 'React & Frontend Frameworks'
  ],
  businessModules: ['CRM', 'Digital Marketing', 'Data Analytics', 'Advanced Google Sheets'],
  secondChanceModules: ['Master Chef', 'Fashion Designing'],
  availableRoles: [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Low Code-No Code Developer', 'Data Analysis', 'Social Media Associate',
    'Business Developer', 'CRM', 'Digital Marketing', 'General Marketing',
    'Intern - Full Stack', 'Intern - FE', 'Intern - BE'
  ],
  technicalSkillOptions: [
    'Programming Foundations', 'Problem Solving & Flowcharts', 'Web Fundamentals',
    'JavaScript Fundamentals', 'Advanced JavaScript', 'DOM & Browser APIs',
    'Python Fundamentals', 'Advanced Python', 'Data Structures & Algorithms',
    'Advanced Data Structures', 'React & Frontend Frameworks',
    'CRM', 'Digital Marketing', 'Data Analytics', 'Advanced Google Sheets',
    'HTML', 'CSS', 'Node.js', 'Express.js', 'MongoDB', 'SQL', 'Git', 'REST APIs', 'TypeScript'
  ],
  courseSkills: [],
  courseProviders: ['Navgurukul', 'Coursera', 'Udemy', 'LinkedIn Learning', 'YouTube', 'Other']
};

const StudentProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPincode, setFetchingPincode] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [campuses, setCampuses] = useState([]);
  const [placementCycles, setPlacementCycles] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState('');
  const [selectedPlacementCycle, setSelectedPlacementCycle] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    linkedIn: '',
    github: '',
    portfolio: '',
    about: '',
    currentSchool: '',
    joiningDate: '',
    currentModule: '',
    customModuleDescription: '',
    tenthGrade: { passingYear: '', state: '', board: '', percentage: '' },
    twelfthGrade: { passingYear: '', state: '', board: '', percentage: '' },
    higherEducation: [],
    courses: [],
    hometown: { pincode: '', village: '', district: '', state: '' },
    openForRoles: [],
    englishProficiency: { speaking: '', writing: '' },
    languages: [], // Multi-language proficiency
    softSkills: {
      communication: 0, collaboration: 0, creativity: 0, criticalThinking: 0,
      problemSolving: 0, adaptability: 0, timeManagement: 0, leadership: 0,
      teamwork: 0, emotionalIntelligence: 0
    },
    technicalSkills: [],
    profileStatus: 'draft',
    revisionNotes: ''
  });

  const [newCourseSkill, setNewCourseSkill] = useState('');
  const [addingCourseSkill, setAddingCourseSkill] = useState(false);
  const [newLanguage, setNewLanguage] = useState({ language: '', speaking: '', writing: '', isNative: false });

  useEffect(() => {
    fetchProfile();
    fetchSettings();
    fetchCampuses();
    fetchPlacementCycles();
  }, []);

  const fetchCampuses = async () => {
    try {
      const response = await campusAPI.getCampuses();
      setCampuses(response.data);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchPlacementCycles = async () => {
    try {
      const response = await placementCycleAPI.getCycles({ activeOnly: true });
      setPlacementCycles(response.data);
    } catch (error) {
      console.error('Error fetching placement cycles:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getMe();
      const data = response.data;
      setProfile(data);
      setSelectedCampus(data.campus?._id || data.campus || '');
      setSelectedPlacementCycle(data.placementCycle?._id || data.placementCycle || '');
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        gender: data.gender || '',
        linkedIn: data.studentProfile?.linkedIn || '',
        github: data.studentProfile?.github || '',
        portfolio: data.studentProfile?.portfolio || '',
        about: data.studentProfile?.about || '',
        currentSchool: data.studentProfile?.currentSchool || '',
        joiningDate: data.studentProfile?.joiningDate ? new Date(data.studentProfile.joiningDate).toISOString().split('T')[0] : '',
        currentModule: data.studentProfile?.currentModule || '',
        customModuleDescription: data.studentProfile?.customModuleDescription || '',
        tenthGrade: data.studentProfile?.tenthGrade || { passingYear: '', state: '', board: '', percentage: '' },
        twelfthGrade: data.studentProfile?.twelfthGrade || { passingYear: '', state: '', board: '', percentage: '' },
        higherEducation: data.studentProfile?.higherEducation || [],
        courses: data.studentProfile?.courses || [],
        hometown: data.studentProfile?.hometown || { pincode: '', village: '', district: '', state: '' },
        openForRoles: data.studentProfile?.openForRoles || [],
        englishProficiency: data.studentProfile?.englishProficiency || { speaking: '', writing: '' },
        languages: data.studentProfile?.languages || [],
        softSkills: data.studentProfile?.softSkills || {
          communication: 0, collaboration: 0, creativity: 0, criticalThinking: 0,
          problemSolving: 0, adaptability: 0, timeManagement: 0, leadership: 0,
          teamwork: 0, emotionalIntelligence: 0
        },
        technicalSkills: data.studentProfile?.technicalSkills || [],
        profileStatus: data.studentProfile?.profileStatus || 'draft',
        revisionNotes: data.studentProfile?.revisionNotes || ''
      });
    } catch (error) {
      toast.error('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getSettings();
      if (response.data && Object.keys(response.data).length > 0) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const getModulesForSchool = () => {
    switch (formData.currentSchool) {
      case 'School of Programming':
        return settings.programmingModules || [];
      case 'School of Business':
        return settings.businessModules || [];
      case 'School of Second Chance':
        return settings.secondChanceModules || [];
      default:
        return [];
    }
  };

  const handlePincodeChange = async (pincode) => {
    setFormData({
      ...formData,
      hometown: { ...formData.hometown, pincode }
    });

    if (pincode.length === 6) {
      setFetchingPincode(true);
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();
        
        if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
          const postOffice = data[0].PostOffice[0];
          setFormData(prev => ({
            ...prev,
            hometown: {
              pincode,
              village: postOffice.Name || '',
              district: postOffice.District || '',
              state: postOffice.State || ''
            }
          }));
          toast.success('Location fetched successfully');
        } else {
          toast.error('Invalid pincode');
        }
      } catch (error) {
        toast.error('Error fetching location');
      } finally {
        setFetchingPincode(false);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Include campus and gender in the profile update
      const profileData = { ...formData, campus: selectedCampus, gender: formData.gender };
      await userAPI.updateProfile(profileData);
      toast.success('Profile updated successfully');
      updateUser({ firstName: formData.firstName, lastName: formData.lastName });
      fetchProfile();
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleChange = async (cycleId) => {
    if (!cycleId) return;
    try {
      await placementCycleAPI.updateMyCycle(cycleId);
      setSelectedPlacementCycle(cycleId);
      toast.success('Placement cycle updated');
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating placement cycle');
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      await userAPI.submitProfile();
      toast.success('Profile submitted for approval');
      fetchProfile();
    } catch (error) {
      toast.error('Error submitting profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    try {
      await userAPI.uploadResume(file);
      toast.success('Resume uploaded successfully');
      fetchProfile();
    } catch (error) {
      toast.error('Error uploading resume');
    }
  };

  const handleSoftSkillChange = (skillKey, value) => {
    setFormData({
      ...formData,
      softSkills: { ...formData.softSkills, [skillKey]: value }
    });
  };

  const handleRoleToggle = (role) => {
    const updated = formData.openForRoles.includes(role)
      ? formData.openForRoles.filter(r => r !== role)
      : [...formData.openForRoles, role];
    setFormData({ ...formData, openForRoles: updated });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const tabs = [
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'education', label: 'Education', icon: GraduationCap },
    { id: 'skills', label: 'Skills', icon: Brain },
    { id: 'languages', label: 'Languages', icon: Languages },
    { id: 'roles', label: 'Open For', icon: Briefcase }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  const getStatusBadge = () => {
    const status = formData.profileStatus;
    const badges = {
      'draft': { color: 'bg-gray-100 text-gray-700', icon: Clock, text: 'Draft' },
      'pending_approval': { color: 'bg-yellow-100 text-yellow-700', icon: Clock, text: 'Waiting for Approval' },
      'approved': { color: 'bg-green-100 text-green-700', icon: CheckCircle, text: 'Approved' },
      'needs_revision': { color: 'bg-red-100 text-red-700', icon: AlertCircle, text: 'Needs Revision' }
    };
    const badge = badges[status] || badges['draft'];
    const BadgeIcon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <BadgeIcon className="w-4 h-4" />
        {badge.text}
      </span>
    );
  };

  const canEdit = true; // Students can always edit, but need re-approval
  const needsReapproval = formData.profileStatus === 'approved';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600">Manage your personal, academic, and skill information</p>
        </div>
        {getStatusBadge()}
      </div>

      {formData.profileStatus === 'needs_revision' && formData.revisionNotes && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Revision Required</h4>
              <p className="text-red-700 text-sm mt-1">{formData.revisionNotes}</p>
            </div>
          </div>
        </div>
      )}

      {formData.profileStatus === 'pending_approval' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Pending Approval</h4>
              <p className="text-yellow-700 text-sm mt-1">
                Your profile is under review by Campus POC. You can still edit, but any changes will require re-approval.
                <br /><strong>Note:</strong> You cannot apply for jobs until your profile is approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {formData.profileStatus === 'draft' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Profile Not Submitted</h4>
              <p className="text-blue-700 text-sm mt-1">
                Complete your profile and submit for approval. You cannot apply for jobs until your profile is approved by Campus POC.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSave}>
            {activeTab === 'personal' && (
              <div className="card space-y-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={profile?.email || ''} disabled className="bg-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select 
                      value={formData.gender || ''} 
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })} 
                      disabled={!canEdit}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <h3 className="text-md font-semibold mt-6 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Campus & Placement Cycle
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campus *</label>
                    <select 
                      value={selectedCampus} 
                      onChange={(e) => setSelectedCampus(e.target.value)} 
                      disabled={!canEdit}
                      required
                    >
                      <option value="">Select Campus</option>
                      {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Select your Navgurukul campus</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placement Cycle</label>
                    <select 
                      value={selectedPlacementCycle} 
                      onChange={(e) => handleCycleChange(e.target.value)} 
                      disabled={!canEdit}
                    >
                      <option value="">Select Placement Cycle</option>
                      {placementCycles.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">The cycle when you aim to be placed</p>
                  </div>
                </div>

                <h3 className="text-md font-semibold mt-6 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Hometown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <div className="relative">
                      <input type="text" maxLength={6} value={formData.hometown.pincode} onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit pincode" disabled={!canEdit} />
                      {fetchingPincode && <div className="absolute right-3 top-1/2 -translate-y-1/2"><LoadingSpinner size="sm" /></div>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Village/Town</label>
                    <input type="text" value={formData.hometown.village} onChange={(e) => setFormData({ ...formData, hometown: { ...formData.hometown, village: e.target.value } })} disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                    <input type="text" value={formData.hometown.district} onChange={(e) => setFormData({ ...formData, hometown: { ...formData.hometown, district: e.target.value } })} disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input type="text" value={formData.hometown.state} onChange={(e) => setFormData({ ...formData, hometown: { ...formData.hometown, state: e.target.value } })} disabled={!canEdit} />
                  </div>
                </div>

                <h3 className="text-md font-semibold mt-6">Social & Portfolio Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Linkedin className="w-4 h-4" /> LinkedIn</label>
                    <input type="url" value={formData.linkedIn} onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })} placeholder="https://linkedin.com/in/..." disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Github className="w-4 h-4" /> GitHub</label>
                    <input type="url" value={formData.github} onChange={(e) => setFormData({ ...formData, github: e.target.value })} placeholder="https://github.com/..." disabled={!canEdit} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Globe className="w-4 h-4" /> Portfolio</label>
                    <input type="url" value={formData.portfolio} onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })} placeholder="https://..." disabled={!canEdit} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">About Me</label>
                  <textarea rows={4} value={formData.about} onChange={(e) => setFormData({ ...formData, about: e.target.value })} placeholder="Tell us about yourself..." disabled={!canEdit} />
                </div>

                {canEdit && (
                  <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'education' && (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    Current Navgurukul Education
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                      <select value={formData.currentSchool} onChange={(e) => setFormData({ ...formData, currentSchool: e.target.value, currentModule: '', customModuleDescription: '' })} disabled={!canEdit}>
                        <option value="">Select School</option>
                        {schools.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Calendar className="w-4 h-4" /> Joining Date</label>
                      <input type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} disabled={!canEdit} />
                    </div>
                    
                    {formData.currentSchool && (
                      <>
                        {['School of Programming', 'School of Business', 'School of Second Chance'].includes(formData.currentSchool) ? (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Module/Phase</label>
                            <select value={formData.currentModule} onChange={(e) => setFormData({ ...formData, currentModule: e.target.value })} disabled={!canEdit}>
                              <option value="">Select Module</option>
                              {getModulesForSchool().map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Phase/Skills Description</label>
                            <textarea rows={3} value={formData.customModuleDescription} onChange={(e) => setFormData({ ...formData, customModuleDescription: e.target.value })} placeholder="Describe your current learning phase and skills..." disabled={!canEdit} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5" />10th Grade Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passing Year</label>
                      <select value={formData.tenthGrade.passingYear} onChange={(e) => setFormData({ ...formData, tenthGrade: { ...formData.tenthGrade, passingYear: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select Year</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <select value={formData.tenthGrade.state} onChange={(e) => setFormData({ ...formData, tenthGrade: { ...formData.tenthGrade, state: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select State</option>
                        {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
                      <select value={formData.tenthGrade.board} onChange={(e) => setFormData({ ...formData, tenthGrade: { ...formData.tenthGrade, board: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select Board</option>
                        {boards.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
                      <input type="number" step="0.01" min="0" max="100" value={formData.tenthGrade.percentage} onChange={(e) => setFormData({ ...formData, tenthGrade: { ...formData.tenthGrade, percentage: e.target.value } })} placeholder="e.g., 85.5" disabled={!canEdit} />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5" />12th Grade Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passing Year</label>
                      <select value={formData.twelfthGrade.passingYear} onChange={(e) => setFormData({ ...formData, twelfthGrade: { ...formData.twelfthGrade, passingYear: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select Year</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <select value={formData.twelfthGrade.state} onChange={(e) => setFormData({ ...formData, twelfthGrade: { ...formData.twelfthGrade, state: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select State</option>
                        {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
                      <select value={formData.twelfthGrade.board} onChange={(e) => setFormData({ ...formData, twelfthGrade: { ...formData.twelfthGrade, board: e.target.value } })} disabled={!canEdit}>
                        <option value="">Select Board</option>
                        {boards.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
                      <input type="number" step="0.01" min="0" max="100" value={formData.twelfthGrade.percentage} onChange={(e) => setFormData({ ...formData, twelfthGrade: { ...formData.twelfthGrade, percentage: e.target.value } })} placeholder="e.g., 85.5" disabled={!canEdit} />
                    </div>
                  </div>
                </div>

                {/* Higher Education Section */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <GraduationCap className="w-5 h-5" />Higher Education
                    </h2>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          higherEducation: [...formData.higherEducation, {
                            degree: '',
                            institution: '',
                            fieldOfStudy: '',
                            startYear: '',
                            endYear: '',
                            percentage: '',
                            isCompleted: false
                          }]
                        })}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add More
                      </button>
                    )}
                  </div>

                  {formData.higherEducation.length === 0 ? (
                    <p className="text-gray-500 text-sm">No higher education added. Click "Add More" to add your degree/diploma.</p>
                  ) : (
                    <div className="space-y-6">
                      {formData.higherEducation.map((edu, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg relative">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...formData.higherEducation];
                                updated.splice(index, 1);
                                setFormData({ ...formData, higherEducation: updated });
                              }}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Degree/Diploma</label>
                              <input
                                type="text"
                                value={edu.degree}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].degree = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                placeholder="e.g., B.Tech, BCA, Diploma"
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                              <input
                                type="text"
                                value={edu.institution}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].institution = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                placeholder="University/College name"
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Field of Study</label>
                              <input
                                type="text"
                                value={edu.fieldOfStudy}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].fieldOfStudy = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                placeholder="e.g., Computer Science"
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                              <select
                                value={edu.startYear}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].startYear = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                disabled={!canEdit}
                              >
                                <option value="">Select Year</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                              <select
                                value={edu.endYear}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].endYear = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                disabled={!canEdit}
                              >
                                <option value="">Select Year</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage/CGPA</label>
                              <input
                                type="text"
                                value={edu.percentage}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].percentage = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                placeholder="e.g., 85% or 8.5 CGPA"
                                disabled={!canEdit}
                              />
                            </div>
                            <div className="flex items-center">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={edu.isCompleted}
                                  onChange={(e) => {
                                    const updated = [...formData.higherEducation];
                                    updated[index].isCompleted = e.target.checked;
                                    setFormData({ ...formData, higherEducation: updated });
                                  }}
                                  disabled={!canEdit}
                                  className="w-4 h-4 text-primary-600 rounded"
                                />
                                <span className="text-sm text-gray-700">Completed</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Courses Section */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Award className="w-5 h-5" />Courses & Certifications
                    </h2>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          courses: [...formData.courses, {
                            courseName: '',
                            provider: '',
                            completionDate: '',
                            certificateUrl: '',
                            skills: []
                          }]
                        })}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Course
                      </button>
                    )}
                  </div>

                  {formData.courses.length === 0 ? (
                    <p className="text-gray-500 text-sm">No courses added. Click "Add Course" to add your certifications.</p>
                  ) : (
                    <div className="space-y-6">
                      {formData.courses.map((course, index) => {
                        const allSkillOptions = [...(settings.technicalSkillOptions || []), ...(settings.courseSkills || [])];
                        return (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg relative">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...formData.courses];
                                  updated.splice(index, 1);
                                  setFormData({ ...formData, courses: updated });
                                }}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Course Name</label>
                                <input
                                  type="text"
                                  value={course.courseName}
                                  onChange={(e) => {
                                    const updated = [...formData.courses];
                                    updated[index].courseName = e.target.value;
                                    setFormData({ ...formData, courses: updated });
                                  }}
                                  placeholder="e.g., React Complete Guide"
                                  disabled={!canEdit}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                <select
                                  value={course.provider}
                                  onChange={(e) => {
                                    const updated = [...formData.courses];
                                    updated[index].provider = e.target.value;
                                    setFormData({ ...formData, courses: updated });
                                  }}
                                  disabled={!canEdit}
                                >
                                  <option value="">Select Provider</option>
                                  {(settings.courseProviders || defaultSettings.courseProviders).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date</label>
                                <input
                                  type="date"
                                  value={course.completionDate ? new Date(course.completionDate).toISOString().split('T')[0] : ''}
                                  onChange={(e) => {
                                    const updated = [...formData.courses];
                                    updated[index].completionDate = e.target.value;
                                    setFormData({ ...formData, courses: updated });
                                  }}
                                  disabled={!canEdit}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Certificate URL</label>
                                <input
                                  type="url"
                                  value={course.certificateUrl || ''}
                                  onChange={(e) => {
                                    const updated = [...formData.courses];
                                    updated[index].certificateUrl = e.target.value;
                                    setFormData({ ...formData, courses: updated });
                                  }}
                                  placeholder="https://..."
                                  disabled={!canEdit}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Skills Learned</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {course.skills?.map((skill, sIndex) => (
                                    <span key={sIndex} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                                      {skill}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...formData.courses];
                                            updated[index].skills = course.skills.filter((_, i) => i !== sIndex);
                                            setFormData({ ...formData, courses: updated });
                                          }}
                                          className="hover:text-primary-900"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                                {canEdit && (
                                  <div className="flex gap-2">
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value && !course.skills?.includes(e.target.value)) {
                                          const updated = [...formData.courses];
                                          updated[index].skills = [...(course.skills || []), e.target.value];
                                          setFormData({ ...formData, courses: updated });
                                        }
                                        e.target.value = '';
                                      }}
                                      className="flex-1"
                                    >
                                      <option value="">Select skill to add</option>
                                      {allSkillOptions.filter(s => !course.skills?.includes(s)).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        placeholder="Or add new skill"
                                        value={newCourseSkill}
                                        onChange={(e) => setNewCourseSkill(e.target.value)}
                                        className="w-40"
                                      />
                                      <button
                                        type="button"
                                        disabled={!newCourseSkill.trim() || addingCourseSkill}
                                        onClick={async () => {
                                          if (!newCourseSkill.trim()) return;
                                          setAddingCourseSkill(true);
                                          try {
                                            await settingsAPI.addCourseSkill(newCourseSkill.trim());
                                            const updated = [...formData.courses];
                                            updated[index].skills = [...(course.skills || []), newCourseSkill.trim()];
                                            setFormData({ ...formData, courses: updated });
                                            setSettings(prev => ({
                                              ...prev,
                                              courseSkills: [...(prev.courseSkills || []), newCourseSkill.trim()]
                                            }));
                                            setNewCourseSkill('');
                                            toast.success('Skill added and saved for all users');
                                          } catch (error) {
                                            if (error.response?.data?.message === 'Skill already exists') {
                                              // Just add it to the course
                                              const updated = [...formData.courses];
                                              updated[index].skills = [...(course.skills || []), newCourseSkill.trim()];
                                              setFormData({ ...formData, courses: updated });
                                              setNewCourseSkill('');
                                            } else {
                                              toast.error('Error adding skill');
                                            }
                                          } finally {
                                            setAddingCourseSkill(false);
                                          }
                                        }}
                                        className="btn btn-primary btn-sm"
                                      >
                                        {addingCourseSkill ? '...' : <Plus className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Brain className="w-5 h-5" />Technical Skills (Self-Assessment)</h2>
                  <p className="text-sm text-gray-500 mb-4">Select your technical skills and rate yourself (1 = Basic, 4 = Expert)</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(settings.technicalSkillOptions || defaultSettings.technicalSkillOptions).map((skillName) => {
                      const existingSkill = formData.technicalSkills.find(s => s.skillName === skillName);
                      const isSelected = !!existingSkill;
                      const rating = existingSkill?.selfRating || 0;
                      
                      return (
                        <div key={skillName} className={`p-3 rounded-lg border-2 transition ${isSelected ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-transparent'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      technicalSkills: [...formData.technicalSkills, { skillName, selfRating: 1, addedAt: new Date() }]
                                    });
                                  } else {
                                    setFormData({
                                      ...formData,
                                      technicalSkills: formData.technicalSkills.filter(s => s.skillName !== skillName)
                                    });
                                  }
                                }}
                                className="w-4 h-4 text-primary-600 rounded"
                              />
                              <span className={`font-medium ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>{skillName}</span>
                            </label>
                            {isSelected && <span className="text-sm font-medium text-primary-600">{ratingLabels[rating]}</span>}
                          </div>
                          {isSelected && (
                            <div className="flex gap-1 mt-2">
                              {[1, 2, 3, 4].map((level) => (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => {
                                    const updated = formData.technicalSkills.map(s =>
                                      s.skillName === skillName ? { ...s, selfRating: level } : s
                                    );
                                    setFormData({ ...formData, technicalSkills: updated });
                                  }}
                                  className={`flex-1 h-2 rounded-full transition ${level <= rating ? 'bg-primary-500' : 'bg-gray-200'}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Soft Skills Assessment</h2>
                  <p className="text-sm text-gray-500 mb-4">Rate yourself on these soft skills (1 = Basic, 4 = Expert). Leave unselected if not applicable.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {softSkillsList.map((skill) => {
                      const rating = formData.softSkills[skill.key] || 0;
                      const isSelected = rating > 0;
                      return (
                        <div key={skill.key} className={`p-3 rounded-lg border-2 transition ${isSelected ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-transparent'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  handleSoftSkillChange(skill.key, e.target.checked ? 1 : 0);
                                }}
                                className="w-4 h-4 text-purple-600 rounded"
                              />
                              <div>
                                <p className={`font-medium ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>{skill.label}</p>
                                <p className="text-xs text-gray-500">{skill.description}</p>
                              </div>
                            </label>
                            {isSelected && <span className="text-sm font-medium text-purple-600">{ratingLabels[rating]}</span>}
                          </div>
                          {isSelected && (
                            <div className="flex gap-1 mt-2">
                              {[1, 2, 3, 4].map((level) => (
                                <button key={level} type="button" onClick={() => handleSoftSkillChange(skill.key, level)} className={`flex-1 h-2 rounded-full transition ${level <= rating ? 'bg-purple-500' : 'bg-gray-200'}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {canEdit && (
                  <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'languages' && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Languages className="w-5 h-5" />Language Proficiency (CEFR Levels)</h2>
                <p className="text-sm text-gray-500 mb-6">The Common European Framework of Reference (CEFR) is an international standard for describing language ability.</p>
                
                {/* English Proficiency - Primary */}
                <div className="mb-8">
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs">Required</span>
                    English Proficiency
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Speaking Level</label>
                      <div className="space-y-2">
                        {cefrLevels.map((level) => (
                          <label key={level} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${formData.englishProficiency.speaking === level ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'} ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}>
                            <input type="radio" name="speaking" value={level} checked={formData.englishProficiency.speaking === level} onChange={(e) => setFormData({ ...formData, englishProficiency: { ...formData.englishProficiency, speaking: e.target.value } })} disabled={!canEdit} className="sr-only" />
                            <span className="font-semibold text-primary-600">{level}</span>
                            <span className="text-gray-600">{cefrDescriptions[level]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Writing Level</label>
                      <div className="space-y-2">
                        {cefrLevels.map((level) => (
                          <label key={level} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${formData.englishProficiency.writing === level ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'} ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}>
                            <input type="radio" name="writing" value={level} checked={formData.englishProficiency.writing === level} onChange={(e) => setFormData({ ...formData, englishProficiency: { ...formData.englishProficiency, writing: e.target.value } })} disabled={!canEdit} className="sr-only" />
                            <span className="font-semibold text-primary-600">{level}</span>
                            <span className="text-gray-600">{cefrDescriptions[level]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Languages */}
                <div className="border-t pt-6">
                  <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">Optional</span>
                    Additional Languages
                  </h3>
                  
                  {/* Existing Languages */}
                  {formData.languages?.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {formData.languages.map((lang, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className="font-medium text-gray-900">{lang.language}</div>
                            {lang.isNative && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Native</span>}
                            <div className="text-sm text-gray-500">
                              Speaking: <span className="font-medium text-gray-700">{lang.speaking}</span>
                              {' | '}
                              Writing: <span className="font-medium text-gray-700">{lang.writing}</span>
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...formData.languages];
                                updated.splice(index, 1);
                                setFormData({ ...formData, languages: updated });
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Language */}
                  {canEdit && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Add a Language</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Language</label>
                          <input
                            type="text"
                            value={newLanguage.language}
                            onChange={(e) => setNewLanguage({ ...newLanguage, language: e.target.value })}
                            placeholder="e.g., Hindi, Spanish"
                            className="input w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Speaking</label>
                          <select
                            value={newLanguage.speaking}
                            onChange={(e) => setNewLanguage({ ...newLanguage, speaking: e.target.value })}
                            className="input w-full"
                          >
                            <option value="">Select</option>
                            {cefrLevels.map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Writing</label>
                          <select
                            value={newLanguage.writing}
                            onChange={(e) => setNewLanguage({ ...newLanguage, writing: e.target.value })}
                            className="input w-full"
                          >
                            <option value="">Select</option>
                            {cefrLevels.map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newLanguage.isNative}
                              onChange={(e) => setNewLanguage({ ...newLanguage, isNative: e.target.checked })}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <span className="text-sm">Native</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (newLanguage.language && newLanguage.speaking && newLanguage.writing) {
                                setFormData({
                                  ...formData,
                                  languages: [...(formData.languages || []), { ...newLanguage }]
                                });
                                setNewLanguage({ language: '', speaking: '', writing: '', isNative: false });
                              }
                            }}
                            disabled={!newLanguage.language || !newLanguage.speaking || !newLanguage.writing}
                            className="btn btn-secondary text-sm"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">CEFR Level Guide</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div><span className="font-medium">A1:</span> Basic phrases</div>
                    <div><span className="font-medium">A2:</span> Routine tasks</div>
                    <div><span className="font-medium">B1:</span> Main points of clear text</div>
                    <div><span className="font-medium">B2:</span> Complex technical discussions</div>
                    <div><span className="font-medium">C1:</span> Flexible and effective use</div>
                    <div><span className="font-medium">C2:</span> Near-native proficiency</div>
                  </div>
                </div>

                {canEdit && (
                  <button type="submit" disabled={saving} className="btn btn-primary mt-6 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5" />Open For Roles</h2>
                <p className="text-sm text-gray-500 mb-6">Select the roles you are interested in. This helps placement coordinators match you with suitable opportunities.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(settings.availableRoles || []).map((role) => (
                    <label key={role} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border-2 ${formData.openForRoles.includes(role) ? 'bg-primary-50 border-primary-500' : 'bg-gray-50 border-transparent hover:bg-gray-100'} ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <input type="checkbox" checked={formData.openForRoles.includes(role)} onChange={() => handleRoleToggle(role)} disabled={!canEdit} className="w-4 h-4 text-primary-600 rounded" />
                      <span className={formData.openForRoles.includes(role) ? 'text-primary-700 font-medium' : 'text-gray-700'}>{role}</span>
                    </label>
                  ))}
                </div>

                {canEdit && (
                  <button type="submit" disabled={saving} className="btn btn-primary mt-6 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="space-y-6">
          {formData.profileStatus !== 'approved' && (
            <div className="card bg-primary-50 border border-primary-200">
              <h2 className="text-lg font-semibold mb-2 text-primary-900">
                {formData.profileStatus === 'pending_approval' ? 'Awaiting Approval' : 'Ready to Submit?'}
              </h2>
              <p className="text-sm text-primary-700 mb-4">
                {formData.profileStatus === 'pending_approval' 
                  ? 'Your profile is being reviewed. If you make changes, you\'ll need to resubmit.' 
                  : 'Once you\'ve completed all sections, submit your profile for approval by your Campus POC.'}
              </p>
              <button onClick={handleSubmitForApproval} disabled={submitting || formData.profileStatus === 'pending_approval'} className="btn btn-primary w-full flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : formData.profileStatus === 'pending_approval' ? 'Pending Review' : 'Submit for Approval'}
              </button>
            </div>
          )}

          {formData.profileStatus === 'approved' && (
            <div className="card bg-green-50 border border-green-200">
              <h2 className="text-lg font-semibold mb-2 text-green-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> Profile Approved
              </h2>
              <p className="text-sm text-green-700 mb-4">Your profile is approved. You can apply for jobs. If you edit your profile, it will need re-approval.</p>
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Resume</h2>
            {profile?.studentProfile?.resume ? (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-700 text-sm">Resume uploaded</p>
                <a href={`/${profile.studentProfile.resume}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline">View Resume</a>
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-3">No resume uploaded</p>
            )}
            {canEdit && (
              <label className="btn btn-secondary w-full mt-3 cursor-pointer flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />Upload Resume
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
              </label>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Profile Completion</h2>
            {(() => {
              const completionItems = [
                { label: 'Personal Info', done: formData.firstName && formData.phone },
                { label: 'Hometown', done: formData.hometown.pincode },
                { label: 'Current School', done: formData.currentSchool },
                { label: '10th Grade', done: formData.tenthGrade.percentage },
                { label: '12th Grade', done: formData.twelfthGrade.percentage },
                { label: 'Technical Skills', done: formData.technicalSkills.length > 0 },
                { label: 'Soft Skills', done: Object.values(formData.softSkills).some(v => v > 0) },
                { label: 'English Level', done: formData.englishProficiency.speaking },
                { label: 'Open For Roles', done: formData.openForRoles.length > 0 },
                { label: 'Resume', done: profile?.studentProfile?.resume }
              ];
              const completedCount = completionItems.filter(item => item.done).length;
              const completionPercent = Math.round((completedCount / completionItems.length) * 100);
              
              return (
                <>
                  {/* Percentage Display */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-primary-600">{completionPercent}%</span>
                      <span className="text-sm text-gray-500">{completedCount}/{completionItems.length} completed</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          completionPercent >= 80 ? 'bg-green-500' : 
                          completionPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                    {completionPercent < 100 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Complete your profile to apply for jobs
                      </p>
                    )}
                  </div>
                  
                  {/* Checklist */}
                  <div className="space-y-3">
                    {completionItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${item.done ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                          {item.done && '✓'}
                        </div>
                        <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
