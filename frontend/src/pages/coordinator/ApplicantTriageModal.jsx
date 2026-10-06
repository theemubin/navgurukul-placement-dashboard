import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    X, CheckCircle, XCircle, Pause, ArrowRight, User,
    MapPin, GraduationCap, FileText, AlertCircle, Search,
    ChevronRight, MessageSquare, Briefcase, Copy, Loader2, Check
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const LocalCommentArea = ({ initialValue, onSave, onCopyToColumn, bucket, placeholder, isExiting }) => {
    const [val, setVal] = useState(initialValue || '');
    const [isCopying, setIsCopying] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        setVal(initialValue || '');
    }, [initialValue]);

    const handleBlur = () => {
        onSave(val);
    };

    const handleCopyClick = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const text = val.trim();
        if (!text) {
            toast.error('Please enter a comment before copying to column.');
            return;
        }
        onSave(text);
        setIsCopying(true);
        try {
            const success = await onCopyToColumn(text);
            if (success) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 1500);
            }
        } finally {
            setIsCopying(false);
        }
    };

    const bucketLabels = {
        promote: 'Promote',
        hold: 'Hold',
        exit: 'Exit'
    };
    const colName = bucketLabels[bucket] || 'column';

    return (
        <div className="flex items-center gap-1.5">
            <textarea
                rows={1}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder}
                className={`flex-1 text-xs p-1.5 border rounded resize-none focus:ring-1 focus:ring-primary-500 ${
                    isExiting && !val.trim() ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200'
                }`}
            />
            <button
                type="button"
                onClick={handleCopyClick}
                disabled={isCopying}
                title={`Copy this comment to all candidates in ${colName}`}
                className={`shrink-0 px-2 py-1.5 rounded border transition-all flex items-center gap-1 text-[10px] font-semibold ${
                    isCopied
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : isCopying
                        ? 'border-primary-300 bg-primary-50 text-primary-700 cursor-wait'
                        : 'border-gray-200 text-gray-500 hover:text-primary-600 hover:bg-primary-50 active:bg-primary-100 hover:border-primary-300'
                }`}
            >
                {isCopying ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin text-primary-600" />
                        <span>Copying...</span>
                    </>
                ) : isCopied ? (
                    <>
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Copied!</span>
                    </>
                ) : (
                    <>
                        <Copy className="w-3 h-3" />
                        <span>To column</span>
                    </>
                )}
            </button>
        </div>
    );
};

