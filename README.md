# PR Garden

An isometric garden where your GitHub work grows as flower beds. Walk a small
gardener around with the keyboard, and "tend" a bed to open its pull request.

- **My garden**: your open PRs, plus stale branches (weeds), a harvest basket
  (merged this week) and a compost heap (closed without merging, last 30 days).
- **Review garden**: PRs waiting for your review.

It's a static site (Vite + TypeScript + PixiJS v8). There's no backend: the app
calls the GitHub GraphQL API straight from your browser.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173/?mock=1> to try it with mock data. Without `?mock=1`,
the app asks for a GitHub token.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |

## GitHub token setup

PR Garden uses a **fine-grained personal access token** with read-only access.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
   (<https://github.com/settings/personal-access-tokens/new>).
2. **Resource owner**: pick your user, or the organisation that owns the repos.
   A fine-grained token covers one owner. If your PRs live in several orgs, you
   may need a token per org, or a classic token with the `repo` scope.
3. **Repository access**: *All repositories*, or select the ones you work in.
4. **Repository permissions**, all **Read-only**:
   - Pull requests
   - Contents (needed for branches, which become weeds)
   - Metadata (added automatically)
   - Checks (CI status)
5. Generate the token, open PR Garden, click the ⚙ button and paste the token.

The token is stored only in your browser's `localStorage` and is sent only to
`api.github.com`. Use **Forget token** in settings to remove it.

### Organisations with SAML SSO

If an org enforces SAML single sign-on, the token must be authorised for that org:
**Settings → Developer settings → Personal access tokens → Configure SSO →
Authorize** next to the org. Until then, GitHub hides that org's PRs, and the
garden shows a notice saying some data is hidden.

Some orgs also need an admin to approve fine-grained tokens before they work.

### Weeds (stale branches)

In settings, list the repos to check (`owner/repo`, one per line). A branch
becomes a weed when its last commit is yours, it has no pull request, and it has
had no commits for 14 days or more.

## How beds are grown

**My PRs**, checked in this order:

| State | When | Look |
| --- | --- | --- |
| Seedling | Draft | Bare soil, tiny sprouts |
| Bugs | CI `FAILURE` or `ERROR` | Red beetles, bug marker |
| Thirsty | Unresolved threads where someone else spoke last | Cracked dry soil, water-drop marker |
| Blooming | Review decision `APPROVED` | Full flowers |
| Growing | Anything else | Green leaves with buds |

**Review requests**, based on how long ago your review was requested:

| State | When |
| --- | --- |
| Growing (fresh) | Under 24 hours |
| Drooping | 1–3 days (amber `!`) |
| Wilting | 3+ days (red `!`) |
| Thirsty | You reviewed before and new commits have arrived since |
| Blooming | You approved and it's waiting for the author to merge |

The review garden combines two searches: `review-requested:@me` and
`reviewed-by:@me -author:@me`. The second search finds PRs that need a re-review
and PRs you've already approved. PRs you reviewed with nothing new since (the
ball is in the author's court) are left out.

Data refreshes every 5 minutes, when the window regains focus, and when you
press **R**. The last result is cached, so the garden appears instantly on
reload. Rate limits, a bad token and being offline each show a notice, and the
cached garden stays on screen.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** / arrows | Walk relative to the screen. Two keys together walk diagonally along the paths. |
| **Shift** | Run |
| **E**, **Space**, **Enter** | Tend the highlighted bed (opens it on GitHub) |
| **Tab**, **1**, **2** | Switch garden (1 = my PRs, 2 = to review) |
| **L** | List view: the same data as plain links |
| **R** | Refresh |
| **\\** | Collapse the side panel |
| **?** | Controls overlay |
| **Esc** | Close overlays |

Mouse: click a tile or bed to walk there, hover a bed for details, and use the
wheel to zoom. Walking through the arch at the bottom edge takes you to the other
garden.

Game keys never scroll the page, and they're ignored while you type in a text
field. When a button has keyboard focus, Tab, Space and Enter keep their usual
behaviour. Below 900 px wide, the panel becomes a bottom sheet and an on-screen
d-pad appears.

Accessibility: the game works fully from the keyboard, focus rings are visible,
the canvas has a descriptive `aria-label`, and **L** offers a plain list of
links. With `prefers-reduced-motion`, bobbing, swaying and camera easing are
turned off.

## Deploying to GitHub Pages

The repo includes `.github/workflows/deploy.yml`. It runs the tests, builds the
site and publishes `dist/` to Pages on every push to `main`.

1. Push the repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run the workflow by hand from the **Actions** tab.

`vite.config.ts` uses `base: './'`, so the build works under any path, such as
`https://<you>.github.io/pr-garden/`.

## Project layout

```
src/
  github/   client.ts (GraphQL + errors), queries.ts, mapping.ts (pure state logic),
            store.ts (cache/refresh), mock.ts
  world/    template.ts (14×14 map), layout.ts (placement, proximity),
            collision.ts, pathfinding.ts (A*)
  render/   iso.ts, drawGround.ts, drawBed.ts, drawProps.ts, drawGardener.ts,
            camera.ts, ambient.ts, scene.ts, palette.ts
  input/    keyboard.ts (key-state map), mouse.ts
  ui/       hud.ts, panel.ts, card.ts, listView.ts, settings.ts, help.ts, touch.ts
  game.ts   fixed-timestep loop (60 Hz update, render on rAF)
  main.ts   wiring
tests/      mapping, layout, collision, pathfinding, client
```

All art is drawn procedurally with Pixi `Graphics`, seeded per bed so it stays
the same between renders. Drawing code lives only in `src/render/`, so it can be
swapped for sprite sheets later without touching game logic.
