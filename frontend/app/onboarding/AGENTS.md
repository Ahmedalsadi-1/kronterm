# frontend/app/onboarding — Onboarding Flow

**Parent:** `../AGENTS.md`

## OVERVIEW

First-run onboarding experience. Multi-step flow introducing features, handling upgrades, and collecting user preferences.

## STRUCTURE

```
onboarding/
├── onboarding.tsx              # Main orchestrator
├── onboarding-layout.tsx       # Layout wrapper
├── onboarding-layout-term.tsx  # Terminal-integrated layout
├── onboarding-command.tsx      # Command introduction step
├── onboarding-features.tsx     # Feature showcase
├── onboarding-features-footer.tsx  # Feature footer
├── onboarding-durable.tsx      # Durable sessions step
├── onboarding-starask.tsx      # Star/feedback request
├── onboarding-upgrade.tsx      # Upgrade orchestrator
├── onboarding-upgrade-minor.tsx  # Minor version upgrades
├── onboarding-upgrade-patch.tsx  # Patch version upgrades
├── onboarding-upgrade-v0*.tsx  # Version-specific upgrades
└── fakechat.tsx                # Simulated chat for demo
```

## PATTERNS

### Version-specific upgrade

Files named `onboarding-upgrade-v{major}{minor}{patch}.tsx`:
- `v0140` → v0.14.0
- `v0141` → v0.14.1
- Each handles changes for that release

### Steps

Onboarding is a sequence of steps:
1. Welcome/intro
2. Features showcase
3. Durable sessions
4. Command introduction
5. Star/feedback request

## FAKE CHAT

`fakechat.tsx` simulates AI chat for onboarding demo:
- Pre-scripted messages
- Typing animation
- No real AI calls

## ADDING STEP

1. Create `onboarding-<name>.tsx`
2. Add to step sequence in `onboarding.tsx`
3. Use `onboarding-layout.tsx` for consistent styling
