const { Client, GatewayIntentBits, EmbedBuilder, ChannelType } = require('discord.js');
const Settings = require('../models/Settings');

class DiscordService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.isInitializing = false;
    }

    /**
     * Initialize Discord bot client
     */
    async initialize() {
        if (this.isInitializing || this.isReady) {
            return;
        }

        this.isInitializing = true;

        try {
            const settings = await Settings.getSettings();

            if (!settings.discordConfig?.enabled) {
                console.log('Discord integration is disabled in settings');
                this.isInitializing = false;
                return;
            }

            if (!settings.discordConfig?.botToken) {
                console.log('Discord bot token not configured');
                this.isInitializing = false;
                return;
            }

            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages
                ]
            });

            this.client.once('ready', () => {
                console.log(`✅ Discord bot logged in as ${this.client.user.tag}`);
                this.isReady = true;
                this.isInitializing = false;
            });

            this.client.on('error', (error) => {
                console.error('Discord client error:', error);
            });

            await this.client.login(settings.discordConfig.botToken);
        } catch (error) {
            console.error('Failed to initialize Discord bot:', error.message);
            this.isReady = false;
            this.isInitializing = false;
        }
    }

    /**
     * Check if Discord is ready to send messages
     */
    async ensureReady() {
        if (!this.isReady && !this.isInitializing) {
            await this.initialize();
        }

        // Wait for initialization to complete
        let attempts = 0;
        while (this.isInitializing && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        return this.isReady;
    }

    /**
     * Send a new job posting notification
     * @param {Object} job - Job document
     * @param {Object} coordinator - User who created the job
     * @param {Array} eligibleStudents - List of eligible students
     */
    async sendJobPosting(job, coordinator, eligibleStudents = []) {
        try {
            const ready = await this.ensureReady();
            if (!ready) {
                console.log('Discord not ready, skipping job posting notification');
                return null;
            }

            const settings = await Settings.getSettings();
            const channelId = settings.discordConfig?.channels?.jobPostings;

            if (!channelId) {
                console.log('Job postings channel not configured');
                return null;
            }

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error('Job postings channel not found');
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setColor('#3b82f6')
                .setTitle(`🆕 New Job: ${job.title}`)
                .setDescription(job.description.substring(0, 300) + (job.description.length > 300 ? '...' : ''))
                .addFields(
                    { name: '🏢 Company', value: job.company.name, inline: true },
                    { name: '📍 Location', value: job.location || 'Not specified', inline: true },
                    { name: '💼 Type', value: job.jobType.replace('_', ' ').toUpperCase(), inline: true },
                    { name: '💰 Salary', value: job.salary?.min && job.salary?.max ? `₹${job.salary.min} - ₹${job.salary.max}` : 'Not disclosed', inline: true },
                    { name: '📅 Deadline', value: new Date(job.applicationDeadline).toLocaleDateString('en-IN'), inline: true },
                    { name: '👥 Eligible Students', value: `~${eligibleStudents.length || 0}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Posted by ${coordinator.firstName} ${coordinator.lastName}` });

            // Send message
            const message = await channel.send({ embeds: [embed] });

            // Create thread if enabled
            let thread = null;
            if (settings.discordConfig?.useThreads) {
                thread = await message.startThread({
                    name: `${job.company.name} - ${job.title}`.substring(0, 100),
                    autoArchiveDuration: 1440, // 24 hours
                    reason: 'Job posting discussion thread'
                });

                await thread.send(`📋 **Job ID:** ${job._id}\n💬 Use this thread for updates and discussions about this job posting.`);
            }

            return {
                messageId: message.id,
                channelId: channel.id,
                threadId: thread?.id
            };
        } catch (error) {
            console.error('Error sending job posting to Discord:', error);
            return { error: error.message };
        }
    }

    /**
     * Send application status update
     * @param {Object} application - Application document
     * @param {Object} job - Job document
     * @param {Object} student - Student user document
     * @param {Object} updatedBy - User who updated the application
     */
    async sendApplicationUpdate(application, job, student, updatedBy) {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const settings = await Settings.getSettings();
            let channel = null;

            // Priority: Job Thread > Configured Channel
            if (job.discordThreadId) {
                try {
                    channel = await this.client.channels.fetch(job.discordThreadId);
                    if (!channel) throw new Error('Thread not found');
                } catch (e) {
                    console.warn(`Failed to fetch job thread ${job.discordThreadId}, falling back to channel`);
                }
            }

            if (!channel) {
                const channelId = settings.discordConfig?.channels?.applicationUpdates;
                if (!channelId) return null;

                channel = await this.client.channels.fetch(channelId);
                if (!channel) throw new Error('Application updates channel not found');
            }

            const statusEmoji = {
                applied: '📝',
                shortlisted: '⭐',
                in_progress: '🔄',
                interviewing: '🎤',
                selected: '🎉',
                rejected: '❌',
                withdrawn: '↩️'
            };

            const statusColor = {
                applied: '#6b7280',
                shortlisted: '#f59e0b',
                in_progress: '#3b82f6',
                interviewing: '#8b5cf6',
                selected: '#10b981',
                rejected: '#ef4444',
                withdrawn: '#9ca3af'
            };

            const embed = new EmbedBuilder()
                .setColor(statusColor[application.status] || '#6b7280')
                .setTitle(`${statusEmoji[application.status]} Application Update`)
                .setDescription(`**${student.firstName} ${student.lastName}**'s application status changed`)
                .addFields(
                    { name: '💼 Job', value: job.title, inline: true },
                    { name: '🏢 Company', value: job.company.name, inline: true },
                    { name: '📊 New Status', value: application.status.replace('_', ' ').toUpperCase(), inline: true },
                    { name: '👤 Updated By', value: `${updatedBy.firstName} ${updatedBy.lastName}`, inline: true }
                )
                .setTimestamp();

            // Add feedback if present
            if (application.feedback) {
                embed.addFields({ name: '💬 Feedback', value: application.feedback.substring(0, 1024) });
            }

            // Mention student if they have Discord ID and mentions are enabled
            let content = '';
            if (settings.discordConfig?.mentionUsers && student.discord?.userId) {
                content = `<@${student.discord.userId}>`;
            }

            const message = await channel.send({ content, embeds: [embed] });

            return {
                messageId: message.id,
                channelId: channel.id
            };
        } catch (error) {
            console.error('Error sending application update to Discord:', error);
            return { error: error.message };
        }
    }

    /**
     * Send profile update notification
     * @param {Object} student - Student user document
     * @param {String} updateType - Type of update ('approved', 'needs_revision', etc.)
     * @param {Object} updatedBy - User who updated the profile
     */
    async sendProfileUpdate(student, updateType, updatedBy) {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const settings = await Settings.getSettings();


            // Prioritize Campus specific channel
            let channelId = null;
            if (student.campus?.discordChannelId) {
                channelId = student.campus.discordChannelId;
            } else {
                channelId = settings.discordConfig?.channels?.profileUpdates;
            }

            if (!channelId) return null;

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) throw new Error('Profile updates channel not found');

            const typeConfig = {
                approved: { emoji: '✅', color: '#10b981', title: 'Profile Approved' },
                needs_revision: { emoji: '📝', color: '#f59e0b', title: 'Profile Needs Revision' },
                submitted: { emoji: '📤', color: '#3b82f6', title: 'Profile Submitted for Review' }
            };

            const config = typeConfig[updateType] || typeConfig.approved;

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`${config.emoji} ${config.title}`)
                .setDescription(`**${student.firstName} ${student.lastName}**'s profile has been updated`)
                .addFields(
                    { name: '🎓 Campus', value: student.campus?.name || 'N/A', inline: true },
                    { name: '👤 Updated By', value: `${updatedBy.firstName} ${updatedBy.lastName}`, inline: true }
                )
                .setTimestamp();

            // Add revision notes if present
            if (updateType === 'needs_revision' && student.studentProfile?.revisionNotes) {
                embed.addFields({ name: '📋 Notes', value: student.studentProfile.revisionNotes.substring(0, 1024) });
            }

            // Mention student if they have Discord ID
            let content = '';
            if (settings.discordConfig?.mentionUsers && student.discord?.userId) {
                content = `<@${student.discord.userId}>`;
            }

            const message = await channel.send({ content, embeds: [embed] });

            return {
                messageId: message.id,
                channelId: channel.id
            };
        } catch (error) {
            console.error('Error sending profile update to Discord:', error);
            return { error: error.message };
        }
    }

    /**
     * Send bulk action notification
     * @param {Object} job - Job document
     * @param {Number} count - Number of applicants affected
     * @param {String} action - Action performed
     * @param {Object} coordinator - User who performed the action
     */
    async sendBulkUpdate(job, count, action, coordinator) {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const settings = await Settings.getSettings();
            let channel = null;

            // Prioritize thread
            if (job.discordThreadId) {
                try {
                    channel = await this.client.channels.fetch(job.discordThreadId);
                } catch (e) {
                    console.warn(`Failed to fetch thread ${job.discordThreadId}`);
                }
            }

            if (!channel) {
                const channelId = settings.discordConfig?.channels?.applicationUpdates;
                if (!channelId) return null;

                channel = await this.client.channels.fetch(channelId);
                if (!channel) throw new Error('Application updates channel not found');
            }

            const embed = new EmbedBuilder()
                .setColor('#8b5cf6')
                .setTitle('📦 Bulk Action Performed')
                .setDescription(`${count} applicant${count !== 1 ? 's' : ''} updated for **${job.title}**`)
                .addFields(
                    { name: '🏢 Company', value: job.company.name, inline: true },
                    { name: '⚡ Action', value: action, inline: true },
                    { name: '👤 By', value: `${coordinator.firstName} ${coordinator.lastName}`, inline: true }
                )
                .setTimestamp();

            const message = await channel.send({ embeds: [embed] });

            return {
                messageId: message.id,
                channelId: channel.id
            };
        } catch (error) {
            console.error('Error sending bulk update to Discord:', error);
            return { error: error.message };
        }
    }

    /**
     * Create a thread for ongoing updates
     * @param {String} channelId - Channel ID where thread should be created
     * @param {String} threadName - Name of the thread
     * @param {String} initialMessage - Initial message in the thread
     */
    async createThread(channelId, threadName, initialMessage) {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) throw new Error('Channel not found');

            const thread = await channel.threads.create({
                name: threadName.substring(0, 100),
                autoArchiveDuration: 1440,
                type: ChannelType.PublicThread,
                reason: 'Automated thread creation'
            });

            if (initialMessage) {
                await thread.send(initialMessage);
            }

            return thread;
        } catch (error) {
            console.error('Error creating thread:', error);
            return null;
        }
    }

    /**
     * Send message to an existing thread
     * @param {String} threadId - Thread ID
     * @param {String} message - Message to send
     */
    async sendToThread(threadId, message) {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const thread = await this.client.channels.fetch(threadId);
            if (!thread) throw new Error('Thread not found');

            const sentMessage = await thread.send(message);
            return sentMessage;
        } catch (error) {
            console.error('Error sending to thread:', error);
            return null;
        }
    }

    /**
     * Get server information
     */
    async getServerInfo() {
        try {
            const ready = await this.ensureReady();
            if (!ready) return null;

            const settings = await Settings.getSettings();
            const guildId = settings.discordConfig?.guildId;

            if (!guildId) return null;

            const guild = await this.client.guilds.fetch(guildId);
            if (!guild) return null;

            const channels = await guild.channels.fetch();
            const textChannels = channels.filter(ch => ch.type === ChannelType.GuildText);

            return {
                name: guild.name,
                memberCount: guild.memberCount,
                channels: textChannels.map(ch => ({
                    id: ch.id,
                    name: ch.name
                }))
            };
        } catch (error) {
            console.error('Error getting server info:', error);
            return null;
        }
    }

    /**
     * Test Discord connection
     */
    async testConnection() {
        try {
            const ready = await this.ensureReady();
            if (!ready) {
                return { success: false, message: 'Discord bot not ready' };
            }

            const settings = await Settings.getSettings();
            const channelId = settings.discordConfig?.channels?.general;

            if (!channelId) {
                return { success: false, message: 'Test channel not configured' };
            }

            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                return { success: false, message: 'Test channel not found' };
            }

            const embed = new EmbedBuilder()
                .setColor('#10b981')
                .setTitle('✅ Discord Integration Test')
                .setDescription('Discord bot is connected and working properly!')
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            return { success: true, message: 'Test message sent successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Gracefully shutdown Discord client
     */
    async shutdown() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            console.log('Discord bot disconnected');
        }
    }
}

// Export singleton instance
module.exports = new DiscordService();
