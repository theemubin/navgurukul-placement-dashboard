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
                if (this.token && typeof this.token === 'string') {
                    // Extract JWT if it's duplicated in .env (common issue)
                    const jwtMarker = 'eyJhbGci';
                    let tokenToUse = this.token.trim();
                    if (tokenToUse.includes(jwtMarker)) {
                        tokenToUse = jwtMarker + tokenToUse.split(jwtMarker).pop();
                    }
                    
                    // Most APIs expect Bearer prefix for JWT
                    config.headers['Authorization'] = tokenToUse.startsWith('Bearer ') 
                        ? tokenToUse 
                        : `Bearer ${tokenToUse}`;
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
     * Fetch filtered students from Ghar Zoho using the filter endpoint
     * @param {Object} filters - Filter parameters (campus, school, status, etc.)
     * @param {boolean} isDev - Whether to use dev mode
     * @returns {Promise<Array>} List of students
     */
    async fetchFilteredStudents(filters = {}, isDev = process.env.NODE_ENV !== 'production') {
        try {
            const params = {
                ...filters,
                isDev,
                stdIdStart: filters.stdIdStart || 1,
                stdIdEnd: filters.stdIdEnd || 5000
            };
            
            console.log(`[GharSync] Fetching students:`, {
                url: this.baseURL + '/gharZoho/students/filter',
                params,
                tokenAvailable: !!this.token,
                tokenPrefixCorrect: this.token?.startsWith('eyJhbGci')
            });
            const response = await this.client.get('/gharZoho/students/filter', { params });

            if (response.data && response.data.students && Array.isArray(response.data.students)) {
                return response.data.students;
            }
            return [];
        } catch (error) {
            console.error('[GharSync] Fetch filtered students failed:', error.message);
            throw error;
        }
    }

    /**
     * Fetch all active students from Ghar Zoho
     * @param {boolean} isDev - Whether to use dev mode
     * @returns {Promise<Array>} List of students
     */
    async fetchAllStudents(isDev = process.env.NODE_ENV !== 'production') {
        try {
            const response = await this.client.get('/gharZoho/All_Students', {
                params: { isDev }
            });

            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                return response.data.data;
            }
            return [];
        } catch (error) {
            console.error('[GharSync] Fetch all students failed:', error.message);
            throw new Error(`Failed to fetch all students: ${error.message}`);
        }
    }

    /**
     * Fetch all attendance configurations
     * @param {boolean} isDev - Whether to use dev mode
     * @returns {Promise<Object>} Attendance configurations
     */
    async getAllAttendanceConfigurations(isDev = process.env.NODE_ENV !== 'production') {
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
        if (!email) return null;
        
        try {
            // Normalize email: trim and lowercase
            const normalizedEmail = email.trim().toLowerCase();
            const isDev = process.env.NODE_ENV !== 'production';

            console.log(`[GharAPI] Attempting sync for: "${normalizedEmail}" (Original: "${email}", isDev: ${isDev})`);

            const tryFetch = async (envMode) => {
                const res = await this.client.get('/gharZoho/students/By/NgEmail', {
                    params: {
                        isDev: envMode,
                        Student_ng_email: normalizedEmail
                    }
                });
                return res;
            };

            // Try primary environment
            let response = await tryFetch(isDev);

            // If no data found in primary, try the fallback
            if (!response.data || !response.data.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
                console.log(`[GharAPI] No data in primary env (${isDev}), trying fallback (${!isDev}) for ${normalizedEmail}`);
                response = await tryFetch(!isDev);
            }

            // Process response
            if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                const externalData = response.data.data[0];
                console.log(`[GharAPI] Found data for ${normalizedEmail}. Status: ${externalData.Status}`);
                
                const User = require('../models/User');
                await User.syncGharData(normalizedEmail, externalData);
                return externalData;
            }

            console.warn(`[GharAPI] Student not found in any environment for email: ${normalizedEmail}`);
            return null;
        } catch (error) {
            console.error(`[GharAPI] Sync failed for ${email}:`, error.message);
            if (error.response) {
                console.error(`[GharAPI] Response data:`, error.response.data);
            }
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
