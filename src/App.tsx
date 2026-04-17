import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

interface Settings {
  totalMinutes: number;
  warningMinutes: number;
  playSoundAtZero: boolean;
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: Settings = {
  totalMinutes: 75,
  warningMinutes: 5,
  playSoundAtZero: true,
  theme: 'light',
};

const SETTINGS_KEY = 'mahjong-timer-settings';

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? '-' : '';
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function playDingSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Create a pleasant "ding" sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.5);
  } catch {
    // Sound not supported, ignore
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [timeRemaining, setTimeRemaining] = useState(settings.totalMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasExpired, setHasExpired] = useState(false);
  const [warningPlayed, setWarningPlayed] = useState(false);
  
  const intervalRef = useRef<number | null>(null);
  const currentSettingsRef = useRef(settings);
  
  // Keep ref in sync
  useEffect(() => {
    currentSettingsRef.current = settings;
  }, [settings]);

  // Timer tick effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Check for warning sound
          const warningSeconds = currentSettingsRef.current.warningMinutes * 60;
          if (newTime === warningSeconds && !warningPlayed) {
            playDingSound();
            setWarningPlayed(true);
          }
          
          // Check for zero crossing
          if (newTime === 0 && prev > 0) {
            if (currentSettingsRef.current.playSoundAtZero) {
              playDingSound();
            }
            setHasExpired(true);
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, warningPlayed]);

  const handleStartStop = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(settings.totalMinutes * 60);
    setHasExpired(false);
    setWarningPlayed(false);
  }, [settings.totalMinutes]);

  const handleSettingsChange = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Reset timer when settings change
    setTimeRemaining(newSettings.totalMinutes * 60);
    setHasExpired(false);
    setWarningPlayed(false);
    setIsRunning(false);
  }, []);

  const isTimeout = hasExpired || timeRemaining < 0;

  return (
    <div className={`app ${isTimeout ? 'timeout' : ''} ${settings.theme}`}>
      <div className="timer-container">
        <div className="timer-display">
          {formatTime(timeRemaining)}
        </div>
        
        <div className="controls">
          <button 
            className="control-btn primary"
            onClick={handleStartStop}
            aria-label={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? '⏸' : '▶'}
          </button>
          <button 
            className="control-btn"
            onClick={handleReset}
            aria-label="Reset"
          >
            ↺
          </button>
        </div>
      </div>
      
      <button 
        className="settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        aria-label="Settings"
      >
        ⚙
      </button>
      
      {showSettings && (
        <div className="settings-panel">
          <h3>Settings</h3>
          
          <label>
            Total Time (minutes)
            <input
              type="number"
              min="1"
              max="180"
              value={settings.totalMinutes}
              onChange={e => handleSettingsChange({
                ...settings,
                totalMinutes: parseInt(e.target.value) || 1
              })}
            />
          </label>
          
          <label>
            Play Sound at (minutes remaining)
            <input
              type="number"
              min="0"
              max={settings.totalMinutes}
              value={settings.warningMinutes}
              onChange={e => handleSettingsChange({
                ...settings,
                warningMinutes: parseInt(e.target.value) || 0
              })}
            />
          </label>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.playSoundAtZero}
              onChange={e => handleSettingsChange({
                ...settings,
                playSoundAtZero: e.target.checked
              })}
            />
            Play sound at 0
          </label>
          
          <label>
            Theme
            <select
              value={settings.theme}
              onChange={e => handleSettingsChange({
                ...settings,
                theme: e.target.value as 'light' | 'dark'
              })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          
          <button 
            className="close-settings"
            onClick={() => setShowSettings(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
