# Website Deployment

The production website is published with GitHub Pages from the `main` branch through GitHub Actions.

## Public URL

https://minitorch25.github.io/Roll-and-Ruin/

## Deployment flow

1. A push to `main` that changes the game, Vite configuration, package metadata, or deployment workflow starts the deployment workflow.
2. The workflow installs dependencies and runs TypeScript, game logic, and Playwright browser tests.
3. Vite builds the static site into `dist/`.
4. GitHub Pages publishes the build artifact.
5. The deployment job exposes the published URL in its environment summary.

The Vite base path is relative (`./`) so generated assets resolve correctly from the repository subpath.

## Manual deployment

The workflow can also be started from the repository's Actions tab using **Deploy Website** → **Run workflow**.

No multiplayer server is required for this static deployment. The current browser build remains a local match with bot-filled seats; online multiplayer is intentionally deferred.
