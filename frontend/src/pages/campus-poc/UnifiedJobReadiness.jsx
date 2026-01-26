import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { jobReadinessAPI, settingsAPI } from '../../services/api';
import { Card, Button, Badge, LoadingSpinner, Alert, Modal } from '../../components/common/UIComponents';
import {
    Plus, Edit, Trash2, Save, X, Eye, Info, CheckCircle2, AlertCircle,
    ChevronRight, Layout, Settings2, Sparkles, Users, Search,
    Filter, Trophy, Clock, CheckCircle, Target, Users2, ListChecks, CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Import the review and config sections as sub-components
// For now, I'll combine them here for simplicity and to ensure they share state if needed (like school selection)

const UnifiedJobReadiness = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('review'); // 'review' or 'config'
    const [selectedSchool, setSelectedSchool] = useState('School of Programming');
    const [schools, setSchools] = useState([]);

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        try {
            const res = await settingsAPI.getSettings();
            const allSchools = res.data.data.schools || [];
            const inactive = res.data.data.inactiveSchools || [];
            const activeSchools = allSchools.filter(s => !inactive.includes(s));
            setSchools(['Common', ...activeSchools]);
            if (activeSchools.length > 0 && !activeSchools.includes(selectedSchool) && selectedSchool !== 'Common') {
                setSelectedSchool('Common');
            }
        } catch (err) {
            console.error('Error fetching schools:', err);
            setSchools(['Common', 'School of Programming', 'School of Business', 'School of Finance', 'School of Education', 'School of Second Chance']);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Target className="w-8 h-8 text-indigo-600" />
                        Job Readiness Management
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Manage readiness criteria and review student progress in one place.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('review')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'review'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Users2 className="w-4 h-4" />
                    Review Students
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'config'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Settings2 className="w-4 h-4" />
                    Configure Criteria
                </button>
            </div>

            {/* Content */}
            <div className="transition-all duration-300">
                {activeTab === 'review' ? (
                    <ReadinessReviewSection />
                ) : (
                    <CriteriaConfigSection
                        selectedSchool={selectedSchool}
                        setSelectedSchool={setSelectedSchool}
                        schools={schools}
                    />
                )}
            </div>
        </div>
    );
};

