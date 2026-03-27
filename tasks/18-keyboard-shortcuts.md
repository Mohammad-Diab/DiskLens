# Task 18 — useKeyboard Hook

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src/hooks/useKeyboard.ts`

## Goal
Centralize all keyboard shortcuts in a single hook, attached at App level.

## All shortcuts

| Key          | Action |
|--------------|--------|
| Delete       | Send selected items to Trash |
| Shift+Delete | Delete permanently (opens DeleteDialog) |
| Backspace    | Navigate to parent folder |
| Enter        | Navigate into selected folder (if single folder selected) |
| Ctrl+A       | Select all visible rows |
| Ctrl+C       | Copy path of first selected item to clipboard |
| Escape       | Clear selection; if side panel open, close it |
| P            | Open side panel with first selected item |
| F5           | Re-scan current folder |
| Ctrl+F       | Focus search input |

## Implementation pattern

```ts
export function useKeyboard() {
  const store = useStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // guard: skip if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' && !e.shiftKey) { /* trash */ }
      if (e.key === 'Delete' && e.shiftKey)  { /* permanent delete dialog */ }
      if (e.key === 'Backspace')              { /* navigate up */ }
      // ... etc
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [/* deps from store */]);
}
```

## Notes
- Single `useEffect` — do not split into multiple effects per key
- Always clean up the listener on unmount
- Guard against firing when focus is inside an input (rename field, search, path input)
- Call this hook once in `App.tsx`, not in individual components
- For Ctrl+F: use a `ref` forwarded to the search input to call `.focus()`
