import { useState, useMemo } from 'react';
import { Modal, LoadingSpinner, Badge } from '../common/UIComponents';
import { Filter, Search, Calendar, Clock, Users } from 'lucide-react';

const ReadinessDetailedModal = ({ isOpen, onClose, students, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const schools = useMemo(() => {
    return ['all', ...new Set(students.map(s => s.school))];
  }, [students]);

  const roles = useMemo(() => {
    const allRoles = students.flatMap(s => s.roles || []);
    return ['all', ...new Set(allRoles)];
  }, [students]);

  const categorizedStudents = useMemo(() => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.campus || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (schoolFilter !== 'all') {
      filtered = filtered.filter(s => s.school === schoolFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(s => s.roles && s.roles.includes(roleFilter));
    }

    return {
      all: filtered,
      jobReady: filtered.filter(s => s.isJobReady),
      underJobReady: filtered.filter(s => !s.isJobReady && s.readinessPercentage >= 30),
      nonJobReady: filtered.filter(s => s.readinessPercentage < 30)
    };
  }, [students, searchTerm, schoolFilter, roleFilter]);

  // Helper for "Days being job ready"
  const getDaysDiff = (date) => {
    if (!date) return '-';
    try {
      const diffTime = Math.abs(new Date() - new Date(date));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} days`;
    } catch (e) {
      return '-';
    }
  };

  const StudentTable = ({ list, type }) => (
    <div className="overflow-x-auto bg-white border border-gray-100 rounded-lg shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 border-b">
          <tr className="text-gray-500 uppercase font-semibold">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Campus/School</th>
            <th className="px-3 py-2 text-center">Readiness</th>
            {type === 'jobReady' && <th className="px-3 py-2">Since</th>}
            <th className="px-3 py-2">Roles</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.length > 0 ? list.map((student) => (
            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900 leading-tight">{student.name}</div>
                <div className="text-[10px] text-gray-400">{student.email}</div>
              </td>
              <td className="px-3 py-2 text-[11px]">
                <div className="font-medium text-gray-700">{student.campus}</div>
                <div className="text-gray-400">{student.school}</div>
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex flex-col items-center">
                  <span className={`font-bold text-[11px] ${
                    student.readinessPercentage === 100 ? 'text-green-600' :
                    student.readinessPercentage >= 30 ? 'text-yellow-600' : 'text-red-500'
                  }`}>
                    {student.readinessPercentage}%
                  </span>
                  <div className="w-12 h-0.5 bg-gray-100 rounded-full mt-0.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        student.readinessPercentage === 100 ? 'bg-green-500' :
                        student.readinessPercentage >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${student.readinessPercentage}%` }}
                    />
                  </div>
                </div>
              </td>
              {type === 'jobReady' && (
                <td className="px-3 py-2 text-[10px]">
                  <div className="flex items-center gap-1 text-gray-400">
                    <Calendar className="w-2.5 h-2.5" />
                    {student.approvedAt ? new Date(student.approvedAt).toLocaleDateString() : '-'}
                  </div>
                  <div className="flex items-center gap-1 text-primary-600 font-bold">
                    <Clock className="w-2.5 h-2.5" />
                    {getDaysDiff(student.approvedAt)}
                  </div>
                </td>
              )}
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-0.5 max-w-[120px]">
                  {student.roles?.slice(0, 2).map((role, i) => (
                    <span key={i} className="text-[9px] px-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-sm">
                      {role}
                    </span>
                  ))}
                  {student.roles?.length > 2 && (
                    <span className="text-[9px] text-gray-400">+{student.roles.length - 2}</span>
                  )}
                </div>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={type === 'jobReady' ? 5 : 4} className="px-3 py-6 text-center text-gray-400 italic">
                No students found in this category
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detailed Student Readiness" size="xl">
      <div className="space-y-4">
        {/* Statistics Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Total</p>
            <p className="text-xl font-bold text-gray-900">{categorizedStudents.all.length}</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 border border-green-100 text-center">
            <p className="text-[10px] uppercase tracking-wider text-green-600 font-bold mb-1">Job Ready</p>
            <p className="text-xl font-bold text-green-700">{categorizedStudents.jobReady.length}</p>
          </div>
          <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
            <p className="text-[10px] uppercase tracking-wider text-yellow-600 font-bold mb-1">30%+</p>
            <p className="text-xl font-bold text-yellow-700">{categorizedStudents.underJobReady.length}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 border border-red-100 text-center">
            <p className="text-[10px] uppercase tracking-wider text-red-600 font-bold mb-1">Non-Ready</p>
            <p className="text-xl font-bold text-red-700">{categorizedStudents.nonJobReady.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 bg-white sticky top-0 z-10 py-1">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input 
              type="text"
              placeholder="Search..."
              className="pl-7 w-full h-8 text-xs border-gray-200 focus:ring-primary-500 focus:border-primary-500 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-400" />
            <select 
              className="text-xs h-8 border-gray-200 focus:ring-primary-500 focus:border-primary-500 rounded-md py-0 pl-2 pr-6"
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
            >
              <option value="all">All Schools</option>
              {schools.filter(s => s !== 'all').map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select 
              className="text-xs h-8 border-gray-200 focus:ring-primary-500 focus:border-primary-500 rounded-md py-0 pl-2 pr-6"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {roles.filter(r => r !== 'all').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="space-y-6 pb-4">
            {/* Sections */}
            <section>
              <h3 className="text-[11px] font-bold text-green-600 mb-2 flex items-center gap-1.5 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                JOB READY STREAMS
              </h3>
              <StudentTable list={categorizedStudents.jobReady} type="jobReady" />
            </section>

            <section>
              <h3 className="text-[11px] font-bold text-yellow-600 mb-2 flex items-center gap-1.5 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                UNDER JOB READY (30%+)
              </h3>
              <StudentTable list={categorizedStudents.underJobReady} type="underJobReady" />
            </section>

            <section>
              <h3 className="text-[11px] font-bold text-red-600 mb-2 flex items-center gap-1.5 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                NON JOB READY (0-29%)
              </h3>
              <StudentTable list={categorizedStudents.nonJobReady} type="nonJobReady" />
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReadinessDetailedModal;
