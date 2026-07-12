import LandingNav from '@/components/landing/LandingNav'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-root">
      <LandingNav />
      {children}
    </div>
  )
}
