# Task 28 — GitHub Actions Build Pipeline

**Phase**: 4 — Release
**Status**: [ ] Not started
**File**: `.github/workflows/build.yml`

## Goal
Automated CI build that compiles the Tauri app on Windows and produces a distributable `.exe` installer.

## Workflow triggers
- On push to `main`
- On pull requests to `main`
- On GitHub release creation (produces the release artifact)

## Build job (Windows)

```yaml
name: Build DiskLens

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  release:
    types: [created]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install frontend deps
        run: npm ci

      - name: Build Tauri app
        run: npm run tauri build

      - name: Upload installer artifact
        uses: actions/upload-artifact@v4
        with:
          name: DiskLens-installer
          path: src-tauri/target/release/bundle/msi/*.msi
```

## Notes
- Rust compilation is slow — consider caching with `Swatinem/rust-cache`
- The `.msi` installer is in `src-tauri/target/release/bundle/msi/`
- For release uploads, use `softprops/action-gh-release` to attach the `.msi` to the GitHub release
- Windows runner is required (can't cross-compile Tauri for Windows from Linux)
