'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '../actions'

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="admin-password" className="text-sm font-medium">
        Password
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="p-2 border rounded"
      />
      <button
        type="submit"
        disabled={pending}
        className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:bg-gray-400"
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
      {state.error && (
        <p role="alert" data-testid="login-error" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  )
}
