import React from 'react'
import './IDCard.css'
import { API_BASE } from '../../api'

export default function IDCard({ card = {}, style = {}, className = '' }) {
    const {
        schoolName = 'SCHOOL NAME',
        name = '',
        fatherName = '',
        rollNo = '',
        class: klass = '',
        section = '',
        gender = '',
        contact = '',
        email = '',
        photoUrl = '',
        house = '',
        houseRole = '',
        idCode = '',
        issueDate,
        validUpto,
        type = 'student',
    } = card || {}

    const isAbsolute = typeof photoUrl === 'string' && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://'))
    const resolvedPhoto = photoUrl
        ? (isAbsolute ? photoUrl : `${API_BASE || ''}${photoUrl}`)
        : 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="260" height="320"%3E%3Crect width="100%25" height="100%25" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="18"%3EPhoto%3C/text%3E%3C/svg%3E'

    const isCompact = type === 'faculty' || type === 'staff'
    return (
        <div className={`idcard ${isCompact ? 'compact employee' : ''} ${type === 'student' ? 'student' : ''} ${className}`} style={style}>
            <div className="idcard-header">{schoolName || 'SCHOOL NAME'}</div>
            <div className="idcard-body horiz">
                <div className="wm">{type === 'student' ? 'STUDENT' : (type === 'faculty' ? 'FACULTY' : 'STAFF')}</div>
                <div className="photo-wrap">
                    <img src={resolvedPhoto} alt="Photo" className="photo" crossOrigin="anonymous" />
                </div>
                <div className="details">
                    <div className="name">{(name || '').toUpperCase()}</div>
                    {!isCompact && (
                        <div className="father">
                            <div>Father’s Name</div>
                            <div className="father-name">{fatherName || '-'}</div>
                        </div>
                    )}
                    {isCompact ? (
                        <div className="stack">
                            <div>
                                <div className="label">Email</div>
                                <div className="value multiline">{email || '-'}</div>
                            </div>
                            <div>
                                <div className="label">Contact</div>
                                <div className="value multiline">{contact || '-'}</div>
                            </div>
                            {(type === 'faculty' || type === 'staff') && (
                                <div>
                                    <div className="label">Designation</div>
                                    <div className="value multiline">{card.designation || '-'}</div>
                                </div>
                            )}
                            <div>
                                <div className="label">Institution Name</div>
                                <div className="value multiline">{schoolName || '-'}</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid-2">
                                <div>
                                    <div className="label">Roll No</div>
                                    <div className="value">{rollNo || '-'}</div>
                                </div>
                                <div>
                                    <div className="label">Class</div>
                                    <div className="value">{klass || '-'}</div>
                                </div>
                            </div>
                            <div className="grid-2">
                                <div>
                                    <div className="label">Medium</div>
                                    <div className="value">{card.medium || '-'}</div>
                                </div>
                                <div>{/* spacer */}</div>
                            </div>
                            <div className="grid-2">
                                <div>
                                    <div className="label">Section</div>
                                    <div className="value">{section || '-'}</div>
                                </div>
                                <div>
                                    <div className="label">Gender</div>
                                    <div className="value">{gender || '-'}</div>
                                </div>
                            </div>
                            <div className="grid-2">
                                <div>
                                    <div className="label">Contact</div>
                                    <div className="value">{contact || '-'}</div>
                                </div>
                                <div>{/* spacer */}</div>
                            </div>
                            <div className="grid-2">
                                <div>
                                    <div className="label">House</div>
                                    <div className="value">{house || '-'}</div>
                                </div>
                                <div>
                                    <div className="label">House Role</div>
                                    <div className="value">{houseRole ? houseRole : '-'}</div>
                                </div>
                            </div>
                            {(houseRole && (houseRole.toLowerCase() === 'leader' || houseRole.toLowerCase() === 'captain')) && (
                                <div style={{ marginTop: 6 }}>
                                    <div className="badge" style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 9999, background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e' }}>
                                        {houseRole.toUpperCase()} — {house ? `${house} HOUSE` : 'HOUSE'}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {isCompact && (
                        <div className="grid-2">
                            <div>
                                <div className="label">{type === 'faculty' ? 'Employee ID' : 'Staff ID'}</div>
                                <div className="value">{rollNo || '-'}</div>
                            </div>
                        </div>
                    )}
                    <div className="grid-2">
                        <div>
                            <div className="label">ID Code</div>
                            <div className="value">{idCode || '-'}</div>
                        </div>
                    </div>
                    <div className="grid-2">
                        <div>
                            <div className="label">Issued</div>
                            <div className="value">{issueDate ? new Date(issueDate).toLocaleDateString() : '-'}</div>
                        </div>
                        <div>
                            <div className="label">Valid Upto</div>
                            <div className="value">{validUpto ? new Date(validUpto).toLocaleDateString() : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
