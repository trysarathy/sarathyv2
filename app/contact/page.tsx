import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact — Sarathy',
  description: 'Get in touch with Sarathy.',
}

/** Update when the beta WhatsApp invite / Instagram handle go live. */
const WHATSAPP_BETA_URL = 'https://chat.whatsapp.com/'
const INSTAGRAM_URL: string | null = null

const OPTIONS = [
  {
    icon: '📧',
    label: 'Email',
    detail: 'aashmiin.k.2025@accountancy.smu.edu.sg',
    href: 'mailto:aashmiin.k.2025@accountancy.smu.edu.sg',
    external: true,
    comingSoon: false,
  },
  {
    icon: '💬',
    label: 'WhatsApp',
    detail: 'Join the Sarathy beta group',
    href: WHATSAPP_BETA_URL,
    external: true,
    comingSoon: false,
  },
  {
    icon: '🐦',
    label: 'Instagram',
    detail: INSTAGRAM_URL ? '@trysarathy' : 'Coming soon — when we go live',
    href: INSTAGRAM_URL,
    external: true,
    comingSoon: !INSTAGRAM_URL,
  },
] as const

export default function ContactPage() {
  return (
    <main className="contact-page">
      <div className="contact-inner">
        <p className="contact-back">
          <Link href="/">← Home</Link>
        </p>

        <header className="contact-header">
          <p className="contact-kicker">Sarathy ✦</p>
          <h1 className="contact-title">Get in touch</h1>
          <p className="contact-sub">
            Questions, feedback, or just want to say hi — I&apos;d love to hear from you.
          </p>
        </header>

        <ul className="contact-list">
          {OPTIONS.map((opt) => {
            const content = (
              <>
                <span className="contact-option-icon" aria-hidden>
                  {opt.icon}
                </span>
                <span className="contact-option-text">
                  <span className="contact-option-label">{opt.label}</span>
                  <span className="contact-option-detail">{opt.detail}</span>
                </span>
                {!opt.comingSoon && (
                  <span className="contact-option-arrow" aria-hidden>
                    →
                  </span>
                )}
              </>
            )

            return (
              <li key={opt.label}>
                {opt.comingSoon || !opt.href ? (
                  <div className="contact-option contact-option-soon">{content}</div>
                ) : (
                  <a
                    className="contact-option"
                    href={opt.href}
                    {...(opt.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {content}
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
