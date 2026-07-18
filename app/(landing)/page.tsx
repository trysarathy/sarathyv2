'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const SECTIONS = [
  { id: 'cta', label: 'Hero' },
  { id: 'hook', label: 'Hook' },
  { id: 'problem', label: 'Problem' },
  { id: 'solution', label: 'Solution' },
  { id: 'social-proof', label: 'Voices' },
] as const

const FEATURES = [
  'AI budgeting that adapts to your life',
  'Multi-currency: SGD, INR, USD',
  'Voice expense logging',
  'Dream savings goals',
  'Expense circles with friends',
  'Personalised daily brief',
] as const

type Testimonial = { comment: string }

export default function LandingPage() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const scrollingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/feedback/testimonials')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data.testimonials) ? data.testimonials : []
        setTestimonials(list.slice(0, 2))
      })
      .catch(() => {
        if (!cancelled) setTestimonials([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-landing-section]'))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible?.target) return
        const idx = sections.indexOf(visible.target as HTMLElement)
        if (idx >= 0) setActive(idx)
      },
      { root, threshold: [0.55, 0.7] }
    )

    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const goTo = useCallback((index: number) => {
    const root = scrollerRef.current
    if (!root) return
    const clamped = Math.max(0, Math.min(SECTIONS.length - 1, index))
    const el = root.querySelector<HTMLElement>(`#${SECTIONS[clamped].id}`)
    if (!el) return
    scrollingRef.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(clamped)
    window.setTimeout(() => {
      scrollingRef.current = false
    }, 700)
  }, [])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return
      e.preventDefault()
      if (scrollingRef.current) return
      goTo(active + (e.deltaY > 0 ? 1 : -1))
    }

    let touchStartY = 0
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0
    }
    const onTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? touchStartY
      const dy = touchStartY - endY
      if (Math.abs(dy) < 48) return
      if (scrollingRef.current) return
      goTo(active + (dy > 0 ? 1 : -1))
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchend', onTouchEnd)
    }
  }, [active, goTo])

  return (
    <>
      <div ref={scrollerRef} className="landing-scroller" aria-label="Sarathy story">
        {/* 1 — HERO / CTA */}
        <section
          id="cta"
          data-landing-section
          className="landing-section landing-section-cta"
          aria-label="Get started"
        >
          <div className="landing-section-inner landing-cta-inner landing-enter">
            <h1 className="landing-cta-title">The WhatsApp of Finance.</h1>
            <p className="landing-cta-sub">
              Always there. Deeply personal.
              <br />
              Finally built for you.
            </p>
            <Link href="/onboarding" className="landing-btn-white">
              Sign up free →
            </Link>
            <p className="landing-cta-url">sarathyv2.vercel.app/home</p>
          </div>
          <div className="landing-scroll-hint landing-scroll-hint-dark" aria-hidden>
            <span />
          </div>
        </section>

        {/* 2 — HOOK */}
        <section
          id="hook"
          data-landing-section
          className="landing-section landing-section-hook"
          aria-label="Hook"
        >
          <div className="landing-section-inner landing-hook-inner">
            <h2 className="landing-hook-title">
              Money is personal. Emotional.
              <br />
              Deeply private.
            </h2>
            <p className="landing-hook-sub">
              The world treats it like a spreadsheet.
              <br />
              We don&apos;t.
            </p>
            <button
              type="button"
              className="landing-btn-gold"
              onClick={() => goTo(3)}
            >
              Meet Sarathy →
            </button>
          </div>
          <div className="landing-scroll-hint" aria-hidden>
            <span />
          </div>
        </section>

        {/* 3 — PROBLEM */}
        <section
          id="problem"
          data-landing-section
          className="landing-section landing-section-problem"
          aria-label="The problem"
        >
          <div className="landing-section-inner">
            <p className="landing-kicker">The problem</p>
            <h2 className="landing-headline landing-headline-dark">
              You moved to a new country. A new currency.
              <br />
              A completely new financial life.
            </h2>
            <p className="landing-body landing-body-dark">
              No one told you how hard it would feel to manage money alone — in a language,
              currency, and system that still feels foreign.
            </p>
          </div>
          <div className="landing-scroll-hint landing-scroll-hint-dark" aria-hidden>
            <span />
          </div>
        </section>

        {/* 4 — SOLUTION */}
        <section
          id="solution"
          data-landing-section
          className="landing-section landing-section-solution"
          aria-label="The solution"
        >
          <div className="landing-section-inner">
            <p className="landing-kicker">The solution</p>
            <h2 className="landing-headline landing-headline-dark">Meet Sarathy.</h2>
            <ul className="landing-feature-list">
              {FEATURES.map((feature) => (
                <li key={feature}>
                  <span className="landing-feature-arrow" aria-hidden>
                    →
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5 — SOCIAL PROOF */}
        <section
          id="social-proof"
          data-landing-section
          className="landing-section landing-section-proof"
          aria-label="What our users say"
        >
          <div className="landing-section-inner">
            <p className="landing-kicker">Voices</p>
            <h2 className="landing-headline landing-headline-dark">What our users say</h2>
            <div className="landing-testimonial-grid">
              {(testimonials.length > 0
                ? testimonials
                : [
                    {
                      comment:
                        'Finally something that gets what it feels like to budget in SGD while thinking in rupees.',
                    },
                    {
                      comment:
                        'The daily brief makes me check in without the guilt spiral. It feels like a friend, not a spreadsheet.',
                    },
                  ]
              ).map((t, i) => (
                <blockquote key={i} className="landing-testimonial-card">
                  <p>&ldquo;{t.comment}&rdquo;</p>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="landing-dots" role="tablist" aria-label="Section progress">
        {SECTIONS.map((section, i) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-label={section.label}
            className={`landing-dot ${active === i ? 'active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <footer className="landing-footer">
        <p className="landing-footer-brand">Sarathy ✦</p>
        <nav className="landing-footer-links" aria-label="Footer">
          <Link href="/contact">Contact</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </>
  )
}
