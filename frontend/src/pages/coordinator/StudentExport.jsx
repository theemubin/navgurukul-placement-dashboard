import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, RefreshCw, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { userAPI } from '../../services/api';
import { LoadingSpinner } from '../../components/common/UIComponents';

const initialFilters = {
  search: '',
  campus: '',
  school: '',
  educationType: '',
  graduation: '',
  educationLevel: '',
  location: '',
  language: '',
  languageLevel: '',
  englishLevel: '',
  interest: ''
};

const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const getDegrees = (student) => (student.studentProfile?.higherEducation || [])
  .map((item) => item.degree)
  .filter(Boolean)
  .join(', ');

const getLocation = (student) => {
  const hometown = student.studentProfile?.hometown || {};
  return [hometown.district, hometown.state].filter(Boolean).join(', ') || '-';
};

const getLanguages = (student) => (student.studentProfile?.languages || [])
  .map((item) => item.language)
  .filter(Boolean)
  .join(', ') || '-';

const StudentExport = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [campuses, setCampuses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [options, setOptions] = useState({ educationTypes: [], graduations: [], educationLevels: [], locations: [], languages: [], proficiencyLevels: levels });
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

  useEffect(() => {
    userAPI.getStudentExportOptions()
      .then((response) => {
        const data = response.data || {};
        setCampuses(data.campuses || []);
        setSchools(data.schools || []);
        setOptions(data);
      })
      .catch(() => toast.error('Failed to load filter options'));
  }, []);

  const query = useMemo(() => Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  ), [filters]);

  const showStudents = async (page = 1) => {
    setLoading(true);
    try {
      const response = await userAPI.getStudents({
        ...query,
        page,
        limit: 50,
        summary: 'export'
      }, { forceRefresh: true });
      setStudents(response.data.students || []);
      setPagination(response.data.pagination || { current: page, pages: 1, total: 0 });
      setSelectedIds(new Set());
      setHasSearched(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setHasSearched(false);
  };

  const toggleStudent = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = students.every((student) => next.has(student._id));
      students.forEach((student) => allSelected ? next.delete(student._id) : next.add(student._id));
      return next;
    });
  };

  const exportStudents = async (selectedOnly) => {
    if (selectedOnly && selectedIds.size === 0) {
      toast.error('Select at least one student to export');
      return;
    }
    setExporting(true);
    try {
      const exportParams = {
        ...query,
        ...(selectedOnly ? { ids: [...selectedIds].join(',') } : {})
      };
      const response = await userAPI.exportStudents(exportParams);
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Student export downloaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to export students');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setStudents([]);
    setSelectedIds(new Set());
    setHasSearched(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Export</h1>
        <p className="text-gray-500">Filter students, review the list, and export selected or all matching records.</p>
      </div>

      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <label className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input className="pl-9" placeholder="Name or email" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
          </label>
          <select value={filters.campus} onChange={(e) => updateFilter('campus', e.target.value)}>
            <option value="">All campuses</option>
            {campuses.map((campus) => <option key={campus._id} value={campus._id}>{campus.name}</option>)}
          </select>
          <select value={filters.school} onChange={(e) => updateFilter('school', e.target.value)}>
            <option value="">All schools</option>
            {schools.map((school) => <option key={school} value={school}>{school}</option>)}
          </select>
          <select value={filters.educationType} onChange={(e) => updateFilter('educationType', e.target.value)}>
            <option value="">All education types</option>
            {options.educationTypes?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.graduation} onChange={(e) => updateFilter('graduation', e.target.value)}>
            <option value="">All graduations</option>
            {options.graduations?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.educationLevel} onChange={(e) => updateFilter('educationLevel', e.target.value)}>
            <option value="">All education levels</option>
            {options.educationLevels?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.location} onChange={(e) => updateFilter('location', e.target.value)}>
            <option value="">All locations</option>
            {options.locations?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.language} onChange={(e) => updateFilter('language', e.target.value)}>
            <option value="">All languages</option>
            {options.languages?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.languageLevel} onChange={(e) => updateFilter('languageLevel', e.target.value)}>
            <option value="">Any language level</option>
            {options.proficiencyLevels?.map((level) => <option key={level} value={level}>{level} or higher</option>)}
          </select>
          <select value={filters.englishLevel} onChange={(e) => updateFilter('englishLevel', e.target.value)}>
            <option value="">Any English level</option>
            {options.proficiencyLevels?.map((level) => <option key={level} value={level}>{level} or higher</option>)}
          </select>
          <select value={filters.interest} onChange={(e) => updateFilter('interest', e.target.value)}>
            <option value="">Any interest request</option>
            <option value="yes">Has interest request</option>
            <option value="no">No interest request</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary flex items-center gap-2" onClick={() => showStudents(1)} disabled={loading}>
            {loading ? <LoadingSpinner size="sm" /> : <Users className="w-4 h-4" />} Show students
          </button>
          <button className="btn btn-secondary flex items-center gap-2" onClick={clearFilters} disabled={loading}>
            <RefreshCw className="w-4 h-4" /> Clear
          </button>
        </div>
      </section>

      {hasSearched && (
        <section className="card !p-0 overflow-hidden">
          <div className="p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              <strong>{pagination.total}</strong> matching students
              {selectedIds.size > 0 && <span className="ml-2 text-primary-700">{selectedIds.size} selected</span>}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex items-center gap-2" onClick={() => exportStudents(true)} disabled={exporting || selectedIds.size === 0}>
                <Download className="w-4 h-4" /> Export selected
              </button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => exportStudents(false)} disabled={exporting || pagination.total === 0}>
                <Download className="w-4 h-4" /> Export all
              </button>
            </div>
          </div>
          {loading ? <div className="p-10"><LoadingSpinner /></div> : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3"><input type="checkbox" checked={students.length > 0 && students.every((student) => selectedIds.has(student._id))} onChange={toggleVisible} /></th>
                    <th className="p-3">Student</th><th className="p-3">Campus</th><th className="p-3">School</th>
                    <th className="p-3">Graduation</th><th className="p-3">Location</th><th className="p-3">Languages</th><th className="p-3">English</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="p-3"><input type="checkbox" checked={selectedIds.has(student._id)} onChange={() => toggleStudent(student._id)} /></td>
                      <td className="p-3"><div className="font-medium">{student.firstName} {student.lastName}</div><div className="text-xs text-gray-500">{student.email}</div></td>
                      <td className="p-3">{student.campus?.name || '-'}</td>
                      <td className="p-3">{student.studentProfile?.currentSchool || '-'}</td>
                      <td className="p-3">{getDegrees(student) || '-'}</td>
                      <td className="p-3">{getLocation(student)}</td>
                      <td className="p-3">{getLanguages(student)}</td>
                      <td className="p-3">{student.studentProfile?.englishProficiency?.speaking || student.studentProfile?.englishProficiency?.writing || '-'}</td>
                    </tr>
                  ))}
                  {students.length === 0 && <tr><td colSpan="8" className="p-10 text-center text-gray-500">No students match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="p-4 border-t flex justify-between items-center text-sm">
              <span>Page {pagination.current} of {pagination.pages}</span>
              <div className="flex gap-2">
                <button className="btn btn-secondary" disabled={pagination.current <= 1} onClick={() => showStudents(pagination.current - 1)}>Previous</button>
                <button className="btn btn-secondary" disabled={pagination.current >= pagination.pages} onClick={() => showStudents(pagination.current + 1)}>Next</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default StudentExport;
