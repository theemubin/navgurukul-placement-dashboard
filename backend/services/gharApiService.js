const axios = require('axios');

/**
 * Service to interact with Ghar Dashboard Dashboard (Zoho) APIs
 * Base URL: https://ghar.navgurukul.org
 */
class GharApiService {
    constructor() {
        this.baseURL = 'https://ghar.navgurukul.org';
        this.token = process.env.NAVGURUKUL_API_TOKEN;

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Add request interceptor to include auth token
        this.client.interceptors.request.use(
            (config) => {
                if (this.token) {
                    const cleanToken = this.token.split('eyJhbGci').find(t => t.length > 0) ? 'eyJhbGci' + this.token.split('eyJhbGci').pop() : this.token;
                    config.headers['Authorization'] = `Bearer ${cleanToken}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('Ghar API Error:', {
                    endpoint: error.config?.url,
                    status: error.response?.status,
                    message: error.response?.data?.message || error.message
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Fetch all attendance configurations
     * @param {boolean} isDev - Whether to use dev mode
     * @returns {Promise<Object>} Attendance configurations
     */
    async getAllAttendanceConfigurations(isDev = true) {
        try {
            const response = await this.client.get('/gharZoho/All_Attendance_Configurations', {
                params: { isDev }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch attendance configurations: ${error.message}`);
        }
    }

    /**
     * Fetch student attendance data
     * @param {string} studentId - Student ID from Ghar system
     * @returns {Promise<Object>} Student attendance data
     */
    async getStudentAttendance(studentId) {
        try {
            const response = await this.client.get(`/gharZoho/student/${studentId}/attendance`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch student attendance: ${error.message}`);
        }
    }

    /**
     * Sync student data from Ghar API to local database
     * @param {string} email - Student email to match
     * @returns {Promise<Object>} Synced data or null
     */
    async syncStudentData(email) {
        try {
            const response = await this.client.get('/gharZoho/students/By/NgEmail', {
                params: {
                    isDev: true,
                    Student_ng_email: email
                }
            });

            // The API returns an array in data, take the first match
            if (response.data && response.data.data && response.data.data.length > 0) {
                const externalData = response.data.data[0];
                const User = require('../models/User');
                await User.syncGharData(email, externalData);
                return externalData;
            }
            return null;
        } catch (error) {
            console.error(`Sync failed for ${email}:`, error.message);
            return null;
        }
    }

    /**
     * Batch sync multiple students
     * @param {Array<string>} emails - Array of student emails
     * @returns {Promise<Array>} Array of synced student data
     */
    async batchSyncStudents(emails) {
        try {
            const promises = emails.map(email => this.syncStudentData(email));
            const results = await Promise.allSettled(promises);

            return results.map((result, index) => ({
                email: emails[index],
                success: result.status === 'fulfilled' && result.value !== null,
                data: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason.message : (result.value === null ? 'No data returned' : null)
            }));
        } catch (error) {
            throw new Error(`Batch sync failed: ${error.message}`);
        }
    }

    /**
     * Check if API is accessible and token is valid
     * @returns {Promise<boolean>} Whether API is accessible
     */
    async checkConnection() {
        try {
            await this.getAllAttendanceConfigurations();
            return true;
        } catch (error) {
            console.error('Ghar API connection check failed:', error.message);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new GharApiService();
