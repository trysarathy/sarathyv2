import Link from 'next/link'

export default function AuthFooter() {
  return (
    <footer className="auth-footer">
      <p className="auth-footer-brand">Sarathy ✦ · Your money companion</p>
      <nav className="auth-footer-links" aria-label="Legal">
        <Link href="/privacy">Privacy Policy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Terms of Service</Link>
        <span aria-hidden="true">·</span>
        <a href="https://sarathyv2.vercel.app/home" target="_blank" rel="noopener noreferrer">
          sarathyv2.vercel.app/home
        </a>
      </nav>
    </footer>
  )
}
