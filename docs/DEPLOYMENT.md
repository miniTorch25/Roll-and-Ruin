# Website Deployment

The repository is configured to publish the production website with GitHub Pages from the `main` branch through GitHub Actions. A one-time manual Pages enablement is required before the first deployment.

## One-time setup required before the first deployment

The repository's `GITHUB_TOKEN` can build and deploy a configured Pages site, but it cannot create the initial Pages site through the Pages API. A repository owner must enable it once:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Save the setting.

After this is enabled, the workflow can deploy using the repository's built-in token. No personal access token or secret is required.

## Public URL

https://minitorch25.github.io/Roll-and-Ruin/

The URL becomes available after the first successful deployment.

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
