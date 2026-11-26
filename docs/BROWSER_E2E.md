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

## Separate remaining work

These tests cover the card-effect and monster interactions listed in the roadmap. They do not yet represent a full browser playthrough from match start to final scoring; that remains tracked as **Browser Playtest**.
