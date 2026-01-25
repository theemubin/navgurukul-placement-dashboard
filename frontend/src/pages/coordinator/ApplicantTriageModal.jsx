import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
    X, CheckCircle, XCircle, Pause, ArrowRight, User,
    MapPin, GraduationCap, FileText, AlertCircle, Search,
    ChevronRight, MessageSquare, Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const LocalCommentArea = ({ initialValue, onSave, placeholder, isExiting }) => {
    const [val, setVal] = useState(initialValue || '');

    useEffect(() => {
        setVal(initialValue || '');
    }, [initialValue]);

    return (
        <textarea
            rows={1}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => onSave(val)}
            placeholder={placeholder}
            className={`w-full text-xs p-2 border rounded resize-none focus:ring-1 focus:ring-primary-500 ${isExiting && !val.trim() ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-gray-200'
                }`}
        />
    );
};

const ApplicantTriageModal = ({
    isOpen,
    onClose,
    job,
    applicants: initialApplicants,
    targetStatus,
    pipelineStages,
    onConfirm,
    isApplying
}) => {
    const [applicants, setApplicants] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('triage'); // 'triage' or 'preview'
    const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
    const [discordThreadId, setDiscordThreadId] = useState('');

    // Map job status to label
    const getStatusLabel = (statusId) => {
        const stage = pipelineStages.find(s => s.id === statusId);
        return stage ? stage.label : statusId;
    };

    const targetLabel = getStatusLabel(targetStatus || job?.status);
    const currentLabel = getStatusLabel(job?.status);

    const activeStatus = targetStatus || job?.status;
    const isInterviewingStage = activeStatus === 'interviewing' || activeStatus?.includes('interview');
    const hasInterviewRounds = job?.interviewRounds?.length > 0;

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
                // If advancing to a new stage, start at round 0. 
                // If staying in current stage, maybe find the "most common" round or just default to 0
                setSelectedRoundIndex(0);
            }

            // Init Discord Thread
            setDiscordThreadId(job?.discordThreadId || '');
        }
    }, [isOpen, initialApplicants, targetStatus, job]);

    if (!isOpen || !job) return null;

    const filteredApplicants = applicants.filter(app => {
        const name = `${app.student?.firstName} ${app.student?.lastName}`.toLowerCase();
        const email = app.student?.email?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    });

    const onDragEnd = (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId) return;

        setApplicants(prev => prev.map(app =>
            app._id === draggableId
                ? { ...app, bucket: destination.droppableId }
                : app
        ));
    };

    const updateComment = (appId, comment) => {
        setApplicants(prev => prev.map(app =>
            app._id === appId ? { ...app, comment } : app
        ));
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

    const promoteList = filteredApplicants.filter(a => a.bucket === 'promote');
    const exitList = filteredApplicants.filter(a => a.bucket === 'exit');
    const holdList = filteredApplicants.filter(a => a.bucket === 'hold');

    const StudentCard = ({ app, index, isExiting }) => (
        <Draggable draggableId={app._id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`bg-white border rounded-lg p-3 mb-3 shadow-sm transition-all ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary-500 opacity-90' : 'hover:border-primary-300'
                        } ${isExiting && !app.comment.trim() ? 'border-red-200 bg-red-50' : ''}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h5 className="font-semibold text-gray-900 leading-tight">
                                {app.student?.firstName} {app.student?.lastName}
                            </h5>
                            <p className="text-xs text-gray-500 truncate max-w-[150px]">{app.student?.email}</p>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${app.matchPercentage >= 80 ? 'bg-green-100 text-green-700' :
                            app.matchPercentage >= 60 ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {app.matchPercentage || 0}% Match
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border">
                            <MapPin className="w-2.5 h-2.5" />
                            {app.student?.campus?.name || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border">
                            <GraduationCap className="w-2.5 h-2.5" />
                            {app.student?.currentModule || 'N/A'}
                        </div>
                    </div>

                    {app.bucket === 'promote' && (
                        <div className="mt-2">
                            {(getStatusLabel(app.status) === (isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel)) ? (
                                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded border border-primary-100 uppercase">
                                    <CheckCircle className="w-3 h-3" />
                                    Currently in: {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-green-700 bg-green-50 p-1.5 rounded border border-green-100">
                                    <span className="bg-white px-1.5 py-0.5 rounded shadow-sm text-gray-500 font-bold border border-gray-100 uppercase">
                                        {getStatusLabel(app.status)}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-green-400" />
                                    <span className="font-bold flex items-center gap-1 uppercase">
                                        {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name : targetLabel}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {app.bucket === 'exit' && (
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-red-700 bg-red-50 p-1.5 rounded mt-2 border border-red-100">
                            <span className="bg-white px-1.5 py-0.5 rounded shadow-sm text-gray-500 font-bold border border-gray-100 uppercase">
                                {getStatusLabel(app.status)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-red-400" />
                            <span className="font-bold uppercase">REJECTED</span>
                        </div>
                    )}

                    <div className="mt-2">
                        <label className="block text-[10px] font-medium text-gray-400 mb-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {isExiting ? 'MANDATORY FEEDBACK *' : 'NOTES (OPTIONAL)'}
                        </label>
                        <LocalCommentArea
                            initialValue={app.comment}
                            onSave={(val) => updateComment(app._id, val)}
                            placeholder={isExiting ? "Why are they not moving ahead?" : "Add a note..."}
                            isExiting={isExiting}
                        />
                    </div>
                </div>
            )}
        </Draggable>
    );

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

                {viewMode === 'triage' ? (
                    <>
                        {/* Triage Workspace */}
                        <div className="p-6 bg-gray-100 overflow-x-auto">
                            <DragDropContext onDragEnd={onDragEnd}>
                                <div className="flex gap-6 min-w-[1000px] h-[60vh]">

                                    {/* Column 1: PROMOTE */}
                                    <Droppable droppableId="promote">
                                        {(provided, snapshot) => (
                                            <div className="flex-1 flex flex-col min-w-[320px]">
                                                <div className="flex items-center justify-between mb-3 px-2">
                                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        PROMOTE TO {isInterviewingStage && hasInterviewRounds ? job.interviewRounds[selectedRoundIndex]?.name.toUpperCase() : targetLabel.toUpperCase()}
                                                    </h3>
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
                                                    {promoteList.length === 0 && !snapshot.isDraggingOver && (
                                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                            <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                                            <p className="text-sm">Drag candidates here to advance them to the next round</p>
                                                        </div>
                                                    )}
                                                    {promoteList.map((app, index) => (
                                                        <StudentCard key={app._id} app={app} index={index} />
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>

                                    {/* Column 2: HOLD */}
                                    <Droppable droppableId="hold">
                                        {(provided, snapshot) => (
                                            <div className="flex-1 flex flex-col min-w-[320px]">
                                                <div className="flex items-center justify-between mb-3 px-2">
                                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                        KEEP ON HOLD
                                                    </h3>
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
                                                    {holdList.length === 0 && !snapshot.isDraggingOver && (
                                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                            <Pause className="w-12 h-12 mb-3 opacity-20" />
                                                            <p className="text-sm">Candidates dropped here won't change status but can still be messaged</p>
                                                        </div>
                                                    )}
                                                    {holdList.map((app, index) => (
                                                        <StudentCard key={app._id} app={app} index={index} />
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
                                    </Droppable>

                                    {/* Column 3: EXIT */}
                                    <Droppable droppableId="exit">
                                        {(provided, snapshot) => (
                                            <div className="flex-1 flex flex-col min-w-[320px]">
                                                <div className="flex items-center justify-between mb-3 px-2">
                                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                        EXIT AT {currentLabel.toUpperCase()}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        {exitList.some(a => !a.comment.trim()) && (
                                                            <span className="text-[10px] text-red-600 font-medium animate-pulse flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> Feedback Required
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
                                                    {exitList.length === 0 && !snapshot.isDraggingOver && (
                                                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                                            <XCircle className="w-12 h-12 mb-3 opacity-20" />
                                                            <p className="text-sm">Candidates here will be rejected with mandatory feedback</p>
                                                        </div>
                                                    )}
                                                    {exitList.map((app, index) => (
                                                        <StudentCard key={app._id} app={app} index={index} isExiting />
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            </div>
                                        )}
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
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {promoteList.slice(0, 5).map(app => (
                                            <div key={app._id} className="flex items-center justify-between text-sm">
                                                <span className="font-medium">{app.student?.firstName} {app.student?.lastName}</span>
                                                <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100 uppercase text-[10px]">
                                                    {isInterviewingStage && hasInterviewRounds ? 'To Round' : 'Promoted'}
                                                </span>
                                            </div>
                                        ))}
                                        {exitList.slice(0, 5).map(app => (
                                            <div key={app._id} className="flex flex-col gap-1 text-sm border-t pt-2 mt-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">{app.student?.firstName} {app.student?.lastName}</span>
                                                    <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase text-[10px]">Exited</span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 italic bg-gray-50 p-2 rounded truncate overflow-hidden">
                                                    Feedback: "{app.comment}"
                                                </p>
                                            </div>
                                        ))}
                                        {applicants.length > 10 && (
                                            <div className="text-center text-xs text-gray-400 py-2">... and {applicants.length - 10} others</div>
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
