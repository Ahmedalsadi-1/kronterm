import { motion } from 'framer-motion'
import React from 'react'

interface Feature {
  title: string
  description: string
  content?: React.ReactNode
  icon?: React.ReactNode
  index: number
}

interface FeatureSectionsProps {
  features: Feature[]
  containerClassName?: string
}

export default function FeatureSections({
  features,
  containerClassName = '',
}: FeatureSectionsProps) {
  return (
    <div className={containerClassName}>
      {features.map((feature, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: idx * 0.1, duration: 0.5 }}
          className="mb-20 last:mb-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
              {feature.icon && (
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)]">
                    {feature.icon}
                  </div>
                </div>
              )}
              <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-display font-semibold tracking-[-0.02em] mb-4">
                {feature.title}
              </h3>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6">
                {feature.description}
              </p>
            </div>
            {feature.content && (
              <div className={idx % 2 === 1 ? 'lg:order-1' : ''}>
                {feature.content}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
