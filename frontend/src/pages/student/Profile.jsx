import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI, userAPI, settingsAPI, campusAPI, placementCycleAPI, skillAPI, utilsAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';
import SearchableSelect from '../../components/common/SearchableSelect';
import {
  User, Mail, Phone, GraduationCap, Upload, Save, Send,
  Linkedin, Github, Globe, BookOpen, Languages, Brain,
  MapPin, Calendar, Briefcase, CheckCircle, Clock, AlertCircle,
  Plus, Trash2, Award, Building2, Search, MessageSquare
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

const fallbackSchools = [
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

const levelLabels = ['', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
const ratingLabels = ['', '1 - Basic', '2 - Intermediate', '3 - Advanced', '4 - Expert'];

const defaultSettings = {
  schoolModules: {
    'School of Programming': [
      'Programming Foundations', 'Problem Solving & Flowcharts', 'Web Fundamentals',
      'JavaScript Fundamentals', 'Advanced JavaScript', 'DOM & Browser APIs',
      'Python Fundamentals', 'Advanced Python', 'Data Structures & Algorithms',
      'Advanced Data Structures', 'React & Frontend Frameworks'
    ],
    'School of Business': ['CRM', 'Digital Marketing', 'Data Analytics', 'Advanced Google Sheets'],
    'School of Second Chance': ['Master Chef', 'Fashion Designing'],
    'School of Finance': [],
    'School of Education': [],
    'School of Design': ['Graphic Design', 'UI/UX Design', 'Product Design', 'Motion Graphics']
  },
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
  courseProviders: ['Navgurukul', 'Coursera', 'Udemy', 'LinkedIn Learning', 'YouTube', 'Other'],
  proficiencyRubrics: {
    '1': { label: 'Basic', description: 'Has basic theoretical knowledge and can perform simple tasks with guidance.' },
    '2': { label: 'Intermediate', description: 'Can work independently on routine tasks and understands core principles.' },
    '3': { label: 'Advanced', description: 'Can handle complex problems, optimize workflows, and guide others.' },
    '4': { label: 'Expert', description: 'Deep mastery of the subject with ability to architect systems and lead strategy.' }
  }
};

const StudentProfile = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [allSkills, setAllSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPincode, setFetchingPincode] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
    softSkills: [],
    technicalSkills: [],
    officeSkills: [],
    profileStatus: 'draft',
    revisionNotes: '',
    resumeLink: '',
    houseName: '',
    resumeLink: '',
    houseName: '',
    councilService: [],
    discord: { userId: '', username: '' },
    readTheoryLevel: '',
    atCoderRating: ''
  });

  const [newCourseSkill, setNewCourseSkill] = useState('');
  const [addingCourseSkill, setAddingCourseSkill] = useState(false);
  const [newCouncilService, setNewCouncilService] = useState({ post: '', monthsServed: '', certificateUrl: '' });
  const [addingCouncilService, setAddingCouncilService] = useState(false);
  const [showProfileCouncilSuggestions, setShowProfileCouncilSuggestions] = useState(false);
  const [newLanguage, setNewLanguage] = useState({ language: '', speaking: '', writing: '', isNative: false });
  const [resumeLinkStatus, setResumeLinkStatus] = useState({ checked: false, ok: false, status: null });

  const schoolList = Object.keys(settings.schoolModules || {});
  const schools = (schoolList.length > 0 ? schoolList : fallbackSchools)
    .filter(s => !settings.inactiveSchools?.includes(s) || s === formData.currentSchool);

  useEffect(() => {
    fetchProfile();
    fetchSettings();
    fetchCampuses();
    fetchPlacementCycles();
    fetchSkills();
  }, []);

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
      setCampuses(response.data || []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
      setCampuses([]);
      toast.error('Error fetching campuses. Click retry to try again.');
    }
  };

  const fetchPlacementCycles = async () => {
    try {
      // Fetch all cycles (students should be able to choose any cycle)
      const response = await placementCycleAPI.getCycles();
      setPlacementCycles(response.data);
    } catch (error) {
      console.error('Error fetching placement cycles:', error);
    }
  };

  const fetchProfile = async () => {
    let data = null;

    try {
      const response = await authAPI.getMe();
      data = response.data;
      setProfile(data);
      setSelectedCampus(data.campus?._id || data.campus || '');
      setSelectedPlacementCycle(data.placementCycle?._id || data.placementCycle || '');
      // Merge technicalSkills with any pending legacy skills so students see their selected levels
      const technicalFromProfile = Array.isArray(data.studentProfile?.technicalSkills) ? [...data.studentProfile.technicalSkills] : [];
      const pendingLegacy = Array.isArray(data.studentProfile?.skills) ? data.studentProfile.skills.filter(s => s.status === 'pending') : [];
      pendingLegacy.forEach(ps => {
        const key = (ps.skill && ps.skill._id) ? ps.skill._id.toString() : (ps.skillName || '');
        const exists = technicalFromProfile.find(ts => (ts.skillId && ts.skillId.toString() === key) || ts.skillName === (ps.skill?.name || ps.skillName));
        if (!exists) {
          technicalFromProfile.push({
            skillId: ps.skill?._id,
            skillName: ps.skill?.name || ps.skillName || '',
            selfRating: ps.selfRating || 0,
            pendingApproval: true
          });
        }
      });

      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        gender: data.resolvedProfile?.gender || data.gender || '',
        linkedIn: data.studentProfile?.linkedIn || '',
        github: data.studentProfile?.github || '',
        portfolio: data.studentProfile?.portfolio || '',
        about: data.studentProfile?.about || '',
        currentSchool: data.resolvedProfile?.currentSchool || data.studentProfile?.currentSchool || '',
        joiningDate: (data.resolvedProfile?.joiningDate || data.studentProfile?.joiningDate) ? new Date(data.resolvedProfile?.joiningDate || data.studentProfile?.joiningDate).toISOString().split('T')[0] : '',
        currentModule: data.resolvedProfile?.currentModule || data.studentProfile?.currentModule || '',
        customModuleDescription: data.studentProfile?.customModuleDescription || '',
        tenthGrade: data.studentProfile?.tenthGrade || { passingYear: '', state: '', board: '', percentage: '' },
        twelfthGrade: data.studentProfile?.twelfthGrade || { passingYear: '', state: '', board: '', percentage: '' },
        higherEducation: data.studentProfile?.higherEducation || [],
        courses: data.studentProfile?.courses || [],
        hometown: data.studentProfile?.hometown || { pincode: '', village: '', district: '', state: '' },
        openForRoles: data.studentProfile?.openForRoles || [],
        englishProficiency: data.studentProfile?.englishProficiency || { speaking: '', writing: '' },
        languages: Array.isArray(data.studentProfile?.languages) ? data.studentProfile.languages : [],
        softSkills: Array.isArray(data.studentProfile?.softSkills) ? data.studentProfile.softSkills : [],
        technicalSkills: technicalFromProfile,
        officeSkills: Array.isArray(data.studentProfile?.officeSkills) ? data.studentProfile.officeSkills : [],
        profileStatus: data.studentProfile?.profileStatus || 'draft',
        revisionNotes: data.studentProfile?.revisionNotes || '',
        resumeLink: data.studentProfile?.resumeLink || '',
        houseName: data.studentProfile?.houseName || '',
        councilService: data.studentProfile?.councilService || [],
        discord: {
          userId: data.discord?.userId || '',
          username: data.discord?.username || ''
        }
      });

      // Override with resolvedProfile data if student and verified data exists
      if (data.role === 'student' && data.resolvedProfile) {
        setFormData(prev => ({
          ...prev,
          firstName: data.resolvedProfile.firstName || prev.firstName,
          lastName: data.resolvedProfile.lastName || prev.lastName,
          currentSchool: data.resolvedProfile.currentSchool || prev.currentSchool,
          joiningDate: data.resolvedProfile.joiningDate ? new Date(data.resolvedProfile.joiningDate).toISOString().split('T')[0] : prev.joiningDate,
          currentModule: data.resolvedProfile.currentModule || prev.currentModule,
          gender: data.resolvedProfile.gender || prev.gender,
          phone: data.resolvedProfile.phone || prev.phone,
          englishProficiency: {
            speaking: data.resolvedProfile.englishSpeaking || prev.englishProficiency.speaking,
            writing: data.resolvedProfile.englishWriting || prev.englishProficiency.writing
          },
          hometown: data.resolvedProfile.hometown ? { ...prev.hometown, ...data.resolvedProfile.hometown } : prev.hometown,
          readTheoryLevel: data.resolvedProfile.readTheoryLevel || prev.readTheoryLevel || '',
          atCoderRating: data.resolvedProfile.atCoderRating || prev.atCoderRating || ''
        }));
      }


      // If profile has a resume link, check accessibility (do this inside try so we can use `data` safely)
      const link = data?.studentProfile?.resumeLink || '';
      if (link) {
        try {
          const res = await utilsAPI.checkUrl(link);
          setResumeLinkStatus({ checked: true, ok: res.data?.ok === true, status: res.data?.status });
        } catch (err) {
          setResumeLinkStatus({ checked: true, ok: false, status: null });
        }
      }
    } catch (error) {
      toast.error('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate hometown if pincode is present but other details are missing (e.g. after Ghar sync)
  useEffect(() => {
    const { pincode, district, state } = formData.hometown;
    if (pincode && pincode.length === 6 && (!district || !state)) {
      handlePincodeChange(pincode);
    }
  }, [formData.hometown.pincode]);

  // Handle campus sync from Ghar - needs to wait for both profile and campuses list
  useEffect(() => {
    if (profile?.resolvedProfile?.isCampusVerified && profile.resolvedProfile.campus && campuses.length > 0) {
      const matchedCampus = campuses.find(c =>
        c.name.toLowerCase().includes(profile.resolvedProfile.campus.toLowerCase()) ||
        profile.resolvedProfile.campus.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchedCampus) {
        setSelectedCampus(matchedCampus._id);
      }
    }
  }, [profile, campuses]);

  const fetchSettings = async () => {
    try {
      const response = await settingsAPI.getSettings();
      const data = response.data?.data || response.data || {};
      if (Object.keys(data).length > 0) {
        setSettings({ ...defaultSettings, ...data });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleAddEducationOption = async (department, specialization = '') => {
    try {
      const response = await settingsAPI.addHigherEducationOption({ department, specialization });
      if (response.data.success) {
        setSettings(prev => ({
          ...prev,
          higherEducationOptions: response.data.data
        }));
        toast.success(specialization ? `Added specialization "${specialization}" to ${department}` : `Added department "${department}"`);
        return true;
      }
    } catch (error) {
      console.error('Error adding education option:', error);
      toast.error('Failed to add new option');
    }
    return false;
  };

  const handleAddInstitutionOption = async (institution, pincode = '') => {
    try {
      const response = await settingsAPI.addInstitutionOption(institution, pincode);
      if (response.data.success) {
        setSettings(prev => ({
          ...prev,
          institutionOptions: response.data.data
        }));
        toast.success(`Added "${institution}" with pincode "${pincode}" to the list`);
        return true;
      }
    } catch (error) {
      console.error('Error adding institution option:', error);
      toast.error('Failed to add new institution');
    }
    return false;
  };

  const handleAddCouncilPostOption = async (post) => {
    try {
      const response = await settingsAPI.addCouncilPostOption(post);
      if (response.data.success) {
        setSettings(prev => ({
          ...prev,
          councilPosts: response.data.data.councilPosts
        }));
        toast.success(`Added "${post}" to the list`);
        return true;
      }
    } catch (error) {
      console.error('Error adding council post option:', error);
      toast.error('Failed to add new post');
    }
    return false;
  };

  const fetchPincodeAuto = async (institution, index) => {
    if (!institution) return;
    try {
      const searchName = institution.split(',')[0].trim();
      const response = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(searchName)}`);
      const data = await response.json();

      if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const pincode = po.Pincode;
        const district = po.District;
        const updated = [...formData.higherEducation];
        updated[index].pincode = pincode;
        updated[index].district = district;
        setFormData({ ...formData, higherEducation: updated });
        toast.success(`Fetched: ${pincode}, ${district}`);

        // Also update our global list if it was empty
        if (!settings.institutionOptions?.[institution]) {
          handleAddInstitutionOption(institution, pincode);
        }
      } else {
        toast.error("Could not auto-fetch location details. Please enter manually.");
      }
    } catch (error) {
      console.error("Pincode fetch error:", error);
      toast.error("Failed to fetch location automatically");
    }
  };

  const fetchDistrictForEdu = async (pincode, index) => {
    if (pincode.length !== 6) return;
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const district = data[0].PostOffice[0].District || '';
        const updated = [...formData.higherEducation];
        updated[index].district = district;
        setFormData({ ...formData, higherEducation: updated });
        toast.success(`District found: ${district}`);
      }
    } catch (error) {
      console.error("Error fetching district:", error);
    }
  };

  const getModulesForSchool = () => {
    const mapped = settings.schoolModules?.[formData.currentSchool];
    if (Array.isArray(mapped) && mapped.length > 0) return mapped;

    switch (formData.currentSchool) {
      case 'School of Programming':
        return settings.programmingModules || defaultSettings.programmingModules;
      case 'School of Business':
        return settings.businessModules || defaultSettings.businessModules;
      case 'School of Second Chance':
        return settings.secondChanceModules || defaultSettings.secondChanceModules;
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
      // Validate resume link before saving if present
      const url = formData.resumeLink && formData.resumeLink.trim();
      if (url) {
        // If we've already checked and it's false, block save
        if (resumeLinkStatus.checked && !resumeLinkStatus.ok) {
          toast.error('Resume link is not accessible. Please fix or remove it before saving.');
          setSaving(false);
          return;
        }
        // If not checked yet, perform a check now
        if (!resumeLinkStatus.checked) {
          try {
            const res = await utilsAPI.checkUrl(url);
            const ok = res.data?.ok === true;
            setResumeLinkStatus({ checked: true, ok, status: res.data?.status });
            if (!ok) {
              toast.error('Resume link is not accessible. Please fix or remove it before saving.');
              setSaving(false);
              return;
            }
          } catch (err) {
            toast.error('Error checking resume link. Please try again.');
            setSaving(false);
            return;
          }
        }
      }

      // Include campus and gender in the profile update
      const profileData = { ...formData, campus: selectedCampus, gender: formData.gender };
      await userAPI.updateProfile(profileData);
      toast.success('Profile updated successfully');
      updateUser({ firstName: formData.firstName, lastName: formData.lastName });
      fetchProfile();
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.message || 'Error updating profile');
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
      const status = error?.response?.status;
      if (status === 403) {
        toast.error('You are not allowed to change placement cycle. Please contact your Campus POC for assistance.');
      } else {
        toast.error(error.response?.data?.message || 'Error updating placement cycle');
      }
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      // Save profile first to persist any changes (e.g., soft skills) before submission
      try {
        await userAPI.updateProfile({ ...formData, campus: selectedCampus, gender: formData.gender });
        toast.success('Profile saved');
      } catch (saveErr) {
        toast.error(saveErr.response?.data?.message || 'Error saving profile before submission');
        setSubmitting(false);
        return;
      }

      await userAPI.submitProfile();
      toast.success('Profile submitted for approval');
      fetchProfile();
    } catch (error) {
      toast.error('Error submitting profile');
    } finally {
      setSubmitting(false);
    }
  };



  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    setUploadingAvatar(true);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const response = await userAPI.uploadAvatar(file);
      if (response.data.success) {
        setProfile({ ...profile, avatar: response.data.avatar });
        toast.success('Profile picture updated');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload profile picture');
      setAvatarPreview(profile?.avatar || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSoftSkillChange = (skillKey, value) => {
    // Legacy support or deprecated function - we now use the new skills handling logic
  };

  const handleSkillToggle = (category, skill) => {
    const field = category === 'technical' ? 'technicalSkills' : (category === 'soft_skill' ? 'softSkills' : 'officeSkills');
    const existing = formData[field].find(s => s.skillId === skill._id || s.skillName === skill.name);

    if (existing) {
      setFormData({
        ...formData,
        [field]: formData[field].filter(s => s.skillId !== skill._id && s.skillName !== skill.name)
      });
    } else {
      setFormData({
        ...formData,
        [field]: [...formData[field], {
          skillId: skill._id,
          skillName: skill.name,
          selfRating: 1,
          addedAt: new Date()
        }]
      });
    }
  };

  const handleRatingChange = (category, skillId, rating) => {
    const field = category === 'technical' ? 'technicalSkills' : (category === 'soft_skill' ? 'softSkills' : 'officeSkills');
    const updated = formData[field].map(s =>
      (s.skillId === skillId || s.skillName === skillId) ? { ...s, selfRating: rating } : s
    );
    setFormData({ ...formData, [field]: updated });
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
    { id: 'council', label: 'Council', icon: Award },
    { id: 'roles', label: 'Open For', icon: Briefcase }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 47 }, (_, i) => (currentYear + 6) - i);
  const modulesForSchool = getModulesForSchool();
  const hasModulesForSchool = modulesForSchool.length > 0;

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

      {profile?.resolvedProfile?.attendancePercentage !== null && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-green-900 text-lg">Verified Attendance: {profile.resolvedProfile.attendancePercentage}%</h4>
              <p className="text-green-700 text-sm">
                This data is periodically synced from the **Ghar Dashboard**. Keep it high to remain eligible for more jobs!
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">Status</div>
            <div className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold border border-green-300">
              {profile.resolvedProfile.currentStatus}
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
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] transition flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
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
                <div className="flex flex-col md:flex-row items-center gap-6 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-white shadow-xl bg-white flex items-center justify-center">
                      {(avatarPreview || (profile?.avatar)) ? (
                        <img
                          src={avatarPreview || (profile?.avatar?.startsWith('http') ? profile.avatar : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${profile.avatar}`)}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                          {formData.firstName?.[0]}{formData.lastName?.[0]}
                        </div>
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <LoadingSpinner size="sm" color="white" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-primary-700 transition-all transform hover:scale-110">
                      <Upload className="w-4 h-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className="text-lg font-bold text-gray-900">Profile Picture</h3>
                    <p className="text-sm text-gray-500 max-w-xs">Upload a clear professional photo. Recommended size: 400x400px, max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      First Name
                      {profile?.resolvedProfile?.isNameVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      disabled={!canEdit || profile?.resolvedProfile?.isNameVerified}
                      className={profile?.resolvedProfile?.isNameVerified ? 'bg-gray-50 border-green-200' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Last Name
                      {profile?.resolvedProfile?.isNameVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      disabled={!canEdit || profile?.resolvedProfile?.isNameVerified}
                      className={profile?.resolvedProfile?.isNameVerified ? 'bg-gray-50 border-green-200' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={profile?.email || ''} disabled className="bg-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Phone
                      {profile?.resolvedProfile?.isPhoneVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={!canEdit || profile?.resolvedProfile?.isPhoneVerified}
                      className={profile?.resolvedProfile?.isPhoneVerified ? 'bg-gray-50 border-green-200' : ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Gender
                      {profile?.resolvedProfile?.isGenderVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.gender || ''}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      disabled={!canEdit || profile?.resolvedProfile?.isGenderVerified}
                      className={profile?.resolvedProfile?.isGenderVerified ? 'bg-gray-50 border-green-200' : ''}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mt-6">
                  <h3 className="text-md font-semibold flex items-center gap-2 text-indigo-900 mb-4">
                    <MessageSquare className="w-5 h-5" />
                    Discord Integration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discord User ID
                        <span className="text-xs text-gray-500 ml-1 font-normal">(Required for notifications)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.discord?.userId || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          discord: { ...formData.discord, userId: e.target.value }
                        })}
                        placeholder="e.g. 748123456789012345"
                        disabled={!canEdit}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      />
                      <p className="text-[11px] text-gray-500 mt-1 leading-tight">
                        To find this: In Discord, go to Settings → Advanced → Enable Developer Mode. Then right-click your profile and select "Copy User ID".
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Discord Username</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.discord?.username || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            discord: { ...formData.discord, username: e.target.value }
                          })}
                          placeholder="e.g. user_name"
                          disabled={!canEdit}
                          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                        {profile?.discord?.verified && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 flex items-center gap-1 text-xs font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Your username will be used for mentions in job updates.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50/50 border border-green-100 rounded-lg p-4 mt-6">
                  <h3 className="text-md font-semibold flex items-center gap-2 text-green-900 mb-4">
                    <CheckCircle className="w-5 h-5" />
                    Verified Identity & Details
                    <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full uppercase">Synced from Ghar</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Aadhar Number</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md font-mono text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.aadharNo || 'Not Synced'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Caste/Category</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.caste || 'Not Synced'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Qualification</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.qualification || 'Not Synced'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Marital Status</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.maritalStatus || 'Not Synced'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Religion</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.religion || 'Not Synced'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
                      <div className="p-2 bg-white border border-green-100 rounded-md text-sm leading-none h-9 flex items-center">
                        {profile?.resolvedProfile?.dob ? new Date(profile.resolvedProfile.dob).toLocaleDateString() : 'Not Synced'}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-green-700 mt-2 font-medium italic">
                    Note: These details are verified by Navgurukul Administrative team. Contact management for corrections.
                  </p>
                </div>

                <h3 className="text-md font-semibold mt-6 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Campus & Placement Cycle
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Campus *
                      {profile?.resolvedProfile?.isCampusVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-tighter">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCampus || ''}
                        onChange={(e) => setSelectedCampus(e.target.value)}
                        disabled={!canEdit || profile?.resolvedProfile?.isCampusVerified}
                        required
                        className={profile?.resolvedProfile?.isCampusVerified ? 'bg-gray-50 border-green-200' : ''}
                      >
                        <option value="">Select Campus</option>
                        {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select your Navgurukul campus</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Placement Cycle & Status
                      {profile?.resolvedProfile?.isStatusVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-tighter">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                        </span>
                      )}
                    </label>
                    {/* Display only the active cycle (read-only) */}
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                      <div className="flex flex-col gap-2">
                        {selectedPlacementCycle ? (
                          (() => {
                            const my = placementCycles.find(p => p._id === selectedPlacementCycle) || null;
                            if (my) {
                              return (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-indigo-900">{my.name}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{my.status === 'active' ? 'Active cycle' : my.status}</div>
                                  </div>
                                </div>
                              );
                            }
                            return <div className="text-sm text-gray-600">No placement cycle assigned</div>;
                          })()
                        ) : (
                          <div className="text-sm text-gray-600">No placement cycle assigned</div>
                        )}

                        <div className="pt-2 mt-1 border-t border-gray-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Current Status:</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${profile?.resolvedProfile?.currentStatus?.toLowerCase() === 'placed' ? 'bg-green-100 text-green-700' :
                            profile?.resolvedProfile?.currentStatus?.toLowerCase() === 'active' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                            {profile?.resolvedProfile?.currentStatus || 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 leading-tight">Only the active cycle/status is shown. To request changes, contact management.</p>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                        School
                        {profile?.resolvedProfile?.isSchoolVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                          </span>
                        )}
                      </label>
                      <select
                        value={formData.currentSchool || ''}
                        onChange={(e) => setFormData({ ...formData, currentSchool: e.target.value, currentModule: '', customModuleDescription: '' })}
                        disabled={!canEdit || profile?.resolvedProfile?.isSchoolVerified}
                        className={profile?.resolvedProfile?.isSchoolVerified ? 'bg-gray-50 border-green-200' : ''}
                      >
                        <option value="">Select School</option>
                        {schools.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Joining Date</span>
                        {profile?.resolvedProfile?.isJoiningDateVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={formData.joiningDate}
                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                        disabled={!canEdit || profile?.resolvedProfile?.isJoiningDateVerified}
                        className={profile?.resolvedProfile?.isJoiningDateVerified ? 'bg-gray-50 border-green-200' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 font-bold text-primary-700">House Name (Navgurukul)</label>
                      <select value={formData.houseName || ''} onChange={(e) => setFormData({ ...formData, houseName: e.target.value })} disabled={!canEdit} className="border-primary-200 focus:ring-primary-500">
                        <option value="">Select House</option>
                        {['Bageshree House', 'Bhairav House', 'Malhar House'].map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <p className="text-[10px] text-gray-400 mt-1 italic">Selecting a house helps in filtering house-specific opportunities.</p>
                    </div>

                    {formData.currentSchool && (
                      hasModulesForSchool ? (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                            Current Module/Phase
                            {profile?.resolvedProfile?.isModuleVerified && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                <CheckCircle className="w-2.5 h-2.5" /> Verified by Ghar
                              </span>
                            )}
                          </label>
                          <select
                            value={formData.currentModule}
                            onChange={(e) => setFormData({ ...formData, currentModule: e.target.value })}
                            disabled={!canEdit || profile?.resolvedProfile?.isModuleVerified}
                            className={profile?.resolvedProfile?.isModuleVerified ? 'bg-gray-50 border-green-200' : ''}
                          >
                            <option value="">Select Module</option>
                            {modulesForSchool.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Current Phase/Skills Description</label>
                          <textarea rows={3} value={formData.customModuleDescription} onChange={(e) => setFormData({ ...formData, customModuleDescription: e.target.value })} placeholder="Describe your current learning phase and skills..." disabled={!canEdit} />
                        </div>
                      )
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
                            pincode: '',
                            district: '',
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
                              <SearchableSelect
                                label="Institution"
                                placeholder="Select or type University/College"
                                options={Object.keys(settings.institutionOptions || {})}
                                value={edu.institution}
                                onChange={(value) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].institution = value;
                                  // Auto-fill pincode if available
                                  const pincode = settings.institutionOptions?.[value];
                                  if (pincode) {
                                    updated[index].pincode = pincode;
                                  }
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                onAdd={(val) => {
                                  handleAddInstitutionOption(val).then(success => {
                                    if (success) {
                                      const updated = [...formData.higherEducation];
                                      updated[index].institution = val;
                                      setFormData({ ...formData, higherEducation: updated });
                                    }
                                  });
                                }}
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">Pincode</label>
                                {edu.institution && !edu.pincode && (
                                  <button
                                    type="button"
                                    onClick={() => fetchPincodeAuto(edu.institution, index)}
                                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                  >
                                    <Search className="w-2.5 h-2.5" /> Auto-fetch
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="College Pincode"
                                value={edu.pincode || ''}
                                onChange={(e) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].pincode = e.target.value;
                                  setFormData({ ...formData, higherEducation: updated });

                                  // Auto-fetch district if pincode reaches 6 digits
                                  if (e.target.value.length === 6) {
                                    fetchDistrictForEdu(e.target.value, index);
                                    // Auto-update global list if it's a known institution but missing pincode
                                    if (edu.institution) {
                                      handleAddInstitutionOption(edu.institution, e.target.value);
                                    }
                                  }
                                }}
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                District <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-lg bg-gray-50 outline-none"
                                placeholder="Auto-filled via Pincode"
                                value={edu.district || ''}
                                readOnly
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <SearchableSelect
                                label="Department"
                                placeholder="Select or type Department"
                                options={Object.keys(settings.higherEducationOptions || {})}
                                value={edu.department || edu.fieldOfStudy}
                                onChange={(value) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].department = value;
                                  updated[index].fieldOfStudy = value; // Sync for legacy
                                  // Clear specialization if department changes
                                  updated[index].specialization = '';
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                onAdd={(val) => {
                                  handleAddEducationOption(val).then(success => {
                                    if (success) {
                                      const updated = [...formData.higherEducation];
                                      updated[index].department = val;
                                      updated[index].fieldOfStudy = val;
                                      setFormData({ ...formData, higherEducation: updated });
                                    }
                                  });
                                }}
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <SearchableSelect
                                label="Specialization"
                                placeholder="Select or type Specialization"
                                options={(edu.department || edu.fieldOfStudy) ? (settings.higherEducationOptions?.[edu.department || edu.fieldOfStudy] || []) : []}
                                value={edu.specialization}
                                onChange={(value) => {
                                  const updated = [...formData.higherEducation];
                                  updated[index].specialization = value;
                                  setFormData({ ...formData, higherEducation: updated });
                                }}
                                onAdd={(val) => {
                                  const dept = edu.department || edu.fieldOfStudy;
                                  if (!dept) {
                                    toast.error('Please select a department first');
                                    return;
                                  }
                                  handleAddEducationOption(dept, val).then(success => {
                                    if (success) {
                                      const updated = [...formData.higherEducation];
                                      updated[index].specialization = val;
                                      setFormData({ ...formData, higherEducation: updated });
                                    }
                                  });
                                }}
                                disabled={!canEdit}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                              <select
                                value={edu.startYear}
                                onChange={(e) => {
                                  const startVal = parseInt(e.target.value);
                                  const updated = [...formData.higherEducation];
                                  updated[index].startYear = e.target.value;

                                  // +3 logic for auto-filling completion year
                                  if (startVal && (!updated[index].endYear || parseInt(updated[index].endYear) < startVal)) {
                                    updated[index].endYear = (startVal + 3).toString();
                                  }
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
                                {years.filter(y => !edu.startYear || y >= edu.startYear).map(y => <option key={y} value={y}>{y}</option>)}
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
                {/* Technical Skills - School Specific */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      {formData.currentSchool ? `${formData.currentSchool.replace('School of ', '')} Skills` : 'Technical Skills'} (Self-Assessment)
                    </h2>
                    <div className="flex items-center gap-2">
                      {profile?.resolvedProfile?.atCoderRating ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full">
                          <span className="text-[10px] font-bold text-orange-600 uppercase">AtCoder:</span>
                          <span className="text-xs font-bold text-orange-700">{profile.resolvedProfile.atCoderRating}</span>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full" title="No rating found in Ghar Dashboard">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">AtCoder:</span>
                          <span className="text-[10px] font-medium text-gray-400 italic">Rating Not Available</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Select your specialized skills and rate yourself (1 = Basic, 4 = Expert)</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allSkills
                      .filter(skill => skill.category === 'technical' && (skill.isCommon || (formData.currentSchool && skill.schools?.includes(formData.currentSchool))))
                      .map((skill) => {
                        const existingSkill = formData.technicalSkills.find(s => s.skillId === skill._id || s.skillName === skill.name);
                        const isSelected = !!existingSkill;
                        const rating = existingSkill?.selfRating || 0;

                        return (
                          <div key={skill._id} className={`p-3 rounded-lg border-2 transition ${isSelected ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-transparent'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSkillToggle('technical', skill)}
                                  className="w-4 h-4 text-primary-600 rounded"
                                />
                                <span className={`font-medium ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>{skill.name}</span>
                              </label>
                              {isSelected && (
                                <div className="flex items-center gap-2 group relative">
                                  <span className="text-sm font-medium text-primary-600 cursor-help underline decoration-dotted">
                                    {settings.proficiencyRubrics?.[rating]?.label || ratingLabels[rating]}
                                  </span>
                                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                    {settings.proficiencyRubrics?.[rating]?.description || 'Click to select level'}
                                  </div>
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div className="flex gap-1 mt-2">
                                {[1, 2, 3, 4].map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => handleRatingChange('technical', skill._id, level)}
                                    className={`flex-1 h-2 rounded-full transition ${level <= rating ? 'bg-primary-500' : 'bg-gray-200'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {allSkills.filter(skill => skill.category === 'technical' && (skill.isCommon || (formData.currentSchool && skill.schools?.includes(formData.currentSchool)))).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No specific skills found for your school yet.</p>
                  )}
                </div>

                {/* Office Skills - Common */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Office/Professional Skills
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Rate your proficiency in common office tools and professional administration (1 = Basic, 4 = Expert)</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allSkills
                      .filter(skill => skill.category === 'office')
                      .map((skill) => {
                        const existingSkill = formData.officeSkills.find(s => s.skillId === skill._id || s.skillName === skill.name);
                        const isSelected = !!existingSkill;
                        const rating = existingSkill?.selfRating || 0;

                        return (
                          <div key={skill._id} className={`p-3 rounded-lg border-2 transition ${isSelected ? 'bg-teal-50 border-teal-300' : 'bg-gray-50 border-transparent'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSkillToggle('office', skill)}
                                  className="w-4 h-4 text-teal-600 rounded"
                                />
                                <span className={`font-medium ${isSelected ? 'text-teal-700' : 'text-gray-700'}`}>{skill.name}</span>
                              </label>
                              <div className="flex items-center gap-2 group relative">
                                <span className="text-sm font-medium text-teal-600 cursor-help underline decoration-dotted">
                                  {settings.proficiencyRubrics?.[rating]?.label || ratingLabels[rating]}
                                </span>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                  {settings.proficiencyRubrics?.[rating]?.description || 'Click to select level'}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex gap-1 mt-2">
                                {[1, 2, 3, 4].map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => handleRatingChange('office', skill._id, level)}
                                    className={`flex-1 h-2 rounded-full transition ${level <= rating ? 'bg-teal-500' : 'bg-gray-200'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {allSkills.filter(skill => skill.category === 'office').length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center">No office skills defined in the system.</p>
                  )}
                </div>

                {/* Soft Skills - Common */}
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Soft Skills
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Rate yourself on essential workplace behavioral skills (1 = Basic, 4 = Expert)</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allSkills
                      .filter(skill => skill.category === 'soft_skill')
                      .map((skill) => {
                        const existingSkill = formData.softSkills.find(s => s.skillId === skill._id || s.skillName === skill.name);
                        const isSelected = !!existingSkill;
                        const rating = existingSkill?.selfRating || 0;

                        return (
                          <div key={skill._id} className={`p-3 rounded-lg border-2 transition ${isSelected ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-transparent'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSkillToggle('soft_skill', skill)}
                                  className="w-4 h-4 text-purple-600 rounded"
                                />
                                <span className={`font-medium ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>{skill.name}</span>
                              </label>
                              <div className="flex items-center gap-2 group relative">
                                <span className="text-sm font-medium text-purple-600 cursor-help underline decoration-dotted">
                                  {settings.proficiencyRubrics?.[rating]?.label || ratingLabels[rating]}
                                </span>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                  {settings.proficiencyRubrics?.[rating]?.description || 'Click to select level'}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex gap-1 mt-2">
                                {[1, 2, 3, 4].map((level) => (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => handleRatingChange('soft_skill', skill._id, level)}
                                    className={`flex-1 h-2 rounded-full transition ${level <= rating ? 'bg-purple-500' : 'bg-gray-200'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {allSkills.filter(skill => skill.category === 'soft_skill').length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center">No soft skills defined in the system.</p>
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
            {activeTab === 'council' && (
              <div className="card space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Council Service
                  </h2>
                  <button
                    type="button"
                    onClick={() => setAddingCouncilService(true)}
                    className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1"
                    disabled={!canEdit}
                  >
                    <Plus className="w-4 h-4" /> Add Service
                  </button>
                </div>

                <div className="space-y-4">
                  {/* List Existing Services */}
                  {(formData.councilService || []).map((service, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{service.post}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {service.monthsServed} Months</span>
                            {service.certificateUrl && (
                              <a href={service.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                                <Award className="w-3 h-3" /> Certificate
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${service.status === 'approved' ? 'bg-green-100 text-green-700' :
                            service.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                            {service.status ? service.status.charAt(0).toUpperCase() + service.status.slice(1) : 'Pending'}
                          </span>
                          {canEdit && service.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...formData.councilService];
                                updated.splice(index, 1);
                                setFormData({ ...formData, councilService: updated });
                              }}
                              className="text-red-500 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.councilService?.length === 0 && !addingCouncilService && (
                    <p className="text-gray-500 text-center py-4 italic">No council service added yet.</p>
                  )}

                  {/* Add New Service Form */}
                  {addingCouncilService && (
                    <div className="p-4 border-2 border-primary-100 rounded-lg bg-primary-50 space-y-3 animate-fadeIn">
                      <h4 className="font-medium text-primary-800 text-sm">Add New Council Service</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <SearchableSelect
                            label="Post Name"
                            placeholder="e.g. General Secretary"
                            options={settings.councilPosts || []}
                            value={newCouncilService.post}
                            onChange={(val) => setNewCouncilService({ ...newCouncilService, post: val })}
                            onAdd={async (val) => {
                              const success = await handleAddCouncilPostOption(val);
                              if (success) {
                                setNewCouncilService({ ...newCouncilService, post: val });
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Months Served</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 6"
                            className="w-full text-sm rounded border-gray-300"
                            value={newCouncilService.monthsServed}
                            onChange={(e) => setNewCouncilService({ ...newCouncilService, monthsServed: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Certificate URL (Drive/Link)</label>
                          <input
                            type="url"
                            placeholder="https://..."
                            className="w-full text-sm rounded border-gray-300"
                            value={newCouncilService.certificateUrl}
                            onChange={(e) => setNewCouncilService({ ...newCouncilService, certificateUrl: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setAddingCouncilService(false)}
                          className="text-gray-500 text-sm hover:text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!newCouncilService.post || !newCouncilService.monthsServed) {
                              return toast.error('Post name and months served are required');
                            }

                            // If post is typed but not yet in the master list, add it first
                            if (!(settings.councilPosts || []).includes(newCouncilService.post)) {
                              await handleAddCouncilPostOption(newCouncilService.post);
                            }

                            const entry = {
                              post: newCouncilService.post,
                              monthsServed: parseInt(newCouncilService.monthsServed),
                              certificateUrl: newCouncilService.certificateUrl,
                              status: 'pending' // Default
                            };
                            setFormData({
                              ...formData,
                              councilService: [...(formData.councilService || []), entry]
                            });
                            setNewCouncilService({ post: '', monthsServed: '', certificateUrl: '' });
                            setAddingCouncilService(false);
                          }}
                          className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                        >
                          Add Service
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                    {profile?.resolvedProfile?.isEnglishVerified && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-tighter">
                        <CheckCircle className="w-3 h-3" /> Verified by Ghar
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Speaking Level</label>
                      <div className="space-y-2">
                        {cefrLevels.map((level) => (
                          <label key={level} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${formData.englishProficiency.speaking === level ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'} ${(!canEdit || profile?.resolvedProfile?.isEnglishVerified) ? 'cursor-not-allowed opacity-60' : ''}`}>
                            <input type="radio" name="speaking" value={level} checked={formData.englishProficiency.speaking === level} onChange={(e) => setFormData({ ...formData, englishProficiency: { ...formData.englishProficiency, speaking: e.target.value } })} disabled={!canEdit || profile?.resolvedProfile?.isEnglishVerified} className="sr-only" />
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
                          <label key={level} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${formData.englishProficiency.writing === level ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'} ${(!canEdit || profile?.resolvedProfile?.isEnglishVerified) ? 'cursor-not-allowed opacity-60' : ''}`}>
                            <input type="radio" name="writing" value={level} checked={formData.englishProficiency.writing === level} onChange={(e) => setFormData({ ...formData, englishProficiency: { ...formData.englishProficiency, writing: e.target.value } })} disabled={!canEdit || profile?.resolvedProfile?.isEnglishVerified} className="sr-only" />
                            <span className="font-semibold text-primary-600">{level}</span>
                            <span className="text-gray-600">{cefrDescriptions[level]}</span>
                          </label>
                        ))}
                      </div>
                      {/* Read Theory Level - Synced from Ghar */}
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Read Theory Level
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase ml-auto">Verified by Ghar</span>
                        </h3>
                        <div className={`p-4 rounded-lg flex items-center justify-between border ${profile?.resolvedProfile?.readTheoryLevel ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                          <span className="text-sm text-indigo-900 font-medium">Current Average Quiz Level:</span>
                          {profile?.resolvedProfile?.readTheoryLevel ? (
                            <span className="text-lg font-bold text-indigo-700">{profile.resolvedProfile.readTheoryLevel}</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-400 italic">Data Not Available</span>
                          )}
                        </div>
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
        </div >

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

            {/* Resume Link Input & Accessibility Check */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resume Link (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={formData.resumeLink || ''}
                  onChange={(e) => setFormData({ ...formData, resumeLink: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="flex-1"
                />
                <button type="button" onClick={async () => {
                  const url = formData.resumeLink && formData.resumeLink.trim();
                  if (!url) return toast.error('Enter a link first');
                  try {
                    setResumeLinkStatus({ checked: false, ok: false, status: null });
                    const res = await utilsAPI.checkUrl(url);
                    const ok = res.data?.ok === true;
                    setResumeLinkStatus({ checked: true, ok, status: res.data?.status });
                    toast.success(ok ? 'Link is accessible' : 'Link is not accessible');
                  } catch (err) {
                    setResumeLinkStatus({ checked: true, ok: false, status: null });
                    toast.error('Error checking link');
                  }
                }} className="btn btn-outline">Check</button>
              </div>
              {resumeLinkStatus.checked && (
                <p className={`text-sm mt-2 ${resumeLinkStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {resumeLinkStatus.ok ? 'Accessible' : 'Not accessible'} {resumeLinkStatus.status ? `(HTTP ${resumeLinkStatus.status})` : ''}
                </p>
              )}
            </div>
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
                { label: 'Soft Skills', done: formData.softSkills.length > 0 },
                { label: 'Office/Professional Skills', done: formData.officeSkills.length > 0 },
                { label: 'English Level', done: formData.englishProficiency.speaking },
                { label: 'Open For Roles', done: formData.openForRoles.length > 0 },
                { label: 'Resume', done: profile?.studentProfile?.resume || profile?.studentProfile?.resumeLink }
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
                        className={`h-3 rounded-full transition-all duration-500 ${completionPercent >= 80 ? 'bg-green-500' :
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
      </div >
    </div >
  );
};

export default StudentProfile;
