# Task 27 — App Icon

**Phase**: 4 — Release
**Status**: [ ] Not started

## Goal
Create and apply a proper app icon for the DiskLens Windows executable and installer.

## Required sizes (Tauri)
Tauri reads icons from `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS — optional)
- `icon.ico` (Windows — required)

## Design concept
- Magnifying glass over a disk/pie chart
- Colors: blue + white on a dark background
- Clean, minimal — readable at 16×16

## Steps
1. Design the icon (Figma, Inkscape, or AI-generated)
2. Export as PNG at 512×512
3. Generate all required sizes and `.ico` using ImageMagick or an online converter
4. Place files in `src-tauri/icons/`
5. Reference in `tauri.conf.json`:
```json
"bundle": {
  "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.ico"]
}
```

## Notes
- Tauri CLI can generate placeholder icons: `npm run tauri icon path/to/source.png`
- The `.ico` file must include 16, 32, 48, and 256px sizes embedded
