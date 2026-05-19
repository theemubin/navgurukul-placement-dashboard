const { EmbedBuilder } = require('discord.js');

class DiscordMessageTemplates {
    /**
     * Template for New Job Posting
     */
    static newJobPosting(job, coordinator) {
        let salaryText = 'Not Disclosed';
        if (job.salary?.min || job.salary?.max) {
            if (job.salary.min && job.salary.max) {
                if (job.salary.min === job.salary.max) {
                    salaryText = `₹${job.salary.min.toLocaleString('en-IN')}`;
                } else {
                    salaryText = `₹${job.salary.min.toLocaleString('en-IN')} - ₹${job.salary.max.toLocaleString('en-IN')}`;
                }
            } else if (job.salary.min) {
                salaryText = `₹${job.salary.min.toLocaleString('en-IN')}`;
            } else if (job.salary.max) {
                salaryText = `₹${job.salary.max.toLocaleString('en-IN')}`;
            }
        }

        return new EmbedBuilder()
            .setColor('#3b82f6') // Blue
            .setTitle(`🆕 New Job Opportunity: ${job.title}`)
            .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/jobs/${job._id}`)
            .setDescription(job.description.substring(0, 300) + (job.description.length > 300 ? '...' : ''))
            .addFields(
                { name: '🏢 Company', value: job.company.name, inline: true },
                { name: '📍 Location', value: job.location || 'Not specified', inline: true },
                { name: '💼 Job Type', value: job.jobType?.replace('_', ' ').toUpperCase() || 'FULL TIME', inline: true },
                { name: '💰 Salary', value: salaryText, inline: true },
                { name: '📅 Deadline', value: new Date(job.applicationDeadline).toLocaleDateString('en-IN'), inline: true },
                { name: '👤 Coordinator', value: `${coordinator.firstName} ${coordinator.lastName}`, inline: true }
            )
            .setThumbnail(job.company.logo || 'https://cdn-icons-png.flaticon.com/512/2910/2910791.png')
            .setTimestamp()
            .setFooter({ text: 'Apply via the Placement Dashboard' });
    }

    /**
     * Template for Application Status Update
     */
    static applicationUpdate(application, job, student, newStatus, updatedBy) {
        const statusEmoji = {
            applied: '📝',
            shortlisted: '⭐',
            in_progress: '🔄',
            interviewing: '🎤',
            selected: '🎉',
            rejected: '❌',
            withdrawn: '↩️',
            on_hold: '⏸️'
        };

        const statusColor = {
            applied: '#6b7280', // Gray
            shortlisted: '#f59e0b', // Amber
            in_progress: '#3b82f6', // Blue
            interviewing: '#8b5cf6', // Purple
            selected: '#10b981', // Green
            rejected: '#ef4444', // Red
            withdrawn: '#9ca3af', // Light Gray
            on_hold: '#f97316' // Orange
        };

        const embed = new EmbedBuilder()
            .setColor(statusColor[newStatus] || '#6b7280')
            .setTitle(`${statusEmoji[newStatus] || '📋'} Application Status Update`)
            .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/applications/${application._id}`)
            .setDescription(`The application status for **${student.firstName} ${student.lastName}** has been updated.`)
            .addFields(
                { name: '💼 Role', value: job.title, inline: true },
                { name: '🏢 Company', value: job.company.name, inline: true },
                { name: '📊 New Status', value: newStatus.replace('_', ' ').toUpperCase(), inline: true }
            );

        if (updatedBy) {
            embed.setFooter({ text: `Updated by ${updatedBy.firstName} ${updatedBy.lastName}` });
        }

        if (application.feedback) {
            embed.addFields({ name: '💬 Feedback', value: application.feedback.substring(0, 1024) });
        }

        // Add round info if applicable
        if (application.currentRound > 0) {
            embed.addFields({ name: '🔄 Round', value: `Round ${application.currentRound}`, inline: true });
        }

        embed.setTimestamp();
        return embed;
    }

    /**
     * Template for Profile Updates
     */
    static profileUpdate(student, updateType, updatedBy, extraData = {}) {
        const typeConfig = {
            approved: { emoji: '✅', color: '#10b981', title: 'Profile Approved' },
            needs_revision: { emoji: '⚠️', color: '#f59e0b', title: 'Profile Needs Revision' },
            submitted: { emoji: '📤', color: '#3b82f6', title: 'Profile Submitted' }
        };

        const config = typeConfig[updateType] || typeConfig.approved;

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle(`${config.emoji} ${config.title}`)
            .setDescription(`Profile update for **${student.firstName} ${student.lastName}**`)
            .addFields(
                { name: '🎓 Campus', value: student.campus?.name || 'N/A', inline: true },
                { name: '📱 Batch', value: student.studentProfile?.batch || 'N/A', inline: true }
            );

        if (updatedBy) {
            embed.addFields({ name: '👤 Updated By', value: `${updatedBy.firstName} ${updatedBy.lastName}`, inline: true });
        }

        if (extraData.notes) {
            embed.addFields({ name: '📝 Notes', value: extraData.notes.substring(0, 1024) });
        }

        if (student.discord?.username) {
            embed.setFooter({ text: `Discord: ${student.discord.username}` });
        }

        embed.setTimestamp();
        return embed;
    }

    /**
     * Template for Bulk Actions
     */
    static bulkAction(job, count, action, coordinator) {
        return new EmbedBuilder()
            .setColor('#8b5cf6') // Purple
            .setTitle('📦 Bulk Action Performed')
            .setDescription(`A bulk action was performed on applicants for **${job.title}**`)
            .addFields(
                { name: '🏢 Company', value: job.company.name, inline: true },
                { name: '⚡ Action', value: action.replace(/_/g, ' ').toUpperCase(), inline: true },
                { name: '👥 Affected Applicants', value: count.toString(), inline: true },
                { name: '👤 Performed By', value: `${coordinator.firstName} ${coordinator.lastName}`, inline: true }
            )
            .setTimestamp();
    }

    /**
     * Template for System/Test Notifications
     */
    static systemNotification(title, message, type = 'info') {
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        return new EmbedBuilder()
            .setColor(colors[type] || colors.info)
            .setTitle(title)
            .setDescription(message)
            .setTimestamp();
    }
}

module.exports = DiscordMessageTemplates;
