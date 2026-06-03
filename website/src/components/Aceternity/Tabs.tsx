import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Tab {
  title: string
  value: string
  content: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  containerClassName?: string
  contentClassName?: string
}

export default function Tabs({
  tabs,
  containerClassName = '',
  contentClassName = '',
}: TabsProps) {
  const [active, setActive] = useState(tabs[0].value)

  return (
    <div className={containerClassName}>
      <div className="flex gap-1.5 mb-10 flex-wrap relative">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              active === tab.value
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {active === tab.value && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-[var(--accent-subtle)] border border-[var(--border-glow)] rounded-xl"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.title}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={contentClassName}
        >
          {tabs.find((t) => t.value === active)?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
