import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';

interface Settings {
  totalSeconds: number;
  warningSeconds: number;
  playSoundAtZero: boolean;
  theme: 'light' | 'dark';
  fontSize: number;
  fontFamily: 'system' | 'serif' | 'mono';
}

interface TimerState {
  timeRemaining: number;
  isRunning: boolean;
  lastStartTime: number | null;
  hasExpired: boolean;
  warningPlayed: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  totalSeconds: 75 * 60, // 75:00
  warningSeconds: 5 * 60, // 5:00
  playSoundAtZero: true,
  theme: 'light',
  fontSize: 24,
  fontFamily: 'system',
};

const SETTINGS_KEY = 'mahjong-timer-settings';
const TIMER_STATE_KEY = 'mahjong-timer-state';

// Convert MM:SS string to seconds
function parseMMSS(value: string): number | null {
  const clean = value.replace(/[^0-9:]/g, '');
  const parts = clean.split(':');
  if (parts.length < 1 || parts.length > 2) return null;
  
  let mins = 0;
  let secs = 0;
  
  if (parts.length === 2) {
    mins = parseInt(parts[0]) || 0;
    secs = parseInt(parts[1]) || 0;
  } else {
    // If just one number, treat as seconds if < 60, else minutes
    const num = parseInt(parts[0]) || 0;
    if (num < 60) {
      secs = num;
    } else {
      mins = num;
    }
  }
  
  return mins * 60 + secs;
}

