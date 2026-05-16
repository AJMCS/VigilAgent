import { GitBranch, Code2, Package, KeyRound, FileText, Check, Loader } from 'lucide-react'

const STEPS = [
  { key: 'clone', label: 'Clone', icon: GitBranch },
  { key: 'static_analysis', label: 'Static', icon: Code2 },
  { key: 'dependency_audit', label: 'Deps', icon: Package },
  { key: 'secret_scan', label: 'Secrets', icon: KeyRound },
  { key: 'report', label: 'Report', icon: FileText },
]

export default function PipelineSteps({ currentAgent, agentsDone = [], status }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isDone = agentsDone.includes(step.key) || status === 'completed'
        const isCurrent = currentAgent === step.key
        const isPending = !isDone && !isCurrent
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                    : isCurrent
                    ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/60 animate-pulse'
                    : 'bg-slate-800 text-slate-600 ring-1 ring-slate-700'
                }`}
              >
                {isDone ? (
                  <Check size={12} />
                ) : isCurrent ? (
                  <Loader size={12} className="animate-spin" />
                ) : (
                  <Icon size={12} />
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isDone ? 'text-emerald-400' : isCurrent ? 'text-indigo-400' : 'text-slate-600'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-6 mx-0.5 mb-4 transition-colors ${
                  agentsDone.includes(STEPS[i + 1]?.key) || isDone
                    ? 'bg-emerald-500/40'
                    : isCurrent
                    ? 'bg-indigo-500/30'
                    : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
