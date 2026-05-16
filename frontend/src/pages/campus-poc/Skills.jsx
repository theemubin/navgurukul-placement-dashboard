import { useState, useEffect, useMemo } from 'react';
import { skillAPI, settingsAPI, userAPI } from '../../services/api';
import { LoadingSpinner, EmptyState, Modal, ConfirmDialog } from '../../components/common/UIComponents';
import { useAuth } from '../../context/AuthContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  LabelList
} from 'recharts';
import { 
  Search, Plus, Edit2, Trash2, Tag, Layers, Globe, School, 
  CheckSquare, CheckCircle, XCircle, Clock, LayoutGrid, ClipboardCheck,
  MessageCircle, TrendingUp, Award, BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

const POCSkillManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('approvals');
  const [loading, setLoading] = useState(true);
  
  // States for Skill Categories (formerly Skills.jsx)
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [schools, setSchools] = useState([]);
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

  // States for Skill Approvals (formerly SkillApprovals.jsx)
  const [pendingStudents, setPendingStudents] = useState([]);
  const [processing, setProcessing] = useState({});

  // States for Communication Tab
  const [communicationStudents, setCommunicationStudents] = useState([]);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [campusList, setCampusList] = useState([]);
  const [communicationSubTab, setCommunicationSubTab] = useState('cefr');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'communication') {
      fetchCommunicationStudents();
    }
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSkills(),
        fetchCategoryOptions(),
        fetchSchools(),
        fetchPendingSkills(),
        fetchCampuses()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      if (user?.role === 'campus_poc') {
        // Keep campus source aligned with the main dashboard managed-campus configuration
        const managedRes = await userAPI.getManagedCampuses();
        const managedCampuses = managedRes?.data?.managedCampuses?.length > 0
          ? managedRes.data.managedCampuses
          : (user?.managedCampuses?.length > 0 ? user.managedCampuses : (user?.campus ? [user.campus] : []));
        setCampusList(managedCampuses);
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchCommunicationStudents = async () => {
    setCommunicationLoading(true);
    try {
      const response = await userAPI.getStudents({
        limit: 1000,
        summary: 'false'
      });
      
      const students = response.data.students || [];
      const allowedStatuses = ['Active', 'Intern (In Campus)', 'Intern (Out Campus)'];
      const studentsWithCommunicationData = students.filter(s => {
        const status = s.studentProfile?.currentStatus || s.resolvedProfile?.currentStatus || 'Active';
        const isAllowedStatus = allowedStatuses.includes(status);
        if (!isAllowedStatus) return false;

        const readTheoryLevel = s.studentProfile?.readTheoryLevel
          || s.studentProfile?.externalData?.ghar?.readTheoryLevel?.value
          || s.resolvedProfile?.readTheoryLevel;
        return (
        s.studentProfile?.englishProficiency?.speaking || 
        s.studentProfile?.englishProficiency?.writing
          || readTheoryLevel
        );
      });
      
      setCommunicationStudents(studentsWithCommunicationData);
    } catch (error) {
      console.error('Error fetching communication students:', error);
      toast.error('Error loading student communication data');
    } finally {
      setCommunicationLoading(false);
    }
  };

  const fetchSkills = async () => {
    const response = await skillAPI.getSkills();
    const skillsData = response.data || [];
    setSkills(skillsData);
    const uniqueCategories = [...new Set(skillsData.map(s => s.category).filter(Boolean))];
    setCategories(uniqueCategories);
  };

  const fetchCategoryOptions = async () => {
    const res = await skillAPI.getCategories();
    setCategoryOptions(res.data || []);
  };

  const fetchSchools = async () => {
    const res = await settingsAPI.getSettings();
    const list = res.data?.data?.schools || Object.keys(res.data?.data?.schoolModules || {});
    setSchools(list);
  };

  const fetchPendingSkills = async () => {
    const response = await userAPI.getPendingSkills();
    setPendingStudents(response.data);
  };

  // Handlers for Skill Categories
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
      fetchSkills();
    } catch (error) {
      toast.error('Error saving skill');
    }
  };

  const handleDelete = async () => {
    try {
      await skillAPI.deleteSkill(selectedSkill._id);
      toast.success('Skill deleted successfully');
      setShowDeleteDialog(false);
      fetchSkills();
    } catch (error) {
      toast.error('Error deleting skill');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', description: '', isCommon: false, schools: [] });
    setSelectedSkill(null);
  };

  // Handlers for Skill Approvals
  const handleApproval = async (studentId, skillId, status) => {
    const key = `${studentId}-${skillId}`;
    setProcessing(prev => ({ ...prev, [key]: true }));
    try {
      await userAPI.approveSkill(studentId, skillId, status);
      toast.success(`Skill ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchPendingSkills();
    } catch (error) {
      toast.error('Error processing skill approval');
    } finally {
      setProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleBulkApprove = async (studentId, skillsList) => {
    for (const skill of skillsList) {
      await handleApproval(studentId, skill.skill._id, 'approved');
    }
  };

  // Utility functions for Communication Tab
  const cefrOrder = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
  
  const isCommunicationReady = (level) => {
    return cefrOrder[level] >= cefrOrder['B2'];
  };

  const getCefrColor = (level) => {
    const order = cefrOrder[level] || 0;
    if (order >= cefrOrder['B2']) return 'text-green-600 bg-green-50';
    if (order >= cefrOrder['B1']) return 'text-blue-600 bg-blue-50';
    if (order >= cefrOrder['A2']) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getCefrLabel = (level) => {
    const labels = {
      'A1': 'Beginner',
      'A2': 'Elementary',
      'B1': 'Intermediate',
      'B2': 'Upper Intermediate',
      'C1': 'Advanced',
      'C2': 'Proficient'
    };
    return labels[level] || level || '-';
  };

  const getCommunicationReadyPercentage = () => {
    if (cefrStudents.length === 0) return 0;
    const ready = cefrStudents.filter(s => {
      const speaking = s.studentProfile?.englishProficiency?.speaking;
      const writing = s.studentProfile?.englishProficiency?.writing;
      return isCommunicationReady(speaking) && isCommunicationReady(writing);
    }).length;
    return Math.round((ready / cefrStudents.length) * 100);
  };

  const getReadTheoryValue = (student) => {
    const raw = student?.studentProfile?.readTheoryLevel
      || student?.studentProfile?.externalData?.ghar?.readTheoryLevel?.value
      || student?.resolvedProfile?.readTheoryLevel
      || null;
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getReadTheoryBadgeClass = (score) => {
    if (score === null || score === undefined) return 'bg-gray-100 text-gray-500 border-gray-200';
    if (score < 3) return 'bg-red-50 text-red-700 border-red-200';
    if (score < 5) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (score < 7) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (score < 9) return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getReadTheoryBucket = (score) => {
    if (score === null || score === undefined) return 'Unknown';
    if (score < 3) return '0-2.9';
    if (score < 5) return '3-4.9';
    if (score < 7) return '5-6.9';
    if (score < 9) return '7-8.9';
    return '9+';
  };

  const cefrStudents = useMemo(() => {
    return communicationStudents.filter((s) => (
      s.studentProfile?.englishProficiency?.speaking || s.studentProfile?.englishProficiency?.writing
    ));
  }, [communicationStudents]);

  const readTheoryStudents = useMemo(() => {
    return communicationStudents
      .map((student) => ({ ...student, readTheoryNumeric: getReadTheoryValue(student) }))
      .filter((student) => student.readTheoryNumeric !== null);
  }, [communicationStudents]);

  const getMonthsSpent = (student) => {
    const joiningDate = student?.studentProfile?.joiningDate || student?.resolvedProfile?.joiningDate;
    if (!joiningDate) return null;
    const parsed = new Date(joiningDate);
    if (Number.isNaN(parsed.getTime())) return null;
    const diffMs = Date.now() - parsed.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  };

  const getMonthBucket = (months) => {
    if (months === null || months === undefined) return 'Unknown';
    if (months <= 2) return '0-2';
    if (months <= 5) return '3-5';
    if (months <= 8) return '6-8';
    if (months <= 12) return '9-12';
    return '12+';
  };

  const communicationAnalytics = useMemo(() => {
    const monthBucketOrder = ['0-2', '3-5', '6-8', '9-12', '12+', 'Unknown'];
    const monthBucketMap = monthBucketOrder.reduce((acc, label) => {
      acc[label] = { bucket: label, communicationReady: 0, inProgress: 0, total: 0 };
      return acc;
    }, {});

    const schoolMap = {};

    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const cefrMatrixMap = {};
    cefrLevels.forEach((speak) => {
      cefrMatrixMap[speak] = {};
      cefrLevels.forEach((write) => {
        cefrMatrixMap[speak][write] = 0;
      });
    });

    cefrStudents.forEach((student) => {
      const speaking = student?.studentProfile?.englishProficiency?.speaking || null;
      const writing = student?.studentProfile?.englishProficiency?.writing || null;
      const communicationReady = isCommunicationReady(speaking) && isCommunicationReady(writing);

      const months = getMonthsSpent(student);
      const monthBucket = getMonthBucket(months);
      const monthEntry = monthBucketMap[monthBucket] || monthBucketMap.Unknown;
      monthEntry.total += 1;
      if (communicationReady) monthEntry.communicationReady += 1;
      else monthEntry.inProgress += 1;

      const school = student?.studentProfile?.currentSchool || 'Unknown';
      if (!schoolMap[school]) {
        schoolMap[school] = { school, communicationReady: 0, inProgress: 0, total: 0, readyRate: 0 };
      }
      schoolMap[school].total += 1;
      if (communicationReady) schoolMap[school].communicationReady += 1;
      else schoolMap[school].inProgress += 1;

      if (cefrLevels.includes(speaking) && cefrLevels.includes(writing)) {
        cefrMatrixMap[speaking][writing] += 1;
      }
    });

    const monthComparisonData = monthBucketOrder
      .map((bucket) => monthBucketMap[bucket])
      .filter((item) => item.total > 0 || item.bucket !== 'Unknown');

    const readinessRateTrendData = monthComparisonData
      .filter((item) => item.total > 0)
      .map((item) => ({
        bucket: item.bucket,
        readyRate: Math.round((item.communicationReady / item.total) * 100),
        total: item.total
      }));

    const schoolReadinessData = Object.values(schoolMap)
      .map((item) => ({
        ...item,
        readyRate: item.total > 0 ? Math.round((item.communicationReady / item.total) * 100) : 0
      }))
      .sort((a, b) => b.readyRate - a.readyRate);

    const cefrMatrixRows = cefrLevels.map((speakingLevel) => ({
      speaking: speakingLevel,
      values: cefrLevels.map((writingLevel) => ({
        writing: writingLevel,
        count: cefrMatrixMap[speakingLevel][writingLevel]
      }))
    }));

    const maxMatrixCount = Math.max(
      0,
      ...cefrMatrixRows.flatMap((row) => row.values.map((cell) => cell.count))
    );

    return {
      monthComparisonData,
      readinessRateTrendData,
      schoolReadinessData,
      cefrMatrixRows,
      cefrLevels,
      maxMatrixCount
    };
  }, [cefrStudents]);

  const readTheoryAnalytics = useMemo(() => {
    const bucketOrder = ['0-2.9', '3-4.9', '5-6.9', '7-8.9', '9+', 'Unknown'];
    const bucketMap = bucketOrder.reduce((acc, label) => {
      acc[label] = { bucket: label, students: 0 };
      return acc;
    }, {});

    const monthBucketOrder = ['0-2', '3-5', '6-8', '9-12', '12+', 'Unknown'];
    const monthMap = monthBucketOrder.reduce((acc, label) => {
      acc[label] = { bucket: label, totalScore: 0, count: 0, averageScore: 0 };
      return acc;
    }, {});

    readTheoryStudents.forEach((student) => {
      const score = student.readTheoryNumeric;
      const scoreBucket = getReadTheoryBucket(score);
      bucketMap[scoreBucket].students += 1;

      const monthBucket = getMonthBucket(getMonthsSpent(student));
      monthMap[monthBucket].totalScore += score;
      monthMap[monthBucket].count += 1;
    });

    const distributionData = bucketOrder
      .map((bucket) => bucketMap[bucket])
      .filter((item) => item.students > 0)
      .map((item) => ({
        ...item,
        pct: readTheoryStudents.length > 0 ? Math.round(item.students / readTheoryStudents.length * 100) : 0
      }));

    const monthTrendData = monthBucketOrder
      .map((bucket) => monthMap[bucket])
      .filter((item) => item.count > 0)
      .map((item) => ({
        bucket: item.bucket,
        averageScore: Number((item.totalScore / item.count).toFixed(2)),
        count: item.count
      }));

    const averageReadTheory = readTheoryStudents.length > 0
      ? Number((readTheoryStudents.reduce((sum, s) => sum + s.readTheoryNumeric, 0) / readTheoryStudents.length).toFixed(2))
      : 0;

    const pctAbove6 = readTheoryStudents.length > 0
      ? Math.round(readTheoryStudents.filter((s) => s.readTheoryNumeric >= 6).length / readTheoryStudents.length * 100)
      : 0;

    const pctAbove8 = readTheoryStudents.length > 0
      ? Math.round(readTheoryStudents.filter((s) => s.readTheoryNumeric >= 8).length / readTheoryStudents.length * 100)
      : 0;

    return {
      distributionData,
      monthTrendData,
      averageReadTheory,
      pctAbove6,
      pctAbove8
    };
  }, [readTheoryStudents]);

  const getMatrixCellClass = (count, maxCount) => {
    if (count === 0 || maxCount === 0) return 'bg-gray-50 text-gray-400 border-gray-100';
    const ratio = count / maxCount;
    if (ratio >= 0.75) return 'bg-primary-600 text-white border-primary-700';
    if (ratio >= 0.5) return 'bg-primary-400 text-white border-primary-500';
    if (ratio >= 0.25) return 'bg-primary-200 text-primary-800 border-primary-300';
    return 'bg-primary-100 text-primary-700 border-primary-200';
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

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skill Management</h1>
          <p className="text-gray-600">Review approvals and manage skill categories</p>
        </div>
        {activeTab === 'categories' && (
          <button 
            onClick={() => { setSelectedSkill(null); resetForm(); setShowModal(true); }} 
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Skill
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'approvals' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Pending Approvals
          {pendingStudents.length > 0 && (
            <span className="bg-primary-600 text-white px-1.5 py-0.5 rounded-full text-[10px] ml-1">
              {pendingStudents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'categories' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Skill Categories
        </button>
        <button
          onClick={() => setActiveTab('communication')}
          className={`px-4 py-2 border-b-2 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'communication' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Communication
          {communicationStudents.length > 0 && (
            <span className="bg-primary-600 text-white px-1.5 py-0.5 rounded-full text-[10px] ml-1">
              {communicationStudents.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'communication' && (
        <div className="flex gap-3 -mt-2">
          <button
            onClick={() => setCommunicationSubTab('cefr')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition shadow-sm ${
              communicationSubTab === 'cefr'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            CFER
          </button>
          <button
            onClick={() => setCommunicationSubTab('readTheory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition shadow-sm flex items-center gap-1.5 ${
              communicationSubTab === 'readTheory'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Read Theory
          </button>
        </div>
      )}

      {activeTab === 'approvals' ? (
        /* Skill Approvals Tab Content */
        <div className="space-y-4">
          {pendingStudents.length > 0 ? (
            pendingStudents.map((student) => (
              <div key={student._id} className="card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700">
                      {student.firstName?.[0]}{student.lastName?.[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{student.firstName} {student.lastName}</h3>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBulkApprove(student._id, student.pendingSkills)}
                    className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-green-100 transition-colors"
                  >
                    Approve All ({student.pendingSkills?.length})
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {student.pendingSkills?.map((skillItem) => {
                    const key = `${student._id}-${skillItem.skill?._id}`;
                    const isProcessing = processing[key];
                    return (
                      <div key={skillItem.skill?._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="font-bold text-sm text-gray-800">{skillItem.skill?.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">{skillItem.skill?.category?.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleApproval(student._id, skillItem.skill?._id, 'rejected')}
                            disabled={isProcessing}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleApproval(student._id, skillItem.skill?._id, 'approved')}
                            disabled={isProcessing}
                            className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg disabled:opacity-50"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={CheckSquare} title="No pending approvals" description="All student skills have been reviewed" />
          )}
        </div>
      ) : activeTab === 'categories' ? (
        /* Skill Categories Tab Content */
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                className="md:w-48 text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Common Skills</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredCommonSkills.map((skill) => (
                <div key={skill._id} className="group relative px-3 py-1.5 rounded-lg border bg-white border-gray-200 flex items-center gap-2 hover:border-primary-300 transition-colors shadow-sm">
                  <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setSelectedSkill(skill); setFormData({ name: skill.name, category: skill.category || '', description: skill.description || '', isCommon: true, schools: skill.schools || [] }); setShowModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary-600"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => { setSelectedSkill(skill); setShowDeleteDialog(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schools.map((school) => (
              <div key={school} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-gray-500" />
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{school}</h2>
                  </div>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full">
                    {filteredSchoolSkills[school]?.length || 0} Skills
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(filteredSchoolSkills[school] || []).map((skill) => (
                    <div key={skill._id} className="group relative px-3 py-1.5 rounded-lg border bg-white border-gray-200 flex items-center gap-2 hover:border-primary-300 transition-colors shadow-sm">
                      <span className="text-sm font-medium text-gray-700">{skill.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => { setSelectedSkill(skill); setFormData({ name: skill.name, category: skill.category || '', description: skill.description || '', isCommon: false, schools: skill.schools || [] }); setShowModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary-600"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => { setSelectedSkill(skill); setShowDeleteDialog(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'communication' ? (
        /* Communication Tab Content */
        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-end">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">
                    {communicationSubTab === 'cefr' ? 'CFER Students' : 'ReadTheory Students'}
                  </p>
                  <p className="text-2xl font-black text-blue-700">
                    {communicationSubTab === 'cefr' ? cefrStudents.length : readTheoryStudents.length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 font-bold uppercase tracking-wider">
                    {communicationSubTab === 'cefr' ? 'Comm Ready' : 'Average ReadTheory'}
                  </p>
                  <p className="text-2xl font-black text-green-700">
                    {communicationSubTab === 'cefr' ? `${getCommunicationReadyPercentage()}%` : readTheoryAnalytics.averageReadTheory}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar for Communication Readiness */}
          {communicationSubTab === 'cefr' && cefrStudents.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-bold text-gray-900">Communication Ready (B2+)</span>
                </div>
                <span className="text-sm font-bold text-primary-600">{getCommunicationReadyPercentage()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${getCommunicationReadyPercentage()}%` }}
                />
              </div>
            </div>
          )}

          {/* Communication Analytics Graphs */}
          {communicationSubTab === 'cefr' && cefrStudents.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Month Spent vs Comm Ready</h3>
                    <p className="text-xs text-gray-500 mt-1">Compares readiness counts across tenure buckets</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={communicationAnalytics.monthComparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="communicationReady" name="Comm Ready" fill="#16a34a" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Readiness Rate by Month Spent</h3>
                    <p className="text-xs text-gray-500 mt-1">Trend line of communication-ready percentage by tenure</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={communicationAnalytics.readinessRateTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${value}%`, 'Ready Rate']} />
                        <Line type="monotone" dataKey="readyRate" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">CFER Speaking vs Writing Matrix</h3>
                    <p className="text-xs text-gray-500 mt-1">Darker cells indicate concentration of students at that level pair</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[460px] text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-2 font-bold text-gray-600 uppercase tracking-wider">Speaking \ Writing</th>
                          {communicationAnalytics.cefrLevels.map((level) => (
                            <th key={level} className="p-2 text-center font-bold text-gray-600 uppercase tracking-wider">{level}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {communicationAnalytics.cefrMatrixRows.map((row) => (
                          <tr key={row.speaking}>
                            <td className="p-2 font-bold text-gray-700">{row.speaking}</td>
                            {row.values.map((cell) => (
                              <td key={`${row.speaking}-${cell.writing}`} className="p-1.5">
                                <div
                                  className={`h-8 rounded-md border text-center leading-8 font-bold ${getMatrixCellClass(cell.count, communicationAnalytics.maxMatrixCount)}`}
                                >
                                  {cell.count}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">School-wise Communication Readiness</h3>
                    <p className="text-xs text-gray-500 mt-1">Compares readiness percentage and student volume across schools</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={communicationAnalytics.schoolReadinessData}
                        margin={{ top: 5, right: 20, left: 60, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="school" width={130} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value, name) => (name === 'readyRate' ? [`${value}%`, 'Ready Rate'] : [value, name])} />
                        <Legend />
                        <Bar dataKey="readyRate" name="Ready %" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {communicationSubTab === 'readTheory' && readTheoryStudents.length > 0 && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg Level</p>
                  <p className="text-3xl font-black text-indigo-600">{readTheoryAnalytics.averageReadTheory}</p>
                  <p className="text-xs text-gray-400 mt-1">out of 12</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">≥ Level 6</p>
                  <p className="text-3xl font-black text-green-600">{readTheoryAnalytics.pctAbove6}%</p>
                  <p className="text-xs text-gray-400 mt-1">benchmark met</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">≥ Level 8</p>
                  <p className="text-3xl font-black text-emerald-600">{readTheoryAnalytics.pctAbove8}%</p>
                  <p className="text-xs text-gray-400 mt-1">advanced</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">ReadTheory Distribution</h3>
                    <p className="text-xs text-gray-500 mt-1">Student count by ReadTheory score bucket</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={readTheoryAnalytics.distributionData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(val, name) => [val, name === 'students' ? 'Students' : name]} />
                        <Bar dataKey="students" name="Students" fill="#4f46e5" radius={[6, 6, 0, 0]}>
                          <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: '#6366f1', fontWeight: 700 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">ReadTheory vs Month Spent</h3>
                    <p className="text-xs text-gray-500 mt-1">Average ReadTheory score trend by tenure bucket</p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={readTheoryAnalytics.monthTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value, name) => [value, name === 'averageScore' ? 'Avg ReadTheory' : name]} />
                        <ReferenceLine y={6} stroke="#22c55e" strokeDasharray="6 3" label={{ value: 'Benchmark 6', position: 'insideTopRight', fontSize: 11, fill: '#15803d' }} />
                        <Line type="monotone" dataKey="averageScore" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">All Students — by Level</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Student Name</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">School</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">ReadTheory Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...readTheoryStudents]
                      .sort((a, b) => b.readTheoryNumeric - a.readTheoryNumeric)
                      .map((student) => (
                        <tr key={student._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-gray-500">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-gray-700">{student.studentProfile?.currentSchool || '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getReadTheoryBadgeClass(student.readTheoryNumeric)}`}>
                              <BookOpen className="w-3 h-3" />
                              {student.readTheoryNumeric}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Needs Support */}
              {readTheoryStudents.filter((s) => s.readTheoryNumeric < 5).length > 0 && (
                <div className="card overflow-x-auto border-l-4 border-amber-400">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider">Needs Support — Below Level 5</h3>
                    <p className="text-xs text-gray-500 mt-1">{readTheoryStudents.filter((s) => s.readTheoryNumeric < 5).length} students need additional English reading support</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Student Name</th>
                        <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">School</th>
                        <th className="text-center py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...readTheoryStudents]
                        .filter((s) => s.readTheoryNumeric < 5)
                        .sort((a, b) => a.readTheoryNumeric - b.readTheoryNumeric)
                        .map((student) => (
                          <tr key={`ns-${student._id}`} className="border-b border-gray-100 hover:bg-amber-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">
                                  {student.firstName?.[0]}{student.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{student.firstName} {student.lastName}</p>
                                  <p className="text-xs text-gray-500">{student.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs font-medium text-gray-700">{student.studentProfile?.currentSchool || '-'}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getReadTheoryBadgeClass(student.readTheoryNumeric)}`}>
                                <BookOpen className="w-3 h-3" />
                                {student.readTheoryNumeric}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Students Table */}
          {communicationLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : communicationSubTab === 'cefr' ? (
            cefrStudents.length > 0 ? (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Student Name</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">School</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Speaking</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Writing</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-600 uppercase tracking-wider text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cefrStudents.map((student) => {
                      const speaking = student.studentProfile?.englishProficiency?.speaking;
                      const writing = student.studentProfile?.englishProficiency?.writing;
                      const isReady = isCommunicationReady(speaking) && isCommunicationReady(writing);
                      
                      return (
                        <tr key={student._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-gray-500">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-gray-700">{student.studentProfile?.currentSchool || '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getCefrColor(speaking)}`}>
                              <MessageCircle className="w-3 h-3" />
                              {speaking || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getCefrColor(writing)}`}>
                              <TrendingUp className="w-3 h-3" />
                              {writing || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isReady ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Comm Ready
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5" />
                                In Progress
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState 
                icon={MessageCircle} 
                title="No students with CFER data" 
                description="Students need to complete their English proficiency assessment first"
              />
            )
          ) : communicationSubTab === 'readTheory' ? (
            readTheoryStudents.length === 0 ? (
              <EmptyState 
                icon={BookOpen}
                title="No students with ReadTheory data"
                description="ReadTheory levels are not available yet for these managed campuses"
              />
            ) : null
          ) : (
            <EmptyState 
              icon={MessageCircle} 
              title="No communication data" 
              description="No CEFR or ReadTheory records are available for the selected scope"
            />
          )}
        </div>
      ) : null}

      {/* Shared Modals */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={selectedSkill ? 'Edit Skill' : 'Add New Skill'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Skill Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., JavaScript" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
              <option value="">Select category</option>
              {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input id="isCommon" type="checkbox" checked={formData.isCommon} onChange={(e) => setFormData({ ...formData, isCommon: e.target.checked })} />
            <label htmlFor="isCommon" className="text-sm text-gray-700">Mark as Common Skill</label>
          </div>
          {!formData.isCommon && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">School Tags</label>
              <select multiple value={formData.schools} onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map(opt => opt.value);
                setFormData({ ...formData, schools: options });
              }} className="w-full h-32">
                {schools.map(school => <option key={school} value={school}>{school}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Hold Cmd/Ctrl to select multiple schools</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{selectedSkill ? 'Update Skill' : 'Add Skill'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setSelectedSkill(null); }}
        onConfirm={handleDelete}
        title="Delete Skill"
        message={`Are you sure you want to delete "${selectedSkill?.name}"?`}
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
};

export default POCSkillManagement;