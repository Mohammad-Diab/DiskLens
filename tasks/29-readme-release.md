# Task 29 — README + GitHub Release

**Phase**: 4 — Release
**Status**: [ ] Not started
**File**: `README.md`

## Goal
Write a proper README and publish the first GitHub release with a downloadable installer.

## README sections
1. **Header** — app name, tagline, badge (CI status, license)
2. **Screenshot** — one or two screenshots of the app in action
3. **Features** — bullet list of what DiskLens can do
4. **Download** — link to latest GitHub release `.msi`
5. **Build from source** — prerequisites (Node 20, Rust stable) + commands
6. **Architecture** — brief overview (Tauri 2 + React + Rust)
7. **License** — MIT

## GitHub Release steps
1. Tag the commit: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. GitHub Actions (Task 28) picks it up and attaches the `.msi`
4. Write release notes highlighting features

## Release artifact
- `DiskLens-v1.0.0-setup.msi` — Windows installer
- Alternatively: portable `.exe` if bundled as NSIS

## Notes
- Take screenshots only after dark mode (Task 26) is done for the best-looking result
- Include a GIF or video demo in the README if possible
