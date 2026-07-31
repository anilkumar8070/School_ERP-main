import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import StudentLayout from '../../components/student/StudentLayout'

export default function StartTestScreen() {
    const { id } = useParams()
    const location = useLocation()
    const nav = useNavigate()
    const candidate = (location && location.state && location.state.candidate) ? location.state.candidate : { name: '', roll: '', email: '' }
    const test = (location && location.state && location.state.test) ? location.state.test : null

    function begin() {
        // Ask for explicit confirmation before starting the test
        try {
            const ok = window.confirm('Are you ready to give the test? Click OK to start.')
            if (!ok) return
        } catch (e) {
            // fallback if confirm is suppressed
        }
        // navigate to actual test page and indicate started=true
        nav(`/student/tests/${id}`, { state: { candidate, started: true } })
    }

    // Fullscreen colourful instruction screen
    return (
        <div className="start-test-screen">
            <div className="st-card">
                <div className="st-left">
                    <h1 className="st-title">{test ? test.title : 'Your Test'}</h1>
                    <div className="st-desc">Please read the instructions carefully. Once you begin the test, the timer will start and you will not be able to return to this screen.</div>

                    <div className="st-info-grid">
                        <div className="st-info-box">
                            <div className="st-info-label">Candidate</div>
                            <div>{candidate.name || '—'}</div>
                            <div style={{ marginTop: 2, fontSize: 14, opacity: 0.8 }}>{candidate.roll || ''}</div>
                            <div style={{ marginTop: 2, fontSize: 13, opacity: 0.8 }}>{candidate.email || ''}</div>
                        </div>
                        <div className="st-info-box">
                            <div className="st-info-label">Test Info</div>
                            <div>{test ? (test.durationMinutes ? `${test.durationMinutes} minutes` : 'Duration not set') : 'N/A'}</div>
                            <div style={{ marginTop: 6, opacity: 0.9 }}>{test && test.description ? test.description : ''}</div>
                        </div>
                    </div>

                    <div className="st-actions">
                        <button onClick={() => nav('/student/tests')} className="btn-glass">Cancel</button>
                        <button onClick={begin} className="btn-white">Begin Test</button>
                    </div>
                </div>

                <div className="st-right">
                    <div className="st-tips-box">
                        <h3 className="st-tips-title">Instructions</h3>
                        <ol className="st-list">
                            <li>Do not refresh or close the browser during the test.</li>
                            <li>Leaving the tab may forfeit your attempt.</li>
                            <li>MCQs will be auto-graded. Subjective answers will be sent for review.</li>
                            <li>Make sure you submit before time ends. There is a short finalizing window.</li>
                        </ol>
                    </div>

                    <div className="st-tips-box" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <h4 className="st-tips-title" style={{ fontSize: 16 }}>Tips</h4>
                        <ul className="st-list">
                            <li>Use a stable internet connection.</li>
                            <li>Type answers in the provided boxes for subjective questions.</li>
                            <li>Contact admin if you face issues.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
