# Website Deployment

The repository publishes the production website with GitHub Pages from the `main` branch through GitHub Actions.

## One-time setup required before the first deployment

A repository owner must enable GitHub Pages once in the repository settings. The built-in `GITHUB_TOKEN` used by the deployment workflow can publish an already-configured Pages site, but it cannot enable Pages for the first time through `actions/configure-pages`.

1. Open the repository: https://github.com/miniTorch25/Roll-and-Ruin
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Save the setting.

No personal access token or repository secret is required. The workflow uses the built-in token for subsequent deployments.

## Public URL

https://minitorch25.github.io/Roll-and-Ruin/

The URL becomes available after the first successful deployment.

## Deployment flow

1. A push to `main` or a manual run from the Actions tab starts the deployment workflow.
2. The workflow installs dependencies and runs TypeScript checks, game logic tests, and Playwright browser end-to-end tests.
3. Vite builds the static site into `dist/`.
4. GitHub Actions uploads the build artifact and deploys it to GitHub Pages.
5. The deployment job exposes the published URL in its environment summary.

The Vite base path is relative (`./`) so generated assets resolve correctly from the repository subpath.

## Manual deployment

After the one-time Pages setup, the workflow can be started from the repository's Actions tab using **Deploy Website → Run workflow**.

No multiplayer server is required for this static deployment. The current browser build remains a local match with bot-filled seats; online multiplayer is intentionally deferred.
