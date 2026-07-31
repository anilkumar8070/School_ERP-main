import React from 'react'

export default function Footer({ copyrightText = '© Parent Panel 2025' }) {
    return (
        <footer className="parent-footer">{copyrightText}</footer>
    )
}