const StudentCard = React.memo(({
    app,
    index,
    isSelected,
    selectedCount,
    isExiting = false,
    isCopyingColumn,
    currentStatusLabel,
    targetRoundOrStatusLabel,
    onToggleSelect,
    onUpdateComment,
    onCopyToColumn
}) => {
    return (
        <Draggable draggableId={app._id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`bg-white border rounded-xl p-2.5 mb-2 shadow-sm transition-all duration-200 ${
                        snapshot.isDragging
                            ? 'shadow-xl ring-2 ring-primary-500 opacity-95 scale-105 z-50'
                            : 'hover:border-primary-300'
                    } ${
                        isExiting && !app.comment?.trim() ? 'border-red-200 bg-red-50/50' : 'border-gray-100'
                    } ${
                        isSelected ? 'ring-2 ring-primary-400 bg-primary-50/30 border-primary-300' : ''
                    } ${
                        isCopyingColumn ? 'ring-2 ring-primary-500 bg-primary-50/70 shadow-md animate-pulse' : ''
                    }`}
                >
                    <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="flex items-start gap-2 min-w-0">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelect(app._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer shrink-0"
                                aria-label={`Select ${app.student?.firstName || 'applicant'}`}
                            />
                            <div className="min-w-0">
                                <h5 className="font-bold text-gray-900 text-[13px] leading-tight truncate">
                                    {app.student?.firstName} {app.student?.lastName}
                                </h5>
                                <p className="text-[10px] text-gray-400 truncate tracking-tight">{app.student?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {snapshot.isDragging && isSelected && selectedCount > 1 && (
                                <span className="bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                                    +{selectedCount - 1} more
                                </span>
                            )}
                            <div className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black tracking-tighter shrink-0 ${
                                app.matchPercentage >= 80 ? 'bg-green-50 text-green-700 border border-green-100' :
                                app.matchPercentage >= 60 ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    'bg-gray-50 text-gray-600 border border-gray-100'
                            }`}>
                                {app.matchPercentage || 0}%
                            </div>
                        </div>
                    </div>

                    {/* Current Student Stage Badge */}
                    <div className="flex items-center gap-1.5 mb-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                            <span className="truncate">Current: {currentStatusLabel} {app.currentRound ? `(R${app.currentRound})` : ''}</span>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <div className="flex items-center gap-1 text-[9px] font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded-full border border-gray-100">
                            <MapPin className="w-2.5 h-2.5" />
                            {app.student?.campus?.name?.split(' ')[0] || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded-full border border-gray-100">
                            <GraduationCap className="w-2.5 h-2.5" />
                            {app.student?.currentModule || 'N/A'}
                        </div>
                    </div>

                    {app.bucket === 'promote' && (
                        <div className="mb-2">
                            {currentStatusLabel === targetRoundOrStatusLabel ? (
                                <div className="flex items-center gap-1 text-[9px] font-black text-primary-600 uppercase tracking-tight bg-primary-50/50 p-1.5 rounded-lg border border-primary-100/50">
                                    <CheckCircle className="w-3 h-3" />
                                    Advancing To {targetRoundOrStatusLabel}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-[9px] font-black text-green-700 bg-green-50/50 p-1.5 rounded-lg border border-green-100/50">
                                    <span className="opacity-50 line-through truncate max-w-[60px]">{currentStatusLabel}</span>
                                    <ArrowRight className="w-3 h-3 text-green-400" />
                                    <span className="truncate">{targetRoundOrStatusLabel}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {app.bucket === 'exit' && (
                        <div className="flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-50/50 p-1.5 rounded-lg mb-2 border border-red-100/50">
                            <span className="opacity-50 line-through truncate max-w-[60px]">{currentStatusLabel}</span>
                            <ArrowRight className="w-3 h-3 text-red-400" />
                            <span>REJECT</span>
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-50">
                        <LocalCommentArea
                            initialValue={app.comment}
                            onSave={(val) => onUpdateComment(app._id, val)}
                            onCopyToColumn={(val) => onCopyToColumn(app.bucket, val)}
                            bucket={app.bucket}
                            placeholder={isExiting ? "Why reject?" : "Add note..."}
                            isExiting={isExiting}
                        />
                    </div>
                </div>
            )}
        </Draggable>
    );
});

const ApplicantTriageModal = ({
    isOpen,
    onClose,
    job,
    applicants: initialApplicants,
    targetStatus,
    pipelineStages = [],
    onConfirm,
    isApplying,
    isLoading = false
}) => {
    const [applicants, setApplicants] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('triage'); // 'triage' or 'preview'
    const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
    const [discordThreadId, setDiscordThreadId] = useState('');
    const [activeTab, setActiveTab] = useState('promote');
    const [selectedIds, setSelectedIds] = useState([]);
    const [copyingBucket, setCopyingBucket] = useState(null);

    const toggleSelected = useCallback((appId) => {
        setSelectedIds(prev => prev.includes(appId)
            ? prev.filter(id => id !== appId)
            : [...prev, appId]);
    }, []);

    const copyCommentToColumn = useCallback(async (targetBucket, commentText) => {
        const comment = (commentText || '').trim();
        if (!comment) {
            toast.error('Enter a comment before copying to column.');
            return false;
        }

        const bucketNames = {
            promote: 'Promote',
            hold: 'Hold',
            exit: 'Exit'
        };
        const colLabel = bucketNames[targetBucket] || targetBucket;

        // Calculate count directly from current state so count is never 0!
        const matchingApps = applicants.filter(app => app.bucket === targetBucket);
        const affectedCount = matchingApps.length;

        if (affectedCount === 0) {
            toast.error(`No candidates currently in ${colLabel}.`);
            return false;
        }

        // Show brief column pulse animation
        setCopyingBucket(targetBucket);

        // Apply comment updates across all matching candidates
        setApplicants(prev => prev.map(app =>
            app.bucket === targetBucket ? { ...app, comment } : app
        ));

        // Let pulse highlight show briefly, then clear
        setTimeout(() => {
            setCopyingBucket(null);
        }, 400);

        toast.success(`Copied comment to all ${affectedCount} candidate${affectedCount > 1 ? 's' : ''} in ${colLabel}.`);
        return true;
    }, [applicants]);

    // Map job status to label
    const getStatusLabel = useCallback((statusId) => {
        if (!statusId) return 'Applied';
        const stage = pipelineStages.find(s => s.id === statusId);
        if (stage) return stage.label;
        const normalized = statusId.replace(/_/g, ' ');
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }, [pipelineStages]);

    const updateComment = useCallback((appId, comment) => {
        setApplicants(prev => prev.map(app =>
            app._id === appId ? { ...app, comment } : app
        ));
    }, []);

    const targetLabel = getStatusLabel(targetStatus || job?.status);
    const currentLabel = getStatusLabel(job?.status);

    const activeStatus = targetStatus || job?.status;
    const isInterviewingStage = activeStatus === 'interviewing' || activeStatus?.includes('interview');
    const hasInterviewRounds = job?.interviewRounds?.length > 0;
    const targetRoundOrStatusLabel = isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel;

    // Initialize applicants with buckets
    useEffect(() => {
        if (isOpen && initialApplicants) {
            setApplicants(initialApplicants.map(app => ({
                ...app,
                bucket: app._target ? app._target : (app.status === 'rejected' ? 'exit' : 'hold'),
                comment: app._comment || ''
            })));

            // Default to first round or current max round if applicable
            if (hasInterviewRounds) {
                setSelectedRoundIndex(0);
            }

            // Init Discord Thread
            setDiscordThreadId(job?.discordThreadId || '');
            setSelectedIds([]);
        }
    }, [isOpen, initialApplicants, hasInterviewRounds, job?.discordThreadId]);

    // Reset state when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setApplicants([]);
            setSearchTerm('');
            setViewMode('triage');
            setSelectedRoundIndex(0);
            setDiscordThreadId('');
            setActiveTab('promote');
            setSelectedIds([]);
        }
    }, [isOpen]);

    if (!isOpen || !job) return null;

    const filteredApplicants = applicants.filter(app => {
        const name = `${app.student?.firstName} ${app.student?.lastName}`.toLowerCase();
        const email = app.student?.email?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    });

    const onDragEnd = (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        const targetBucket = destination.droppableId;

        // If the dragged applicant is part of multi-selection, move all selected applicants together
        if (selectedIds.includes(draggableId)) {
            const hasChange = applicants.some(
                app => selectedIds.includes(app._id) && app.bucket !== targetBucket
            );
            if (!hasChange) return;

            setApplicants(prev => prev.map(app =>
                selectedIds.includes(app._id)
                    ? { ...app, bucket: targetBucket }
                    : app
            ));
            const count = selectedIds.length;
            setSelectedIds([]);
            toast.success(`Moved ${count} selected applicant${count > 1 ? 's' : ''}`);
        } else {
            // Dragged an unselected applicant: move single card
            if (destination.droppableId === source.droppableId) return;

            setApplicants(prev => prev.map(app =>
                app._id === draggableId
                    ? { ...app, bucket: targetBucket }
                    : app
            ));
        }
    };

    const validateAndShowPreview = () => {
        // Check if any exitee is missing a comment
        const exiteesWithoutComment = applicants.filter(a => a.bucket === 'exit' && !a.comment.trim());

        if (exiteesWithoutComment.length > 0) {
            toast.error(`Please provide feedback for all ${exiteesWithoutComment.length} rejected students. Individual feedback is mandatory for exits.`);
            return;
        }

        const promoteCount = applicants.filter(a => a.bucket === 'promote').length;
        if (promoteCount === 0 && targetStatus && targetStatus !== job.status) {
            const confirm = window.confirm("You are moving the job status forward but haven't promoted any students. Continue?");
            if (!confirm) return;
        }

        setViewMode('preview');
    };

    const handleFinalSubmit = () => {
        onConfirm(applicants, {
            roundIndex: selectedRoundIndex,
            roundName: hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : null,
            discordThreadId
        });
    };

    // Full lists for summary and preview
    const promoteList = applicants.filter(a => a.bucket === 'promote');
    const exitList = applicants.filter(a => a.bucket === 'exit');
    const holdList = applicants.filter(a => a.bucket === 'hold');

    // Filtered lists for the drag & drop workspace
    const filteredPromoteList = filteredApplicants.filter(a => a.bucket === 'promote');
    const filteredExitList = filteredApplicants.filter(a => a.bucket === 'exit');
    const filteredHoldList = filteredApplicants.filter(a => a.bucket === 'hold');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col z-10 shadow-2xl animate-scaleIn">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center shadow-sm">
                            {targetStatus ? <ArrowRight className="w-6 h-6 text-primary-600" /> : <User className="w-6 h-6 text-primary-600" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                Triage Applicants for <span className="text-primary-600">{job.title}</span>
                            </h2>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">
                                    {currentLabel}
                                </span>
                                <ArrowRight className="w-4 h-4" />
                                <span className="flex items-center gap-1 bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-xs font-semibold">
                                    {targetLabel || 'No Job Change'}
                                </span>
                                <span className="ml-2">• {applicants.length} total applicants</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isInterviewingStage && hasInterviewRounds && (
                            <div className="flex flex-col items-end">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Round</label>
                                <select
                                    value={selectedRoundIndex}
                                    onChange={(e) => setSelectedRoundIndex(parseInt(e.target.value))}
                                    className="text-xs font-bold border-2 border-primary-200 rounded-lg px-3 py-1.5 focus:border-primary-500 transition-colors bg-white shadow-sm"
                                >
                                    {job.interviewRounds.map((round, idx) => (
                                        <option key={idx} value={idx}>Round {idx + 1}: {round.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-400"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gray-50 min-h-[400px]">
                        <div className="relative flex items-center justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl border-4 border-primary-200 border-t-primary-600 animate-spin" />
                            <Briefcase className="w-6 h-6 text-primary-600 absolute" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Loading Applicants for Triage...</h3>
                        <p className="text-sm text-gray-500 max-w-sm text-center">
                            Preparing applicant pool, match ratings, and current candidate stages.
                        </p>
                    </div>
                ) : viewMode === 'triage' ? (
                    <>
                        {/* Mobile Tabs for Triage */}
                        <div className="md:hidden flex p-1.5 bg-white border-b sticky top-0 z-20">
                            {[
                                { id: 'promote', label: 'Promote', color: 'green', count: promoteList.length },
                                { id: 'hold', label: 'Hold', color: 'yellow', count: holdList.length },
                                { id: 'exit', label: 'Exit', color: 'red', count: exitList.length }
                            ].map(tab => {
                                const isActive = activeTab === tab.id;
                                const colorMap = {
                                    green: isActive ? 'bg-green-600 text-white shadow-green-100' : 'text-green-600 bg-green-50/50',
                                    yellow: isActive ? 'bg-amber-500 text-white shadow-amber-100' : 'text-amber-600 bg-amber-50/50',
                                    red: isActive ? 'bg-red-600 text-white shadow-red-100' : 'text-red-600 bg-red-50/50'
                                };
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 py-2.5 px-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${colorMap[tab.color]} ${isActive ? 'scale-100 shadow-lg' : 'scale-95 opacity-70'}`}
                                    >
                                        {tab.label}
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Triage Workspace */}
                        <div className="flex-1 p-4 sm:p-6 bg-gray-100 overflow-hidden flex flex-col">
                            {/* Multi-selection banner */}
                            {selectedIds.length > 0 && (
                                <div className="mb-3 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl flex items-center justify-between text-xs animate-fadeIn shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-primary-900">
                                            {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected
                                        </span>
                                        <span className="text-primary-600 hidden sm:inline">
                                            — Drag any selected card to move all together
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIds([])}
                                        className="text-xs font-semibold text-primary-700 hover:text-primary-900 underline"
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            )}

                            <DragDropContext onDragEnd={onDragEnd}>
                                <div className="flex md:flex-row flex-col gap-6 h-[65vh] md:h-[60vh] flex-1 min-h-0">

                                    {/* Column 1: PROMOTE */}
                                    <Droppable droppableId="promote">
                                        {(provided, snapshot) => {
                                            const promoteColIds = filteredPromoteList.map(a => a._id);
                                            const allPromoteSelected = promoteColIds.length > 0 && promoteColIds.every(id => selectedIds.includes(id));

                                            return (
                                                <div className={`flex-1 flex flex-col min-w-0 md:min-w-[320px] ${activeTab !== 'promote' && 'hidden md:flex'}`}>
                                                    <div className="flex items-center justify-between mb-3 px-2">
                                                        <div className="flex items-center gap-2">
                                                            {filteredPromoteList.length > 0 && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allPromoteSelected}
                                                                    onChange={() => {
                                                                        if (allPromoteSelected) {
                                                                            setSelectedIds(prev => prev.filter(id => !promoteColIds.includes(id)));
                                                                        } else {
                                                                            setSelectedIds(prev => [...new Set([...prev, ...promoteColIds])]);
                                                                        }
                                                                    }}
                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                                    title="Select all in this column"
                                                                />
                                                            )}
                                                            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-xs sm:text-sm">
                                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                PROMOTE TO {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name.toUpperCase() : targetLabel.toUpperCase()}
                                                            </h3>
                                                        </div>
                                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                            {promoteList.length}
                                                        </span>
                                                    </div>
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={`flex-1 overflow-y-auto p-2 rounded-xl border-2 border-dashed transition-colors flex flex-col ${snapshot.isDraggingOver ? 'bg-green-50 border-green-300' : 'bg-white/50 border-gray-200'
                                                            }`}
                                                    >
                                                        {filteredPromoteList.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                                                <p className="text-sm">Drag candidates here to advance them</p>
                                                            </div>
                                                        )}
                                                        {filteredPromoteList.map((app, index) => (
                                                            <StudentCard
                                                                key={app._id}
                                                                app={app}
                                                                index={index}
                                                                isSelected={selectedIds.includes(app._id)}
                                                                selectedCount={selectedIds.length}
                                                                isCopyingColumn={copyingBucket === app.bucket}
                                                                currentStatusLabel={getStatusLabel(app.status)}
                                                                targetRoundOrStatusLabel={targetRoundOrStatusLabel}
                                                                onToggleSelect={toggleSelected}
                                                                onUpdateComment={updateComment}
                                                                onCopyToColumn={copyCommentToColumn}
                                                            />
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Droppable>

                                    {/* Column 2: HOLD */}
                                    <Droppable droppableId="hold">
                                        {(provided, snapshot) => {
                                            const holdColIds = filteredHoldList.map(a => a._id);
                                            const allHoldSelected = holdColIds.length > 0 && holdColIds.every(id => selectedIds.includes(id));

                                            return (
                                                <div className={`flex-1 flex flex-col min-w-0 md:min-w-[320px] ${activeTab !== 'hold' && 'hidden md:flex'}`}>
                                                    <div className="flex items-center justify-between mb-3 px-2">
                                                        <div className="flex items-center gap-2">
                                                            {filteredHoldList.length > 0 && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allHoldSelected}
                                                                    onChange={() => {
                                                                        if (allHoldSelected) {
                                                                            setSelectedIds(prev => prev.filter(id => !holdColIds.includes(id)));
                                                                        } else {
                                                                            setSelectedIds(prev => [...new Set([...prev, ...holdColIds])]);
                                                                        }
                                                                    }}
                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                                    title="Select all in this column"
                                                                />
                                                            )}
                                                            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-xs sm:text-sm">
                                                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                                KEEP ON HOLD
                                                            </h3>
                                                        </div>
                                                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                            {holdList.length}
                                                        </span>
                                                    </div>
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={`flex-1 overflow-y-auto p-2 rounded-xl border-2 border-dashed transition-colors flex flex-col ${snapshot.isDraggingOver ? 'bg-yellow-50 border-yellow-300' : 'bg-white/50 border-gray-200'
                                                            }`}
                                                    >
                                                        {filteredHoldList.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                                <Pause className="w-12 h-12 mb-3 opacity-20" />
                                                                <p className="text-sm">Candidates dropped here won't change status</p>
                                                            </div>
                                                        )}
                                                        {filteredHoldList.map((app, index) => (
                                                            <StudentCard
                                                                key={app._id}
                                                                app={app}
                                                                index={index}
                                                                isSelected={selectedIds.includes(app._id)}
                                                                selectedCount={selectedIds.length}
                                                                isCopyingColumn={copyingBucket === app.bucket}
                                                                currentStatusLabel={getStatusLabel(app.status)}
                                                                targetRoundOrStatusLabel={targetRoundOrStatusLabel}
                                                                onToggleSelect={toggleSelected}
                                                                onUpdateComment={updateComment}
                                                                onCopyToColumn={copyCommentToColumn}
                                                            />
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Droppable>

                                    {/* Column 3: EXIT */}
                                    <Droppable droppableId="exit">
                                        {(provided, snapshot) => {
                                            const exitColIds = filteredExitList.map(a => a._id);
                                            const allExitSelected = exitColIds.length > 0 && exitColIds.every(id => selectedIds.includes(id));

                                            return (
                                                <div className={`flex-1 flex flex-col min-w-0 md:min-w-[320px] ${activeTab !== 'exit' && 'hidden md:flex'}`}>
                                                    <div className="flex items-center justify-between mb-3 px-2">
                                                        <div className="flex items-center gap-2">
                                                            {filteredExitList.length > 0 && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={allExitSelected}
                                                                    onChange={() => {
                                                                        if (allExitSelected) {
                                                                            setSelectedIds(prev => prev.filter(id => !exitColIds.includes(id)));
                                                                        } else {
                                                                            setSelectedIds(prev => [...new Set([...prev, ...exitColIds])]);
                                                                        }
                                                                    }}
                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                                    title="Select all in this column"
                                                                />
                                                            )}
                                                            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-xs sm:text-sm">
                                                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                                EXIT AT {currentLabel.toUpperCase()}
                                                            </h3>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {exitList.some(a => !a.comment.trim()) && (
                                                                <span className="text-[10px] text-red-600 font-medium animate-pulse flex items-center gap-1">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                                {exitList.length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={`flex-1 overflow-y-auto p-2 rounded-xl border-2 border-dashed transition-colors flex flex-col ${snapshot.isDraggingOver ? 'bg-red-50 border-red-300' : 'bg-white/50 border-gray-200'
                                                            }`}
                                                    >
                                                        {filteredExitList.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                                <XCircle className="w-12 h-12 mb-3 opacity-20" />
                                                                <p className="text-sm">Candidates here will be rejected</p>
                                                            </div>
                                                        )}
                                                        {filteredExitList.map((app, index) => (
                                                            <StudentCard
                                                                key={app._id}
                                                                app={app}
                                                                index={index}
                                                                isExiting
                                                                isSelected={selectedIds.includes(app._id)}
                                                                selectedCount={selectedIds.length}
                                                                isCopyingColumn={copyingBucket === app.bucket}
                                                                currentStatusLabel={getStatusLabel(app.status)}
                                                                targetRoundOrStatusLabel={targetRoundOrStatusLabel}
                                                                onToggleSelect={toggleSelected}
                                                                onUpdateComment={updateComment}
                                                                onCopyToColumn={copyCommentToColumn}
                                                            />
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </Droppable>

                                </div>
                            </DragDropContext>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t flex items-center justify-between bg-white">
                            <div className="flex items-center gap-6">
                                <div className="text-sm">
                                    <span className="text-gray-500">Promoting:</span>
                                    <span className="font-bold text-green-600 ml-1">{promoteList.length}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-gray-500">Rejecting:</span>
                                    <span className="font-bold text-red-600 ml-1">{exitList.length}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-gray-500">Waitlist:</span>
                                    <span className="font-bold text-yellow-600 ml-1">{holdList.length}</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="btn btn-secondary"
                                >
                                    Discard Changes
                                </button>
                                <button
                                    onClick={validateAndShowPreview}
                                    disabled={applicants.length === 0}
                                    className="btn btn-primary px-8"
                                >
                                    Review Decision <ChevronRight className="w-4 h-4 ml-2" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* PREVIEW MODE */
                    <div className="flex-1 flex flex-col p-8 overflow-y-auto space-y-8 bg-gray-50">
                        <div className="max-w-4xl mx-auto w-full">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Final Review</h3>
                            <p className="text-gray-500 mb-8">Please check the movements and messages before applying changes.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left: Metadata summary */}
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Job Update</h4>
                                        <div className="flex items-center gap-3">
                                            <div className="text-lg font-bold p-3 bg-gray-100 rounded-lg border">{currentLabel}</div>
                                            <ArrowRight className="w-6 h-6 text-primary-500" />
                                            <div className="text-lg font-bold p-3 bg-primary-600 text-white rounded-lg shadow-lg">
                                                {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel || currentLabel}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-4 leading-relaxed italic border-l-4 border-primary-100 pl-4">
                                            {isInterviewingStage && hasInterviewRounds
                                                ? `Candidates will be advanced to the specified interview round: ${job.interviewRounds[selectedRoundIndex]?.name}.`
                                                : currentLabel === targetLabel
                                                    ? "Candidates will be confirmed for the current stage. No status change will occur, but notifications may be sent."
                                                    : "The recruitment process for this job is advancing. Selected candidates will be notified of their new status."
                                            }
                                        </p>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border shadow-sm">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Notification Summary</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600 italic">"Congratulations! You've been advanced to {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel}..."</span>
                                                <span className="font-bold text-green-600">x{promoteList.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600 italic">"Thank you for your interest, however..."</span>
                                                <span className="font-bold text-red-600">x{exitList.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Detailed lists */}
                                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                                        <h4 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Movement Tracker</h4>
                                        <span className="text-[10px] text-gray-400">Total {applicants.length} students</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {promoteList.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">Promotions / Advances</div>
                                                {promoteList.map(app => (
                                                    <div key={app._id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                                        <div>
                                                            <span className="font-medium text-gray-900 block">{app.student?.firstName} {app.student?.lastName}</span>
                                                            <span className="text-[10px] text-gray-400">Current: {getStatusLabel(app.status)}</span>
                                                        </div>
                                                        <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase text-[10px]">
                                                            {isInterviewingStage && hasInterviewRounds ? 'To Round' : 'Promoted'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {holdList.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest bg-yellow-50 px-2 py-0.5 rounded">Remaining / On Hold</div>
                                                {holdList.map(app => (
                                                    <div key={app._id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                                                        <div>
                                                            <span className="font-medium text-gray-700 block">{app.student?.firstName} {app.student?.lastName}</span>
                                                            <span className="text-[10px] text-gray-400">Current: {getStatusLabel(app.status)}</span>
                                                        </div>
                                                        <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 uppercase text-[10px]">No Change</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {exitList.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded">Exits / Rejections</div>
                                                {exitList.map(app => (
                                                    <div key={app._id} className="flex flex-col gap-1 text-sm py-2 border-b border-gray-50 last:border-0">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <span className="font-medium text-gray-700 block">{app.student?.firstName} {app.student?.lastName}</span>
                                                                <span className="text-[10px] text-gray-400">Current: {getStatusLabel(app.status)}</span>
                                                            </div>
                                                            <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase text-[10px]">Exited</span>
                                                        </div>
                                                        {app.comment && (
                                                            <p className="text-[10px] text-gray-500 italic bg-gray-50 p-2 rounded">
                                                                Feedback: "{app.comment}"
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-indigo-900 text-white p-6 rounded-2xl shadow-xl mt-12">
                                <div className="space-y-4 flex-1 mr-8">
                                    <div>
                                        <h4 className="font-bold text-lg">Ready to commit?</h4>
                                        <p className="text-indigo-200 text-sm">This action will trigger batch notifications to all candidates.</p>
                                    </div>
                                    <div className="bg-indigo-800/50 p-3 rounded-lg border border-indigo-700/50">
                                        <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wide mb-1 block">Discord Thread ID (Optional)</label>
                                        <div className="flex gap-2">
                                            <MessageSquare className="w-4 h-4 text-indigo-400 mt-2" />
                                            <input
                                                type="text"
                                                value={discordThreadId}
                                                onChange={(e) => setDiscordThreadId(e.target.value)}
                                                placeholder="Enter Discord thread ID for live updates..."
                                                className="bg-indigo-900/50 border border-indigo-700 text-white text-sm rounded px-3 py-1.5 w-full focus:ring-1 focus:ring-white placeholder-indigo-400/50 outline-none"
                                            />
                                        </div>
                                        <p className="text-[10px] text-indigo-400 mt-1 ml-6">If set, updates are posted to this specific thread.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <button
                                        onClick={() => setViewMode('triage')}
                                        className="px-6 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleFinalSubmit}
                                        disabled={isApplying}
                                        className="px-10 py-3 bg-white text-indigo-900 font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                                    >
                                        {isApplying ? 'Processing Batch...' : 'Confirm & Send Notifications'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplicantTriageModal;
