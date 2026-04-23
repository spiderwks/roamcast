import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function TripsPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <p className="text-white font-medium mb-1">Your trips</p>
      <p className="text-text-muted text-sm mb-6">Coming in the next phase</p>
      <button
        onClick={() => navigate('/trips/new')}
        className="flex items-center gap-2 bg-brand-teal text-white text-sm font-medium px-4 py-2.5 rounded-sm"
      >
        <Plus size={14} />
        New trip
      </button>
    </div>
  )
}
