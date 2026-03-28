import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Plus, Trash2 } from 'lucide-react';
import { settingsAPI } from '../../services/api';
import { Modal } from '../../components/common/UIComponents';

const CouncilPosts = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [higherEducationOptions, setHigherEducationOptions] = useState({});
  const [analytics, setAnalytics] = useState({
    councilPostCounts: {},
    higherEducationDepartmentCounts: {},
    higherEducationSpecializationCounts: {}
  });
  const [newDepartment, setNewDepartment] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    mode: 'initial',
    action: null,
    impact: null,
    message: ''
  });
  const [studentListModal, setStudentListModal] = useState({
    isOpen: false,
    title: '',
    students: [],
    loading: false
  });

  const closeDeleteModal = () => {
    if (saving) return;
    setDeleteModal({
      isOpen: false,
      mode: 'initial',
      action: null,
      impact: null,
      message: ''
    });
  };

  const getActionLabel = (action) => {
    if (!action) return 'option';
    if (action.type === 'council-post') return `council post "${action.post}"`;
    if (action.type === 'department') return `department "${action.department}"`;
    if (action.type === 'specialization') {
      return `specialization "${action.specialization}" from "${action.department}"`;
    }
    return 'option';
  };

  const openDeleteModal = (action) => {
    setDeleteModal({
      isOpen: true,
      mode: 'initial',
      action,
      impact: null,
      message: `Remove ${getActionLabel(action)}?`
    });
  };

  const buildImpactCsv = () => {
    const action = deleteModal.action;
    const impact = deleteModal.impact || {};
    if (!action) return;

    const rows = [];

    // Summary section
    rows.push(['=== SUMMARY ===']);
    rows.push(['Scope', getActionLabel(action)]);
    rows.push(['Affected Students', impact.students || 0]);
    rows.push(['Affected Campuses', impact.campuses || 0]);
    rows.push([]);

    // Campus breakdown section
    rows.push(['=== CAMPUS BREAKDOWN ===']);
    rows.push(['Campus', 'Students Affected']);
    const campusBreakdown = Array.isArray(impact.campusBreakdown) ? impact.campusBreakdown : [];
    if (campusBreakdown.length > 0) {
      campusBreakdown.forEach((row) => {
        rows.push([row.campusName || 'Unknown Campus', row.students || 0]);
      });
    } else {
      rows.push(['(no campus data)', '']);
    }
    rows.push([]);

    // Per-student section
    rows.push(['=== AFFECTED STUDENTS ===']);
    rows.push(['Name', 'Email', 'Campus']);
    const studentRows = Array.isArray(impact.studentRows) ? impact.studentRows : [];
    if (studentRows.length > 0) {
      studentRows.forEach((s) => {
        rows.push([s.name || 'N/A', s.email || 'N/A', s.campus || 'N/A']);
      });
    } else {
      rows.push(['(no student details)', '', '']);
    }

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    link.href = url;
    link.setAttribute('download', `profile-options-impact-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const runDeleteAction = async (action, force = false) => {
    if (!action) throw new Error('No delete action specified');

    if (action.type === 'council-post') {
      const response = await settingsAPI.removeCouncilPostOption(action.post, force);
      setPosts(response.data?.data?.councilPosts || []);
      return response;
    }

    if (action.type === 'department') {
      const response = await settingsAPI.removeHigherEducationOption({ department: action.department }, force);
      const nextOptions = response.data?.data || {};
      setHigherEducationOptions(nextOptions);
      setSelectedDepartment((current) => {
        if (current !== action.department) return current;
        return Object.keys(nextOptions)[0] || '';
      });
      return response;
    }

    if (action.type === 'specialization') {
      const response = await settingsAPI.removeHigherEducationOption(
        { department: action.department, specialization: action.specialization },
        force
      );
      setHigherEducationOptions(response.data?.data || {});
      return response;
    }

    throw new Error('Unsupported delete action');
  };

  const handleModalConfirmDelete = async () => {
    const action = deleteModal.action;
    if (!action) return;

    try {
      setSaving(true);
      if (deleteModal.mode === 'initial') {
        await runDeleteAction(action, false);
        await fetchPosts();
        closeDeleteModal();
        toast.success('Option removed');
        return;
      }

      const forcedResponse = await runDeleteAction(action, true);
      await fetchPosts();
      closeDeleteModal();

      const notifiedStudents = forcedResponse?.data?.notifiedStudents || 0;
      if (notifiedStudents > 0) {
        toast.success(`Option removed. ${notifiedStudents} student(s) notified to update profile.`);
      } else {
        toast.success('Option removed');
      }
    } catch (error) {
      const impact = error.response?.data?.impact;
      if (deleteModal.mode === 'initial' && error.response?.status === 409 && impact) {
        setDeleteModal((prev) => ({
          ...prev,
          mode: 'impact',
          impact,
          message: error.response?.data?.message || 'This option is in use. Delete anyway?'
        }));
        return;
      }

      console.error('Delete option error:', error);
      toast.error(error.response?.data?.message || 'Failed to remove option');
      closeDeleteModal();
    } finally {
      setSaving(false);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const [settingsResponse, analyticsResponse] = await Promise.all([
        settingsAPI.getSettings(),
        settingsAPI.getProfileOptionsAnalytics().catch(() => null)
      ]);

      setPosts(settingsResponse.data?.data?.councilPosts || []);
      const nextHigherEducationOptions = settingsResponse.data?.data?.higherEducationOptions || {};
      setHigherEducationOptions(nextHigherEducationOptions);

      if (analyticsResponse?.data?.success) {
        setAnalytics(analyticsResponse.data.data || {
          councilPostCounts: {},
          higherEducationDepartmentCounts: {},
          higherEducationSpecializationCounts: {}
        });
      }

      setSelectedDepartment((current) => {
        if (current && nextHigherEducationOptions[current]) return current;
        return Object.keys(nextHigherEducationOptions)[0] || '';
      });
    } catch (error) {
      console.error('Failed to load council posts:', error);
      toast.error('Failed to load profile option registries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleAddPost = async () => {
    const post = newPost.trim();
    if (!post) return;

    try {
      setSaving(true);
      const response = await settingsAPI.addCouncilPostOption(post);
      setPosts(response.data?.data?.councilPosts || []);
      setNewPost('');
      toast.success('Council post added');
    } catch (error) {
      console.error('Failed to add council post:', error);
      toast.error(error.response?.data?.message || 'Failed to add council post');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePost = async (post) => {
    openDeleteModal({ type: 'council-post', post });
  };

  const handleAddDepartment = async () => {
    const department = newDepartment.trim();
    if (!department) return;

    try {
      setSaving(true);
      const response = await settingsAPI.addHigherEducationOption({ department });
      const nextOptions = response.data?.data || {};
      setHigherEducationOptions(nextOptions);
      setSelectedDepartment(department);
      setNewDepartment('');
      toast.success('Higher-education department added');
    } catch (error) {
      console.error('Failed to add higher-education department:', error);
      toast.error(error.response?.data?.message || 'Failed to add higher-education department');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSpecialization = async () => {
    const department = selectedDepartment.trim();
    const specialization = newSpecialization.trim();
    if (!department) {
      toast.error('Choose a department first');
      return;
    }
    if (!specialization) return;

    try {
      setSaving(true);
      const response = await settingsAPI.addHigherEducationOption({ department, specialization });
      setHigherEducationOptions(response.data?.data || {});
      setNewSpecialization('');
      toast.success('Specialization added');
    } catch (error) {
      console.error('Failed to add specialization:', error);
      toast.error(error.response?.data?.message || 'Failed to add specialization');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDepartment = async (department) => {
    openDeleteModal({ type: 'department', department });
  };

  const handleRemoveSpecialization = async (department, specialization) => {
    openDeleteModal({ type: 'specialization', department, specialization });
  };

  const handleViewStudents = async (params, title) => {
    const count =
      params.type === 'council-post'
        ? analytics.councilPostCounts?.[params.value] || 0
        : params.type === 'department'
        ? analytics.higherEducationDepartmentCounts?.[params.value] || 0
        : analytics.higherEducationSpecializationCounts?.[params.department]?.[params.value] || 0;

    if (count === 0) {
      toast('No students have selected this option yet.', { icon: 'ℹ️' });
      return;
    }

    setStudentListModal({ isOpen: true, title, students: [], loading: true });
    try {
      const res = await settingsAPI.getOptionStudents(params);
      setStudentListModal((prev) => ({ ...prev, students: res.data?.data || [], loading: false }));
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load student list');
      setStudentListModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const departmentList = Object.keys(higherEducationOptions || {});
  const sortedPosts = [...posts].sort((a, b) => {
    const countDiff = (analytics.councilPostCounts?.[b] || 0) - (analytics.councilPostCounts?.[a] || 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });

  const sortedDepartments = [...departmentList].sort((a, b) => {
    const countDiff =
      (analytics.higherEducationDepartmentCounts?.[b] || 0) -
      (analytics.higherEducationDepartmentCounts?.[a] || 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b);
  });
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile Options</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage approved council-post and higher-education values used across student profiles and job eligibility.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Add New Council Post</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddPost();
              }
            }}
            placeholder="e.g. General Secretary"
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddPost}
            disabled={saving || !newPost.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Adding...' : 'Add Post'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Approved Council Posts</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading council posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-500">No council posts configured yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedPosts.map((post) => (
              <span
                key={post}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100"
              >
                {post}
                <span
                  className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 cursor-pointer hover:bg-indigo-200 transition-colors"
                  title="Click to view students"
                  onClick={() => handleViewStudents({ type: 'council-post', value: post }, `Students: ${post}`)}
                >
                  {analytics.councilPostCounts?.[post] || 0}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemovePost(post)}
                  className="text-indigo-500 hover:text-red-600"
                  title="Remove council post"
                  disabled={saving}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Higher-Education Department</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDepartment();
              }
            }}
            placeholder="e.g. B.Tech, B.Sc, B.Com"
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddDepartment}
            disabled={saving || !newDepartment.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Adding...' : 'Add Department'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Add Specialization</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="">Select Department</option>
            {departmentList.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newSpecialization}
            onChange={(e) => setNewSpecialization(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSpecialization();
              }
            }}
            placeholder="e.g. Computer Science, Finance"
            className="flex-1"
          />
          <button
            type="button"
            onClick={handleAddSpecialization}
            disabled={saving || !selectedDepartment || !newSpecialization.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Adding...' : 'Add Specialization'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Approved Higher-Education Options</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading higher-education options...</p>
        ) : departmentList.length === 0 ? (
          <p className="text-sm text-gray-500">No higher-education departments configured yet.</p>
        ) : (
          <div className="space-y-4">
            {sortedDepartments.map((department) => (
              <div key={department} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span>{department}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
                      title="Click to view students"
                      onClick={() => handleViewStudents({ type: 'department', value: department }, `Students: ${department}`)}
                    >
                      {analytics.higherEducationDepartmentCounts?.[department] || 0}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleRemoveDepartment(department)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50"
                    disabled={saving}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Department
                  </button>
                </div>
                {(higherEducationOptions[department] || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No specializations added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...(higherEducationOptions[department] || [])]
                      .sort((a, b) => {
                        const countDiff =
                          (analytics.higherEducationSpecializationCounts?.[department]?.[b] || 0) -
                          (analytics.higherEducationSpecializationCounts?.[department]?.[a] || 0);
                        if (countDiff !== 0) return countDiff;
                        return a.localeCompare(b);
                      })
                      .map((specialization) => (
                      <span
                        key={`${department}-${specialization}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100"
                      >
                        {specialization}
                        <span
                          className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 cursor-pointer hover:bg-emerald-200 transition-colors"
                          title="Click to view students"
                          onClick={() => handleViewStudents(
                            { type: 'specialization', department, value: specialization },
                            `Students: ${department} — ${specialization}`
                          )}
                        >
                          {analytics.higherEducationSpecializationCounts?.[department]?.[specialization] || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecialization(department, specialization)}
                          className="text-emerald-600 hover:text-red-600"
                          title="Remove specialization"
                          disabled={saving}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={studentListModal.isOpen}
        onClose={() => setStudentListModal({ isOpen: false, title: '', students: [], loading: false })}
        title={studentListModal.title}
        size="lg"
      >
        {studentListModal.loading ? (
          <p className="text-sm text-gray-500 py-4 text-center">Loading students...</p>
        ) : studentListModal.students.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No students found for this option.</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-gray-500 mb-3">{studentListModal.students.length} student{studentListModal.students.length !== 1 ? 's' : ''}</p>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Campus</th>
                </tr>
              </thead>
              <tbody>
                {studentListModal.students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{student.name}</td>
                    <td className="px-3 py-2 text-gray-600">{student.email}</td>
                    <td className="px-3 py-2 text-gray-600">{student.campus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        title={deleteModal.mode === 'impact' ? 'Impact Confirmation Required' : 'Confirm Deletion'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{deleteModal.message}</p>

          {deleteModal.mode === 'impact' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">This removal will clear profile values for affected students.</p>
              <p className="text-sm text-amber-800">
                Affected students: {deleteModal.impact?.students || 0} | Affected campuses: {deleteModal.impact?.campuses || 0}
              </p>
              {(deleteModal.impact?.campusBreakdown || []).length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs text-amber-900 border border-amber-200 rounded bg-white p-2">
                  {(deleteModal.impact?.campusBreakdown || []).map((row) => (
                    <div key={row.campusName} className="flex justify-between gap-3 py-0.5">
                      <span>{row.campusName}</span>
                      <span className="font-medium">{row.students}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {deleteModal.mode === 'impact' && (
              <button
                type="button"
                onClick={buildImpactCsv}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Download Impact CSV
              </button>
            )}
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleModalConfirmDelete}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving
                ? 'Processing...'
                : deleteModal.mode === 'impact'
                  ? 'Delete and Notify Students'
                  : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CouncilPosts;