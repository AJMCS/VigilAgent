import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProfileManager, { useProfiles } from '../components/ProfileManager';
import ScanForm from '../components/ScanForm';
import WatchlistManager from '../components/WatchlistManager';
import JobMonitor from '../components/JobMonitor';
import NeonCard from '../components/ui/NeonCard';
import logo from '../assets/vigilagent_logo.svg';
import { listScans, listReports, getWatchlist } from '../api';

function StatBox({ label, value, green = false }) {
  return (
    <div className="flex-1 px-4 py-2 text-center" style={{ borderRight: '1px solid rgba(0,240,255,0.08)' }}>
      <div style={{ color: green ? '#00ff88' : '#00f0ff', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ color: 'rgba(0,240,255,0.35)', fontSize: 9, letterSpacing: '0.14em', marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function Section({ label, green = false, children }) {
  return (
    <NeonCard green={green} className="p-4 space-y-3">
      <div style={{ color: green ? '#00ff88' : '#00f0ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>
        [ {label} ]
      </div>
      {children}
    </NeonCard>
  );
}

export default function Dashboard() {
  // Single source of truth for profiles — passed down to all children
  const { profiles, addProfile, removeProfile } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [pickedRepos, setPickedRepos] = useState([]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;

  const { data: scans     = [] } = useQuery({ queryKey: ['scans'],     queryFn: listScans,    refetchInterval: 10000 });
  const { data: reports   = [] } = useQuery({ queryKey: ['reports'],   queryFn: listReports,  refetchInterval: 30000 });
  const { data: watchlist = [] } = useQuery({ queryKey: ['watchlist'], queryFn: getWatchlist, refetchInterval: 30000 });

  const hasJobs = scans.length > 0;

  return (
    <div className="pt-12 min-h-screen flex flex-col">
      {/* Stats bar */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: '1px solid rgba(0,240,255,0.12)', background: 'rgba(0,0,0,0.5)' }}
      >
        <StatBox label="REPOS WATCHED" value={watchlist.length} />
        <StatBox label="SCANS RUN"     value={scans.length} />
        <StatBox label="REPORTS"       value={reports.length} green />
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-[320px_1fr] flex-1">

        {/* Left column */}
        <div
          className="space-y-4 p-4 overflow-y-auto"
          style={{ borderRight: '1px solid rgba(0,240,255,0.08)' }}
        >
          <Section label="PROFILES">
            <ProfileManager
              profiles={profiles}
              addProfile={addProfile}
              removeProfile={removeProfile}
              selectedId={selectedProfileId}
              onSelect={setSelectedProfileId}
            />
          </Section>

          <Section label="SCAN">
            <ScanForm
              selectedProfile={selectedProfile}
              pickedRepos={pickedRepos}
              onPickedReposChange={setPickedRepos}
            />
          </Section>

          <Section label="WATCHLIST" green>
            <WatchlistManager selectedProfile={selectedProfile} pickedRepos={pickedRepos} />
          </Section>
        </div>

        {/* Right column — logo backdrop + job queue */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none"
            style={{ opacity: hasJobs ? 0.05 : 0.82, transition: 'opacity 1s ease' }}
          >
            <img src={logo} alt="VigilAgent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <div className="relative z-10 p-4 space-y-3">
            {hasJobs && (
              <div style={{ color: '#00f0ff', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em' }}>
                [ JOB QUEUE ]
              </div>
            )}
            <JobMonitor hideEmptyState />
          </div>
        </div>

      </div>
    </div>
  );
}
