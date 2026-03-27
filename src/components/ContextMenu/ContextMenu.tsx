import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileEntry } from '../../types';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry;
  onClose: () => void;
  onDeleteTrash: (entry: FileEntry) => void;
  onDeletePermanent: (entry: FileEntry) => void;
  onProperties: (entry: FileEntry) => void;
}

export function ContextMenu({
  x,
  y,
  entry,
  onClose,
  onDeleteTrash,
  onDeletePermanent,
  onProperties,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll() {
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp position to viewport
  const menuWidth = 200;
  const menuHeight = 200;
  const left = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  function item(label: string, onClick: () => void, danger = false) {
    return (
      <button
        className={`ctx-item${danger ? ' ctx-item-danger' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
          onClose();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item('Open in Explorer', () =>
        invoke('open_in_explorer', { path: entry.path })
      )}
      {item('Copy Path', () =>
        invoke('copy_to_clipboard', { text: entry.path })
      )}
      {item('Copy Name', () =>
        invoke('copy_to_clipboard', { text: entry.name })
      )}
      <div className="ctx-separator" />
      {item('Send to Trash', () => onDeleteTrash(entry))}
      {item('Delete Permanently', () => onDeletePermanent(entry), true)}
      <div className="ctx-separator" />
      {item('Properties', () => onProperties(entry))}
    </div>
  );
}
