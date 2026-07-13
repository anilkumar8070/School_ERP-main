import React from 'react';
import { Link } from 'react-router-dom';
import { FaSchool } from 'react-icons/fa';

export default function Dashboard() {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white text-gray-800 py-4 px-6 md:px-12 flex justify-between items-center shadow-md relative z-10">
                <div className="flex items-center gap-2">
                    <FaSchool className="text-3xl text-black" />
                    <span className="text-xl font-bold tracking-tight">ERP-School</span>
                </div>
                <nav>
                    <Link
                        to="/start"
                        className="inline-block bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-8 rounded-full transition-colors duration-200"
                    >
                        Get Started
                    </Link>
                </nav>
            </header>

            {/* Hero Section */}
            <main className="min-h-screen relative flex items-center justify-center text-center text-white">
                {/* Background Image Overlay */}
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{
                        backgroundImage: "url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop')",
                    }}
                >
                    <div className="absolute inset-0 bg-black/70"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 px-4 max-w-4xl mx-auto flex flex-col items-center">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                        Welcome to the <br />
                        School Management System
                    </h1>

                    <div className="mt-12 md:mt-24 space-y-8">
                        <p className="text-lg md:text-xl italic font-light">
                            Effortless School Management Starts Here!
                        </p>

                        <p className="max-w-3xl text-sm md:text-base text-gray-200 leading-relaxed font-light">
                            "Digitize your entire school ecosystem with a cloud-based solution built for speed,
                            reliability, and scalability. Manage users, track performance, automate attendance,
                            and keep everyone informed – all from one secure platform."
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-[#485563] text-white py-10 px-6 md:px-12 border-t border-gray-700">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
                    {/* Brand Column */}
                    <div>
                        <h3 className="font-bold text-base mb-3">ERP - School</h3>
                        <p className="text-gray-300 leading-relaxed">
                            Streamline academic and administrative processes easily.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-bold text-base mb-3">Quick Links</h3>
                        <ul className="space-y-2 text-gray-300">
                            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
                            <li><Link to="/start" className="hover:text-white transition-colors">Login</Link></li>
                            <li><Link to="/#" className="hover:text-white transition-colors">Dashboard</Link></li>
                            <li><Link to="/#" className="hover:text-white transition-colors">Support</Link></li>
                        </ul>
                    </div>

                    {/* Contact Us */}
                    <div>
                        <h3 className="font-bold text-base mb-3">Contact Us</h3>
                        <ul className="space-y-2 text-gray-300">
                            <li>Email: support@aca-school.com</li>
                            <li>Phone: +91 xxxxxxxxxx</li>
                            <li>Location: Pune, Maharashtra</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-600 text-center text-xs text-gray-400">
                    &copy; 2025 ACA. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
