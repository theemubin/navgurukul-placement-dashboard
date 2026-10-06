import { useEffect } from 'react';
import { Github, Linkedin, FileText, Globe, MapPin, Mail, X, Zap } from 'lucide-react';

/**
 * StudentModal Component
 * Full-screen expanded view of student profile with overlay
 * Closes when clicking overlay or X button
 */
const StudentModal = ({ student, isOpen, onClose }) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !student) return null;

  const initials = `${student.firstName?.[0] || 'S'}${student.lastName?.[0] || 'T'}`.toUpperCase();
  const avatarUrl = student.avatar ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${student.avatar}` : null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-8 transform transition-all duration-300 animate-in">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Student Profile</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            {/* Avatar and Basic Info */}
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              {/* Avatar */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-4 border-gray-200 bg-gray-200 flex items-center justify-center overflow-hidden shadow-lg mb-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={student.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gray-600">{initials}</span>
                  )}
                </div>
              </div>

              {/* Name and Details */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {student.fullName}
                </h1>
                <div className="space-y-2 text-gray-700">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-lg">{student.campus?.name || 'Unknown Campus'}</span>
                  </div>
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <span className="text-sm break-all">{student.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* About */}
            {student.about && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">About</h3>
                <p className="text-gray-700 leading-relaxed">{student.about}</p>
              </div>
            )}

            {/* Approved Skills */}
            {student.approvedSkills && student.approvedSkills.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h3 className="text-xl font-bold text-gray-900">Approved Skills</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {student.approvedSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold text-sm"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links Section */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Links & Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {student.github && (
                  <a
                    href={student.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all group"
                  >
                    <Github className="w-6 h-6 text-gray-700 group-hover:text-gray-900" />
                    <div>
                      <p className="font-semibold text-gray-900">GitHub</p>
                      <p className="text-sm text-gray-600 truncate">github.com/...</p>
                    </div>
                  </a>
                )}
                {student.linkedIn && (
                  <a
                    href={student.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
                  >
                    <Linkedin className="w-6 h-6 text-blue-600 group-hover:text-blue-700" />
                    <div>
                      <p className="font-semibold text-gray-900">LinkedIn</p>
                      <p className="text-sm text-gray-600 truncate">linkedin.com/...</p>
                    </div>
                  </a>
                )}
                {student.portfolio && (
                  <a
                    href={student.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all group"
                  >
                    <Globe className="w-6 h-6 text-purple-600 group-hover:text-purple-700" />
                    <div>
                      <p className="font-semibold text-gray-900">Portfolio</p>
                      <p className="text-sm text-gray-600 truncate">portfolio.com/...</p>
                    </div>
                  </a>
                )}
                {student.resume && (
                  <a
                    href={student.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all group"
                  >
                    <FileText className="w-6 h-6 text-red-600 group-hover:text-red-700" />
                    <div>
                      <p className="font-semibold text-gray-900">Resume</p>
                      <p className="text-sm text-gray-600">View PDF</p>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentModal;
