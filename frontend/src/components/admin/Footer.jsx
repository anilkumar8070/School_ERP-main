import React from 'react'

export default function Footer({ copyrightText = 'copyright @AdminPanel 2025' }) {
    return (
        <footer className="admin-footer">{copyrightText}</footer>
    )
}
