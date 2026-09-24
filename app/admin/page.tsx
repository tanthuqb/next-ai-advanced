import { redirect } from 'next/navigation'
import { hasAdminSession } from '@/lib/admin-auth'
import { logout } from './actions'
import IngestForm from './ingest-form'

export default async function AdminPage() {
  // Defense in depth: proxy.ts already redirects, but never rely on it alone.
  if (!(await hasAdminSession())) redirect('/admin/login')

  return (
    <div>
      <form action={logout} className="max-w-4xl mx-auto px-10 pt-6 flex justify-end">
        <button type="submit" className="text-sm text-gray-600 underline hover:text-black">
          Sign out
        </button>
      </form>
      <IngestForm />
    </div>
  )
}
