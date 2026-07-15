import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Sarathy',
}

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#F8F5FF',
        padding: '3rem 1.5rem',
        color: '#1C0F3F',
      }}
    >
      <div style={{ maxWidth: '40rem', margin: '0 auto' }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
          <Link href="/login" style={{ color: '#D4A853', textDecoration: 'none' }}>
            ← Back
          </Link>
        </p>
        <h1
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '2rem',
            fontWeight: 600,
            margin: '0 0 1rem',
          }}
        >
          Terms of Service
        </h1>
        <p style={{ lineHeight: 1.6, color: '#5a4e6a' }}>
          This is a placeholder terms of service for Sarathy. By using the app you agree to use it
          responsibly for your personal financial companion needs. Full terms will be published here
          soon.
        </p>
      </div>
    </main>
  )
}
