import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './styles/mobile.css'
import App from './App.jsx'

// Suppress React DevTools console hint in development when desired
try {
  // Some React builds show a friendly console message recommending React DevTools.
  // This is harmless; to reduce noise during development, override the hook info flag.
  if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.skipDevToolsMessage = true
  }
} catch (e) { }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// Global sanitizer: fix any SVG/IMG elements that may have width/height set to 'auto'
function sanitizeSvgsAndImages(root = document) {
  try {
    const svgs = (root.querySelectorAll && root.querySelectorAll('svg')) || []
    svgs.forEach(s => {
      try {
        const fixAttr = (attr) => {
          const v = s.getAttribute && s.getAttribute(attr)
          if (!v) return
          const tv = String(v).trim().toLowerCase()
          if (tv === 'auto') {
            const rect = s.getBoundingClientRect()
            if (rect && rect.width && attr === 'width') s.setAttribute('width', String(Math.round(rect.width)))
            if (rect && rect.height && attr === 'height') s.setAttribute('height', String(Math.round(rect.height)))
            if (!rect || (!rect.width && !rect.height)) s.removeAttribute(attr)
          }
        }
        fixAttr('width')
        fixAttr('height')
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

    const imgs = (root.querySelectorAll && root.querySelectorAll('img')) || []
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
  } catch (e) { }
}

// Run once on initial load and then observe DOM changes to sanitize dynamically inserted content
try {
  if (typeof window !== 'undefined') {
    setTimeout(() => sanitizeSvgsAndImages(document), 120)
    // observe for added nodes that might include SVG/IMG with auto attributes
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          m.addedNodes.forEach(n => {
            if (n && n.querySelectorAll) sanitizeSvgsAndImages(n)
          })
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
  }
} catch (e) { }
