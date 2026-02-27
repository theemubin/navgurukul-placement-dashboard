import { useState, useEffect, useRef, useMemo } from 'react';
import { questionAPI, jobAPI, applicationAPI } from '../../services/api';
import {
    Trash2, CheckCircle, MessageCircle, Building2,
    ChevronRight, Search, Send, Globe, Users, Phone,
    Mail, Clock, AlertCircle, Inbox, Calendar, Briefcase,
    TrendingUp, Filter, ArrowUpCircle, User, Star,
    ChevronDown, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

/* ────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ──────────────────────────────────────────────────────── */

const Avatar = ({ name = '', size = 10, bg = 'bg-primary-100', fg = 'text-primary-700' }) => {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    return (
        <div className={`w-${size} h-${size} rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${bg} ${fg}`}>
            {initials}
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const map = {
        application_stage: { label: 'Applications Open', color: 'bg-green-100 text-green-700 border-green-200' },
        interviewing: { label: 'Interviewing', color: 'bg-blue-100 text-blue-700 border-blue-200' },
        filled: { label: 'Filled', color: 'bg-purple-100 text-purple-700 border-purple-200' },
        closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600 border-gray-200' },
        draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    };
    const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-500 border-gray-200' };
    return (
        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.color}`}>
            {s.label}
        </span>
    );
};

const JourneyStep = ({ event, isLast }) => {
    const icons = {
        created: { icon: '✨', color: 'bg-indigo-100 text-indigo-600' },
        application_stage: { icon: '📋', color: 'bg-green-100 text-green-600' },
        interviewing: { icon: '🎤', color: 'bg-blue-100 text-blue-600' },
        filled: { icon: '🏆', color: 'bg-purple-100 text-purple-600' },
        closed: { icon: '🔒', color: 'bg-gray-100 text-gray-500' },
    };
    const cfg = icons[event.event] || { icon: '•', color: 'bg-gray-100 text-gray-500' };
    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full text-sm flex items-center justify-center shrink-0 ${cfg.color}`}>
                    {cfg.icon}
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1" />}
            </div>
            <div className="pb-4 min-w-0">
                <p className="text-xs font-bold text-gray-800 capitalize leading-tight">
                    {(event.event || '').replace(/_/g, ' ')}
                </p>
                {event.description && (
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{event.description}</p>
                )}
                <p className="text-[10px] text-gray-300 mt-0.5">
                    {event.createdAt ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }) : ''}
                </p>
            </div>
        </div>
    );
};

