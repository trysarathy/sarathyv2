import FeedbackPrompt from '@/components/feedback/FeedbackPrompt'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FeedbackPrompt />
    </>
  )
}
