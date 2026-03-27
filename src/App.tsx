import './App.css';
import { Breadcrumb } from './components/Breadcrumb/Breadcrumb';
import { DiskBar } from './components/DiskBar/DiskBar';
import { FileTable } from './components/FileTable/FileTable';
import { SidePanel } from './components/SidePanel/SidePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useKeyboard } from './hooks/useKeyboard';
import { useStore } from './store/useStore';

function App() {
  const sidePanelOpen = useStore((s) => s.sidePanelOpen);

  useKeyboard();

  return (
    <div className="app">
      <Toolbar />
      <DiskBar />
      <Breadcrumb />
      <div className="main-content">
        <FileTable />
        {sidePanelOpen && <SidePanel />}
      </div>
    </div>
  );
}

export default App;
