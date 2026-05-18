import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProfileManager, { useProfiles } from '../components/ProfileManager';
import ScanForm from '../components/ScanForm';
import WatchlistManager from '../components/WatchlistManager';
import JobMonitor from '../components/JobMonitor';
import ModelSelector from '../components/ModelSelector';
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

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 320;

export default function Dashboard() {
  // Single source of truth for profiles — passed down to all children
  const { profiles, addProfile, removeProfile } = useProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [pickedRepos, setPickedRepos] = useState([]);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) ?? null;

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    parseInt(localStorage.getItem('vigilagent-sidebar-width') || String(SIDEBAR_DEFAULT), 10)
  );
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, w: SIDEBAR_DEFAULT });

  const onDragMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, w: sidebarWidth };

    const onMove = (e) => {
      if (!isDragging.current) return;
      const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, dragStart.current.w + e.clientX - dragStart.current.x));
      setSidebarWidth(newW);
    };
    const onUp = (e) => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, dragStart.current.w + e.clientX - dragStart.current.x));
      localStorage.setItem('vigilagent-sidebar-width', String(newW));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const { data: scans     = [] } = useQuery({ queryKey: ['scans'],     queryFn: listScans,    refetchInterval: 10000 });
  const { data: reports   = [] } = useQuery({ queryKey: ['reports'],   queryFn: listReports,  refetchInterval: 5000 });
  const { data: watchlist = [] } = useQuery({ queryKey: ['watchlist'], queryFn: getWatchlist, refetchInterval: 30000 });

  const hasJobs      = scans.length > 0;
  const reposScanned = scans.reduce((n, j) => n + (j.repos?.length || 1), 0);

  return (
    <div className="pt-12 h-screen flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: '1px solid rgba(0,240,255,0.12)', background: 'rgba(0,0,0,0.5)' }}
      >
        <StatBox label="REPOS WATCHED"  value={watchlist.length} />
        <StatBox label="REPOS SCANNED"  value={reposScanned} />
        <StatBox label="REPORTS"        value={reports.length} green />
      </div>

      {/* Main layout — flex so sidebar is resizable */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left column */}
        <div
          className="space-y-4 p-4 overflow-y-auto shrink-0"
          style={{ width: sidebarWidth }}
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

          <Section label="MODEL">
            <ModelSelector />
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

        {/* Drag handle */}
        <div
          onMouseDown={onDragMouseDown}
          className="shrink-0 transition-colors duration-150"
          style={{ width: 5, cursor: 'col-resize', background: 'rgba(0,240,255,0.08)', borderLeft: '1px solid rgba(0,240,255,0.08)', borderRight: '1px solid rgba(0,240,255,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,240,255,0.25)'; }}
          onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'rgba(0,240,255,0.08)'; }}
        />

        {/* Right column — logo backdrop + job queue */}
        <div className="relative overflow-hidden flex-1">
          <div
            className="absolute inset-0 flex items-center justify-center p-12 pointer-events-none"
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
