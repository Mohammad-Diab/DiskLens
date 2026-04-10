import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileEntry } from '../../types';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  /** The right-clicked item — used for the header label. */
  entry: FileEntry;
  /** All entries the menu should act on (1 or many). */
  entries: FileEntry[];
  onClose: () => void;
  onOpen: (entry: FileEntry) => void;
  onDeleteTrash: (entries: FileEntry[]) => void;
  onDeletePermanent: (entries: FileEntry[]) => void;
  onProperties: (e: FileEntry) => void;
}

export function ContextMenu({
  x,
  y,
  entry,
  entries,
  onClose,
  onOpen,
  onDeleteTrash,
  onDeletePermanent,
  onProperties,
}: ContextMenuProps) {
  const menuRef  = useRef<HTMLDivElement>(null);
  const isMulti  = entries.length > 1;
  const isFolder = entry.kind === 'folder';

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onScroll()  { onClose(); }
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('scroll',    onScroll,  true);
    document.addEventListener('keydown',   onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('scroll',    onScroll,  true);
      document.removeEventListener('keydown',   onKeyDown);
    };
  }, [onClose]);

  // Clamp so the menu stays within the viewport
  const menuWidth  = 210;
  const menuHeight = isMulti ? 110 : isFolder ? 250 : 250;
  const left = x + menuWidth  > window.innerWidth  ? x - menuWidth  : x;
  const top  = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  function action(fn: () => void) {
    return () => { fn(); onClose(); };
  }

  function Item({
    label,
    onClick,
    danger = false,
  }: {
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) {
    return (
      <button
        className={`ctx-item${danger ? ' ctx-item-danger' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      >
        {label}
      </button>
    );
  }

  function Sep() { return <div className="ctx-separator" />; }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="ctx-header">
        <span className="ctx-header-name">
          {isMulti ? `${entries.length} items selected` : entry.name}
        </span>
        {!isMulti && (
          <span className="ctx-header-kind">{entry.kind}</span>
        )}
      </div>

      {/* ── Multi-select menu ── */}
      {isMulti && (
        <>
          <Item
            label="Send to Trash"
            onClick={action(() => onDeleteTrash(entries))}
          />
          <Item
            label="Delete Permanently"
            onClick={action(() => onDeletePermanent(entries))}
            danger
          />
        </>
      )}

      {/* ── Single folder menu ── */}
      {!isMulti && isFolder && (
        <>
          <Item
            label="Open"
            onClick={action(() => onOpen(entry))}
          />
          <Item
            label="Show in Explorer"
            onClick={action(() =>
              invoke('open_in_explorer', { path: entry.path }).catch(console.error)
            )}
          />
          <Item
            label="Open Terminal Here"
            onClick={action(() =>
              invoke('open_terminal', { path: entry.path }).catch(console.error)
            )}
          />

          <Sep />

          <Item
            label="Copy Path"
            onClick={action(() =>
              invoke('copy_to_clipboard', { text: entry.path }).catch(console.error)
            )}
          />
          <Item
            label="Copy Name"
            onClick={action(() =>
              invoke('copy_to_clipboard', { text: entry.name }).catch(console.error)
            )}
          />

          <Sep />

          <Item
            label="Send to Trash"
            onClick={action(() => onDeleteTrash([entry]))}
          />
          <Item
            label="Delete Permanently"
            onClick={action(() => onDeletePermanent([entry]))}
            danger
          />
        </>
      )}

      {/* ── Single file menu ── */}
      {!isMulti && !isFolder && (
        <>
          <Item
            label="Open"
            onClick={action(() =>
              invoke('open_path', { path: entry.path }).catch(console.error)
            )}
          />

          <Sep />

          <Item
            label="Copy Path"
            onClick={action(() =>
              invoke('copy_to_clipboard', { text: entry.path }).catch(console.error)
            )}
          />
          <Item
            label="Copy Name"
            onClick={action(() =>
              invoke('copy_to_clipboard', { text: entry.name }).catch(console.error)
            )}
          />

          <Sep />

          <Item
            label="Send to Trash"
            onClick={action(() => onDeleteTrash([entry]))}
          />
          <Item
            label="Delete Permanently"
            onClick={action(() => onDeletePermanent([entry]))}
            danger
          />

          <Sep />

          <Item
            label="Properties"
            onClick={action(() => onProperties(entry))}
          />
        </>
      )}
    </div>
  );
}
