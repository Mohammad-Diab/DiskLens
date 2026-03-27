import { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './SidePanel.css';

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KB';
  return n + ' B';
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SidePanel() {
  const { sidePanelItem, sidePanelOpen, setSidePanelOpen, setEntries, entries } = useStore();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!sidePanelOpen || !sidePanelItem) return null;

  const item = sidePanelItem;

  function startEditing() {
    setNameValue(item.name);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function commitRename() {
    if (!editingName) return;
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === item.name) return;
    try {
      await invoke('rename_file', { path: item.path, newName: trimmed });
      // Update in store
      const dir = item.path.replace(/[^\\]+$/, '');
      const newPath = dir + trimmed;
      setEntries(
        entries.map((e) =>
          e.id === item.id ? { ...e, name: trimmed, path: newPath } : e
        )
      );
    } catch (err) {
      console.error('Rename failed:', err);
    }
  }

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <span className="side-panel-title">Properties</span>
        <button className="side-panel-close" onClick={() => setSidePanelOpen(false)}>
          <X size={14} />
        </button>
      </div>

      <div className="side-panel-body">
        {/* Name (editable) */}
        <div className="prop-name-row">
          {editingName ? (
            <input
              ref={inputRef}
              className="prop-name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <div className="prop-name" onClick={startEditing} title="Click to rename">
              {item.name}
            </div>
          )}
        </div>

        {/* Attributes */}
        <div className="prop-badges">
          {item.isHidden && <span className="badge">Hidden</span>}
          {item.isReadOnly && <span className="badge">Read-only</span>}
          {item.isSystem && <span className="badge">System</span>}
        </div>

        <div className="prop-section">
          <div className="prop-row">
            <span className="prop-label">Path</span>
            <span className="prop-value prop-path">{item.path}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Type</span>
            <span className="prop-value">{item.kind.charAt(0).toUpperCase() + item.kind.slice(1)}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Size</span>
            <span className="prop-value">
              {formatBytes(item.sizeBytes)}
              <span className="prop-raw"> ({item.sizeBytes.toLocaleString()} bytes)</span>
            </span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Size on Disk</span>
            <span className="prop-value">{formatBytes(item.sizeOnDisk)}</span>
          </div>
          {item.pctDisk > 0 && (
            <div className="prop-row">
              <span className="prop-label">% of Disk</span>
              <span className="prop-value">{item.pctDisk.toFixed(2)}%</span>
            </div>
          )}
          {item.pctParent > 0 && (
            <div className="prop-row">
              <span className="prop-label">% of Parent</span>
              <span className="prop-value">{item.pctParent.toFixed(1)}%</span>
            </div>
          )}
          <div className="prop-row">
            <span className="prop-label">Modified</span>
            <span className="prop-value">{formatDate(item.modified)}</span>
          </div>
          <div className="prop-row">
            <span className="prop-label">Accessed</span>
            <span className="prop-value">{formatDate(item.accessed)}</span>
          </div>

          {item.kind === 'folder' && (
            <>
              <div className="prop-row">
                <span className="prop-label">Files</span>
                <span className="prop-value">{item.childFiles.toLocaleString()}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Folders</span>
                <span className="prop-value">{item.childFolders.toLocaleString()}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Total Items</span>
                <span className="prop-value">{item.totalItems.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        <button
          className="prop-copy-btn"
          onClick={() => invoke('copy_to_clipboard', { text: item.path })}
        >
          Copy Path
        </button>
      </div>
    </div>
  );
}
