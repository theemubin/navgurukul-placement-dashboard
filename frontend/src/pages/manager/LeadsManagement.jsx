import { useState, useEffect } from 'react';
import { leadAPI } from '../../services/api';
import {
    Mail,
    Phone,
    Building,
    Calendar,
    Clock,
    MoreVertical,
    MessageSquare,
    User,
    ArrowRight,
    GripVertical,
    X,
    Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const STAGES = [
    { id: 'lead open', label: 'Lead Open', color: 'blue' },
    { id: 'contacted', label: 'Contacted', color: 'yellow' },
    { id: 'got the lead', label: 'Got the Lead', color: 'purple' },
    { id: 'placed from them', label: 'Placed from Them', color: 'green' },
    { id: 'unsuccessful', label: 'Unsuccessful', color: 'red' }
];

const STAGE_COLORS = {
    blue: { bg: 'bg-blue-50/50', border: 'border-blue-100', header: 'bg-blue-600', text: 'text-blue-700' },
    yellow: { bg: 'bg-yellow-50/50', border: 'border-yellow-100', header: 'bg-yellow-600', text: 'text-yellow-700' },
    purple: { bg: 'bg-purple-50/50', border: 'border-purple-100', header: 'bg-purple-600', text: 'text-purple-700' },
    green: { bg: 'bg-green-50/50', border: 'border-green-100', header: 'bg-green-600', text: 'text-green-700' },
    red: { bg: 'bg-red-50/50', border: 'border-red-100', header: 'bg-red-600', text: 'text-red-700' }
};

const LeadCard = ({ lead, index, onAction }) => {
    return (
        <Draggable draggableId={lead._id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary-500 z-50' : ''
                        }`}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded text-gray-400">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight leading-none mb-1">
                                    {lead.name}
                                </h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                                    {lead.company}
                                </p>
                            </div>
                        </div>
                        <div className="relative group/menu">
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-gray-50 rounded text-gray-400"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-[60]">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction('view', lead); }}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 rounded-t-xl"
                                >
                                    View History
                                </button>

                                {/* Mobile/Quick Status Update */}
                                <div className="border-y border-gray-50">
                                    <p className="px-4 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">Move to stage</p>
                                    {STAGES.filter(s => s.id !== lead.status).map(stage => (
                                        <button
                                            key={stage.id}
                                            onClick={(e) => { e.stopPropagation(); onAction('move', { lead, targetStatus: stage.id }); }}
                                            className="w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-gray-50 text-gray-600"
                                        >
                                            → {stage.label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onAction('edit_notes', lead); }}
                                    className="w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 rounded-b-xl"
                                >
                                    Edit Notes
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-gray-500">
                            <Mail className="w-3 h-3" />
                            <span className="text-[10px] font-medium truncate">{lead.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                            <Phone className="w-3 h-3" />
                            <span className="text-[10px] font-medium">{lead.phone}</span>
                        </div>
                    </div>

                    {lead.notes && (
                        <div className="mb-4 p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-[10px] text-gray-600 italic line-clamp-2">"{lead.notes}"</p>
                        </div>
                    )}

                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                                {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        {lead.statusHistory?.length > 0 && (
                            <div className="flex items-center gap-1 text-primary-600">
                                <Clock className="w-3 h-3" />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Updated</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const KanbanColumn = ({ stage, leads, onAction }) => {
    const config = STAGE_COLORS[stage.color];

    return (
        <div className={`flex-shrink-0 w-80 rounded-2xl border ${config.border} ${config.bg} flex flex-col h-[calc(100vh-200px)]`}>
            {/* Header */}
            <div className={`p-4 rounded-t-2xl flex items-center justify-between border-b ${config.border} bg-white shadow-sm`}>
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${config.header}`}></div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">{stage.label}</h3>
                </div>
                <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-[10px] font-black">
                    {leads.length}
                </span>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-4 flex-1 overflow-y-auto no-scrollbar transition-colors ${snapshot.isDraggingOver ? 'bg-white/50' : ''
                            }`}
                    >
                        {leads.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                                <Clock className="w-8 h-8 mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">No inquiries here</p>
                            </div>
                        ) : (
                            leads.map((lead, index) => (
                                <LeadCard
                                    key={lead._id}
                                    lead={lead}
                                    index={index}
                                    onAction={onAction}
                                />
                            ))
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

const CommentModal = ({ isOpen, onClose, onSave, lead, targetStatus }) => {
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave(comment);
        setSaving(false);
        setComment('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-1">Stage Update</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Update status for {lead.name}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className="px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            {lead.status}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 text-[9px] font-black text-blue-700 uppercase tracking-widest">
                            {targetStatus}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Transition Note</label>
                            <textarea
                                autoFocus
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="What happened since the last contact?"
                                className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all resize-none font-medium"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-4 bg-gray-950 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Confirm Update
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const HistoryModal = ({ isOpen, onClose, lead }) => {
    if (!isOpen || !lead) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                <div className="p-8 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-1">Timeline History</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{lead.name} · {lead.company}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto flex-1 no-scrollbar">
                    {(!lead.statusHistory || lead.statusHistory.length === 0) ? (
                        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No history recorded yet</p>
                        </div>
                    ) : (
                        <div className="space-y-8 relative">
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100"></div>
                            {lead.statusHistory.slice().reverse().map((entry, i) => (
                                <div key={i} className="relative pl-12">
                                    <div className="absolute left-2.5 top-0 w-3.5 h-3.5 rounded-full bg-white border-2 border-blue-500 z-10 shadow-sm"></div>
                                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-widest">
                                                Moved to: {entry.status}
                                            </div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                {new Date(entry.updatedAt).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-700 font-medium mb-1">{entry.comment || 'No comment provided'}</p>
                                                <div className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Updated by {entry.updatedBy?.name || 'Manager'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LeadsManagement = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null); // { lead, targetStatus }
    const [selectedLead, setSelectedLead] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const response = await leadAPI.getLeads();
            setLeads(response.data.leads || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Failed to load inquiries');
        } finally {
            setLoading(false);
        }
    };

    const handleDragEnd = (result) => {
        const { destination, source, draggableId } = result;

        if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
            return;
        }

        const lead = leads.find(l => l._id === draggableId);
        if (!lead) return;

        setUpdating({ lead, targetStatus: destination.droppableId });
    };

    const confirmStatusUpdate = async (comment) => {
        if (!updating) return;

        const { lead, targetStatus } = updating;
        const oldStatus = lead.status;

        // Optimistic UI update
        const updatedLeads = leads.map(l =>
            l._id === lead._id ? { ...l, status: targetStatus } : l
        );
        setLeads(updatedLeads);

        try {
            await leadAPI.updateLead(lead._id, {
                status: targetStatus,
                comment: comment
            });
            toast.success(`Moved ${lead.name} to ${targetStatus}`);
            fetchLeads(); // Refresh to get proper history
        } catch (error) {
            toast.error('Failed to update status');
            // Revert on error
            setLeads(leads);
        } finally {
            setUpdating(null);
        }
    };

    const handleAction = (type, data) => {
        if (type === 'view') {
            setSelectedLead(data);
            setShowHistory(true);
        } else if (type === 'move') {
            setUpdating({ lead: data.lead, targetStatus: data.targetStatus });
        }
    };

    const leadsByStatus = STAGES.reduce((acc, stage) => {
        acc[stage.id] = leads.filter(l => l.status === stage.id);
        return acc;
    }, {});

    if (loading && leads.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-full mx-auto p-4 md:p-8">
            <div className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-none mb-4">Pipeline Triage</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">Recruitment Recruitment Funnel & Partnership Leads</p>
                </div>
                <div className="hidden md:flex items-center gap-4 bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100">
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-black text-gray-900">{leads.length}</span>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Active</span>
                    </div>
                    <div className="w-[1px] h-8 bg-gray-200"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-black text-green-600">{leads.filter(l => l.status === 'placed from them').length}</span>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Successful</span>
                    </div>
                    <div className="w-[1px] h-8 bg-gray-200"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-xl font-black text-red-600">{leads.filter(l => l.status === 'unsuccessful').length}</span>
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Unsuccessful</span>
                    </div>
                </div>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar scroll-smooth">
                    {STAGES.map((stage) => (
                        <KanbanColumn
                            key={stage.id}
                            stage={stage}
                            leads={leadsByStatus[stage.id] || []}
                            onAction={handleAction}
                        />
                    ))}
                </div>
            </DragDropContext>

            {/* Modals */}
            <CommentModal
                isOpen={!!updating}
                onClose={() => setUpdating(null)}
                onSave={confirmStatusUpdate}
                lead={updating?.lead || {}}
                targetStatus={updating?.targetStatus}
            />

            <HistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                lead={selectedLead}
            />

            {/* Help Note */}
            <div className="mt-8 bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center gap-6">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-100 text-blue-600">
                    <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Recruitment Intelligence</h4>
                    <p className="text-[11px] text-gray-500 font-medium">Drag partners between stages to update their status. You'll be prompted to record a quick note for the team context. Use 'View History' to see the full journey of a lead.</p>
                </div>
            </div>
        </div>
    );
};

export default LeadsManagement;
