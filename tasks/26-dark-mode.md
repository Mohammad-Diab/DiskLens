# Task 26 — Dark Mode

**Phase**: 4 — Release
**Status**: [ ] Not started

## Goal
Support system-level dark/light mode. Detect the OS preference and apply the corresponding theme automatically.

## Implementation

### Detection
```ts
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
```
Listen for changes:
```ts
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  setDark(e.matches);
});
```

### CSS approach
Use a `data-theme="dark"` attribute on `<html>` or a `dark` class (compatible with Tailwind dark mode):
```ts
document.documentElement.classList.toggle('dark', isDark);
```

### Color tokens to define
| Token          | Light          | Dark           |
|----------------|----------------|----------------|
| bg-base        | `#ffffff`      | `#1a1a1a`      |
| bg-surface     | `#f5f5f5`      | `#252525`      |
| bg-row-hover   | `#f0f0f0`      | `#2e2e2e`      |
| text-primary   | `#111111`      | `#e5e5e5`      |
| text-secondary | `#555555`      | `#999999`      |
| border         | `#e0e0e0`      | `#3a3a3a`      |
| row-red        | `#fee2e2`      | `#3d1a1a`      |
| row-amber      | `#fef3c7`      | `#2e2500`      |
| row-green      | `#dcfce7`      | `#0d2e16`      |

## Notes
- No manual toggle needed — follow system preference only (can add manual override in a later version)
- Tauri window background should match: set in `tauri.conf.json` → `backgroundColor`
