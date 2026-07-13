import React from 'react'
import { FaUser, FaLock, FaGoogle, FaFacebookF } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import './LoginLayout.css'

const LoginLayout = ({
    title,
    description = "Hey enter your details to sign in to your account",
    image,
    username,
    setUsername,
    password,
    setPassword,
    onSubmit,
    loading,
    error,
    signupLink,
    forgotPasswordLink = "/forgot-password",
    usernameLabel = "Enter your username/email",
    passwordLabel = "Enter your password"
}) => {
    return (
        <div className="login-container">
            {/* Left Side - Image/Illustration */}
            <div className="login-image-section" style={{ backgroundImage: `url(${image})` }}>
                <div className="login-overlay">
                    {/* Optional text or branding overlay can go here */}
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="login-form-section">
                <div className="login-form-wrapper">
                    <h2 className="login-title">{title}</h2>
                    <p className="login-desc">{description}</p>

                    <form onSubmit={onSubmit} className="login-form">
                        <div className="input-group">
                            {/* <FaUser className="input-icon" /> */}
                            <input
                                type="text"
                                placeholder={usernameLabel}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            {/* <FaLock className="input-icon" /> */}
                            <input
                                type="password"
                                placeholder={passwordLabel}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="login-error">{error}</div>}

                        <div className="form-info">
                            <span className="info-text">Having Trouble in sign in?</span>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Logging In...' : 'Login In'}
                        </button>



                        {signupLink && (
                            <div className="signup-link">
                                Don't have an account? <Link to={signupLink}>Signup Now</Link>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}

export default LoginLayout
