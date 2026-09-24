import { redirect } from 'next/navigation'
import { hasAdminSession } from '@/lib/admin-auth'
import { getAdminConfig } from '@/lib/admin-session'
import LoginForm from './login-form'

export const metadata = { title: 'Admin sign in | Suzu AI' }

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect('/admin')

  const config = getAdminConfig()
  return (
    <div className="p-10 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Admin sign in</h1>
      {'reason' in config ? (
        <p role="alert" className="text-sm text-red-700">
          {config.reason} Set it in the server environment (see README) and restart the server.
        </p>
      ) : (
        <LoginForm />
      )}
    </div>
  )
}
