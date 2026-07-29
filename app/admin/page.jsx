'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTrain = async () => {
    setLoading(true)
    const res = await fetch('/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ content: text })
    })
    if (res.ok) alert('AI has finished learning!')
    setLoading(false)
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Feed knowledge to the AI</h1>
      <textarea
        className="w-full h-64 p-4 border rounded shadow-inner"
        placeholder="Paste documents, policies, or project information here..."
        onChange={(e) => setText(e.target.value)}
      />
      <button 
        onClick={handleTrain}
        disabled={loading}
        className="mt-4 px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-400"
      >
        {loading ? 'Encoding vectors...' : 'Teach AI now'}
      </button>
    </div>
  )
}