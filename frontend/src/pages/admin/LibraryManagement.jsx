import React, { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getLibraryBooks, addLibraryBook, issueLibraryBook, returnLibraryBook, deleteLibraryBook } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function LibraryManagement() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    // Form state for adding book
    const [title, setTitle] = useState('')
    const [author, setAuthor] = useState('')
    const [isbn, setIsbn] = useState('')
    const [genre, setGenre] = useState('')
    const [totalCopies, setTotalCopies] = useState('')

    // State for issuing/returning (keyed by book id)
    const [studentInputs, setStudentInputs] = useState({})

    const { data: books = [], isLoading } = useQuery({
        queryKey: ['libraryBooks', token],
        queryFn: () => getLibraryBooks(token),
        enabled: !!token,
        retry: false, // Don't retry if the endpoint is not implemented
        onError: () => { /* ignore or toast */ }
    })

    const addMutation = useMutation({
        mutationFn: (payload) => addLibraryBook(payload, token),
        onSuccess: () => {
            toast.success('Book added successfully')
            setTitle(''); setAuthor(''); setIsbn(''); setGenre(''); setTotalCopies('')
            try { qc.invalidateQueries(['libraryBooks', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to add book')
    })

    const issueMutation = useMutation({
        mutationFn: ({ id, studentId }) => issueLibraryBook(id, studentId, token),
        onSuccess: () => {
            toast.success('Book issued successfully')
            setStudentInputs({})
            try { qc.invalidateQueries(['libraryBooks', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to issue book')
    })

    const returnMutation = useMutation({
        mutationFn: ({ id, studentId }) => returnLibraryBook(id, studentId, token),
        onSuccess: () => {
            toast.success('Book returned successfully')
            setStudentInputs({})
            try { qc.invalidateQueries(['libraryBooks', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to return book')
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteLibraryBook(id, token),
        onSuccess: () => {
            toast.success('Book deleted')
            try { qc.invalidateQueries(['libraryBooks', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to delete book')
    })

    function handleAdd(e) {
        e.preventDefault()
        if (!title || !author || !totalCopies) return toast.error('Title, author, and total copies are required')
        addMutation.mutate({ title, author, isbn, genre, totalCopies: Number(totalCopies) })
    }

    function handleIssue(id) {
        const sid = studentInputs[id]
        if (!sid) return toast.error('Enter a Student ID to issue the book to')
        issueMutation.mutate({ id, studentId: sid })
    }

    function handleReturn(id) {
        const sid = studentInputs[id]
        if (!sid) return toast.error('Enter the Student ID returning the book')
        returnMutation.mutate({ id, studentId: sid })
    }

    return (
        <AdminLayout title="Library Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Library Management</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={handleAdd} className="admin-form-grid">
                        <div className="form-group">
                            <label>Book Title *</label>
                            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Author *</label>
                            <input className="admin-input" value={author} onChange={e => setAuthor(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>ISBN</label>
                            <input className="admin-input" value={isbn} onChange={e => setIsbn(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Genre</label>
                            <input className="admin-input" value={genre} onChange={e => setGenre(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Total Copies *</label>
                            <input className="admin-input" type="number" min="1" value={totalCopies} onChange={e => setTotalCopies(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={addMutation.isLoading}>
                                {addMutation.isLoading ? 'Adding...' : 'Add Book'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3>Book Catalog</h3>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Author</th>
                                    <th>ISBN/Genre</th>
                                    <th>Available</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && books.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No books in catalog</td></tr>
                                )}
                                {!isLoading && books.map(book => {
                                    const available = book.totalCopies - (book.issuedCopies || 0)
                                    return (
                                        <tr key={book._id}>
                                            <td>{book.title}</td>
                                            <td>{book.author}</td>
                                            <td>
                                                <div style={{ fontSize: '0.9rem' }}>{book.isbn || 'No ISBN'}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{book.genre || '-'}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${available > 0 ? 'green' : 'red'}`}>
                                                    {available} / {book.totalCopies}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input 
                                                        className="admin-input" 
                                                        placeholder="Student ID" 
                                                        style={{ width: '120px', padding: '4px 8px', minHeight: '32px' }}
                                                        value={studentInputs[book._id] || ''}
                                                        onChange={e => setStudentInputs(prev => ({ ...prev, [book._id]: e.target.value }))}
                                                    />
                                                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleIssue(book._id)} disabled={available <= 0 || issueMutation.isLoading}>Issue</button>
                                                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleReturn(book._id)} disabled={returnMutation.isLoading}>Return</button>
                                                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--error)', marginLeft: '10px' }} onClick={() => { if(window.confirm('Delete this book?')) deleteMutation.mutate(book._id) }}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