// Convert seconds to MM:SS string
function formatMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format time for display (with + when expired)
function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? '+' : '';
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.totalMinutes !== undefined && parsed.totalSeconds === undefined) {
        parsed.totalSeconds = (parsed.totalMinutes || 75) * 60;
        delete parsed.totalMinutes;
      }
      if (parsed.warningMinutes !== undefined && parsed.warningSeconds === undefined) {
        parsed.warningSeconds = (parsed.warningMinutes || 5) * 60;
        delete parsed.warningMinutes;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
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

function saveTimerState(state: TimerState) {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadTimerState(): TimerState | null {
  try {
    const saved = localStorage.getItem(TIMER_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return null;
}

function clearTimerState() {
  try {
    localStorage.removeItem(TIMER_STATE_KEY);
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

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.5);
  } catch {
    // Sound not supported, ignore
  }
}

// TimeInput component with uncontrolled input for better UX
function TimeInput({ 
  label, 
  defaultValue, 
  onChange, 
  minSeconds = 1 
}: { 
  label: string; 
  defaultValue: number; 
  onChange: (seconds: number) => void;
  minSeconds?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleBlur = () => {
    if (!inputRef.current) return;
    const parsed = parseMMSS(inputRef.current.value);
    if (parsed !== null && parsed >= minSeconds) {
      onChange(parsed);
      inputRef.current.value = formatMMSS(parsed);
    } else {
      // Invalid - reset to current value
      inputRef.current.value = formatMMSS(defaultValue);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };
  
  return (
    <label>
      {label}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="MM:SS"
        defaultValue={formatMMSS(defaultValue)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ fontFamily: 'ui-monospace, monospace' }}
      />
    </label>
  );
}

function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  
  // Load timer state synchronously on init to prevent flash of default state
  const initialTimerState = useMemo(() => {
    const savedState = loadTimerState();
    if (savedState) {
      let restoredTime = savedState.timeRemaining;
      let restoredRunning = savedState.isRunning;
      let restoredExpired = savedState.hasExpired;
      let restoredWarning = savedState.warningPlayed;

      if (savedState.isRunning && savedState.lastStartTime) {
        const elapsedSeconds = Math.floor((Date.now() - savedState.lastStartTime) / 1000);
        restoredTime = savedState.timeRemaining - elapsedSeconds;

        if (savedState.timeRemaining > 0 && restoredTime <= 0) {
          restoredExpired = true;
        }
        if (savedState.timeRemaining > settings.warningSeconds && restoredTime <= settings.warningSeconds && !savedState.warningPlayed) {
          restoredWarning = true;
        }
      }

      return {
        timeRemaining: restoredTime,
        isRunning: restoredRunning,
        hasExpired: restoredExpired,
        warningPlayed: restoredWarning,
      };
    }
    return null;
  }, []);
  
  const [timeRemaining, setTimeRemaining] = useState(initialTimerState?.timeRemaining ?? settings.totalSeconds);
  const [isRunning, setIsRunning] = useState(initialTimerState?.isRunning ?? false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasExpired, setHasExpired] = useState(initialTimerState?.hasExpired ?? false);
  const [warningPlayed, setWarningPlayed] = useState(initialTimerState?.warningPlayed ?? false);
  // Local state for font size to allow immediate visual feedback
  const [localFontSize, setLocalFontSize] = useState(settings.fontSize);

  const intervalRef = useRef<number | null>(null);
  const currentSettingsRef = useRef(settings);
  const soundPlayedRef = useRef({ expired: false, warning: false });

  useEffect(() => {
    currentSettingsRef.current = settings;
  }, [settings]);

  // Play missed sounds on initial load if timer crossed thresholds while away
  useEffect(() => {
    if (initialTimerState) {
      // Play sound if we crossed zero while away
      if (initialTimerState.hasExpired && !soundPlayedRef.current.expired) {
        soundPlayedRef.current.expired = true;
        if (settings.playSoundAtZero) {
          playDingSound();
        }
      }
      // Play sound if we crossed warning threshold while away
      if (initialTimerState.warningPlayed && !soundPlayedRef.current.warning) {
        soundPlayedRef.current.warning = true;
        playDingSound();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save timer state whenever it changes
  useEffect(() => {
    const state: TimerState = {
      timeRemaining,
      isRunning,
      lastStartTime: isRunning ? Date.now() : null,
      hasExpired,
      warningPlayed,
    };
    saveTimerState(state);
  }, [timeRemaining, isRunning, hasExpired, warningPlayed]);

  // Load timer state on mount
  useEffect(() => {
    const savedState = loadTimerState();
    if (savedState) {
      let restoredTime = savedState.timeRemaining;
      let restoredRunning = savedState.isRunning;
      let restoredExpired = savedState.hasExpired;
      let restoredWarning = savedState.warningPlayed;

      if (savedState.isRunning && savedState.lastStartTime) {
        const elapsedSeconds = Math.floor((Date.now() - savedState.lastStartTime) / 1000);
        restoredTime = savedState.timeRemaining - elapsedSeconds;

        if (savedState.timeRemaining > 0 && restoredTime <= 0) {
          restoredExpired = true;
          if (settings.playSoundAtZero && !savedState.hasExpired) {
            playDingSound();
          }
        }

        if (savedState.timeRemaining > settings.warningSeconds && restoredTime <= settings.warningSeconds && !savedState.warningPlayed) {
          playDingSound();
          restoredWarning = true;
        }
      }

      setTimeRemaining(restoredTime);
      setIsRunning(restoredRunning);
      setHasExpired(restoredExpired);
      setWarningPlayed(restoredWarning);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer tick effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTimeRemaining((prev: number) => {
          const newTime = prev - 1;
          const warningSeconds = currentSettingsRef.current.warningSeconds;
          
          if (newTime === warningSeconds) {
            playDingSound();
            setWarningPlayed(true);
          }

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
  }, [isRunning]);

  const handleStartStop = useCallback(() => {
    setIsRunning((prev: boolean) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(settings.totalSeconds);
    setHasExpired(false);
    setWarningPlayed(false);
    clearTimerState();
  }, [settings.totalSeconds]);

  const handleTotalTimeChange = useCallback((seconds: number) => {
    const newSettings = { ...settings, totalSeconds: seconds };
    setSettings(newSettings);
    saveSettings(newSettings);
    setTimeRemaining(seconds);
    setHasExpired(false);
    setWarningPlayed(false);
    setIsRunning(false);
    clearTimerState();
  }, [settings]);

  const handleWarningTimeChange = useCallback((seconds: number) => {
    const newSettings = { ...settings, warningSeconds: seconds };
    setSettings(newSettings);
    saveSettings(newSettings);
    setWarningPlayed(false);
  }, [settings]);

  const handleFontSizeChange = useCallback((size: number) => {
    setLocalFontSize(size);
    const newSettings = { ...settings, fontSize: size };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  const isTimeout = hasExpired || timeRemaining < 0;

  const fontFamilyValue = settings.fontFamily === 'system'
    ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    : settings.fontFamily === 'serif'
      ? 'Georgia, "Times New Roman", serif'
      : '"Courier New", Courier, monospace';

  return (
    <div
      className={`app ${isTimeout ? 'timeout' : ''} ${settings.theme}`}
      style={{
        '--timer-font-size': `${localFontSize}vw`,
        '--timer-font-family': fontFamilyValue,
      } as React.CSSProperties}
    >
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

          <TimeInput
            label="Total Time (MM:SS)"
            defaultValue={settings.totalSeconds}
            onChange={handleTotalTimeChange}
            minSeconds={1}
          />

          <TimeInput
            label="Play Sound at (MM:SS remaining)"
            defaultValue={settings.warningSeconds}
            onChange={handleWarningTimeChange}
            minSeconds={0}
          />

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.playSoundAtZero}
              onChange={e => {
                const newSettings = { ...settings, playSoundAtZero: e.target.checked };
                setSettings(newSettings);
                saveSettings(newSettings);
              }}
            />
            Play sound at 0
          </label>

          <label>
            Timer Font Size
            <input
              type="range"
              min="10"
              max="40"
              value={localFontSize}
              onChange={e => handleFontSizeChange(parseInt(e.target.value))}
            />
            <span className="range-value">{localFontSize}vw</span>
          </label>

          <label>
            Timer Font
            <select
              value={settings.fontFamily}
              onChange={e => {
                const newSettings = { ...settings, fontFamily: e.target.value as Settings['fontFamily'] };
                setSettings(newSettings);
                saveSettings(newSettings);
              }}
            >
              <option value="system">System</option>
              <option value="serif">Serif</option>
              <option value="mono">Monospace</option>
            </select>
          </label>

          <label>
            Theme
            <select
              value={settings.theme}
              onChange={e => {
                const newSettings = { ...settings, theme: e.target.value as 'light' | 'dark' };
                setSettings(newSettings);
                saveSettings(newSettings);
              }}
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
