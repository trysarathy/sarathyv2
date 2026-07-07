'use client'

interface Props {
  onClick: () => void
  listening?: boolean
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export default function VoiceMicButton({
  onClick,
  listening = false,
  size = 'md',
  className = '',
  ariaLabel = 'Log expense by voice',
}: Props) {
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${dim} shrink-0 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${
        listening
          ? 'border-coral bg-coral/10 text-coral voice-mic-pulse'
          : 'border-coral text-coral bg-transparent'
      } ${className}`}
    >
      <MicIcon className={icon} />
    </button>
  )
}
