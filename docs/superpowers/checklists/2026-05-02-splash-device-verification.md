# Splash Animation — Device Verification Checklist

**Date:** 2026-05-02
**Target device:** iPhone 12 Pro
**Build:** Release (`xcodebuild -workspace ios/Kairos.xcworkspace -scheme Kairos -configuration Release ...`)

## Pre-flight

- [ ] Clean install: delete app from device, run fresh install
- [ ] AsyncStorage is empty (verified via fresh install)

## Full sequence (`KairosBootSequence`) — first launch only

### Phase 1: Origin (0–600ms)
- [ ] Sphere appears at exact center
- [ ] Sphere fades from 0 → 1 opacity smoothly
- [ ] Sphere scales from 0.7 → 1.0 with deceleration
- [ ] Soft warm glow rises behind sphere in last 200ms
- [ ] Haptic tap felt at frame 0

### Phase 2: Emission (700–1500ms)
- [ ] Three blocks emit from sphere center
- [ ] Angles approximately 10°, 135°, 250° (top-right, bottom-left, bottom-right)
- [ ] Stagger between block emissions visible (~80ms)
- [ ] Each block has a slight rotation while flying
- [ ] Sphere glow recedes during emission

### Phase 3: Return (1500–2200ms)
- [ ] All three blocks return to center
- [ ] Acceleration is felt (slow start, fast finish)
- [ ] Convergence is simultaneous

### Phase 4: Cube morph (2200–2900ms)
- [ ] Sphere disappears as cube appears (no jarring crossfade)
- [ ] Three emission blocks fade as cube grows
- [ ] Cube has visible 3-face volume (top brighter than left, right darker)
- [ ] Cube rotates ~15° during transition
- [ ] Haptic medium impact felt at ~2400ms

### Phase 5: Division (3000–4000ms)
- [ ] Cube dissolves
- [ ] Six blocks emerge from center
- [ ] Stagger between block births is visible (~120ms)
- [ ] Each block lands with subtle bounce
- [ ] Final positions form a horizontal line spaced like the wordmark

### Phase 6: Mutation (4000–5200ms)
- [ ] Each block transforms into its letter (K, A, I, R, O, S in order)
- [ ] Stagger between letter reveals visible (~100ms)
- [ ] Block scale-up + opacity-down + letter scale-up + opacity-up read as morph
- [ ] No "two states fighting" feel
- [ ] Haptic tap felt at ~5000ms (when S completes)

### Phase 7: Final state (5200–6400ms)
- [ ] "KAIROS" reads cleanly in geometric sans-serif weight 300
- [ ] Soft warm glow rises and falls behind letters
- [ ] Subtle breathing on letters detectable
- [ ] No flicker

### Phase 8: Reverse (6400–7400ms)
- [ ] Letters fade back into blocks
- [ ] 6 blocks collapse to 3 in isometric formation
- [ ] Tempo feels slightly slower than forward
- [ ] Background fades cleanly to home screen
- [ ] No "snap" at end

### After completion
- [ ] App is interactive within 100ms of splash end
- [ ] Force quit + relaunch → condensed plays (NOT full)

## Condensed sequence (`SplashCondensed`) — every subsequent launch

- [ ] Total duration ~3.1s
- [ ] Sphere → wordmark transition without intermediate cube
- [ ] Two haptic beats (start, S-complete)
- [ ] Final state shows breathing
- [ ] Smooth fade to app

## Performance

- [ ] No frame drops visible during phase 4 (cube morph)
- [ ] No frame drops visible during phase 6 (letter mutation)
- [ ] No frame drops visible during phase 8 (reverse)
- [ ] Memory stays under 5MB delta during splash (verified via Xcode profiler)

## Reference comparison

After capturing 60fps screen recording from device:

- [ ] Side-by-side with Atoms — does Kairos hold up on visual quality?
- [ ] Side-by-side with Tiimo — does Kairos motion feel meditative, not frantic?
- [ ] Side-by-side with Notion — does the cube read as volumetric, not flat?

## Decision gate

- [ ] **PASS** → ship; iterate timings in production
- [ ] **FAIL** → migrate to Lottie (separate plan: `lottie-react-native` install + .json authoring)
