import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Backlight } from '@/components/ui/backlight'

interface Product {
  title: string
  thumbnail: string
  link?: string
}

interface HeroParallaxProps {
  products: Product[]
}

export default function HeroParallax({ products }: HeroParallaxProps) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const translateY = useTransform(scrollYProgress, [0, 1], [0, 400])

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden"
    >
      <motion.div style={{ y: translateY }} className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6 py-20 max-w-[1200px] mx-auto">
          {products.map((product, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="relative group"
            >
              <a href={product.link || '#'} className="block">
                <Backlight className="backlight-wrap" blur={8}>
                  <div className="relative h-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--border-glow)] transition-all duration-300">
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <h3 className="text-white font-medium text-sm">{product.title}</h3>
                  </div>
                  </div>
                </Backlight>
              </a>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
