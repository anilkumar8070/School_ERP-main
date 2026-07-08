import React, { useEffect, useState } from 'react'

import { getAuth } from '../../utils/session'
import { getParentAccessCode } from '../../api'
import { toast } from 'react-toastify'

export default function StudentParents() {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const { token } = getAuth()
                const { code } = await getParentAccessCode(token)
                setCode(code)
            } catch (e) {
                toast.error(e.message || 'Failed to load code')
            } finally { setLoading(false) }
        }
        load()
    }, [])

    function copyCode() {
        try {
            navigator.clipboard.writeText(code)
            toast.success('Code copied')
        } catch (e) {
            toast.info('Copy manually')
        }
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Parent Access</h3>
            </header>

            <div className="card p-6 max-w-xl mx-auto text-center">
                <p className="text-muted mb-6">Share this code with your parent/guardian. They can enter it once in their panel to view your progress, attendance and fee status.</p>

                <div className="flex items-center justify-center gap-4 bg-surface p-4 rounded-xl border-2 border-dashed border-subtle mb-4">
                    <span className="text-2xl font-mono font-bold tracking-widest text-main">{loading ? '...' : (code || '------')}</span>
                    <button
                        onClick={copyCode}
                        disabled={!code}
                        className="btn outline sm"
                    >
                        Copy
                    </button>
                </div>

                <div className="text-xs text-muted">Note: Keep this code private. You can request admin to reset if needed.</div>
            </div>
        </div>
    )
}
