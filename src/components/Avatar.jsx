export default function Avatar({ name = '', size = 30, color = 'teal', src = null }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const colorMap = {
    teal: 'text-brand-teal border-[#2e2e2e]',
    purple: 'text-brand-purple border-[#3a3a3a]',
  }
  if (src) {
    return (
      <div
        className="rounded-full border border-[#2e2e2e] overflow-hidden flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <img src={src} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-surface-elevated border ${colorMap[color]} font-medium flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}
