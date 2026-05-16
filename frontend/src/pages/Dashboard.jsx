import { useState } from 'react'
import ProfileManager, { useProfiles } from '../components/ProfileManager'
import ScanForm from '../components/ScanForm'
import JobMonitor from '../components/JobMonitor'
import WatchlistManager from '../components/WatchlistManager'

export default function Dashboard() {
  const { profiles, addProfile, removeProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState(null)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Left column: profiles + scan form + watchlist */}
        <div className="space-y-4">
          <ProfileManager
            profiles={profiles}
            addProfile={addProfile}
            removeProfile={removeProfile}
            selectedId={selectedProfileId}
            onSelect={setSelectedProfileId}
          />
          <ScanForm
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
          />
          <WatchlistManager
            profiles={profiles}
            selectedProfileId={selectedProfileId}
          />
        </div>

        {/* Right column: job monitor */}
        <div>
          <JobMonitor />
        </div>
      </div>
    </div>
  )
}