// --- Review Section Component ---
const ReadinessReviewSection = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('pending'); // pending, all, job-ready
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [reviewModal, setReviewModal] = useState({ open: false, student: null, criterion: null });
    const [approveModal, setApproveModal] = useState({ open: false, student: null });
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchStudents();
    }, [filter]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filter === 'pending') params.status = 'pending';
            if (filter === 'job-ready') params.isJobReady = true;

            const res = await jobReadinessAPI.getCampusStudents(params);
            setStudents(res.data?.records || []);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCriterion = async (status) => {
        try {
            setProcessing(true);
            const studentId = reviewModal.student?.student?._id || reviewModal.student?.student;
            await jobReadinessAPI.verifyStudentCriterion(
                studentId,
                reviewModal.criterion.criteriaId,
                {
                    verified: status === 'verified',
                    verificationNotes: document.getElementById('verificationNotes')?.value || '',
                    rating: document.getElementById('reviewRating')?.value || undefined
                }
            );
            setReviewModal({ open: false, student: null, criterion: null });
            toast.success(`Criterion ${status === 'verified' ? 'verified' : 'rejected'}`);
            await fetchStudents();

            if (selectedStudent?._id === reviewModal.student._id) {
                const updated = students.find(s => s._id === reviewModal.student._id);
                if (updated) setSelectedStudent(updated);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to verify');
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveJobReady = async () => {
        try {
            setProcessing(true);
            const studentId = approveModal.student?.student?._id || approveModal.student?.student;
            await jobReadinessAPI.approveStudentJobReady(
                studentId,
                { notes: document.getElementById('approvalNotes')?.value || '' }
            );
            setApproveModal({ open: false, student: null });
            toast.success('Student marked as Job Ready!');
            await fetchStudents();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve');
        } finally {
            setProcessing(false);
        }
    };

    const getProgressStats = (record) => {
        const criteria = record.criteriaStatus || [];
        const total = criteria.length;
        const verified = criteria.filter(c => c.status === 'verified').length;
        const pending = criteria.filter(c => c.status === 'completed').length;
        return { total, verified, pending };
    };

    const filteredStudents = students.filter(record => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const name = `${record.student?.firstName} ${record.student?.lastName}`.toLowerCase();
        const email = record.student?.email?.toLowerCase() || '';
        return name.includes(search) || email.includes(search);
    });

    const stats = {
        total: students.length,
        jobReady: students.filter(s => s.isJobReady).length,
        pending: students.filter(s => getProgressStats(s).pending > 0).length
    };

    if (loading && students.length === 0) return <LoadingSpinner size="lg" />;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-white border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Students</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending Review</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.pending}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-xl text-green-600">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Job Ready</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.jobReady}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setFilter('pending')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'pending' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 border'
                            }`}
                    >
                        Pending Review
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 border'
                            }`}
                    >
                        All Students
                    </button>
                    <button
                        onClick={() => setFilter('job-ready')}
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'job-ready' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 border'
                            }`}
                    >
                        Job Ready
                    </button>
                </div>

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Student List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                        <Users2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">No students found</h3>
                        <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    filteredStudents.map(record => {
                        const studentStats = getProgressStats(record);
                        const isExpanded = selectedStudent?._id === record._id;

                        return (
                            <Card
                                key={record._id}
                                className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-2 ring-indigo-500 border-transparent shadow-xl' : 'hover:border-indigo-200'
                                    }`}
                            >
                                <div
                                    className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    onClick={() => setSelectedStudent(isExpanded ? null : record)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl">
                                            {record.student?.firstName?.[0]}{record.student?.lastName?.[0]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900">{record.student?.firstName} {record.student?.lastName}</h4>
                                                {record.isJobReady && <Badge variant="success" className="text-[10px] uppercase font-bold">Job Ready</Badge>}
                                            </div>
                                            <p className="text-sm text-gray-500">{record.student?.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-gray-900">{studentStats.verified}/{studentStats.total}</span>
                                                <span className="text-xs text-gray-400 uppercase tracking-tighter">Verified</span>
                                            </div>
                                            <div className="w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 transition-all duration-500"
                                                    style={{ width: `${(studentStats.verified / studentStats.total) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        {studentStats.pending > 0 && (
                                            <div className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full animate-pulse border border-amber-100">
                                                {studentStats.pending} Pending
                                            </div>
                                        )}
                                        <ChevronRight className={`w-5 h-5 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                                        <div className="pt-5 border-t border-gray-50">
                                            <div className="flex items-center justify-between mb-4">
                                                <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                                    <ListChecks className="w-4 h-4 text-indigo-600" />
                                                    Detailed Criteria Progress
                                                </h5>
                                                <div className="text-xs text-gray-400">
                                                    School: <span className="text-gray-900 font-medium">{record.school}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {record.criteriaStatus?.map(crit => (
                                                    <div
                                                        key={crit.criteriaId}
                                                        className={`p-4 rounded-2xl border transition-all ${crit.status === 'verified' ? 'bg-green-50/50 border-green-100' :
                                                            crit.status === 'completed' ? 'bg-amber-50/50 border-amber-100 ring-1 ring-amber-200' :
                                                                'bg-gray-50 border-gray-100'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    {crit.status === 'verified' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                                                    {crit.status === 'completed' && <Clock className="w-4 h-4 text-amber-600" />}
                                                                    <span className="font-bold text-gray-900 text-sm">{crit.criteriaId.replace(/_/g, ' ')}</span>
                                                                </div>
                                                                {crit.selfReportedValue && (
                                                                    <p className="text-xs text-gray-600 mt-1 line-clamp-1 italic">
                                                                        " {crit.selfReportedValue} "
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {crit.status === 'completed' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setReviewModal({ open: true, student: record, criterion: crit });
                                                                    }}
                                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm"
                                                                >
                                                                    Review
                                                                </button>
                                                            )}
                                                            {crit.status === 'verified' && crit.rating && (
                                                                <div className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                                                    Rating: {crit.rating}/4
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {!record.isJobReady && studentStats.verified === studentStats.total && studentStats.total > 0 && (
                                                <div className="mt-6 flex justify-center">
                                                    <button
                                                        onClick={() => setApproveModal({ open: true, student: record })}
                                                        className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                                                    >
                                                        <Trophy className="w-5 h-5" />
                                                        Approve Final Job Readiness
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Review Modal */}
            <Modal
                isOpen={reviewModal.open}
                onClose={() => setReviewModal({ open: false, student: null, criterion: null })}
                showClose={true}
            >
                <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <Eye className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Review Submission</h2>
                            <p className="text-gray-500 uppercase text-[10px] font-bold tracking-widest leading-loose">
                                {reviewModal.criterion?.criteriaId?.replace(/_/g, ' ')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Student's Input</h5>
                            <p className="text-gray-900 font-medium whitespace-pre-wrap">
                                {reviewModal.criterion?.notes
                                    ? reviewModal.criterion?.notes
                                    : (reviewModal.criterion?.selfReportedValue !== undefined && reviewModal.criterion?.selfReportedValue !== null)
                                        ? String(reviewModal.criterion?.selfReportedValue)
                                        : 'No input provided'}
                            </p>
                            {/* Show PoC comments/ratings if the student already has them */}
                            {reviewModal.criterion?.pocComment && (
                                <p className="text-sm text-gray-600 mt-2">PoC Comment: {reviewModal.criterion.pocComment}</p>
                            )}
                            {reviewModal.criterion?.pocRating !== undefined && (
                                <p className="text-sm text-gray-600 mt-1">PoC Rating: {reviewModal.criterion.pocRating}/10</p>
                            )}
                            {reviewModal.criterion?.proofUrl && (
                                <a
                                    href={reviewModal.criterion.proofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 text-indigo-600 font-bold text-sm hover:border-indigo-600 transition"
                                >
                                    <Layout className="w-4 h-4" /> View Linked Document / Achievement
                                </a>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Feedback Rating (1-4)</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => {
                                                const input = document.getElementById('reviewRating');
                                                if (input) input.value = num;
                                                // Trigger visual selection state if needed
                                                [1, 2, 3, 4].forEach(i => {
                                                    const btn = document.getElementById(`rate-btn-${i}`);
                                                    if (btn) btn.className = i === num ? "flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold" : "flex-1 py-3 rounded-xl bg-gray-50 text-gray-400 font-bold border border-gray-100 hover:bg-gray-100 transition";
                                                });
                                            }}
                                            id={`rate-btn-${num}`}
                                            className="flex-1 py-3 rounded-xl bg-gray-50 text-gray-400 font-bold border border-gray-100 hover:bg-gray-100 transition"
                                        >
                                            {num}
                                        </button>
                                    ))}
                                    <input type="hidden" id="reviewRating" defaultValue="4" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Verification Note</label>
                                <textarea
                                    id="verificationNotes"
                                    className="input w-full h-24"
                                    placeholder="Points of improvement or validation notes..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => handleVerifyCriterion('rejected')}
                                disabled={processing}
                                className="py-4 bg-white border-2 border-rose-100 text-rose-600 font-bold rounded-2xl hover:bg-rose-50 transition flex items-center justify-center gap-2"
                            >
                                <X className="w-5 h-5" /> Reject Submission
                            </button>
                            <button
                                onClick={() => handleVerifyCriterion('verified')}
                                disabled={processing}
                                className="py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-black transition shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                            >
                                {processing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <CheckCircle className="w-5 h-5" />}
                                Verify & Approve
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Approve Job Ready Modal */}
            <Modal
                isOpen={approveModal.open}
                onClose={() => setApproveModal({ open: false, student: null })}
                showClose={true}
            >
                <div className="p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-inner">
                        <Trophy className="w-10 h-10" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Confirm Job Readiness</h2>
                        <p className="text-gray-500 max-w-sm mx-auto mt-2 leading-relaxed">
                            By approving, you certify that <strong>{approveModal.student?.student?.firstName}</strong> has met all training requirements and is ready for placements.
                        </p>
                    </div>

                    <textarea
                        id="approvalNotes"
                        className="input w-full h-24 text-center"
                        placeholder="Add a congratulatory note (Optional)"
                    />

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={() => setApproveModal({ open: false, student: null })}
                            className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApproveJobReady}
                            disabled={processing}
                            className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition shadow-xl shadow-green-100"
                        >
                            {processing ? 'Approving...' : 'Confirm Approval'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- Criteria Config Section Component ---
const CriteriaConfigSection = ({ selectedSchool, setSelectedSchool, schools }) => {
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        criteriaId: '',
        name: '',
        description: '',
        type: 'answer',
        pocCommentRequired: false,
        pocCommentTemplate: '',
        pocRatingRequired: false,
        pocRatingScale: 4,
        category: 'other',
        isMandatory: true,
        targetSchools: []
    });
    const [saving, setSaving] = useState(false);
    const [configId, setConfigId] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewCriteria, setPreviewCriteria] = useState(null);

    const criteriaTypes = [
        { value: 'answer', label: 'Answer (Text Input)' },
        { value: 'link', label: 'Link (URL)' },
        { value: 'yes/no', label: 'Yes/No' },
        { value: 'comment', label: 'Comment (Long Text)' }
    ];

    const categories = [
        { value: 'profile', label: 'Profile Build', color: 'blue' },
        { value: 'skills', label: 'Key Skills', color: 'indigo' },
        { value: 'technical', label: 'Technical Rounds', color: 'purple' },
        { value: 'preparation', label: 'Interview Prep', color: 'orange' },
        { value: 'academic', label: 'Academic Details', color: 'green' },
        { value: 'other', label: 'Other', color: 'gray' }
    ];

    useEffect(() => {
        fetchConfig();
    }, [selectedSchool]);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await jobReadinessAPI.getConfig();
            let configs = res.data || [];

            // Criteria from the selected school
            let mainConfig = configs.find(c => c.school === selectedSchool);

            // Criteria from 'Common' track
            let commonConfig = configs.find(c => c.school === 'Common');

            if (selectedSchool === 'Common') {
                // AGGREGATED VIEW for Common:
                // Show everything from 'Common' config 
                // PLUS anything from other configs that has at least 1 school in targetSchools
                const aggregated = [];
                const seenIds = new Set();

                // 1. Add everything from Common config
                if (commonConfig) {
                    setConfigId(commonConfig._id);
                    (commonConfig.criteria || []).forEach(c => {
                        aggregated.push({ ...c, isSourceCommon: true });
                        seenIds.add(c.criteriaId);
                    });
                } else {
                    setConfigId(null);
                }

                // 2. Add anything from other configs that is shared (targetSchools > 0)
                configs.forEach(conf => {
                    if (conf.school !== 'Common') {
                        (conf.criteria || []).forEach(crit => {
                            if (crit.targetSchools?.length > 0 && !seenIds.has(crit.criteriaId)) {
                                aggregated.push({ ...crit, isSharedFrom: conf.school });
                                seenIds.add(crit.criteriaId);
                            }
                        });
                    }
                });
                setCriteria(aggregated);
            } else {
                // SPECIFIC SCHOOL VIEW:
                // Show school's own criteria + shares from others + global common tasks
                let sharedWithMe = [];
                configs.forEach(c => {
                    if (c.school !== selectedSchool && c.school !== 'Common') {
                        c.criteria.forEach(crit => {
                            if (crit.targetSchools?.includes(selectedSchool)) {
                                sharedWithMe.push({ ...crit, isSharedFrom: c.school });
                            }
                        });
                    }
                });

                if (mainConfig) {
                    setConfigId(mainConfig._id);
                    const merged = [...(mainConfig.criteria || [])];

                    sharedWithMe.forEach(swm => {
                        if (!merged.find(m => m.criteriaId === swm.criteriaId)) {
                            merged.push(swm);
                        }
                    });

                    if (commonConfig) {
                        commonConfig.criteria.forEach(cc => {
                            if (!merged.find(m => m.criteriaId === cc.criteriaId)) {
                                merged.push({ ...cc, isSharedFromCommon: true });
                            }
                        });
                    }
                    setCriteria(merged);
                } else {
                    setConfigId(null);
                    const initial = [...sharedWithMe];
                    if (commonConfig) {
                        commonConfig.criteria.forEach(cc => {
                            if (!initial.find(m => m.criteriaId === cc.criteriaId)) {
                                initial.push({ ...cc, isSharedFromCommon: true });
                            }
                        });
                    }
                    setCriteria(initial);
                }
            }
        } catch (err) {
            toast.error('Failed to load criteria');
            setConfigId(null);
            setCriteria([]);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingId(null);
        setForm({
            criteriaId: '',
            name: '',
            description: '',
            type: 'answer',
            pocCommentRequired: false,
            pocCommentTemplate: '',
            pocRatingRequired: false,
            pocRatingScale: 4,
            category: 'other',
            isMandatory: true,
            targetSchools: []
        });
        setShowModal(true);
    };

    const handleEdit = (crit) => {
        if (crit.isSharedFromCommon || (selectedSchool === 'Common' && crit.isSourceCommon === false && crit.isSharedFrom)) {
            const source = crit.isSharedFrom || 'the original school';
            toast.error(`This is shared from ${source}. Switch to ${source} to edit it.`);
            return;
        }
        setEditingId(crit.criteriaId);
        setForm({
            criteriaId: crit.criteriaId,
            name: crit.name,
            description: crit.description || '',
            type: crit.type || 'answer',
            pocCommentRequired: crit.pocCommentRequired || false,
            pocCommentTemplate: crit.pocCommentTemplate || '',
            pocRatingRequired: crit.pocRatingRequired || false,
            pocRatingScale: crit.pocRatingScale || 4,
            category: crit.category || 'other',
            isMandatory: crit.isMandatory !== undefined ? crit.isMandatory : true,
            targetSchools: crit.targetSchools || []
        });
        setShowModal(true);
    };

    const handleDelete = async (crit) => {
        if (crit.isSharedFromCommon || (selectedSchool === 'Common' && crit.isSourceCommon === false && crit.isSharedFrom)) {
            toast.error("Switch to the original school view to delete this.");
            return;
        }
        if (!window.confirm('Are you sure you want to delete this criterion? This will remove it for all students in this school.')) return;
        if (!configId) return;

        setSaving(true);
        try {
            await jobReadinessAPI.deleteCriterion(configId, crit.criteriaId);
            toast.success('Criterion deleted');
            fetchConfig();
        } catch {
            toast.error('Delete failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) return toast.error('Name is required');
        if (!editingId && !form.criteriaId.trim()) return toast.error('Unique ID is required');

        setSaving(true);
        try {
            let currentConfigId = configId;
            if (!currentConfigId) {
                const createRes = await jobReadinessAPI.createConfig({
                    school: selectedSchool,
                    criteria: []
                });
                currentConfigId = createRes.data._id;
                setConfigId(currentConfigId);
            }

            const dataToSend = {
                criteriaId: form.criteriaId.trim(),
                name: form.name.trim(),
                description: form.description.trim(),
                type: form.type,
                pocCommentRequired: form.pocCommentRequired,
                pocCommentTemplate: form.pocCommentTemplate.trim(),
                pocRatingRequired: form.pocRatingRequired,
                pocRatingScale: form.pocRatingScale,
                category: form.category,
                isMandatory: form.isMandatory,
                targetSchools: form.targetSchools
            };

            if (editingId) {
                await jobReadinessAPI.editCriterion(currentConfigId, editingId, dataToSend);
                toast.success('Criterion updated successfully');
            } else {
                await jobReadinessAPI.addCriterion(currentConfigId, dataToSend);
                toast.success('New criterion added successfully');
            }

            setShowModal(false);
            fetchConfig();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const groupedCriteria = categories.map(cat => ({
        ...cat,
        items: criteria.filter(c => c.category === cat.value)
    })).filter(group => group.items.length > 0 || group.value === 'other');

    const StudentViewPreview = ({ criterion, onClose }) => {
        if (!criterion) return null;

        return (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Eye className="w-5 h-5" /> Student View Preview
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50/30">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    {criterion.name}
                                    {criterion.isMandatory && <span className="text-rose-500 text-sm">*</span>}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">{criterion.description}</p>
                            </div>
                            <Badge variant="outline" className="capitalize text-[10px]">{criterion.type}</Badge>
                        </div>

                        <div className="mt-4">
                            {criterion.type === 'yes/no' && (
                                <div className="flex gap-3">
                                    <button className="flex-1 py-2 px-4 rounded-lg bg-green-100 text-green-700 font-medium border border-green-200">Yes</button>
                                    <button className="flex-1 py-2 px-4 rounded-lg bg-white text-gray-600 font-medium border border-gray-200">No</button>
                                </div>
                            )}

                            {criterion.type === 'answer' && (
                                <input className="input w-full bg-white" placeholder="Enter your answer..." disabled />
                            )}

                            {criterion.type === 'link' && (
                                <div className="relative">
                                    <input className="input w-full bg-white pl-10" placeholder="https://..." disabled />
                                    <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                            )}

                            {criterion.type === 'comment' && (
                                <textarea className="input w-full bg-white" rows={3} placeholder="Enter your response..." disabled />
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-indigo-100/50">
                            <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium mb-3">
                                <CheckCircle2 className="w-4 h-4" /> PoC Feedback (After Review)
                            </div>
                            <div className="space-y-3">
                                {criterion.pocRatingRequired && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 font-bold uppercase tracking-tighter">Rating:</span>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(n => (
                                                <div key={n} className="w-6 h-6 rounded bg-gray-100 border border-gray-200"></div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {criterion.pocCommentRequired && (
                                    <div className="p-3 bg-white rounded-lg border border-gray-100 text-sm text-gray-500 italic">
                                        {criterion.pocCommentTemplate || "PoC's feedback will appear here..."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fadeIn">
            {/* Sidebar: School Selection */}
            <div className="lg:col-span-1 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Manage by School</h3>
                <div className="space-y-1">
                    {schools.map(school => (
                        <button
                            key={school}
                            onClick={() => setSelectedSchool(school)}
                            className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl transition-all duration-200 group ${selectedSchool === school
                                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200 shadow-sm'
                                : 'bg-white text-gray-600 border-2 border-transparent hover:bg-gray-50 hover:border-gray-200'
                                }`}
                        >
                            <span className="font-semibold text-sm truncate">{school}</span>
                            <ChevronRight className={`w-4 h-4 transition-transform ${selectedSchool === school ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                        </button>
                    ))}
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-6">
                    <h4 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" /> System Info
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        Changes made here directly affect students' Job Readiness trackers for the selected school. Use Preview to verify formatting.
                    </p>
                </div>
            </div>

            {/* Main Content: Criteria List */}
            <div className="lg:col-span-3 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">{selectedSchool} Track</h2>
                    <button
                        onClick={openAddModal}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Add Criterion
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-gray-100">
                        <LoadingSpinner size="lg" />
                        <p className="text-gray-400 mt-4 animate-pulse">Syncing track details...</p>
                    </div>
                ) : criteria.length === 0 ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
                        <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No track defined yet</h3>
                        <p className="text-gray-500 mb-6">Create the first readiness milestone for this school.</p>
                        <button onClick={openAddModal} className="text-indigo-600 font-bold hover:underline">+ Get Started</button>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groupedCriteria.map((group) => (
                            <div key={group.value} className="space-y-4">
                                <div className="flex items-center gap-3 px-2">
                                    <div className={`w-1.5 h-6 rounded-full bg-${group.color}-500`}></div>
                                    <h3 className="text-lg font-bold text-gray-900">{group.label}</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
                                        {group.items.length} Items
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {group.items.map((crit) => (
                                        <div key={crit.criteriaId} className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col h-full">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-gray-900 text-sm">{crit.name}</h4>
                                                        {crit.isMandatory && <span className="text-rose-500" title="Mandatory">*</span>}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline" className="text-[9px] py-0 px-1.5 uppercase tracking-tighter">{crit.type}</Badge>
                                                        {crit.pocRatingRequired && <Badge variant="info" className="text-[9px] py-0 px-1.5 uppercase tracking-tighter">Rating Req.</Badge>}
                                                        {(crit.isSharedFromCommon || crit.isSourceCommon) && <Badge variant="warning" className="text-[9px] py-0 px-1.5 uppercase tracking-tighter">Direct Common</Badge>}
                                                        {crit.isSharedFrom && <Badge variant="purple" className="text-[9px] py-0 px-1.5 uppercase tracking-tighter">Shared: {crit.isSharedFrom}</Badge>}
                                                        {crit.targetSchools?.length > 0 && <Badge variant="amber" className="text-[9px] py-0 px-1.5 uppercase tracking-tighter">Shared with {crit.targetSchools.length}</Badge>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all md:translate-x-2 md:group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => { setPreviewCriteria(crit); setShowPreview(true); }}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {(!crit.isSharedFromCommon && !crit.isSharedFrom) && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(crit)}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(crit)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                                                {crit.description || 'No description provided.'}
                                            </p>

                                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                                                <div>
                                                    <span>ID: {crit.criteriaId}</span>
                                                    {crit.targetSchools?.length > 0 && <span className="ml-2 text-amber-600">→ {crit.targetSchools.join(', ')}</span>}
                                                </div>
                                                {crit.pocCommentRequired && <span className="text-indigo-500">Feedback Needed</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Overlay */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="max-w-lg w-full animate-in zoom-in-95 duration-200">
                        <StudentViewPreview
                            criterion={previewCriteria}
                            onClose={() => setShowPreview(false)}
                        />
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Edit Criterion' : 'New Criterion'}</h2>
                                <p className="text-sm text-gray-500 mt-1">Define requirements for {selectedSchool}</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-white rounded-xl transition text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-100 shadow-sm"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Unique Identifier</label>
                                    <input
                                        className="input w-full bg-gray-50"
                                        placeholder="e.g. mock_interview_final"
                                        value={form.criteriaId}
                                        onChange={e => setForm({ ...form, criteriaId: e.target.value })}
                                        disabled={!!editingId}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Display Name</label>
                                    <input
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="e.g. Communication Test"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Description & Guide</label>
                                    <textarea
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        placeholder="Explain what the student needs to submit..."
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Input Type</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    >
                                        {criteriaTypes.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm({ ...form, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2 p-6 bg-indigo-50/50 rounded-2xl space-y-6 border border-indigo-100/50">
                                    <h4 className="text-sm font-extrabold text-indigo-900 border-b border-indigo-100 pb-3 flex items-center gap-2 uppercase tracking-wide">
                                        <CheckSquare className="w-4 h-4" /> Rules & PoC Feedback
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-300 transition shadow-sm">
                                            <input
                                                type="checkbox"
                                                checked={form.isMandatory}
                                                onChange={e => setForm({ ...form, isMandatory: e.target.checked })}
                                                className="w-5 h-5 rounded-lg text-indigo-600 border-gray-200 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-bold text-gray-700">Mandatory Item</span>
                                        </label>

                                        <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-300 transition shadow-sm">
                                            <input
                                                type="checkbox"
                                                checked={form.pocRatingRequired}
                                                onChange={e => setForm({ ...form, pocRatingRequired: e.target.checked })}
                                                className="w-5 h-5 rounded-lg text-indigo-600 border-gray-200 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-bold text-gray-700">Numeric Rating (1-4)</span>
                                        </label>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-indigo-300 transition shadow-sm">
                                            <input
                                                type="checkbox"
                                                checked={form.pocCommentRequired}
                                                onChange={e => setForm({ ...form, pocCommentRequired: e.target.checked })}
                                                className="w-5 h-5 rounded-lg text-indigo-600 border-gray-200 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-bold text-gray-700">Require Detailed Feedback</span>
                                        </label>

                                        {form.pocCommentRequired && (
                                            <div className="animate-in slide-in-from-top-2 duration-200 px-1">
                                                <textarea
                                                    className="input w-full text-sm bg-white"
                                                    placeholder="Guide the PoC on what to comment on... (Optional)"
                                                    value={form.pocCommentTemplate}
                                                    onChange={e => setForm({ ...form, pocCommentTemplate: e.target.value })}
                                                    rows={2}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* School Visibility Section */}
                                <div className="md:col-span-2 p-6 bg-amber-50/50 rounded-2xl space-y-4 border border-amber-100/50 mt-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-extrabold text-amber-900 flex items-center gap-2 uppercase tracking-wide">
                                            <Users className="w-4 h-4" /> Visibility & Sharing
                                        </h4>
                                        {selectedSchool === 'Common' && <Badge variant="warning">Global Roadmap</Badge>}
                                    </div>

                                    <p className="text-xs text-amber-700 mb-2">
                                        {selectedSchool === 'Common'
                                            ? "Criteria in the Common track are visible to ALL schools by default."
                                            : "Mark which other schools should follow this criterion."
                                        }
                                    </p>

                                    {selectedSchool !== 'Common' && (
                                        <div className="flex flex-wrap gap-2">
                                            {schools.filter(s => s !== 'Common' && s !== selectedSchool).map(schoolName => (
                                                <button
                                                    key={schoolName}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = form.targetSchools || [];
                                                        if (current.includes(schoolName)) {
                                                            setForm({ ...form, targetSchools: current.filter(s => s !== schoolName) });
                                                        } else {
                                                            setForm({ ...form, targetSchools: [...current, schoolName] });
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${form.targetSchools?.includes(schoolName)
                                                        ? 'bg-amber-600 text-white shadow-md'
                                                        : 'bg-white text-amber-700 border border-amber-200 hover:border-amber-400'
                                                        }`}
                                                >
                                                    {form.targetSchools?.includes(schoolName) ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                    {schoolName}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedSchool === 'Common' && (
                                        <div className="p-3 bg-white/50 rounded-lg text-[10px] text-amber-800 font-medium italic border border-amber-100">
                                            Common criteria are automatically distributed to all active student profiles.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-3xl sticky bottom-0">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-gray-600 font-bold hover:bg-white rounded-xl transition">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition shadow-xl shadow-gray-200 flex items-center gap-2"
                            >
                                {saving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                                {editingId ? 'Save Changes' : 'Create Criterion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnifiedJobReadiness;
