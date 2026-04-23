import { Outlet, NavLink } from 'react-router-dom'
import { Home, MapPin, Map, Users, User } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/trips', icon: MapPin, label: 'Trips' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/followers', icon: Users, label: 'Followers' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function RoamerLayout() {
  return (
    <div className="flex flex-col h-full bg-surface-deep">
      <main className="flex-1 overflow-y-auto"><Outlet /></main>
      <nav className="flex-shrink-0 px-3 pb-2 pt-1 safe-bottom">
        <div className="flex items-center justify-around bg-surface border border-border rounded-2xl px-1 py-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${isActive ? 'text-brand-teal' : 'text-text-muted'}`}
            >
              {({ isActive }) => (<><Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} /><span className="text-[10px] font-medium">{label}</span></>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
