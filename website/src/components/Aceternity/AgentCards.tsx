import { motion } from 'framer-motion'
import { useState } from 'react'

interface Agent {
  name: string
  description: string
  status: 'Active' | 'Beta' | 'Premium' | 'Soon'
  tags: string[]
  icon: React.ReactNode
  screenshot?: string
  capabilities?: string[]
}

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Beta: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Premium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Soon: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
}

interface AgentCardProps {
  agent: Agent
  index: number
}

function AgentCard({ agent, index }: AgentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="h-full"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <motion.div
        className="relative h-full cursor-pointer glow-card"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 80, damping: 25 }}
        style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
      >
        {/* Front */}
        <motion.div
          className="absolute inset-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[var(--accent)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {agent.icon}
                </svg>
              </div>
              <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full uppercase tracking-[0.08em] border ${statusColors[agent.status]}`}>
                {agent.status}
              </span>
            </div>

            <h4 className="text-lg font-display font-semibold tracking-[-0.01em] mb-3 text-[var(--text-primary)]">
              {agent.name}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4 line-clamp-3">
              {agent.description}
            </p>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-mono"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-[var(--text-tertiary)] font-mono text-center">
            <span className="text-[var(--accent)]">$</span> hover to inspect
          </div>
        </motion.div>

        {/* Back */}
        <motion.div
          className="absolute inset-0 bg-[var(--bg-secondary)] border border-[var(--border-glow)] rounded-2xl p-6 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden', rotateY: 180 }}
        >
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <h4 className="text-base font-display font-semibold text-[var(--accent)]">
                {agent.name} capabilities
              </h4>
            </div>
            <ul className="space-y-3">
              {(agent.capabilities || []).map((cap, i) => (
                <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2.5">
                  <span className="text-[var(--accent)] mt-0.5 font-mono text-xs">→</span>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

interface AgentCardsProps {
  agents: Agent[]
}

export default function AgentCards({ agents }: AgentCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-max">
      {agents.map((agent, i) => (
        <div key={agent.name} style={{ perspective: 1000 }}>
          <AgentCard agent={agent} index={i} />
        </div>
      ))}
    </div>
  )
}
