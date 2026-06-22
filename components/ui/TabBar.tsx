'use client'
import Link from 'next/link'

interface Props {
  active: 'home' | 'sarathy' | 'story' | 'profile'
}

const tabs = [
  { id: 'home', href: '/home', label: 'Today', emoji: '🏠' },
  { id: 'sarathy', href: '/sarathy', label: 'Sarathy', emoji: '💬' },
  { id: 'story', href: '/story', label: 'My Story', emoji: '📖' },
  { id: 'profile', href: '/profile', label: 'Profile', emoji: '👤' },
]

export default function TabBar({ active }: Props) {
  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`tab-item ${active === tab.id ? 'active' : ''}`}
        >
          <span className="text-xl">{tab.emoji}</span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </div>
  )
}
