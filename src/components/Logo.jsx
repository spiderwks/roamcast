export default function Logo({ size = 'md' }) {
  const sizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }
  return (
    <span className={`font-medium ${sizes[size]}`}>
      <span className="text-white">roam</span>
      <span className="text-brand-teal">cast</span>
    </span>
  )
}