const AnswerInput = ({ onSubmit, submitting }) => {
    const [val, setVal] = useState('');
    const ref = useRef();
    const submit = async (e) => {
        e?.preventDefault();
        if (!val.trim() || submitting) return;
        await onSubmit(val.trim());
        setVal('');
        ref.current?.focus();
    };
    return (
        <form onSubmit={submit} className="flex items-end gap-2">
            <div className="flex-1 relative">
                <textarea
                    ref={ref}
                    rows={1}
                    value={val}
                    onChange={e => {
                        setVal(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    placeholder="Type your reply… (Enter to send)"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none leading-relaxed shadow-sm transition-all"
                />
            </div>
            <button
                type="submit"
                disabled={!val.trim() || submitting}
                className="w-9 h-9 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all shadow-md shrink-0"
            >
                <Send className="w-4 h-4" />
            </button>
        </form>
    );
};

/* ────────────────────────────────────────────────────────
   RIGHT PANEL: Company Quick-Peek
   ──────────────────────────────────────────────────────── */
const CompanyPanel = ({ companyName, questions, jobs }) => {
    // Find all jobs for this company
    const companyJobs = jobs.filter(j =>
        (j.company?.name || '').toLowerCase() === (companyName || '').toLowerCase()
    );

    // Aggregate stats
    const totalApplicants = companyJobs.reduce((s, j) => s + (j.applicantCount || 0), 0);
    const openJobs = companyJobs.filter(j => j.status === 'application_stage').length;
    const pendingQ = questions.filter(q => !q.answer).length;

    // Company info from first job
    const job0 = companyJobs[0] || {};
    const company = job0.company || {};
    const coordinator = job0.coordinator;

    return (
        <aside className="w-72 bg-white border-l border-gray-100 flex flex-col overflow-y-auto shrink-0">
            {/* Header */}
            <div className="p-5 bg-gradient-to-br from-primary-50 to-indigo-50 border-b border-gray-100">
                <div className="flex flex-col items-center text-center gap-3">
                    {company.logo ? (
                        <img src={company.logo} alt={company.name} className="w-14 h-14 rounded-2xl object-contain bg-white border border-gray-100 shadow-sm p-1" />
                    ) : (
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
                            <Building2 className="w-7 h-7 text-primary-400" />
                        </div>
                    )}
                    <div>
                        <h2 className="font-extrabold text-gray-900 text-sm leading-tight">{companyName}</h2>
                        {company.website && (
                            <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary-500 hover:text-primary-700 flex items-center justify-center gap-1 mt-1 transition-colors"
                            >
                                <Globe className="w-3 h-3" />
                                {company.website.replace(/^https?:\/\//, '').split('/')[0]}
                            </a>
                        )}
                    </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                        { label: 'Jobs', val: companyJobs.length, color: 'text-indigo-600' },
                        { label: 'Applicants', val: totalApplicants, color: 'text-green-600' },
                        { label: 'Pending Q', val: pendingQ, color: pendingQ > 0 ? 'text-amber-600' : 'text-gray-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/80 rounded-xl p-2.5 text-center border border-white/60">
                            <p className={`text-lg font-extrabold leading-none ${s.color}`}>{s.val}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* PoC details from first job */}
                {(company.pocName || company.pocContact || company.pocEmail) && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Point of Contact</p>
                        {company.pocName && (
                            <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{company.pocName}</p>
                                    {company.pocRole && <p className="text-[10px] text-gray-400">{company.pocRole}</p>}
                                </div>
                            </div>
                        )}
                        {company.pocContact && (
                            <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl">
                                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="text-xs text-gray-600">{company.pocContact}</span>
                            </div>
                        )}
                        {company.pocEmail && (
                            <a href={`mailto:${company.pocEmail}`} className="flex items-center gap-2.5 p-2.5 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors group">
                                <Mail className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 shrink-0" />
                                <span className="text-xs text-gray-600 truncate">{company.pocEmail}</span>
                            </a>
                        )}
                    </div>
                )}

                {/* Coordinator Lead */}
                {coordinator && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Coordinator Lead</p>
                        <div className="flex items-center gap-2.5 p-2.5 bg-primary-50 rounded-xl border border-primary-100">
                            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center text-white text-[10px] font-extrabold shrink-0">
                                {[coordinator.firstName, coordinator.lastName].map(n => n?.[0] || '').join('')}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-primary-800 truncate">
                                    {[coordinator.firstName, coordinator.lastName].filter(Boolean).join(' ')}
                                </p>
                                <p className="text-[10px] text-primary-500 truncate">{coordinator.email}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Active Jobs with deadline */}
                {companyJobs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Active Postings</p>
                        {companyJobs.map(job => {
                            const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
                            const isExpired = deadline && isPast(deadline);
                            return (
                                <div key={job._id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-bold text-gray-800 leading-tight flex-1">{job.title}</p>
                                        <StatusBadge status={job.status} />
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {deadline && (
                                            <div className={`flex items-center gap-1 text-[10px] font-bold ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                                                <Calendar className="w-3 h-3" />
                                                {isExpired ? 'Expired ' : 'Deadline '}
                                                {format(deadline, 'MMM d')}
                                            </div>
                                        )}
                                        {job.applicantCount != null && (
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                <Users className="w-3 h-3" />
                                                {job.applicantCount} applied
                                            </div>
                                        )}
                                        {job.maxPositions && (
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                <Briefcase className="w-3 h-3" />
                                                {job.maxPositions} seat{job.maxPositions > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Job Journey / Timeline from first job */}
                {job0.timeline?.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> Job Journey
                        </p>
                        <div className="space-y-0">
                            {[...job0.timeline].reverse().slice(0, 6).map((event, i, arr) => (
                                <JourneyStep key={i} event={event} isLast={i === arr.length - 1} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback when no company data */}
                {!company.pocName && !company.website && companyJobs.length === 0 && (
                    <div className="flex flex-col items-center py-8 text-center">
                        <AlertCircle className="w-8 h-8 text-gray-200 mb-2" />
                        <p className="text-xs text-gray-400">No company profile data yet.<br />Create a job for this company first.</p>
                    </div>
                )}
            </div>
        </aside>
    );
};

/* ────────────────────────────────────────────────────────
   MAIN FORUM COMPONENT
   ──────────────────────────────────────────────────────── */
const CoordinatorForum = () => {
    const { user } = useAuth() || {};
    const [questions, setQuestions] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [filter, setFilter] = useState('all');   // 'all' | 'unread' | 'my'
    const chatEndRef = useRef();

    useEffect(() => { fetchAll(); }, []);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedCompany]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [qRes, jRes] = await Promise.all([
                questionAPI.getQuestions(),
                jobAPI.getJobs({ limit: 200 }),
            ]);
            setQuestions(qRes.data || []);
            setJobs(jRes.data?.jobs || jRes.data || []);
        } catch {
            toast.error('Failed to load forum data');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this question?')) return;
        try {
            await questionAPI.deleteQuestion(id);
            toast.success('Deleted');
            setQuestions(prev => prev.filter(q => q._id !== id));
        } catch { toast.error('Failed to delete'); }
    };

    const handleAnswer = async (id, answer) => {
        setSubmitting(true);
        try {
            await questionAPI.answerQuestion(id, answer);
            toast.success('Reply sent!');
            await fetchAll();
        } catch { toast.error('Failed to send reply'); }
        finally { setSubmitting(false); }
    };

    /* Group questions by company */
    const grouped = useMemo(() => questions.reduce((acc, q) => {
        const key = q.companyName || 'General';
        if (!acc[key]) acc[key] = [];
        acc[key].push(q);
        return acc;
    }, {}), [questions]);

    /* Get coordinator id to filter "my leads" */
    const myJobCompanies = useMemo(() => {
        if (!user?._id) return new Set();
        return new Set(
            jobs
                .filter(j => {
                    const cid = j.coordinator?._id || j.coordinator;
                    return String(cid) === String(user._id);
                })
                .map(j => (j.company?.name || '').toLowerCase())
        );
    }, [jobs, user]);

    const pendingTotal = questions.filter(q => !q.answer).length;

    /* Filtered + sorted thread list */
    const threadList = useMemo(() => {
        return Object.entries(grouped)
            .filter(([name, qs]) => {
                if (!name.toLowerCase().includes(search.toLowerCase())) return false;
                if (filter === 'unread') return qs.some(q => !q.answer);
                if (filter === 'my') return myJobCompanies.has(name.toLowerCase());
                return true;
            })
            .sort((a, b) => {
                // unread first
                const ua = a[1].filter(q => !q.answer).length;
                const ub = b[1].filter(q => !q.answer).length;
                if (ub !== ua) return ub - ua;
                // then by latest message
                const la = Math.max(...a[1].map(q => new Date(q.createdAt)));
                const lb = Math.max(...b[1].map(q => new Date(q.createdAt)));
                return lb - la;
            });
    }, [grouped, search, filter, myJobCompanies]);

    const activeThread = useMemo(() =>
        selectedCompany
            ? [...(grouped[selectedCompany] || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            : [],
        [grouped, selectedCompany]
    );

    const activePending = activeThread.filter(q => !q.answer).length;

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">

            {/* ══════════════════════════════════════════
          LEFT SIDEBAR — Thread list
          ══════════════════════════════════════════ */}
            <aside className={`
        w-full md:w-80 bg-white border-r border-gray-100 flex flex-col shrink-0
        ${selectedCompany ? 'hidden md:flex' : 'flex'}
      `}>
                {/* Top bar */}
                <div className="p-4 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-extrabold text-gray-900 leading-none">Forum</h1>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Student Q&amp;A</p>
                            </div>
                        </div>
                        {pendingTotal > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                {pendingTotal}
                            </span>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative mb-2.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search companies…"
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-xl text-xs border-0 focus:ring-2 focus:ring-primary-300 focus:outline-none text-gray-700 placeholder:text-gray-300"
                        />
                    </div>

                    {/* Filter pills */}
                    <div className="flex gap-1.5">
                        {[
                            { id: 'all', label: 'All', icon: <Inbox className="w-3 h-3" /> },
                            { id: 'unread', label: 'Unread', icon: <ArrowUpCircle className="w-3 h-3" /> },
                            { id: 'my', label: 'My Leads', icon: <Star className="w-3 h-3" /> },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all ${filter === f.id
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                {f.icon} {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Thread list */}
                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                        </div>
                    ) : threadList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Inbox className="w-10 h-10 text-gray-100 mb-3" />
                            <p className="text-xs font-semibold text-gray-400">No threads found</p>
                            <p className="text-[10px] text-gray-300 mt-1">
                                {filter === 'my' ? 'No questions for your leads yet' : 'Student questions appear here'}
                            </p>
                        </div>
                    ) : threadList.map(([company, qs]) => {
                        const unread = qs.filter(q => !q.answer).length;
                        const last = [...qs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                        const isActive = selectedCompany === company;
                        const isMine = myJobCompanies.has(company.toLowerCase());

                        return (
                            <button
                                key={company}
                                onClick={() => setSelectedCompany(company)}
                                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                  ${isActive
                                        ? 'bg-primary-50 border border-primary-100'
                                        : 'hover:bg-gray-50 border border-transparent'
                                    }
                `}
                            >
                                {/* Avatar with unread badge */}
                                <div className="relative shrink-0">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-extrabold ${unread > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {company.slice(0, 2).toUpperCase()}
                                    </div>
                                    {unread > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-extrabold text-white flex items-center justify-center">
                                            {unread}
                                        </span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <p className={`text-xs font-extrabold truncate ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                                            {company}
                                            {isMine && <span className="ml-1 text-[8px] font-extrabold text-primary-400 bg-primary-50 px-1 py-0.5 rounded-full uppercase">Lead</span>}
                                        </p>
                                        <span className="text-[9px] text-gray-300 shrink-0 font-medium">
                                            {formatDistanceToNow(new Date(last.createdAt), { addSuffix: false })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{last.question}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {unread > 0
                                            ? <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">⚡ {unread} pending</span>
                                            : <span className="text-[9px] font-extrabold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">✓ resolved</span>
                                        }
                                        <span className="text-[9px] text-gray-300">{qs.length} msgs</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* ══════════════════════════════════════════
          CENTER — Chat thread
          ══════════════════════════════════════════ */}
            <main className={`
        flex-1 flex flex-col overflow-hidden min-w-0
        ${!selectedCompany ? 'hidden md:flex' : 'flex'}
      `}>
                {!selectedCompany ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-50">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-5 shadow-sm border border-gray-100">
                            <MessageCircle className="w-8 h-8 text-primary-200" />
                        </div>
                        <h2 className="text-lg font-extrabold text-gray-800 mb-1">Select a conversation</h2>
                        <p className="text-sm text-gray-400 max-w-xs">Pick a company thread from the left to view and reply to student questions.</p>
                    </div>
                ) : (
                    <>
                        {/* Thread header */}
                        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100">
                            <button
                                onClick={() => setSelectedCompany(null)}
                                className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </button>
                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-extrabold ${activePending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-primary-100 text-primary-700'
                                }`}>
                                {selectedCompany.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-extrabold text-gray-900 text-sm truncate">{selectedCompany}</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    {activeThread.length} questions ·&nbsp;
                                    {activePending > 0
                                        ? <span className="text-amber-500">{activePending} awaiting reply</span>
                                        : <span className="text-green-500">All resolved</span>
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 bg-gray-50">
                            {activeThread.map((q, idx) => {
                                const studentName = [q.student?.firstName, q.student?.lastName].filter(Boolean).join(' ') || 'Student';
                                const showDateDivider = idx === 0 ||
                                    new Date(q.createdAt).toDateString() !== new Date(activeThread[idx - 1].createdAt).toDateString();

                                return (
                                    <div key={q._id} className="space-y-2">
                                        {showDateDivider && (
                                            <div className="flex items-center gap-3 my-2">
                                                <div className="flex-1 h-px bg-gray-200" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    {format(new Date(q.createdAt), 'MMMM d, yyyy')}
                                                </span>
                                                <div className="flex-1 h-px bg-gray-200" />
                                            </div>
                                        )}

                                        {/* Student bubble — LEFT */}
                                        <div className="flex items-end gap-2.5 max-w-[82%]">
                                            <div className="w-8 h-8 bg-gray-200 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-gray-500 shrink-0">
                                                {studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-[11px] font-bold text-gray-700">{studentName}</span>
                                                    <span className="text-[10px] text-gray-400">{format(new Date(q.createdAt), 'h:mm a')}</span>
                                                    {q.jobTitle && (
                                                        <span className="text-[9px] font-extrabold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                                                            {q.jobTitle}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                                    <p className="text-sm text-gray-800 leading-relaxed">{q.question}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(q._id)}
                                                    className="flex items-center gap-1 mt-1 ml-1 text-[9px] font-bold text-gray-200 hover:text-red-400 transition-colors uppercase tracking-widest"
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" /> delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* Answer — RIGHT or pending form */}
                                        {q.answer ? (
                                            <div className="flex items-end gap-2.5 justify-end">
                                                <div className="max-w-[82%]">
                                                    <div className="flex items-baseline justify-end gap-2 mb-1">
                                                        <span className="text-[10px] text-gray-400">{format(new Date(q.answeredAt || q.updatedAt), 'h:mm a')}</span>
                                                        <span className="text-[11px] font-bold text-primary-600">You</span>
                                                    </div>
                                                    <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md shadow-primary-100">
                                                        <p className="text-sm leading-relaxed">{q.answer}</p>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                                                        <CheckCircle className="w-3 h-3 text-green-400" />
                                                        <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Resolved</span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-white shrink-0">
                                                    CO
                                                </div>
                                            </div>
                                        ) : (
                                            /* Inline pending reply form — nested under the question */
                                            <div className="ml-10">
                                                <div className="bg-amber-50 border border-amber-200 border-dashed rounded-2xl p-3.5 space-y-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                                        <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest">Pending your reply</span>
                                                        <span className="text-[10px] text-amber-300">·</span>
                                                        <span className="text-[10px] text-amber-400">
                                                            {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <AnswerInput onSubmit={(ans) => handleAnswer(q._id, ans)} submitting={submitting} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                    </>
                )}
            </main>

            {/* ══════════════════════════════════════════
          RIGHT PANEL — always visible when company selected
          ══════════════════════════════════════════ */}
            {selectedCompany && (
                <CompanyPanel
                    companyName={selectedCompany}
                    questions={activeThread}
                    jobs={jobs}
                />
            )}
        </div>
    );
};

export default CoordinatorForum;
