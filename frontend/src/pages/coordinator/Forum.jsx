import { useState, useEffect } from 'react';
import { questionAPI } from '../../services/api';
import { Trash, CheckCircle, MessageCircle, Building } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CoordinatorForum = () => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            const response = await questionAPI.getQuestions();
            setQuestions(response.data);
        } catch (error) {
            console.error('Error fetching questions:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this question?')) return;
        try {
            await questionAPI.deleteQuestion(id);
            toast.success('Question deleted');
            setQuestions(prev => prev.filter(q => q._id !== id));
        } catch (error) {
            toast.error('Failed to delete question');
        }
    };

    const handleAnswer = async (id, answer) => {
        try {
            await questionAPI.answerQuestion(id, answer);
            toast.success('Question answered');
            fetchQuestions(); // Refresh to update view
        } catch (error) {
            toast.error('Failed to submit answer');
        }
    };

    // Group questions by company
    const groupedQuestions = questions.reduce((acc, q) => {
        const company = q.companyName || 'Unknown Company';
        if (!acc[company]) acc[company] = [];
        acc[company].push(q);
        return acc;
    }, {});

    const pendingCount = questions.filter(q => !q.answer).length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Q&A Forum Management</h1>
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                            {pendingCount} unanswered
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-8">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="mt-2 text-gray-500">Loading questions...</p>
                    </div>
                ) : Object.keys(groupedQuestions).length > 0 ? (
                    Object.entries(groupedQuestions).map(([company, companyQuestions]) => (
                        <div key={company} className="bg-white rounded-lg shadow-sm border p-6">
                            <h2 className="text-xl font-bold border-b pb-3 mb-4 flex items-center gap-2">
                                <Building className="w-5 h-5 text-gray-400" />
                                {company}
                            </h2>

                            <div className="space-y-6">
                                {companyQuestions.map((q) => (
                                    <div key={q._id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                {/* Enhanced Header */}
                                                <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                                                    <span className="font-semibold text-primary-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {q.jobTitle || 'General Role'}
                                                    </span>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-gray-600">
                                                        Apply by: <span className="font-medium text-gray-900">{q.jobDeadline ? format(new Date(q.jobDeadline), 'MMM d, yyyy') : 'No deadline'}</span>
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-medium text-gray-900">{q.question}</h3>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    Asked {format(new Date(q.createdAt), 'MMM d, yyyy h:mm a')}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => handleDelete(q._id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                                                title="Delete Question"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {q.answer ? (
                                            <div className="bg-white rounded-lg p-3 border border-gray-200 mt-2">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-gray-700">{q.answer}</p>
                                                        {q.answeredAt && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Answered {format(new Date(q.answeredAt), 'MMM d, yyyy')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-3 pl-4 border-l-2 border-yellow-300">
                                                <p className="text-xs text-yellow-600 font-medium mb-2">Needs Answer</p>
                                                <AnswerForm onSubmit={(answer) => handleAnswer(q._id, answer)} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No questions found</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

const AnswerForm = ({ onSubmit }) => {
    const [answer, setAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!answer.trim()) return;

        setSubmitting(true);
        await onSubmit(answer);
        setSubmitting(false);
        setAnswer('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write an answer..."
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
            <button
                type="submit"
                disabled={submitting || !answer.trim()}
                className="btn btn-primary btn-sm whitespace-nowrap"
            >
                {submitting ? 'Submitting...' : 'Answer'}
            </button>
        </form>
    );
};

export default CoordinatorForum;
