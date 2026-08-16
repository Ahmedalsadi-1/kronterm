import { ALL_PROFILES, normalizeProfileKey } from '@hermes/store/profile'
import type { SessionInfo } from '@hermes/types/hermes'

/** Return the sessions visible in one sidebar profile scope, or the original unified list for All profiles. */
export function filterSessionsByProfileScope(sessions: SessionInfo[], profileScope: string): SessionInfo[] {
  if (profileScope === ALL_PROFILES) {
    return sessions
  }

  const scope = normalizeProfileKey(profileScope)

  return sessions.filter(session => normalizeProfileKey(session.profile) === scope)
}
