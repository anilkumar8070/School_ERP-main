import React from 'react'

export default function Footer({ copyrightText = '© FACULTY ERP 2025' }) {
    return (
        <footer className="faculty-footer">{copyrightText}</footer>
    )
}
