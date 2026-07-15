import type { ReactNode } from 'react'
import AuthStoryPanel from './AuthStoryPanel'
import AuthFooter from './AuthFooter'
import './auth.css'

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-split">
        <AuthStoryPanel />
        <main className="auth-form-panel">{children}</main>
      </div>
      <AuthFooter />
    </div>
  )
}
