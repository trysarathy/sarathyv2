'use client'
import Link from 'next/link'
import { BookOpen, Home, MessageCircle, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type TabId = 'home' | 'sarathy' | 'circles' | 'story' | 'profile'

interface Props {
  active: TabId
}

const tabs: Array<{ id: TabId; href: string; label: string; icon: LucideIcon }> = [
  { id: 'home', href: '/home', label: 'Today', icon: Home },
  { id: 'circles', href: '/circles', label: 'Circles', icon: UsersRound },
  { id: 'sarathy', href: '/sarathy', label: 'Sarathy', icon: MessageCircle },
  { id: 'story', href: '/story', label: 'Story', icon: BookOpen },
  { id: 'profile', href: '/profile', label: 'Profile', icon: UserRound },
]

export default function TabBar({ active }: Props) {
  return (
    <nav className="tab-bar" aria-label="Primary navigation">
      {tabs.map(tab => {
        const Icon = tab.icon

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`tab-item ${active === tab.id ? 'active' : ''}`}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" strokeWidth={active === tab.id ? 2.4 : 2} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
