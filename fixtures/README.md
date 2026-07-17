# Fixtures

Integration tests (`npm run test:ae`) need a real After Effects project. This repo’s default fixture is `hello-world.aep` — host tests open it by path under `fixtures/`; no env var is required.

## `hello-world.aep` layout

| Comp                  | Layers / purpose                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `main`                | `Hello World` (text), `Background` (solid) — baseline inventory                           |
| `animated`            | `Shape Layer 1` — Position expression `wiggle(1, 10)`, Opacity keyframes (0→99)           |
| `duplicatedLayerName` | Two layers both named `thisNameExistsTwice` — ambiguous `layerName` errors                |
| `withFootage`         | `1x1.png` AV layer + Fast Box Blur (`ADBE Box Blur2`) — file source + effect `matchNames` |

| Source                | Kind  | Notes                                                            |
| --------------------- | ----- | ---------------------------------------------------------------- |
| `1x1.png`             | file  | Under Project folder `footage/`; sibling file `fixtures/1x1.png` |
| `Background`          | solid | Used by `main`                                                   |
| `thisNameExistsTwice` | solid | Used by `duplicatedLayerName`                                    |

## Setup

Configure the host via `.env` (or the environment), then run the suite.

### macOS

```bash
export AE_APP_NAME="Adobe After Effects 2025"   # match your install
# optional:
# export AE_EXECUTABLE="/Applications/Adobe After Effects 2025/Adobe After Effects 2025.app"
```

### Windows

```bat
set AE_EXECUTABLE=C:\Program Files\Adobe\Adobe After Effects 2025\Support Files\AfterFX.exe
```

In After Effects, enable **Preferences → Scripting & Expressions → Allow Scripts To Write Files And Access Network**.

### Run

```bash
npm run test:ae
```

`vitest.ae.config.ts` loads `.env` automatically when present. Suites skip when the current platform has no host bridge or config is incomplete.

Keep `1x1.png` next to the `.aep` so file footage does not go missing. Re-saving the project may change numeric ids; host tests prefer stable **names**.
