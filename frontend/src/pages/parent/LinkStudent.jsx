import React, { useState } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import { linkParentByCode } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'

export default function ParentLinkStudent() {
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)

    async function submit(e) {
        e && e.preventDefault()
        if (!code) { toast.error('Enter code'); return }
        setLoading(true)
        try {
            const { token } = getAuth()
            const res = await linkParentByCode(code, token)
            if (res && res.student) {
                try { localStorage.setItem('parent_linked_student', JSON.stringify(res.student)) } catch (e) { }
                toast.success('Linked successfully')
                window.location.href = '/parent/progress'
            } else {
                toast.error('Failed to link')
            }
        } catch (e) {
            toast.error(e.message || 'Failed')
        } finally { setLoading(false) }
    }

    return (
        <ParentLayout>
            <div className="parent-page">
                <h2>Link Student</h2>
                <p className="text-subtle mt-2">Enter the one-time code shared from the student's panel.</p>
                <form onSubmit={submit} className="mt-4">
                    <label className="form-label">Access Code</label>
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ABC123"
                        className="black-bordered-input w-full max-w-[260px]"
                    />
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Linking...' : 'Link Student'}</button>
                        <a href="/parent/progress" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/parent/progress'); window.dispatchEvent(new PopStateEvent('popstate')) }} className="btn-secondary">Cancel</a>
                    </div>
                </form>
            </div>
        </ParentLayout>
    )
}
