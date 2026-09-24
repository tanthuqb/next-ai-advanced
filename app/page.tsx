import Link from 'next/link'

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold text-slate-800">Suzu AI</h1>
      <p className="text-slate-600">
        A RAG-powered career advisor built with Next.js, Supabase pgvector, and Google Gemini.
      </p>
      <nav className="flex gap-3">
        <Link
          href="/chat"
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Chat with Suzu
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Feed knowledge
        </Link>
      </nav>
    </div>
  )
}
