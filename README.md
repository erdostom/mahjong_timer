# Mahjong Timer

![Mahjong Timer](/public/android-chrome-512x51x.png)

A beautiful, full-screen timer designed for Mahjong games and other events. Features a large, legible display optimized for projectors and large screens.

## Features

- **Large Timer Display** - MM:SS format with customizable font size (10-40vw)
- **Font Customization** - Choose from System, Serif, or Monospace fonts
- **Theme Support** - Light and dark themes
- **Audio Alerts** - Pleasant bell-like ding at warning time and when timer expires
- **Persistent State** - Timer continues even if you accidentally refresh the page
- **Timeout Mode** - Red background and counts up (+MM:SS) when time runs out

## Settings

- **Total Time** - Set the countdown duration (MM:SS format)
- **Warning Time** - Get an audio alert at a specific time remaining
- **Play Sound at 0** - Toggle sound when timer reaches zero
- **Font Size** - Adjust the timer display size
- **Font Family** - System, Serif, or Monospace
- **Theme** - Light or dark mode

## Usage

- **▶ / ⏸** - Start or pause the timer
- **↺** - Reset timer to the configured duration
- **⚙** - Open settings panel

## Deployment

This project is automatically deployed to [timer.tamaserdos.com](https://timer.tamaserdos.com) via GitHub Actions.

## Development

```bash
npm install
npm run dev
```

## License

MIT
