# KronTerm Video Production

## Intro Film

- Composition: `KronTermIntro`
- Duration: 90 seconds
- Format: 1080×1920, 9:16 vertical, 30 FPS, H.264 MP4
- Tone: calm; long fades, staggered reveals
- Audio: silent track (add BGM/narration as a follow-up if needed)

| Scene          | Time        | Visual                                                                                  |
| -------------- | ----------- | --------------------------------------------------------------------------------------- |
| Title          | 00:00–00:10 | Icon + KronTerm wordmark fade in with tagline "The developer workspace, unified."       |
| Problem        | 00:10–00:23 | Terminal / Browser / AI Chat window cards drift apart                                   |
| Solution       | 00:23–00:37 | Four cards glide into a tiled 2×2 workspace grid                                        |
| Surfaces       | 00:37–00:50 | Mock terminal types on while a browser block loads kronterm.dev                         |
| Canvas + AI    | 00:50–01:04 | Sticky notes and connectors pan across the canvas beside a KronosCode chat panel        |
| Values         | 01:04–01:17 | Keyboard-first · Local-first & private · Built for deep work                            |
| CTA            | 01:17–01:30 | Wordmark returns with "One workspace. Every surface." and fades to black                |

Render with:

```bash
npm run build:intro
```

Output lands at `video/out/kronterm-intro.mp4`. QA stills for each scene are in `video/out/stills/`.

## Field Guide Film

- Composition: `KronTermFieldGuide`
- Duration: 15 seconds
- Format: 1920×1080, 16:9, 30 FPS, H.264 MP4
- Tone: cinematic editorial field guide
- Audio: no narration required; designed to work muted on the website

| Scene                            | Time        | Visual                                                                             |
| -------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| Open the cover                   | 00:00–00:03 | The pet opens the living-canvas field guide beside the product thesis              |
| One operating picture            | 00:03–00:06 | Human + Agent Orchestra keyframe with a slow camera settle                         |
| Follow the evidence              | 00:06–00:10 | Browser evidence and sandbox launch plates slide into a split spread               |
| Work across the loop             | 00:10–00:13 | Code review, desktop control, agent operations, and testing form a four-card index |
| Put the canvas behind the prompt | 00:13–00:15 | Living Workspace image and private-beta call to action                             |

Render with:

```bash
npm run build:field-guide
```

The final website copy is `website/public/assets/video/kronterm-field-guide.mp4`. The Remotion render remains in `video/out/kronterm-field-guide.mp4`.
