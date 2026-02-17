import React, { useState } from 'react';
import { gharAPI } from '../../services/api';
import './GharDataViewer.css';

const GharDataViewer = () => {
    const [email, setEmail] = useState('');
    const [isDev, setIsDev] = useState(true);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const response = await gharAPI.studentPreview(email, isDev);
            setData(response.data.data);
        } catch (err) {
            console.error('Search error:', err);
            setError(err.response?.data?.message || 'Failed to fetch student data');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return dateStr;
    };

    return (
        <div className="ghar-data-viewer">
            <div className="page-header">
                <div>
                    <h1>Ghar Data Explorer</h1>
                    <p className="subtitle">Search and view raw student data directly from NavGurukul Ghar API</p>
                </div>
            </div>

            <div className="search-card">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="input-group">
                        <label htmlFor="email">Student Email</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="e.g. ankush25@navgurukul.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="toggle-group">
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={isDev}
                                onChange={(e) => setIsDev(e.target.checked)}
                            />
                            <span className="slider round"></span>
                        </label>
                        <span className="toggle-label">{isDev ? 'Dev Mode (isDev=true)' : 'Prod Mode (isDev=false)'}</span>
                    </div>
                    <button type="submit" className="search-button" disabled={loading}>
                        {loading ? <span className="loader"></span> : 'Fetch Data'}
                    </button>
                </form>
            </div>

            {error && (
                <div className="error-alert">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                </div>
            )}

            {data && (
                <div className="data-results">
                    <div className="results-header">
                        <h2>Found {data.length} student record(s)</h2>
                    </div>
                    <div className="table-container">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>English</th>
                                    <th>Status</th>
                                    <th>Campus</th>
                                    <th>Joining Date</th>
                                    <th>Aadhar & Caste</th>
                                    <th>Qualification</th>
                                    <th>Phone & Address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((student, index) => (
                                    <tr key={student.ID || index}>
                                        <td>
                                            <div className="name-cell">
                                                <span className="full-name">{student.Name?.zc_display_value || 'N/A'}</span>
                                                <span className="student-id">ID: {student.Student_ID1}</span>
                                                <span className="dob">DOB: {student.Date_of_Birth || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="email-cell">
                                                <div className="main-email">{student.Navgurukul_Email || 'N/A'}</div>
                                                <div className="sub-text">P: {student.Personal_Email || 'N/A'}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="english-cell">
                                                <span className="badge-s">S: {student.Speak_Improve_Latest_Grade || 'N/A'}</span>
                                                <span className="badge-w">W: {student.Write_Improve_Latest_Grade || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${student.Status?.toLowerCase()}`}>
                                                {student.Status || 'N/A'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="campus-cell">
                                                <div className="campus-name">{student.Select_Campus?.Campus_Name || 'N/A'}</div>
                                                <div className="school-name">{student.Select_School1 || 'N/A'}</div>
                                            </div>
                                        </td>
                                        <td>{formatDate(student.Joining_Date)}</td>
                                        <td>
                                            <div className="info-cell">
                                                <div>Aadhar: {student.Aadhar_No || 'N/A'}</div>
                                                <div className="sub-text">{student.Caste || 'N/A'} | {student.Religion || 'N/A'}</div>
                                            </div>
                                        </td>
                                        <td>{student.Qualification || 'N/A'}</td>
                                        <td>
                                            <div className="address-cell">
                                                <div className="phone">{student.Phone_Number || 'N/A'}</div>
                                                <div className="sub-text truncated" title={student.Address?.zc_display_value}>
                                                    {student.Address?.district_city}, {student.Address?.state_province}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="raw-json-section">
                        <h3>Raw JSON Response</h3>
                        <pre className="json-block">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GharDataViewer;
