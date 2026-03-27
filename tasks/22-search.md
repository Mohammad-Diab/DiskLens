# Task 22 — Search (Debounced)

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/Toolbar/Toolbar.tsx`

## Goal
Add a search input to the toolbar that filters the file table by name, debounced at 200ms.

## Behavior
- Input field with a search icon (Lucide `Search`)
- As user types, wait 200ms then update `searchQuery` in Zustand
- File table filters rows where `name.toLowerCase().includes(query.toLowerCase())`
- `Ctrl+F` focuses this input (keyboard hook sets focus via ref)
- Clear button (×) appears when there's text — click clears the query

## Debounce implementation
```tsx
const [localQuery, setLocalQuery] = useState('');
const { setSearchQuery } = useStore();

useEffect(() => {
  const id = setTimeout(() => setSearchQuery(localQuery), 200);
  return () => clearTimeout(id);
}, [localQuery]);
```

## FileTable filter integration
```tsx
const visible = filtered.filter(e =>
  searchQuery === '' || e.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

## Notes
- Search is client-side only — does not re-invoke `scan_dir`
- Combined with type filter chips (Task 21): both apply simultaneously
- Forward a `ref` to the input so `useKeyboard` can call `.focus()` on Ctrl+F
