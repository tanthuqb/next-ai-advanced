'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const handleTrain = async () => {
    if (!text.trim()) return
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json().catch(() => ({}))
      setStatus(
        res.ok
          ? { ok: true, message: data.message ?? 'AI has finished learning!' }
          : { ok: false, message: data.error ?? `Ingest failed (${res.status})` }
      )
    } catch (error) {
      setStatus({ ok: false, message: error instanceof Error ? error.message : 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Feed knowledge to the AI</h1>
      <textarea
        aria-label="Knowledge content"
        className="w-full h-64 p-4 border rounded shadow-inner"
        placeholder="Paste documents, policies, or project information here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={handleTrain}
        disabled={loading || !text.trim()}
        className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-400"
      >
        {loading ? 'Encoding vectors...' : 'Teach AI now'}
      </button>
      {status && (
        <p
          role="status"
          className={`mt-4 text-sm ${status.ok ? 'text-green-700' : 'text-red-700'}`}
        >
          {status.message}
        </p>
      )}
    </div>
  )
}
