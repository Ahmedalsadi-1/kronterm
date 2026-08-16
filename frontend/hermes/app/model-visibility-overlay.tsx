import { useStore } from '@nanostores/react'

import { ModelVisibilityDialog } from '@hermes/components/model-visibility-dialog'
import type { HermesGateway } from '@hermes/hermes'
import { $modelVisibilityOpen, setModelVisibilityOpen } from '@hermes/store/model-visibility'
import { $activeSessionId, $gatewayState } from '@hermes/store/session'

interface ModelVisibilityOverlayProps {
  gateway?: HermesGateway
  onOpenProviders: () => void
  profile: string
}

export function ModelVisibilityOverlay({ gateway, onOpenProviders, profile }: ModelVisibilityOverlayProps) {
  const activeSessionId = useStore($activeSessionId)
  const gatewayOpen = useStore($gatewayState) === 'open'
  const open = useStore($modelVisibilityOpen)

  if (!gatewayOpen) {
    return null
  }

  return (
    <ModelVisibilityDialog
      gw={gateway}
      onOpenChange={setModelVisibilityOpen}
      onOpenProviders={onOpenProviders}
      open={open}
      profile={profile}
      sessionId={activeSessionId}
    />
  )
}
