# LilyAssist ⚗️

**A desktop buddy for people working with Claude.** A little cream flask from the Black Lily Labs logo walks along the bottom of your screen, keeps you motivated to code, reminds you about breaks and water, hands you ready-made prompts, and tells you about Claude's status and important IT and security news.

Windows 10/11 · Electron · English and Polish · MIT license · [Wersja polska](README.md)

![LilyAssist: the Black Lily Labs flask on a desktop](docs/lilyassist.png)

> **Trademarks:** Claude is a trademark of Anthropic, PBC. LilyAssist is an independent open-source project by Black Lily Labs. It is not affiliated with or endorsed by Anthropic.

---

## Features

### 🤖 Working with Claude
- **Click the flask** to open the Claude Desktop app.
- **Quick prompts**: ready-made prompts (explain an error, code review, write tests, simplify code, explain code, plan first, commit message, README) plus **your own prompts**. A click copies the prompt to the clipboard and opens Claude, so you just paste (Ctrl+V).
- **Quick menu** on right-click or **Ctrl+Alt+P**: Open Claude, prompts and usage limits.
- **Claude status**: checks [status.claude.com](https://status.claude.com) every 5 minutes. A new incident is an important alert; when things are back to normal you get "✅ Claude is working normally again".
- **Time with Claude**: tracks how long you work with Claude today (Claude Desktop, Claude Code in a terminal, or claude.ai in front).
- **Commit reminders**: when changes in a git repository you pick have been waiting for over an hour, it reminds you to commit and opens a terminal there.

### 🎯 Motivation
- **Daily goal**: asks "What are we building today?" in the morning and "Did you make it?" in the evening.
- **Day streaks**: water, coding (15+ min with Claude) and daily goal.
- **Today's stats** with an evening summary.
- **Focus mode** (pomodoro, 25 min): the flask sits down with a laptop and headphones and stays quiet.
- About every 20 seconds a joke, an IT fun fact or a news item, and every minute an activity (running is its favourite). After a while of inactivity: "Bored… shall we build something?".

### 💧 Health
- **Water**: reminds you to drink based on a daily goal (default 2000 ml spread over 8 hours of work, so a glass every ~48 min) and tracks what you drank today. [EFSA](https://pmc.ncbi.nlm.nih.gov/articles/PMC4473081/table/Tab1) recommends about 1.6–2.0 L of drinks a day for adults.
- **Breaks**: every 60 minutes of work it suggests a 15-minute break (snack, push-ups, move around). The break is a toggle in the menu: untick it when you're back.
- **Eyes (20-20-20)**: every 20 minutes a short bubble reminds you to look far away for 20 seconds.
- **Reminder sounds**: a soft “plop” for water and “ding-dong” for a break. Silent while music, a video or a call is playing. You can turn them off in the menu or in settings (with a ▶ Listen button).
- During your break the flask takes a nap too: it sits on the ground and snores “ZZz”.
- Only active working time counts; 10+ minutes away from the computer counts as a break.

### 📰 News and alerts
- News from RSS feeds: Sekurak, Niebezpiecznik, Hacker News, The Hacker News, Krebs on Security, Dark Reading, The Record, Help Net Security and CISA. You can add **your own feeds**.
- **Important alerts** (new vulnerabilities, CVEs, zero-days, ransomware, breaches) show up in a red bubble. Click to read.

### 🎭 Fun
The flask does its own thing: skateboards (kickflip!), climbs the screen edge (then slides down, jumps off with a somersault, or parachutes), shadow-boxes, listens to music, runs, watches something on a laptop, lassoes your cursor and hops over it.

### 🤫 Modes
- **Do not disturb**: turns into a little ghost and disappears. It only comes back with an important alert.
- **Screen keep-awake** (off by default – turn it on in the menu or settings): if the mouse hasn't moved for 3 minutes and nothing is playing, it gently tugs your cursor with a lasso so the screen doesn't go dark.
  > ⚠️ This also prevents the automatic Windows screen lock. That's why it's off by default; on a work computer you'd better leave it off.

---

## Installation

### Ready-made installer (easiest)

1. Download `LilyAssist-Setup-0.6.0.exe` from the [latest release on GitHub](https://github.com/blacklilylabs/lilyassist/releases/latest).
2. Run it and follow the installer. You get Start menu and desktop shortcuts.
3. To open Claude with a click on the flask, install the [Claude Desktop](https://claude.ai/download) app.

> Windows SmartScreen may warn that the app is unrecognized, because the installer isn't code-signed. Click **More info → Run anyway**.

To uninstall: **Windows Settings → Apps → LilyAssist → Uninstall**.

### Build the installer yourself

You need [Node.js](https://nodejs.org) (LTS).

1. Download the code (green **Code → Download ZIP** button on GitHub) and unzip it, or clone the repository.
2. Open PowerShell in the project folder and install dependencies:

   ```bash
   npm.cmd install
   ```

3. Build the installer (the first time takes a few minutes):

   ```bash
   npm.cmd run dist
   ```

4. Run `dist\LilyAssist-Setup-0.6.0.exe` and follow the installer.

### Running from source (for developers)

```bash
npm.cmd install
```

```bash
npm.cmd start
```

**Demo mode** (everything happens much more often, handy for testing):

```bash
npm.cmd run demo
```

> We use `npm.cmd` instead of `npm` because default PowerShell settings on Windows often block `npm.ps1` scripts.

---

## Usage

### Mouse
| Action | What it does |
|---|---|
| Left-click the flask | opens Claude Desktop |
| Right-click the flask | quick menu (Claude, prompts, limits) |
| Click / right-click a news bubble | opens the article |
| Click a reminder | "done" (drank / break / commit / goal), ✕ = later |

### Keyboard shortcuts (work in any app)
| Shortcut | What it does |
|---|---|
| **Ctrl+Alt+P** | quick menu at the cursor |
| **Ctrl+Alt+0** | open Claude |
| **Ctrl+Alt+1…9** | run a prompt directly (1–8 built-in, then yours) |

On Polish keyboards Ctrl+Alt acts as AltGr, so no letters with diacritics are used. Ctrl+Alt+Space is usually taken by Claude Desktop.

### Tray menu (next to the clock)
- **STATUS**: Claude status, water today, time with Claude, daily goal, day streaks, today's stats
- **CLAUDE**: Open Claude, Quick prompts, Quick menu, Claude usage limits
- **HEALTH**: Had a glass, Break (toggle), Reminder sounds
- **MODES**: Focus mode, Do not disturb, Keep the screen awake
- **PET**: Say something, Show the intro, Show the pet
- **APP**: Start with Windows, Język / Language, Settings and RSS feeds…, Quit

Windows 11 often hides new tray icons under the **^** arrow next to the clock. Drag the icon onto the taskbar to keep it visible.

### Settings
In **Settings and RSS feeds…** you can set:
- language,
- modes,
- health (water goal, glass size, breaks, eyes, reminder sounds),
- coding (Claude status, focus length, repository folder for commit reminders),
- your own prompts,
- RSS feeds (built-in and your own, optionally marked "important").

Settings are saved right away to `%APPDATA%\LilyAssist\settings.json`. On first launch LilyAssist moves your settings from earlier versions (CodeBuddy, OctoBuddy) here automatically.

---

## Privacy

LilyAssist runs locally, with no account and no telemetry.

- **It only connects to:** the RSS feeds you have enabled, the Hacker News API and [status.claude.com](https://status.claude.com). It sends nothing about you.
- **It reads locally:**
  - the title and program name of the window in front (to count time with Claude),
  - the audio level (so the screen keep-awake doesn't get in the way of videos),
  - the time since your last mouse/keyboard input,
  - `git status` in the folder you choose.
- **None of this is stored, except** the numbers in today's stats in the settings file.

---

## Customizing

| What | Where |
|---|---|
| Bubble texts, jokes, fun facts, built-in prompts (EN and PL) | `src/messages.js` |
| Menu texts | `src/i18n.js` |
| Timings: inactivity, reminders, RSS and status refresh, summary hour | `src/main.js`, `CONFIG` object |
| Built-in RSS feeds and "important" keywords | `src/news.js` (`BUILTIN_FEEDS`, `IMPORTANT`) |
| The flask's look and colors | `src/sprite.js` |
| Size (`SCALE`: 1 = small, 2 = default), speed, rhythm, climbing | `src/renderer/pet.js` (`SCALE`, `SPEED`, `TALK_EVERY`, `FUN_EVERY`, `FUN`, `CLIMB_*`) |

After changes, restart (`npm.cmd start`) or build a new installer (`npm.cmd run dist`).

## Project structure

```
src/
  main.js          – the core: window, tray menu, reminders, alerts, shortcuts
  preload.js       – secure bridge between the flask window and main.js
  messages.js      – all bubble texts (en / pl)
  i18n.js          – menu texts (en / pl)
  sprite.js        – flask drawing (vector) and colors
  news.js          – RSS feeds and important-entry detection
  claudeStatus.js  – Claude status
  git.js           – repository change checks, opening a terminal
  stats.js         – stats and day streaks
  system.js        – Windows functions via the koffi library (foreground window, audio, mouse, keys)
  settings.js      – saving and loading settings
  trayIcon.js      – tray icon
  renderer/        – what you see: the flask, animations, bubbles
  settings/        – settings window
  goal/            – "Daily goal" window
scripts/make-icon.js – builds the app and tray icons from the flask drawing
```

---

## Troubleshooting

- **No `electron.exe` after `npm.cmd install`** ("Electron failed to install correctly"): newer npm versions may skip downloading Electron itself. Run:

  ```bash
  node node_modules\electron\install.js
  ```

- **Clicking doesn't open Claude**: make sure Claude Desktop is installed. It registers the `claude://` link.
- **No icon next to the clock**: look under the **^** arrow.
- **A shortcut doesn't work**: another app may be using it. The console (`npm.cmd start`) will show "Skrót zajęty przez inny program" (shortcut taken).

---

## License

[MIT](LICENSE) © 2026 Black Lily Labs

Claude is a trademark of Anthropic, PBC. LilyAssist is not affiliated with or endorsed by Anthropic.
