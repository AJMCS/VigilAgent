import ProfileManager, { useProfiles } from '../components/ProfileManager'
import { useState } from 'react'
import { Shield } from 'lucide-react'

export default function Profiles() {
  const { profiles, addProfile, removeProfile } = useProfiles()
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" /> GitHub Profiles
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Saved tokens are stored only in your browser (localStorage). They are never sent to any server other than GitHub and your local VigilAgent API.
        </p>
      </div>
      <ProfileManager
        profiles={profiles}
        addProfile={addProfile}
        removeProfile={removeProfile}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  )
}
