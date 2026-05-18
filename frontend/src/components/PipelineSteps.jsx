const STEPS = [
  { key: 'clone',            label: 'CLONE'   },
  { key: 'static_analysis',  label: 'STATIC'  },
  { key: 'dependency_audit', label: 'DEPS'    },
  { key: 'secret_scan',      label: 'SECRETS' },
  { key: 'report',           label: 'REPORT'  },
];

export default function PipelineSteps({ currentAgent, agentsDone = [] }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done    = agentsDone.includes(step.key);
        const active  = currentAgent === step.key;
        const pending = !done && !active;
        const last    = i === STEPS.length - 1;

        const color = done ? '#00ff88' : active ? '#00f0ff' : 'rgba(0,240,255,0.2)';

        return (
          <div key={step.key} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: color,
                  boxShadow: done
                    ? '0 0 6px #00ff88'
                    : active
                    ? '0 0 8px #00f0ff, 0 0 16px #00f0ff'
                    : 'none',
                  animation: active ? 'pulseDotBlue 1.2s ease-in-out infinite' : 'none',
                }}
              />
              <span
                className="text-[8px] tracking-wider font-bold"
                style={{ color, whiteSpace: 'nowrap' }}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {!last && (
              <div
                className="w-6 h-px mx-0.5 mb-3 transition-all duration-300"
                style={{
                  background: done ? '#00ff88' : active ? 'rgba(0,240,255,0.4)' : 'rgba(0,240,255,0.1)',
                  boxShadow: done ? '0 0 4px #00ff88' : 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
