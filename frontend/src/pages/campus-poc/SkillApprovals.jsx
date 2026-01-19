import { useState, useEffect } from 'react';
import { userAPI } from '../../services/api';
import { LoadingSpinner, EmptyState } from '../../components/common/UIComponents';
import { CheckSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const POCSkillApprovals = () => {
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    fetchPendingSkills();
  }, []);

  const fetchPendingSkills = async () => {
    try {
      const response = await userAPI.getPendingSkills();
      setPendingStudents(response.data);
    } catch (error) {
      console.error('Error fetching pending skills:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleBulkApprove = async (studentId, skills) => {
    for (const skill of skills) {
      await handleApproval(studentId, skill.skill._id, 'approved');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Skill Approvals</h1>
        <p className="text-gray-600">Review and approve student skills</p>
      </div>

      {/* Pending List */}
      {pendingStudents.length > 0 ? (
        <div className="space-y-4">
          {pendingStudents.map((student) => (
            <div key={student._id} className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">
                      {student.firstName?.[0]}{student.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {student.firstName} {student.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleBulkApprove(student._id, student.pendingSkills)}
                  className="btn btn-success text-sm"
                  title="Approve all pending skills"
                >
                  Approve All ({student.pendingSkills?.length})
                </button>
              </div>

              <div className="space-y-3">
                {student.pendingSkills?.map((skillItem) => {
                  const key = `${student._id}-${skillItem.skill?._id}`;
                  const isProcessing = processing[key];

                  return (
                    <div 
                      key={skillItem.skill?._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="font-medium">{skillItem.skill?.name}</p>
                          <p className="text-sm text-gray-500 capitalize">
                            {skillItem.skill?.category?.replace('_', ' ')}
                          </p>                          {skillItem.selfRating > 0 && (
                            <p className="text-xs text-gray-600 mt-1">Level: {['','Basic','Intermediate','Advanced','Expert'][skillItem.selfRating]}</p>
                          )}                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproval(student._id, skillItem.skill?._id, 'rejected')}
                          disabled={isProcessing}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          title="Reject skill"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleApproval(student._id, skillItem.skill?._id, 'approved')}
                          disabled={isProcessing}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                            title="Approve skill"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No pending approvals"
          description="All student skills have been reviewed"
        />
      )}
    </div>
  );
};

export default POCSkillApprovals;
