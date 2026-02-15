import { useState } from 'react';

const PortfolioModal = ({ portfolio, selectedRole, onClose }) => {
    const [imageError, setImageError] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Fallback avatar
    const defaultAvatarImage = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(portfolio?.name || 'Student') + '&background=random&color=fff&size=128';

    if (!portfolio) return null;

    // Rating display component
    const RatingStars = ({ rating }) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((star) => (
                    <svg
                        key={star}
                        className={`w-4 h-4 ${star <= rating ? 'text-gray-900' : 'text-gray-200'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gray-950 text-white p-6 md:p-8 rounded-t-2xl">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                            {/* Profile Picture */}
                            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/10 shrink-0">
                                <img
                                    src={portfolio.avatar || defaultAvatarImage}
                                    alt={portfolio.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        if (!imageError) {
                                            setImageError(true);
                                            e.target.src = defaultAvatarImage;
                                        }
                                    }}
                                />
                            </div>
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-black uppercase tracking-tighter mb-1">{portfolio.name}</h2>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{selectedRole || portfolio.openForRoles?.join(' • ') || 'Developer'}</p>
                                {portfolio.about && (
                                    <p className="mt-4 text-gray-400 text-sm leading-relaxed max-w-xl italic">
                                        "{portfolio.about}"
                                    </p>
                                )}
                                {portfolio.campus && (
                                    <div className="mt-4">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 py-1 bg-white/5 rounded inline-block border border-white/10">{portfolio.campus.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Tabs - Matching the filter style */}
                <div className="border-b border-gray-100 px-6 py-4 bg-gray-50/50">
                    <div className="flex flex-wrap gap-2">
                        {['overview', 'skills', 'education', 'links'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 shadow-sm border ${activeTab === tab
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white text-gray-900 border-gray-100 hover:border-gray-900 hover:text-gray-900'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* About */}
                            {portfolio.about && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                                    <p className="text-gray-700 leading-relaxed">{portfolio.about}</p>
                                </div>
                            )}

                            {/* Quick Stats */}
                            {/* Quick Stats - Binary style */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-gray-900">{portfolio.technicalSkills.length}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Technical Skills</div>
                                </div>
                                <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-gray-900">{portfolio.softSkills.length}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Soft Skills</div>
                                </div>
                                <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-gray-900">{portfolio.languages.length}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Languages</div>
                                </div>
                                <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-gray-900">{portfolio.courses.length}</div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Courses</div>
                                </div>
                            </div>

                            {/* Languages */}
                            {portfolio.languages.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Languages</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {portfolio.languages.map((lang, index) => (
                                            <div key={index} className="bg-gray-50 rounded-lg p-3">
                                                <div className="font-medium text-gray-900">{lang.language}</div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    Speaking: {lang.speaking} • Writing: {lang.writing}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Skills Tab */}
                    {activeTab === 'skills' && (
                        <div className="space-y-6">
                            {/* Technical Skills */}
                            {portfolio.technicalSkills.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Technical Skills</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {portfolio.technicalSkills.map((skill, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-3">
                                                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-900">{skill.name}</span>
                                                <RatingStars rating={skill.rating} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Soft Skills */}
                            {portfolio.softSkills.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Soft Skills</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {portfolio.softSkills.map((skill, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-3">
                                                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-900">{skill.name}</span>
                                                <RatingStars rating={skill.rating} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Office Skills */}
                            {portfolio.officeSkills.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Office Skills</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {portfolio.officeSkills.map((skill, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-3">
                                                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-900">{skill.name}</span>
                                                <RatingStars rating={skill.rating} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Education Tab */}
                    {activeTab === 'education' && (
                        <div className="space-y-6">
                            {/* 10th Grade */}
                            {portfolio.education.tenth && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">10th Grade</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-600">Board:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.tenth.board}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Percentage:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.tenth.percentage}%</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Year:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.tenth.passingYear}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">State:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.tenth.state}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 12th Grade */}
                            {portfolio.education.twelfth && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">12th Grade</h3>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-600">Board:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.twelfth.board}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Percentage:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.twelfth.percentage}%</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Year:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.twelfth.passingYear}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">State:</span>
                                            <span className="ml-2 font-medium">{portfolio.education.twelfth.state}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Higher Education */}
                            {portfolio.education.higher.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Higher Education</h3>
                                    <div className="space-y-3">
                                        {portfolio.education.higher.map((edu, index) => (
                                            <div key={index} className="bg-gray-50 rounded-lg p-4">
                                                <div className="font-medium text-gray-900">{edu.degree}</div>
                                                <div className="text-sm text-gray-600 mt-1">{edu.institution}</div>
                                                <div className="text-sm text-gray-600">
                                                    {edu.startYear} - {edu.isCompleted ? edu.endYear : 'Present'}
                                                    {edu.percentage && ` • ${edu.percentage}%`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Courses */}
                            {portfolio.courses.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Courses & Certifications</h3>
                                    <div className="space-y-3">
                                        {portfolio.courses.map((course, index) => (
                                            <div key={index} className="bg-gray-50 rounded-lg p-4">
                                                <div className="font-medium text-gray-900">{course.courseName}</div>
                                                <div className="text-sm text-gray-600 mt-1">{course.provider}</div>
                                                {course.certificateUrl && (
                                                    <a
                                                        href={course.certificateUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                                                    >
                                                        View Certificate →
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Links Tab */}
                    {activeTab === 'links' && (
                        <div className="space-y-6">
                            {/* LinkedIn */}
                            {portfolio.linkedIn && (
                                <a
                                    href={portfolio.linkedIn}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md group border border-white/5"
                                >
                                    <svg className="w-8 h-8 opacity-90 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="font-bold text-base uppercase tracking-tight">LinkedIn Profile</div>
                                        <div className="text-xs text-gray-400 font-medium">Verify professional experience</div>
                                    </div>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}

                            {/* GitHub */}
                            {portfolio.github && (
                                <a
                                    href={portfolio.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md"
                                >
                                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="font-medium">GitHub Profile</div>
                                        <div className="text-sm text-gray-300">View code repositories & contributions</div>
                                    </div>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}

                            {/* Portfolio */}
                            {portfolio.portfolio && (
                                <a
                                    href={portfolio.portfolio}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors shadow-md"
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="font-medium">Portfolio Website</div>
                                        <div className="text-sm text-blue-100">View projects and work showcase</div>
                                    </div>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}

                            {/* Resume */}
                            {portfolio.resumeLink && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Resume</h3>
                                        <a
                                            href={portfolio.resumeLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            View Full Screen
                                        </a>
                                    </div>
                                    <div className="aspect-[8.5/11] bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200 relative group">
                                        <iframe
                                            src={portfolio.resumeLink.includes('drive.google.com')
                                                ? portfolio.resumeLink.replace('/view', '/preview').replace('?usp=sharing', '')
                                                : `${portfolio.resumeLink}#toolbar=0&navpanes=0&scrollbar=0`}
                                            className="w-full h-full"
                                            title="Resume"
                                        />
                                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    </div>
                                    <p className="text-xs text-gray-500 text-center italic">
                                        * Note: If the resume doesn't load, please use the "View Full Screen" link above.
                                    </p>
                                </div>
                            )}

                            {!portfolio.github && !portfolio.portfolio && !portfolio.resumeLink && (
                                <div className="text-center py-12 text-gray-500">
                                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <p>No links available</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PortfolioModal;
