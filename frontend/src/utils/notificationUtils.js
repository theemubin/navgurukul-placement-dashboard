export const getNotificationUrl = (notification, userRole) => {
    if (!notification || !userRole) return null;

    // 1. If a direct link is provided by the backend, use it
    if (notification.link) return notification.link;

    // 2. Otherwise, determine path by type and entity
    const rolePath = userRole.replace('_', '-'); // e.g., campus_poc -> campus-poc
    const entityId = notification.relatedEntity?.id;

    switch (notification.type) {
        case 'new_job_posting':
        case 'job_posted':
            if (userRole === 'coordinator') {
                return `/${rolePath}/jobs${entityId ? `?jobId=${entityId}` : ''}`;
            }
            return `/${rolePath}/jobs/${entityId || ''}`;

        case 'skill_approval_needed':
        case 'skill_approved':
        case 'skill_rejected':
            if (userRole === 'campus_poc') {
                return `/${rolePath}/skill-approvals`;
            }
            if (userRole === 'student') {
                return `/${rolePath}/profile`;
            }
            return `/${rolePath}/skills`;

        case 'application_update':
        case 'interview_scheduled':
        case 'feedback_received':
            if (userRole === 'student') {
                return `/${rolePath}/applications${entityId ? `?appId=${entityId}` : ''}`;
            }
            return `/${rolePath}/applications${entityId ? `?appId=${entityId}` : ''}`;

        case 'self_application':
        case 'self_application_update':
        case 'self_application_verified':
            return `/${rolePath}/self-applications${entityId ? `?appId=${entityId}` : ''}`;

        case 'profile_approval_needed':
        case 'profile_approved':
        case 'profile_needs_revision':
            if (userRole === 'campus_poc') {
                return `/${rolePath}/profile-approvals`;
            }
            return `/${rolePath}/profile`;

        case 'job_question':
        case 'question_answered':
            if (userRole === 'coordinator') {
                return `/${rolePath}/jobs${entityId ? `?jobId=${entityId}` : ''}`;
            }
            return `/${rolePath}/jobs/${entityId || ''}`;

        case 'job_readiness_update':
            return `/${rolePath}/job-readiness`;

        default:
            return null;
    }
};
