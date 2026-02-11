import { useState } from 'react';
import { Github, Linkedin, FileText, Globe, MapPin, Mail, Zap } from 'lucide-react';

/**
 * StudentCard Component
 * Displays approved student profile in a professional card format
 * Can be expanded to full-screen modal on click
 */
const StudentCard = ({ student, onCardClick }) => {
  const [isHovering, setIsHovering] = useState(false);

  if (!student) return null;

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(student);
    }
  };

  const hasLinks =
    student.github ||
    student.linkedIn ||
    student.resume ||
    student.portfolio;

  // Get initials for avatar fallback
  const initials = `${student.firstName?.[0] || 'S'}${student.lastName?.[0] || 'T'}`.toUpperCase();
  const avatarUrl = student.avatar ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${student.avatar}` : null;

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`group bg-white rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 ${
        isHovering ? 'shadow-xl scale-105' : ''
      }`}
    >
      {/* Header with Campus Badge */}
      <div className="relative h-24 bg-gradient-to-r from-blue-500 to-indigo-600">
        <div className="absolute top-2 right-2 bg-white/90 px-3 py-1 rounded-full text-xs font-semibold text-gray-700">
          {student.campus?.name || 'N/A'}
        </div>
      </div>

      {/* Avatar Section */}
      <div className="relative px-4 pb-4">
        <div className="flex flex-col items-center -mt-12 mb-3">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full border-4 border-white bg-gray-200 flex items-center justify-center overflow-hidden shadow-md">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={student.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-600">{initials}</span>
            )}
          </div>
        </div>

        {/* Name and Basic Info */}
        <div className="text-center mb-3">
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
            {student.fullName}
          </h3>
          <div className="flex items-center justify-center text-sm text-gray-600 mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            {student.campus?.name || 'Unknown'}
          </div>
          {student.email && (
            <div className="flex items-center justify-center text-xs text-gray-500 mt-1">
              <Mail className="w-3 h-3 mr-1" />
              <span className="truncate">{student.email}</span>
            </div>
          )}
        </div>

        {/* About Section */}
        {student.about && (
          <p className="text-sm text-gray-600 text-center line-clamp-3 mb-3">
            {student.about}
          </p>
        )}

        {/* Approved Skills */}
        {student.approvedSkills && student.approvedSkills.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-center mb-2">
              <Zap className="w-4 h-4 text-amber-500 mr-1" />
              <span className="text-xs font-semibold text-gray-700">Skills</span>
            </div>
            <div className="flex flex-wrap gap-1 justify-center">
              {student.approvedSkills.slice(0, 4).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium"
                >
                  {skill.name}
                </span>
              ))}
              {student.approvedSkills.length > 4 && (
                <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
                  +{student.approvedSkills.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Social Links */}
        {hasLinks && (
          <div className="flex justify-center gap-3 pt-3 border-t border-gray-200">
            {student.github && (
              <a
                href={student.github}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                title="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
            )}
            {student.linkedIn && (
              <a
                href={student.linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            )}
            {student.portfolio && (
              <a
                href={student.portfolio}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-purple-600 hover:text-purple-800 transition-colors"
                title="Portfolio"
              >
                <Globe className="w-5 h-5" />
              </a>
            )}
            {student.resume && (
              <a
                href={student.resume}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-red-600 hover:text-red-800 transition-colors"
                title="Resume"
              >
                <FileText className="w-5 h-5" />
              </a>
            )}
          </div>
        )}

        {/* Click to Expand Indicator */}
        <div className="text-center mt-3">
          <button
            onClick={handleCardClick}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
