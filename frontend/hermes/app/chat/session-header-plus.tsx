import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Codicon } from '@hermes/components/ui/codicon'
import { Tip } from '@hermes/components/ui/tooltip'
import { cn } from '@hermes/lib/utils'
import { $fileBrowserOpen, $panesFlipped, toggleFileBrowserOpen } from '@hermes/store/layout'
import { type PreviewTarget, $previewTabs, openPreview } from '@hermes/store/preview'
import { $terminalTakeover, setTerminalTakeover } from '@hermes/app/right-sidebar/store'

interface PanelAction {
  id: string
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
}

export function SessionHeaderPlusButton() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  const fileBrowserOpen = useStore($fileBrowserOpen)
  const terminalActive = useStore($terminalTakeover)
  const previewTabs = useStore($previewTabs)
  const panesFlipped = useStore($panesFlipped)

  const browserActive = previewTabs.length > 0

  // Position the popup below the trigger button
  useEffect(() => {
    if (!open || !triggerRef.current) {
      return
    }

    const rect = triggerRef.current.getBoundingClientRect()
    setPopupStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: panesFlipped ? undefined : rect.left,
      right: panesFlipped ? `${window.innerWidth - rect.right}px` : undefined,
      zIndex: 9999
    })
  }, [open, panesFlipped])

  // Close the popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) {
      return
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const handleOpenBrowser = useCallback(() => {
    if (!browserActive) {
      const defaultTarget: PreviewTarget = {
        kind: 'url',
        url: 'https://example.com',
        label: 'Browser',
        source: 'manual'
      }
      openPreview(defaultTarget, 'manual')
    }
    setOpen(false)
  }, [browserActive])

  const handleToggleTerminal = useCallback(() => {
    setTerminalTakeover(!terminalActive)
    setOpen(false)
  }, [terminalActive])

  const handleToggleFiles = useCallback(() => {
    toggleFileBrowserOpen()
    setOpen(false)
  }, [])

  const panels: PanelAction[] = [
    {
      id: 'browser',
      icon: 'globe',
      label: 'Browser',
      isActive: browserActive,
      onClick: handleOpenBrowser
    },
    {
      id: 'terminal',
      icon: 'terminal',
      label: 'Terminal',
      isActive: terminalActive,
      onClick: handleToggleTerminal
    },
    {
      id: 'files',
      icon: 'files',
      label: 'Files',
      isActive: fileBrowserOpen,
      onClick: handleToggleFiles
    }
  ]

  return (
    <>
      <Tip label="Add panel">
        <button
          ref={triggerRef}
          className={cn(
            'pointer-events-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] transition-colors',
            'hover:bg-(--chrome-action-hover)',
            open && 'bg-(--chrome-action-hover)'
          )}
          onClick={() => setOpen(prev => !prev)}
        >
          <Codicon name="add" className="text-(--ui-text-primary)" />
        </button>
      </Tip>

      {open &&
        createPortal(
          <div
            className="flex gap-1 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-surface-background) p-1.5 shadow-lg"
            style={popupStyle}
          >
            {panels.map(panel => (
              <Tip key={panel.id} label={panel.label}>
                <button
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors',
                    'hover:bg-(--chrome-action-hover)',
                    panel.isActive && 'bg-(--chrome-action-hover) text-(--ui-text-primary)'
                  )}
                  onClick={panel.onClick}
                >
                  <Codicon name={panel.icon} className="text-(--ui-text-secondary)" />
                </button>
              </Tip>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
