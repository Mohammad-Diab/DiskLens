import './App.css';
import { Breadcrumb } from './components/Breadcrumb/Breadcrumb';
import { FileTable } from './components/FileTable/FileTable';
import { Toolbar } from './components/Toolbar/Toolbar';

function App() {
  return (
    <div className="app">
      <Toolbar />
      <Breadcrumb />
      <FileTable />
    </div>
  );
}

export default App;
