import React, { useState, useCallback } from 'react'

// BusyButton: disables itself while an async action is running to prevent double-clicks.
// Props:
// - asyncAction: function that returns a Promise (preferred)
// - onClick: click handler (sync or async)
// - disabled: external disabled flag (will be combined)
// - children: button label/content
// - className, style, type
export default function BusyButton({ asyncAction, onClick, disabled, children, className, style, type = 'button' }) {
    const [busy, setBusy] = useState(false)

    const handle = useCallback(async (e) => {
        if (disabled || busy) return
        // If asyncAction provided, run that and manage busy state
        try {
            if (asyncAction) {
                setBusy(true)
                await asyncAction(e)
                return
            }
            // Fallback to onClick
            const res = onClick && onClick(e)
            if (res && typeof res.then === 'function') {
                setBusy(true)
                try { await res } finally { setBusy(false) }
            }
        } finally {
            // ensure busy cleared if asyncAction resolved
            if (asyncAction) setBusy(false)
        }
    }, [asyncAction, onClick, disabled, busy])

    return (
        <button
            type={type}
            onClick={handle}
            disabled={disabled || busy}
            className={className}
            style={style}
        >
            {busy ? (typeof children === 'string' ? `${children}…` : children) : children}
        </button>
    )
}
