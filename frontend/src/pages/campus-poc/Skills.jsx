import { useState, useEffect } from 'react';
import { skillAPI, settingsAPI, userAPI } from '../../services/api';
import { LoadingSpinner, EmptyState, Modal, ConfirmDialog } from '../../components/common/UIComponents';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, Plus, Edit2, Trash2, Tag, Layers, Globe, School, 
  CheckSquare, CheckCircle, XCircle, Clock, LayoutGrid, ClipboardCheck,
  MessageCircle, TrendingUp, Award
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
  const [selectedCampus, setSelectedCampus] = useState('');
  const [campusList, setCampusList] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'communication') {
      fetchCommunicationStudents();
    }
  }, [selectedCampus, activeTab]);

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
        // For POC, use their managed campuses or their campus
        const managedCampuses = user?.managedCampuses?.length > 0 ? user.managedCampuses : (user?.campus ? [user.campus] : []);
        setCampusList(managedCampuses);
        if (managedCampuses.length > 0 && !selectedCampus) {
          setSelectedCampus(managedCampuses[0]?._id || managedCampuses[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchCommunicationStudents = async () => {
    if (!selectedCampus) return;
    
    setCommunicationLoading(true);
    try {
      const response = await userAPI.getStudents({
        campus: selectedCampus,
        limit: 1000,
        summary: 'false'
      });
      
      const students = response.data.students || [];
      const studentsWithEnglish = students.filter(s => 
        s.studentProfile?.englishProficiency?.speaking || 
        s.studentProfile?.englishProficiency?.writing
      );
      
      setCommunicationStudents(studentsWithEnglish);
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
  
  const isJobReady = (level) => {
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

  const getJobReadyPercentage = () => {
    if (communicationStudents.length === 0) return 0;
    const ready = communicationStudents.filter(s => {
      const speaking = s.studentProfile?.englishProficiency?.speaking;
      const writing = s.studentProfile?.englishProficiency?.writing;
      return isJobReady(speaking) && isJobReady(writing);
    }).length;
    return Math.round((ready / communicationStudents.length) * 100);
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
          {/* Header with Campus Filter */}
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filter by Campus</label>
                <select
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full md:w-64"
                >
                  <option value="">Select Campus</option>
                  {campusList.map(campus => (
                    <option key={campus._id || campus} value={campus._id || campus}>
                      {campus.name || campus}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Students</p>
                  <p className="text-2xl font-black text-blue-700">{communicationStudents.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 font-bold uppercase tracking-wider">Job Ready</p>
                  <p className="text-2xl font-black text-green-700">{getJobReadyPercentage()}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar for Job Readiness */}
          {communicationStudents.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-bold text-gray-900">Communication Job Readiness (B2+)</span>
                </div>
                <span className="text-sm font-bold text-primary-600">{getJobReadyPercentage()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${getJobReadyPercentage()}%` }}
                />
              </div>
            </div>
          )}

          {/* Students Table */}
          {communicationLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : communicationStudents.length > 0 ? (
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
                  {communicationStudents.map((student) => {
                    const speaking = student.studentProfile?.englishProficiency?.speaking;
                    const writing = student.studentProfile?.englishProficiency?.writing;
                    const isReady = isJobReady(speaking) && isJobReady(writing);
                    
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
                              Job Ready
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
              title="No students with communication data" 
              description="Students need to complete their English proficiency assessment first"
            />
          )
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