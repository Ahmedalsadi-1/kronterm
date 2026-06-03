const sprites = ['kronterm-pet-pose1.png', 'kronterm-pet-pose2.png', 'kronterm-pet-pose3.png', 'kronterm-pet-pose1.png']
const positions = ['top-[10%] left-[4%] w-10 h-10', 'top-[15%] right-[5%] w-9 h-9', 'bottom-[10%] left-[6%] w-11 h-11', 'bottom-[12%] right-[6%] w-[38px] h-[38px]']

const messages = [
  'Keep coding!',
  'Ship it!',
  'You are doing great!',
  'KronosCode is watching...',
  'Have you committed today?',
]

export default function PetSprites() {
  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const msg = messages[Math.floor(Math.random() * messages.length)]
    const bubble = document.createElement('div')
    bubble.textContent = msg
    Object.assign(bubble.style, {
      position: 'fixed',
      zIndex: '9999',
      background: 'var(--bg-card)',
      color: 'var(--text-primary)',
      padding: '8px 16px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      fontSize: '12px',
      fontWeight: '500',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      opacity: '0',
      transform: 'translateY(10px)',
      transition: 'all 0.3s',
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top - 40}px`,
    })
    document.body.appendChild(bubble)
    requestAnimationFrame(() => {
      bubble.style.opacity = '1'
      bubble.style.transform = 'translateY(0)'
    })
    setTimeout(() => {
      bubble.style.opacity = '0'
      setTimeout(() => bubble.remove(), 300)
    }, 2000)
  }

  return (
    <>
      {sprites.map((sprite, i) => (
        <div
          key={i}
          className={`fixed z-90 opacity-15 hover:opacity-70 transition-all duration-300 cursor-pointer ${positions[i]}`}
          onClick={handleClick}
        >
          <img src={`/assets/${sprite}`} alt="" className="w-full h-full object-contain" />
        </div>
      ))}
    </>
  )
}
