import React, { useEffect, useMemo, useState, useRef } from 'react'
import { getAuth } from '../../utils/session'
import { getMyHostelAllocations, getHostelsPublic, markHostelAllocationPaid, getMyHostelReceipts, createRazorpayOrder, confirmPayment, getMyStudent, API_BASE } from '../../api'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default function StudentHostel() {
    const { token } = getAuth()
    const qc = useQueryClient()

    const [allocs, setAllocs] = useState([])
    const [selectedAllocId, setSelectedAllocId] = useState('')
    const [hostels, setHostels] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [receipts, setReceipts] = useState([])

    const { data: allocsData, isLoading: loadingAllocations } = useQuery({ queryKey: ['hostelAllocations', token], queryFn: () => getMyHostelAllocations(token), enabled: !!token })
    const { data: hostelsData } = useQuery({ queryKey: ['hostelsPublic'], queryFn: () => getHostelsPublic() })
    const { data: receiptsData, isLoading: loadingReceipts } = useQuery({ queryKey: ['hostelReceipts', token], queryFn: () => getMyHostelReceipts(token), enabled: !!token })

    useEffect(() => {
        setAllocs(Array.isArray(allocsData) ? allocsData : [])
    }, [allocsData])
    useEffect(() => {
        setHostels(Array.isArray(hostelsData) ? hostelsData : [])
    }, [hostelsData])
    useEffect(() => {
        setReceipts(Array.isArray(receiptsData) ? receiptsData : [])
    }, [receiptsData])

    useEffect(() => { setLoading(loadingAllocations || loadingReceipts) }, [loadingAllocations, loadingReceipts])

    function findHostel(id) { return hostels.find(h => String(h._id) === String(id)) }

    const selectedAlloc = useMemo(() => {
        if (!allocs || allocs.length === 0) return null
        if (selectedAllocId) return allocs.find(a => String(a._id || a.id) === String(selectedAllocId)) || allocs[0]
        return allocs[0]
    }, [allocs, selectedAllocId])

    const termParts = useMemo(() => {
        if (!selectedAlloc || !selectedAlloc.fee) return [];
        const parts = Number(selectedAlloc.fee.parts || 1);
        const per = Number(selectedAlloc.fee.perPart || selectedAlloc.fee.amount || 0);
        // Check receipts for paid terms
        const paidTerms = new Set(receipts.filter(r => String(r.allocationId) === String(selectedAlloc._id || selectedAlloc.id)).map(r => r.term));
        return Array.from({ length: parts }, (_, i) => ({
            index: i + 1,
            amount: per,
            paid: paidTerms.has(`Term ${i + 1}`)
        }));
    }, [selectedAlloc, receipts]);

    const receiptRef = useRef(null)
    const [lastReceipt, setLastReceipt] = useState(null)
    function normalizeReceiptForView(r) {
        if (!r) return null
        return {
            ...r,
            date: r.date || r.createdAt || r.created_at || new Date().toISOString(),
            paymentId: r.paymentId || r.razorpayPaymentId || r.razorpay_payment_id || r.payment_id || '',
            orderId: r.orderId || r.razorpayOrderId || r.razorpay_order_id || '',
            backendReceipt: r
        }
    }

    async function viewReceipt(r) {
        try {
            // Ensure we have the logged-in student's profile (rollNo/class)
            let student = null
            try { student = await getMyStudent(token) } catch (e) { student = null }

            // Try to resolve allocation details for this receipt
            let alloc = null
            try {
                alloc = (allocs || []).find(a => String(a._id || a.id) === String(r.allocationId)) || null
                if (!alloc && r.allocationId) {
                    const fetched = await getMyHostelAllocations(token)
                    alloc = Array.isArray(fetched) ? fetched.find(a => String(a._id || a.id) === String(r.allocationId)) : null
                    if (alloc) setAllocs(list => {
                        // merge if new
                        const exists = (list || []).some(x => String(x._id || x.id) === String(alloc._id || alloc.id))
                        return exists ? list : [alloc, ...list]
                    })
                }
            } catch (e) { alloc = null }

            const norm = normalizeReceiptForView(r || {})
            // attach richer fields
            norm.student = norm.student || student || null;
            norm.rollNo = norm.rollNo || (student && student.rollNo) || ''
            norm.studentClass = norm.studentClass || (student && (student.class || student.studentClass)) || norm.class || ''
            norm.allocation = norm.allocation || alloc || null
            setLastReceipt(norm)
            setError('')
            // scroll into view
            if (receiptRef.current) setTimeout(() => receiptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
        } catch (e) {
            console.error('Failed to view receipt', e)
            setError('Failed to load receipt details')
        }
    }

    // Polling helper: try to find the newly created receipt by paymentId/allocationId
    async function pollForReceipt({ allocationId, paymentId, term }, attempts = 6, delay = 800) {
        for (let i = 0; i < attempts; i++) {
            try {
                const latestReceipts = await getMyHostelReceipts(token)
                const list = Array.isArray(latestReceipts) ? latestReceipts : []
                setReceipts(list)
                // try to match by paymentId first, then by allocationId+term
                let found = null
                if (paymentId) found = list.find(x => String(x.razorpayPaymentId || x.paymentId || '') === String(paymentId))
                if (!found && allocationId) found = list.find(x => String(x.allocationId || '') === String(allocationId) && (!term || String(x.term || '').includes(String(term || ''))))
                if (found) {
                    await viewReceipt(found)
                    return found
                }
            } catch (e) {
                console.warn('pollForReceipt attempt failed', e)
            }
            await new Promise(r => setTimeout(r, delay))
        }
        return null
    }

    async function downloadPdf() {
        if (!receiptRef.current) {
            setError('No receipt to download')
            return
        }
        try {
            // Clone node and fix SVG attributes that may be 'auto' (html2canvas complains)
            const node = receiptRef.current
            const wrapper = document.createElement('div')
            wrapper.style.position = 'fixed'
            wrapper.style.left = '-10000px'
            wrapper.style.top = '0'
            wrapper.style.opacity = '0'
            wrapper.appendChild(node.cloneNode(true))
            document.body.appendChild(wrapper)
            const cloned = wrapper.firstChild
            // Fix SVGs and inline styles with width/height='auto' or invalid values
            const svgs = (cloned.querySelectorAll && cloned.querySelectorAll('svg')) || []
            svgs.forEach(s => {
                try {
                    // check attributes and styles for 'auto' (case-insensitive)
                    const fixAttr = (attr) => {
                        const v = s.getAttribute && s.getAttribute(attr)
                        if (!v) return
                        const tv = String(v).trim().toLowerCase()
                        if (tv === 'auto') {
                            const rect = s.getBoundingClientRect()
                            if (rect && rect.width && rect.height) {
                                if (attr === 'width') s.setAttribute('width', String(rect.width))
                                if (attr === 'height') s.setAttribute('height', String(rect.height))
                            } else {
                                s.removeAttribute(attr)
                            }
                        }
                    }
                    fixAttr('width')
                    fixAttr('height')
                    // also check inline style
                    const style = s.getAttribute && s.getAttribute('style')
                    if (style && String(style).toLowerCase().includes('width:auto')) {
                        const rect = s.getBoundingClientRect()
                        if (rect && rect.width) s.style.width = rect.width + 'px'
                    }
                    if (style && String(style).toLowerCase().includes('height:auto')) {
                        const rect = s.getBoundingClientRect()
                        if (rect && rect.height) s.style.height = rect.height + 'px'
                    }
                } catch (e) { }
            })
            // Also fix any IMG elements with SVG data that may have width/height='auto' attributes
            const imgs = (cloned.querySelectorAll && cloned.querySelectorAll('img')) || []
            imgs.forEach(img => {
                try {
                    const w = img.getAttribute && img.getAttribute('width')
                    const h = img.getAttribute && img.getAttribute('height')
                    if (w && String(w).trim().toLowerCase() === 'auto') img.removeAttribute('width')
                    if (h && String(h).trim().toLowerCase() === 'auto') img.removeAttribute('height')
                    const st = img.getAttribute && img.getAttribute('style')
                    if (st && String(st).toLowerCase().includes('width:auto')) img.style.width = ''
                    if (st && String(st).toLowerCase().includes('height:auto')) img.style.height = ''
                } catch (e) { }
            })
            const canvas = await html2canvas(cloned, { scale: 2 })
            document.body.removeChild(wrapper)
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] })
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
            pdf.save(`receipt_${lastReceipt?.paymentId || Date.now()}.pdf`)
        } catch (e) {
            console.error('PDF generation failed', e)
            setError('Failed to generate PDF')
        }
    }

    // Helper: format amount without unnecessary .00 when integer
    function formatAmount(value) {
        const n = Number(value || 0)
        if (Number.isInteger(n)) return `₹${n}`
        return `₹${n.toFixed(2)}`
    }

    // Build consistent receipt HTML (matches the attached style) for PDF generation
    function buildReceiptHtml({ id, paymentId, studentName, rollNo, studentEmail, studentClass, term, amount, date, hostelName, room }) {
        const rid = id || paymentId || ''
        const d = new Date(date || new Date()).toLocaleString()
        const amt = formatAmount(amount)
        return `
                <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding:20px;">
                    <div style="max-width:760px;margin:0 auto;background:#fff;border-radius:8px;padding:22px;border:1px solid #e6e9ef;box-shadow:0 1px 0 rgba(15,23,42,0.04);">
                        <div style="text-align:center;margin-bottom:14px;">
                            <div style="font-size:28px;font-weight:700;color:#0b1220;">School Name</div>
                            <div style="font-size:16px;margin-top:6px;color:#0b1220;font-weight:700;">Hostel Fee Receipt</div>
                            <div style="margin-top:6px;color:#475569;font-size:13px">Receipt ID: ${rid}</div>
                        </div>
                        <div style="margin-top:8px;border-top:1px solid #eef2f7;padding-top:12px">
                            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0b1220">
                                <tbody>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="width:30%;padding:8px 6px;color:#334155"><strong>Student</strong></td>
                                        <td style="padding:8px 6px">${studentName || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Roll No</strong></td>
                                        <td style="padding:8px 6px">${rollNo || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Class</strong></td>
                                        <td style="padding:8px 6px">${studentClass || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Email</strong></td>
                                        <td style="padding:8px 6px">${studentEmail || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Hostel</strong></td>
                                        <td style="padding:8px 6px">${hostelName || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Room</strong></td>
                                        <td style="padding:8px 6px">${room || ''}</td>
                                    </tr>
                                    <tr style="border-bottom:1px solid #f1f5f9;height:40px">
                                        <td style="padding:8px 6px;color:#334155"><strong>Term</strong></td>
                                        <td style="padding:8px 6px">${term || ''}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top:14px;padding:12px 0;border-top:1px dashed #e6eef8;display:flex;justify-content:space-between;align-items:center">
                            <div style="color:#64748b;font-size:12px">This is a system generated receipt.</div>
                            <div style="text-align:right">
                                <div style="font-size:13px;color:#334155">Amount Paid</div>
                                <div style="font-weight:800;font-size:20px;margin-top:6px">${amt}</div>
                            </div>
                        </div>
                        <div style="margin-top:10px;color:#475569;font-size:12px">Date: ${d}</div>
                        <div style="margin-top:4px;color:#475569;font-size:12px">Payment ID: ${paymentId || ''}</div>
                    </div>
                </div>`
    }

    // Generate PDF from HTML string using html2canvas + jsPDF
    async function generatePdfFromHtml(html, filename = `receipt_${Date.now()}.pdf`) {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'fixed'
        wrapper.style.left = '-10000px'
        wrapper.style.top = '0'
        wrapper.style.opacity = '0'
        wrapper.innerHTML = html
        document.body.appendChild(wrapper)
        try {
            const node = wrapper.firstElementChild || wrapper
            const canvas = await html2canvas(node, { scale: 2 })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] })
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
            pdf.save(filename)
        } catch (e) {
            console.error('PDF generation failed', e)
            setError('Failed to generate PDF')
        } finally {
            document.body.removeChild(wrapper)
        }
    }

    // Helper to download the currently viewed receipt (uses DOM in receiptRef)
    async function downloadViewedReceiptPdf() {
        try {
            if (!lastReceipt) return setError('No receipt selected')
            // Prefer server PDF if backend provided one
            const backend = lastReceipt.backendReceipt || lastReceipt
            if (backend && backend.pdfUrl) {
                try {
                    const href = String(backend.pdfUrl || '')
                    const url = href.startsWith('http') ? href : `${API_BASE}${href}`
                    const { token } = getAuth()
                    const headers = {}
                    if (token) headers['Authorization'] = `Bearer ${token}`
                    const res = await fetch(url, { credentials: 'include', headers })
                    if (!res.ok) throw new Error('Failed to download receipt')
                    const blob = await res.blob()
                    const blobUrl = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = blobUrl
                    const filename = (href && href.split('/').pop()) || `receipt_${backend._id || Date.now()}.pdf`
                    a.download = filename
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    window.URL.revokeObjectURL(blobUrl)
                    return
                } catch (e) {
                    console.error('Failed to download server PDF', e)
                    // fallthrough to generate PDF locally
                }
            }
            // Otherwise generate from a consistent HTML template using the receipt object
            const html = buildReceiptHtml({
                id: backend && backend._id,
                paymentId: backend && (backend.razorpayPaymentId || backend.paymentId),
                studentName: lastReceipt.studentName || (lastReceipt.student && lastReceipt.student.name) || '',
                rollNo: lastReceipt.rollNo || (lastReceipt.student && lastReceipt.student.rollNo) || '',
                studentEmail: lastReceipt.studentEmail || (lastReceipt.student && lastReceipt.student.email) || '',
                studentClass: lastReceipt.studentClass || lastReceipt.class || (lastReceipt.student && (lastReceipt.student.class || lastReceipt.student.studentClass)) || '',
                term: lastReceipt.term || '',
                amount: Number(lastReceipt.amount || 0),
                date: lastReceipt.date || lastReceipt.createdAt || new Date().toISOString(),
                hostelName: lastReceipt.allocation ? (findHostel(lastReceipt.allocation.hostelId)?.name || lastReceipt.allocation.hostelName) : '',
                room: lastReceipt.allocation ? `${lastReceipt.allocation.floorNo} / ${lastReceipt.allocation.roomNo} / ${Number(lastReceipt.allocation.bedIndex) + 1}` : ''
            })
            await generatePdfFromHtml(html, `receipt_${backend && (backend._id || backend.razorpayPaymentId) || Date.now()}.pdf`)
        } catch (e) {
            console.error('Failed to download viewed receipt', e)
            setError('Failed to download receipt')
        }
    }

    async function downloadReceipt(r) {
        if (!r) return setError('No receipt')
        try {
            // Prefer server PDF if available
            if (r.pdfUrl) return window.open(r.pdfUrl, '_blank')
            // try to enrich with allocation details if available (kept for potential future fields)
            let alloc = null
            try { alloc = (allocs || []).find(a => String(a._id || a.id) === String(r.allocationId)) } catch (e) { alloc = null }
            if (!alloc && r.allocationId) {
                try { const fetched = await getMyHostelAllocations(token); alloc = Array.isArray(fetched) ? fetched.find(a => String(a._id || a.id) === String(r.allocationId)) : null } catch (e) { }
            }
            // try to enrich with student profile (roll/class) if missing
            let studentProfile = r.student || null
            if (!studentProfile) {
                try { studentProfile = await getMyStudent(token) } catch (e) { studentProfile = null }
            }
            const html = buildReceiptHtml({
                id: r._id,
                paymentId: r.razorpayPaymentId || r.paymentId,
                studentName: r.studentName || (studentProfile && (studentProfile.name || '')) || '',
                rollNo: r.rollNo || (studentProfile && studentProfile.rollNo) || '',
                studentEmail: r.studentEmail || (studentProfile && studentProfile.email) || '',
                studentClass: (studentProfile && (studentProfile.class || studentProfile.studentClass)) || r.class || '',
                term: r.term || '',
                amount: Number(r.amount || 0),
                date: r.createdAt || r.date || new Date().toISOString(),
                hostelName: alloc ? (findHostel(alloc.hostelId)?.name || alloc.hostelName) : '',
                room: alloc ? `${alloc.floorNo} / ${alloc.roomNo} / ${Number(alloc.bedIndex) + 1}` : ''
            })
            await generatePdfFromHtml(html, `receipt_${r._id || r.razorpayPaymentId || Date.now()}.pdf`)
        } catch (e) {
            console.error('Failed to download receipt', e)
            setError('Failed to generate receipt PDF')
        }
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Hostel Details</h3>
            </header>

            {loading && <div className="text-muted">Loading...</div>}
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {!loading && (!allocs || allocs.length === 0) && <div className="text-muted">No hostel allocation found.</div>}

            {allocs && allocs.length > 0 && (
                <div className="flex flex-col gap-6">
                    <section className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-main m-0">My Allocations</h3>
                            <select className="p-2 rounded border border-subtle bg-surface text-main outline-none focus:ring-2 focus:ring-primary/20" value={selectedAllocId} onChange={e => setSelectedAllocId(e.target.value)}>
                                <option value="">Latest</option>
                                {allocs.map(a => (
                                    <option key={a._id || a.id} value={a._id || a.id}>
                                        {(findHostel(a.hostelId)?.name) || '—'}/F{a.floorNo}/R{a.roomNo}/B{(Number(a.bedIndex) + 1)} — {new Date(a.when).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <div className="text-sm text-muted mb-1">Hostel</div>
                                <div className="font-bold text-main">{(findHostel(selectedAlloc?.hostelId)?.name) || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted mb-1">Floor / Room / Bed</div>
                                <div className="font-bold text-main">{selectedAlloc?.floorNo} / {selectedAlloc?.roomNo} / {(selectedAlloc?.bedIndex || 0) + 1}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted mb-1">Bed Type</div>
                                <div className="font-bold text-main">{selectedAlloc?.bedType}</div>
                            </div>
                        </div>
                    </section>

                    {lastReceipt && (
                        <section className="card p-6 border-l-4 border-l-primary">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-main m-0">Latest Receipt</h3>
                                <button
                                    onClick={async () => {
                                        if (lastReceipt && (lastReceipt.backendReceipt && lastReceipt.backendReceipt.pdfUrl)) {
                                            try {
                                                const href = String(lastReceipt.backendReceipt.pdfUrl || '')
                                                const url = href.startsWith('http') ? href : `${API_BASE}${href}`
                                                const { token } = getAuth()
                                                const headers = {}
                                                if (token) headers['Authorization'] = `Bearer ${token}`
                                                const res = await fetch(url, { credentials: 'include', headers })
                                                if (!res.ok) throw new Error('Failed to download receipt')
                                                const blob = await res.blob()
                                                const blobUrl = window.URL.createObjectURL(blob)
                                                const a = document.createElement('a')
                                                a.href = blobUrl
                                                const filename = (href && href.split('/').pop()) || `receipt_${lastReceipt.backendReceipt._id || Date.now()}.pdf`
                                                a.download = filename
                                                document.body.appendChild(a)
                                                a.click()
                                                a.remove()
                                                window.URL.revokeObjectURL(blobUrl)
                                                return
                                            } catch (err) {
                                                console.error('Download failed', err)
                                            }
                                        }
                                        await downloadViewedReceiptPdf()
                                    }}
                                    className="btn outline sm"
                                >
                                    Download PDF
                                </button>
                            </div>

                            <div ref={receiptRef} className="bg-surface p-6 rounded border border-subtle text-main font-sans max-w-2xl">
                                <div className="flex justify-between items-start mb-6 border-b border-subtle pb-4">
                                    <div>
                                        <div className="text-xl font-bold">School Name</div>
                                        <div className="text-sm text-muted">Hostel Fee Receipt</div>
                                    </div>
                                    <div className="text-right text-sm text-muted">
                                        <div><strong>Date:</strong> {new Date(lastReceipt.date || lastReceipt.createdAt).toLocaleDateString()}</div>
                                        <div><strong>Payment ID:</strong> {lastReceipt.paymentId || lastReceipt.razorpayPaymentId || ''}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                    <div className="space-y-1">
                                        <div><strong>Student:</strong> {lastReceipt.studentName || lastReceipt.student?.name || '-'}</div>
                                        <div><strong>Roll No:</strong> {lastReceipt.student?.rollNo || '-'}</div>
                                        <div><strong>Class:</strong> {lastReceipt.studentClass || lastReceipt.student?.class || '-'}</div>
                                        <div><strong>Email:</strong> {lastReceipt.studentEmail || lastReceipt.student?.email || '-'}</div>
                                    </div>
                                    <div className="space-y-1 text-right sm:text-left">
                                        <div><strong>Hostel:</strong> {lastReceipt.allocation ? (findHostel(lastReceipt.allocation.hostelId)?.name || lastReceipt.allocation.hostelId) : '-'}</div>
                                        <div><strong>Room:</strong> {lastReceipt.allocation ? `${lastReceipt.allocation.floorNo} / ${lastReceipt.allocation.roomNo} / ${Number(lastReceipt.allocation.bedIndex) + 1}` : '-'}</div>
                                        <div><strong>Term:</strong> {lastReceipt.term}</div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-dashed border-subtle">
                                    <div className="font-bold">Amount Paid</div>
                                    <div className="text-xl font-bold">₹{lastReceipt.amount}</div>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="card p-6">
                        <h3 className="text-lg font-bold text-main mb-4">Fee & Payment Options</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="p-4 bg-surface rounded border border-subtle">
                                <div className="text-sm text-muted mb-1">Total Fee</div>
                                <div className="text-xl font-bold text-main">₹{selectedAlloc?.fee?.amount}</div>
                            </div>
                            <div className="p-4 bg-surface rounded border border-subtle">
                                <div className="text-sm text-muted mb-1">Payment Mode</div>
                                <div className="font-bold text-main capitalize">{selectedAlloc?.fee?.option === 'add-to-fee' ? 'Term-wise' : 'Pay Now'}</div>
                            </div>
                            <div className="p-4 bg-surface rounded border border-subtle">
                                <div className="text-sm text-muted mb-1">Parts</div>
                                <div className="font-bold text-main">{selectedAlloc?.fee?.parts} × ₹{selectedAlloc?.fee?.perPart}</div>
                            </div>
                        </div>

                        {selectedAlloc?.fee?.option === 'add-to-fee' && termParts.length > 0 && (
                            <div>
                                <div className="font-bold text-main mb-3">Term-wise Breakdown</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {termParts.map(p => (
                                        <div key={p.index} className="border border-subtle rounded-lg p-4 flex flex-col justify-between">
                                            <div className="mb-2">
                                                <div className="font-bold text-main">Term {p.index}</div>
                                                <div className="text-muted">₹{p.amount}</div>
                                            </div>
                                            <div>
                                                {p.paid ? (
                                                    <span className="badge green w-full justify-center">Paid</span>
                                                ) : (
                                                    <button
                                                        className="btn primary sm w-full"
                                                        onClick={async () => {
                                                            // offline check
                                                            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                                                                setError('No internet connection — cannot process online payment now.')
                                                                return
                                                            }
                                                            // Razorpay payment for this term
                                                            const ok = await loadRazorpayScript();
                                                            if (!ok) {
                                                                setError('Unable to load payment checkout. Please check your internet connection or try again later.')
                                                                return
                                                            }
                                                            try {
                                                                const receipt = `hostel_${selectedAlloc._id || selectedAlloc.id}_term${p.index}`;
                                                                // create order via mutation
                                                                const order = await qc.fetchQuery(['createHostelOrder', receipt, p.amount], () => createRazorpayOrder(p.amount, receipt, token))
                                                                const options = {
                                                                    key: window?.RAZORPAY_KEY_ID || (import.meta.env.VITE_RAZORPAY_KEY_ID),
                                                                    amount: order.amount,
                                                                    currency: order.currency,
                                                                    name: 'Hostel Fee',
                                                                    description: `Term ${p.index} Hostel Fee Payment`,
                                                                    order_id: order.id,
                                                                    handler: async function (response) {
                                                                        // Confirm payment to backend — fetch student first and send expected keys
                                                                        try {
                                                                            let student = null
                                                                            try {
                                                                                student = await getMyStudent(token)
                                                                            } catch (e) {
                                                                                console.warn('Could not load student before confirming payment', e)
                                                                            }
                                                                            const payload = {
                                                                                razorpay_order_id: order.id,
                                                                                razorpay_payment_id: response.razorpay_payment_id,
                                                                                razorpay_signature: response.razorpay_signature,
                                                                                allocationId: selectedAlloc?._id || selectedAlloc?.id || null,
                                                                                studentId: student?._id || (selectedAlloc && (selectedAlloc.studentId || selectedAlloc.userId)) || null,
                                                                                studentName: student?.name || (selectedAlloc && (selectedAlloc.name || '')) || '',
                                                                                studentEmail: student?.email || (selectedAlloc && (selectedAlloc.email || '')) || '',
                                                                                class: student?.class || (selectedAlloc && (selectedAlloc.class || '')) || '',
                                                                                term: `Term ${p.index}`,
                                                                                amount: p.amount
                                                                            }
                                                                            const conf = await qc.fetchQuery(['confirmHostelPayment', order.id, response.razorpay_payment_id], () => confirmPayment(payload, token))
                                                                            // invalidate queries so receipts/allocations refresh
                                                                            await qc.invalidateQueries(['hostelReceipts', token])
                                                                            await qc.invalidateQueries(['hostelAllocations', token])
                                                                            setError('')
                                                                            // Prefer backend receipt if provided
                                                                            const rec = (conf && conf.receipt) ? conf.receipt : null
                                                                            const receiptObj = {
                                                                                student: student,
                                                                                allocation: selectedAlloc,
                                                                                term: (rec && rec.term) || `Term ${p.index}`,
                                                                                amount: (rec && (rec.amount || rec.feeAmount)) || p.amount,
                                                                                paymentId: response.razorpay_payment_id,
                                                                                orderId: order.id,
                                                                                date: (rec && rec.createdAt) ? rec.createdAt : new Date().toISOString(),
                                                                                backendReceipt: rec,
                                                                                studentName: (rec && rec.studentName) || (student && student.name) || '',
                                                                                studentEmail: (rec && rec.studentEmail) || (student && student.email) || '',
                                                                                studentClass: (rec && rec.class) || (student && student.class) || ''
                                                                            }
                                                                            setLastReceipt(receiptObj);
                                                                            // Notify other pages (admin) that a hostel payment completed so they can refresh allocations
                                                                            try { window.dispatchEvent(new CustomEvent('erp_hostel_payment_completed', { detail: { allocationId: selectedAlloc?._id || selectedAlloc?.id, receipt: receiptObj } })) } catch (e) { }
                                                                        } catch (e) {
                                                                            console.error('Payment confirmation failed', e)
                                                                            setError('Payment confirmation failed: ' + (e.message || 'Unknown error'))
                                                                        }
                                                                    },
                                                                    prefill: {},
                                                                    theme: { color: '#0ea5e9' },
                                                                };
                                                                const rzp = new window.Razorpay(options);
                                                                rzp.open();
                                                            } catch (e) {
                                                                console.error('Payment failed', e)
                                                                setError('Payment failed: ' + (e.message || 'Unknown error'))
                                                            }
                                                        }}
                                                    >
                                                        Pay Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedAlloc?.fee?.option === 'pay-now' && (
                            <div className="mt-4">
                                {selectedAlloc.paid ? (
                                    <div className="badge green inline-flex text-lg px-4 py-2">Full Payment Completed</div>
                                ) : (
                                    <button
                                        className="btn primary big"
                                        onClick={async () => {
                                            try {
                                                const updated = await qc.fetchQuery(['markHostelPaid', selectedAlloc._id || selectedAlloc.id], () => markHostelAllocationPaid(selectedAlloc._id || selectedAlloc.id, token))
                                                // invalidate queries so UI refreshes
                                                await qc.invalidateQueries(['hostelAllocations', token])
                                                await qc.invalidateQueries(['hostelReceipts', token])
                                                setError('')
                                                // poll for receipt (sometimes created async) and and show it
                                                try {
                                                    const found = await pollForReceipt({ allocationId: updated._id || updated.id }, 6, 800)
                                                    if (found) setLastReceipt(normalizeReceiptForView(found))
                                                } catch (e) { console.warn('polling for receipt after mark-paid failed', e) }
                                                // Notify admin pages to refresh allocations
                                                try { window.dispatchEvent(new CustomEvent('erp_hostel_payment_completed', { detail: { allocationId: updated._id || updated.id } })) } catch (e) { }
                                            } catch (e) {
                                                console.error('Payment failed', e)
                                                setError('Payment failed: ' + (e.message || 'Unknown error'))
                                            }
                                        }}
                                    >
                                        Pay Full Amount Now
                                    </button>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="card">
                        <div className="p-4 border-b border-subtle">
                            <h3 className="text-lg font-bold text-main m-0">Payment Requests & Receipts</h3>
                        </div>
                        {(!receipts || receipts.length === 0) ? (
                            <div className="p-8 text-center text-muted">No receipts generated yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="student-table w-full">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Term</th>
                                            <th>Amount</th>
                                            <th>Payment ID</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receipts.map(r => (
                                            <tr key={r._id}>
                                                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                                <td><span className="badge gray">{r.term}</span></td>
                                                <td><span className="font-bold">₹{r.amount}</span></td>
                                                <td className="font-mono text-sm">{r.razorpayPaymentId || '—'}</td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={async () => { await viewReceipt(r) }}
                                                            className="btn outline sm"
                                                        >
                                                            View
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    if (r.pdfUrl) {
                                                                        const href = String(r.pdfUrl || '')
                                                                        const url = href.startsWith('http') ? href : `${API_BASE}${href}`
                                                                        window.open(url, '_blank')
                                                                        return
                                                                    }
                                                                    if (lastReceipt && ((lastReceipt.backendReceipt && String(lastReceipt.backendReceipt._id) === String(r._id)) || String(lastReceipt._id || lastReceipt.backendReceipt?._id) === String(r._id))) {
                                                                        return await downloadViewedReceiptPdf()
                                                                    }
                                                                    await viewReceipt(r)
                                                                    await new Promise(res => setTimeout(res, 120))
                                                                    await downloadViewedReceiptPdf()
                                                                } catch (e) { console.error('Failed to download receipt', e); setError('Failed to download receipt') }
                                                            }}
                                                            className="btn ghost sm"
                                                        >
                                                            Download
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    )
}
