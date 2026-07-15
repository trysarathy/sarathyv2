import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Sarathy',
}

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ lineHeight: 1.6, color: '#5a4e6a' }}>
          This is a placeholder privacy policy for Sarathy. We care about your data — your financial
          information stays yours. A full policy will be published here soon.
        </p>
        <p style={{ lineHeight: 1.6, color: '#5a4e6a', marginTop: '1rem' }}>
          Questions? Reach us via the in-app support channels once you&apos;re signed in.
        </p>
      </div>
    </main>
  )
}
