import React from 'react';
import { Link } from 'react-router-dom';
import { MdEmail, MdPhone, MdLocationOn } from 'react-icons/md';

export default function GlobalFooter({ copyrightText = '© 2025 School Management System. All Rights Reserved.' }) {
    return (
        <footer className="global-footer">
            <div className="global-footer-content">
                <div className="footer-section">
                    <h4>About Us</h4>
                    <p>
                        Empowering students and faculty through innovative education and seamless administration. Our portal provides secure access to all your academic needs.
                    </p>
                </div>

                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><a href="/">Home</a></li>
                        <li><a href="/start">Portals</a></li>
                        <li><a href="/admin-login">Admin Login</a></li>
                        <li><a href="/student-login">Student Login</a></li>
                        <li><a href="/faculty-login">Faculty Login</a></li>
                    </ul>
                </div>

                <div className="footer-section">
                    <h4>Contact Information</h4>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MdLocationOn size={18} color="var(--secondary)" />
                            <span>123 Academic Way, University City, TX 75000</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MdPhone size={18} color="var(--secondary)" />
                            <span>+1 (555) 123-4567</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MdEmail size={18} color="var(--secondary)" />
                            <span>support@schoolerp.edu</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="global-footer-bottom">
                {copyrightText}
            </div>
        </footer>
    );
}
