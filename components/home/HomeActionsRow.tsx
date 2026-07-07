'use client'

import Link from 'next/link'

interface Props {
  onLogExpense: () => void
}

export default function HomeActionsRow({ onLogExpense }: Props) {
  return (
    <div className="flex gap-2 mb-3">
      <button
        type="button"
        onClick={onLogExpense}
        className="btn-primary !w-auto flex-[3] py-3 text-sm"
      >
        + Log expense
      </button>
      <Link
        href="/sarathy"
        className="btn-secondary !w-auto flex-[2] py-3 text-sm flex items-center justify-center no-underline"
      >
        Ask Sarathy
      </Link>
    </div>
  )
}
