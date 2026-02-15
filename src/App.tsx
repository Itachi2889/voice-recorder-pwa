import { useState } from 'react';
import RecorderView from './components/RecorderView';
import RecordingsList from './components/RecordingsList';
import './App.css';

type View = 'recorder' | 'list';

function App() {
  const [currentView, setCurrentView] = useState<View>('recorder');

  return (
    <div className="app">
      {currentView === 'recorder' ? (
        <RecorderView onNavigateToList={() => setCurrentView('list')} />
      ) : (
        <RecordingsList onNavigateBack={() => setCurrentView('recorder')} />
      )}
    </div>
  );
}

export default App;
