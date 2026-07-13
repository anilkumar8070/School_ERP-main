import React, { useState } from 'react';

import { getAuth } from '../../utils/session';
import { getMyTransportAllocations, getMyTransportReceipts, createTransportRazorpayOrder, confirmTransportPayment, markTransportAllocationPaid, API_BASE } from '../../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function StudentTransport() {
    const { token } = getAuth();
    const qc = useQueryClient()

    const { data: allocs = [], isLoading: loadingAllocations } = useQuery({
        queryKey: ['transportAllocations', token],
        queryFn: () => getMyTransportAllocations(token),
        enabled: !!token,
    })
    const { data: receipts = [], isLoading: loadingReceipts } = useQuery({
        queryKey: ['transportReceipts', token],
        queryFn: () => getMyTransportReceipts(token),
        enabled: !!token,
    })

    const [viewMode, setViewMode] = useState('details') // 'details' | 'fees'
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(false);
    const loading = loadingAllocations || loadingReceipts

    function isAllocationPaid(a) {
        if (!a) return false
        try {
            if (a.paid) return true
            if (Array.isArray(a.payments) && a.payments.some(p => p && String(p.status).toLowerCase() === 'paid')) return true
            // also check receipts state for matching allocation id
            if (Array.isArray(receipts) && receipts.some(r => String(r.allocationId || r.allocationId) === String(a._id || a.id))) return true
        } catch (e) { }
        return false
    }

    async function handlePay(allocation) {
        if (!allocation) return;
        setPaying(true);
        try {
            await loadRazorpayScript();
            const allocationId = allocation._id || allocation.id
            const amount = Number((allocation && allocation.fee && allocation.fee.amount) ?? allocation.amount ?? 0)
            if (!allocationId) return alert('Allocation id missing')
            // create order via React Query mutation
            const createOrderMutation = qc.getQueryCache ? null : null
            // use a mutation instance locally for clarity
            const createOrder = async () => createTransportRazorpayOrder(amount, `transport_${allocationId}`, token)
            const order = await createOrder()
            const options = {
                key: order && (order.keyId || order.key_id) || 'rzp_test_YourKeyHere',
                amount: order.amount,
                currency: order.currency,
                name: 'School Name',
                description: 'Transport Fee Payment',
                order_id: order.id,
                handler: async function (response) {
                    try {
                        // confirm payment via mutation helper
                        const res = await confirmTransportPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            allocationId: allocationId,
                            amount: amount,
                        }, token);
                        // Optimistic UI update: mark allocation paid immediately and add receipt if available
                        try {
                            console.log('confirmTransportPayment response:', res)
                            // update cache: allocations and receipts
                            try {
                                qc.setQueryData(['transportAllocations', token], old => {
                                    if (!Array.isArray(old)) return old
                                    return old.map(x => (String(x._id || x.id) === String(allocationId) ? { ...x, paid: true, payments: (x.payments || []).concat([{ status: 'paid', amount, orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id }]) } : x))
                                })
                                if (res && res.receipt) {
                                    qc.setQueryData(['transportReceipts', token], old => Array.isArray(old) ? [res.receipt, ...old] : [res.receipt])
                                } else {
                                    // fallback: refresh receipts
                                    try {
                                        await qc.invalidateQueries(['transportReceipts', token])
                                    } catch (e) { console.warn('failed to refresh transport receipts after confirm', e) }
                                }
                            } catch (e) { console.warn('optimistic update failed', e) }
                        } catch (e) { console.warn('optimistic update failed', e) }
                        // switch to receipts view so user sees the new receipt
                        try {
                            setViewMode('fees')
                            setTimeout(() => {
                                const el = document.getElementById('transport-fee-receipts')
                                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth' })
                            }, 150)
                        } catch (e) { }
                        // notify admin pages to refresh
                        window.dispatchEvent(new Event('erp_transport_payment_completed'));
                        // reload allocations and receipts in background to ensure server state is synced
                        qc.invalidateQueries(['transportAllocations', token])
                        qc.invalidateQueries(['transportReceipts', token])
                    } catch (e) {
                        // try fallback: mark allocation paid (creates receipt on server without razorpay ids)
                        try {
                            await markTransportAllocationPaid(allocationId, token)
                            alert('Payment registered. Receipt created (fallback).')
                            // invalidate queries to refresh cache
                            qc.invalidateQueries(['transportAllocations', token])
                            qc.invalidateQueries(['transportReceipts', token])
                        } catch (e2) {
                            alert('Payment confirmation failed: ' + (e.message || 'Unknown error') + '\nFallback also failed: ' + (e2 && e2.message ? e2.message : String(e2)))
                        }
                    }
                },
                prefill: {
                    name: allocation.student && allocation.student.name,
                    email: allocation.student && allocation.student.email,
                },
                theme: { color: '#3399cc' },
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (e) {
            alert('Payment failed: ' + (e.message || 'Unknown error'));
        } finally {
            setPaying(false);
        }
    }

    async function downloadPdf(url, suggestedName) {
        if (!url) return alert('No file URL available')
        const { token } = getAuth()
        // Resolve absolute URL for relative paths
        let finalUrl = url
        try {
            if (finalUrl.startsWith('/')) {
                finalUrl = (API_BASE && API_BASE !== '') ? `${API_BASE.replace(/\/$/, '')}${finalUrl}` : `${window.location.origin}${finalUrl}`
            }
        } catch (e) { }

        // Try to fetch with Authorization header so SPA doesn't navigate away
        try {
            const res = await fetch(finalUrl, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
            if (!res.ok) {
                // If access denied or not OK, fallback to opening the URL in a new tab
                const txt = await res.text().catch(() => '')
                console.warn('Protected fetch failed', res.status, txt)
                // fallback: open in new tab (may prompt for auth or download depending on server)
                window.open(finalUrl, '_blank', 'noopener')
                return
            }
            const blob = await res.blob()
            // extract filename from header
            const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || ''
            let filename = suggestedName || ''
            try {
                const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/) || []
                const fname = decodeURIComponent(m[1] || m[2] || '')
                if (fname) filename = fname
            } catch (e) { }
            if (!filename) {
                // fallback name from URL
                try { filename = finalUrl.split('/').pop().split('?')[0] || suggestedName || 'file.pdf' } catch (e) { filename = suggestedName || 'file.pdf' }
            }
            const link = document.createElement('a')
            const objUrl = window.URL.createObjectURL(blob)
            link.href = objUrl
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(objUrl)
        } catch (e) {
            console.warn('Download fetch failed, opening URL', e)
            window.open(url, '_blank', 'noopener')
        }
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Transport & Bus</h3>
            </header>

            <div className="flex bg-surface rounded-lg p-1 border border-subtle w-fit mb-6">
                <button
                    onClick={() => setViewMode('details')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'details' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main hover:bg-surface-hover'}`}
                >
                    Allocation Details
                </button>
                <button
                    onClick={() => setViewMode('fees')}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'fees' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-main hover:bg-surface-hover'}`}
                >
                    Transport Fee
                </button>
            </div>

            {loading && <div className="text-muted text-center py-8">Loading transport details...</div>}
            {error && <div className="text-red-500 mb-4 bg-red-500/10 p-4 rounded border border-red-500/20">{error}</div>}

            {!loading && allocs.length === 0 && (
                <div className="card p-8 text-center text-muted border-dashed">
                    No transport allocations found. Please contact administration.
                </div>
            )}

            {viewMode === 'details' && allocs.map(a => (
                <section key={a._id || a.id} className="card p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-4 border-b border-subtle">
                        <div>
                            <h3 className="text-xl font-bold text-main">Bus Allocation</h3>
                            <div className="text-muted text-sm mt-1">{a.routeId || a._id}</div>
                        </div>
                        {isAllocationPaid(a) ? (
                            <div className="badge green px-4 py-2 text-base font-bold shadow-sm">Payment Complete</div>
                        ) : (
                            <div className="badge orange px-4 py-2 text-base font-bold shadow-sm">Payment Pending</div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1">Route</div>
                            <div className="font-bold text-main text-lg">{a.routeName || a.routeId || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1">Stop</div>
                            <div className="font-bold text-main text-lg">{a.stopName || a.stopId || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1">Bus Number</div>
                            <div className="font-bold text-main text-lg">{a.busName || a.busId || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1">Assigned Date</div>
                            <div className="font-bold text-main">{new Date(a.when || a.createdAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1">Seat No</div>
                            <div className="font-bold text-main text-lg">{a.seatNo || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted uppercase tracking-wider mb-1"> Annual Fee</div>
                            <div className="font-bold text-main text-lg">₹{a.fee?.amount || 0}</div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        {!isAllocationPaid(a) && (
                            <button onClick={() => handlePay(a)} disabled={paying} className="btn primary big shadow-lg hover:shadow-xl transition-all">
                                {paying ? 'Processing...' : 'Pay Transport Fee Now'}
                            </button>
                        )}
                        {isAllocationPaid(a) && (() => {
                            const rec = receipts.find(r => String(r.allocationId || r.allocationId) === String(a._id || a.id))
                            if (rec && rec.pdfUrl) return (<button onClick={() => downloadPdf(rec.pdfUrl, `receipt_${rec._id || rec.id}.pdf`)} className="btn ghost sm">Download Receipt</button>)
                            return null
                        })()}
                    </div>

                    {Array.isArray(a.payments) && a.payments.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-subtle">
                            <h5 className="text-main font-bold mb-4">Payment History</h5>
                            <div className="overflow-x-auto">
                                <table className="student-table w-full">
                                    <thead>
                                        <tr>
                                            <th>Status</th>
                                            <th>Amount</th>
                                            <th>Transaction ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {a.payments.map((p, idx) => (
                                            <tr key={idx}>
                                                <td><span className="badge green">{p.status}</span></td>
                                                <td className="font-bold text-main">₹{p.amount}</td>
                                                <td className="font-mono text-xs text-muted">{p.orderId || p.paymentId || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            ))}

            <section className={`card p-6 h-fit min-h-[400px] ${viewMode !== 'fees' ? 'hidden' : ''}`} id="transport-fee-receipts">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-main">Transport Fee Receipts</h3>
                        <p className="text-muted text-sm mt-1">View and download your past transport fee receipts.</p>
                    </div>
                </div>

                {receipts.length === 0 && <div className="text-muted text-center py-12 bg-surface rounded-lg border border-dashed border-subtle">No transport receipts available.</div>}

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                    {receipts.map(r => (
                        <div key={r._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-subtle bg-surface hover:border-primary/30 transition-all hover:shadow-md">
                            <div className="mb-3 sm:mb-0">
                                <div className="font-bold text-main text-lg">{r.routeName || r.busName || `Allocation ${r.allocationId || ''}`}</div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                                    <span className="w-1 h-1 rounded-full bg-subtle"></span>
                                    <span className="text-main font-bold">₹{r.amount}</span>
                                </div>
                                {(r.stopName || r.busName) && (
                                    <div className="text-xs text-muted mt-2 px-2 py-1 bg-surface-active rounded border border-subtle w-fit">
                                        {r.stopName ? r.stopName : ''} {r.stopName && r.busName ? '•' : ''} {r.busName ? r.busName : ''}
                                    </div>
                                )}
                            </div>
                            <div>
                                {r.pdfUrl ? (
                                    <button onClick={() => downloadPdf(r.pdfUrl, `receipt_${r._id || r.id}.pdf`)} className="btn outline sm whitespace-nowrap group">
                                        <span>Download PDF</span>
                                        <svg className="w-4 h-4 ml-2 inline-block transform group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </button>
                                ) : (
                                    <span className="badge gray">Processing PDF...</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
