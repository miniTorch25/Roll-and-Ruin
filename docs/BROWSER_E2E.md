# Browser End-to-End Tests

The browser test suite uses Playwright with Chromium and a local Vite development server.

## Run locally

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

## Current coverage

- Complete the match setup dialogs and verify the Phaser canvas and initial player HUD.
- Trigger a player turn action from the browser UI and verify the roll result.
- Play a targeted Attack card, select an opponent, and verify the target's HP changes.
- Summon a Rare Monster from a card, verify it appears in the monster panel, then use Monster Hunter and verify the monster's HP changes.

The suite runs in GitHub Actions after TypeScript and game-logic tests and before the production build. The timed-match lifecycle test starts a match, completes a player turn, expires the timer, and verifies the final results screen.

## Mobile layout smoke test

A 390 × 844 mobile viewport test verifies that the board and all primary actions remain visible, the page does not overflow horizontally, and primary action buttons retain touch-friendly heights. The first responsive pass also accounts for device safe areas and keeps player status cards in a compact two-column layout on narrow phones.


## Tablet and desktop layout test

A responsive layout test checks 768 × 1024 tablet and 1280 × 900 desktop viewports. It verifies there is no horizontal page overflow, the Phaser canvas stays inside the game panel, and the sidebar switches between stacked and two-column layouts at the intended breakpoint.


## Accessibility and compact viewport coverage

- Setup dialogs expose accessible names and descriptions, support keyboard selection, and remain inside the viewport in short landscape orientation.
- The main action group and game feedback use accessible labels and live status semantics; player and monster panels expose list semantics.
- A 320px-wide viewport is checked for horizontal overflow.
- Dialog option targets retain at least 44px height, and reduced-motion preferences are respected by the UI stylesheet.
