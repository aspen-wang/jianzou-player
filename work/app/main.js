const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const execute = promisify(execFile);
const applications = { spotify: 'Spotify', music: 'Music' };
const artCache = new Map();
let windowRef;
let pendingState;

function emptyState() {
  return { running: false, playing: false, title: '', artist: '', album: '', duration: 0, position: 0, artworkUrl: null, volume: null, shuffle: false, repeat: 'off', error: null };
}

async function processRunning(name) {
  try {
    await execute('/usr/bin/pgrep', ['-x', name], { timeout: 1500 });
    return true;
  } catch { return false; }
}

function scriptError(err, name) {
  const message = `${err.stderr || ''} ${err.message || ''}`;
  if (/(-1743|not authorized|not permitted|denied|拒绝|不允许)/i.test(message)) {
    return `无法连接 ${name}。请在“系统设置 → 隐私与安全性 → 自动化”中允许访问，然后重新打开应用。`;
  }
  if (err.killed || err.signal) return `${name} 没有响应，请检查是否有等待确认的权限弹窗。`;
  return `无法读取 ${name}，请确认它正在运行后重试。`;
}

async function musicArtwork() {
  const file = path.join(os.tmpdir(), `now-playing-art-${crypto.randomUUID()}`);
  const script = `on run argv
set outputFile to POSIX file (item 1 of argv)
if application "Music" is not running then return "not-running"
tell application "Music"
  try
    set imageData to raw data of artwork 1 of current track
  on error
    return "no-art"
  end try
end tell
set f to open for access outputFile with write permission
try
  set eof of f to 0
  write imageData to f
  close access f
  return "ok"
on error errText number errNum
  close access f
  error errText number errNum
end try
end run`;
  try {
    const result = await execute('/usr/bin/osascript', ['-e', script, file], { timeout: 2500, maxBuffer: 1024 * 1024 });
    if (result.stdout.trim() !== 'ok') return null;
    const data = await fs.readFile(file);
    if (!data.length || data.length > 12 * 1024 * 1024) return null;
    const type = data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' : null;
    return type ? `data:${type};base64,${data.toString('base64')}` : null;
  } catch { return null; }
  finally { await fs.unlink(file).catch(() => {}); }
}

async function sourceState(source) {
  const name = applications[source];
  const state = emptyState();
  if (!(await processRunning(name))) return state;
  state.running = true;
  // A separate process check above avoids resolving or launching absent apps. The
  // running check inside the script also covers an app quitting during polling.
  const code = `function run() {
    var a = Application(${JSON.stringify(name)});
    if (!a.running()) return JSON.stringify({running:false});
    var state = String(a.playerState());
    var result = {running:true, playing:state === 'playing'};
    try {
      var track = a.currentTrack;
      result.title = String(track.name() || '');
      result.artist = String(track.artist() || '');
      result.album = String(track.album() || '');
      result.duration = Number(track.duration() || 0) ${source === 'spotify' ? '/ 1000' : ''};
      result.position = Number(a.playerPosition() || 0);
      ${source === 'spotify' ? "try { result.artworkUrl = String(track.artworkUrl() || ''); } catch (_) {}" : ''}
    } catch (_) {}
    // The two apps name these differently; Spotify only repeats a whole context.
    try { result.volume = Number(a.soundVolume()); } catch (_) {}
    try { result.shuffle = Boolean(${source === 'spotify' ? 'a.shuffling()' : 'a.shuffleEnabled()'}); } catch (_) {}
    try { result.repeat = ${source === 'spotify' ? "a.repeating() ? 'all' : 'off'" : 'String(a.songRepeat())'}; } catch (_) {}
    return JSON.stringify(result);
  }`;
  try {
    const { stdout } = await execute('/usr/bin/osascript', ['-l', 'JavaScript', '-e', code], { timeout: 5000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(stdout);
    Object.assign(state, result);
    if (source === 'music' && state.title) {
      const key = JSON.stringify([state.title, state.artist, state.album]);
      if (!artCache.has(key)) {
        // Store the promise so overlapping refreshes do not request the artwork twice.
        artCache.set(key, musicArtwork());
        if (artCache.size > 16) artCache.delete(artCache.keys().next().value);
      }
      state.artworkUrl = await artCache.get(key);
    }
    if (source === 'spotify' && state.artworkUrl && !/^https:\/\//i.test(state.artworkUrl)) state.artworkUrl = null;
  } catch (err) {
    state.error = scriptError(err, name === 'Music' ? 'Apple Music' : name);
  }
  return state;
}

async function getState() {
  if (pendingState) return pendingState;
  pendingState = (async () => {
    const [spotify, music] = await Promise.all([sourceState('spotify'), sourceState('music')]);
    const activeSource = spotify.playing ? 'spotify' : music.playing ? 'music' : spotify.title ? 'spotify' : music.title ? 'music' : null;
    return { sources: { spotify, music }, activeSource };
  })();
  try { return await pendingState; } finally { pendingState = null; }
}

async function command(source, action, value) {
  const name = applications[source];
  const commands = {
    playPause: 'a.playpause()', next: 'a.nextTrack()', previous: 'a.previousTrack()',
    shuffle: source === 'spotify' ? 'a.shuffling = !a.shuffling()' : 'a.shuffleEnabled = !a.shuffleEnabled()',
    // Apple Music steps through off, all, one; Spotify can only switch repeat on or off.
    repeat: source === 'spotify' ? 'a.repeating = !a.repeating()' : "var mode = String(a.songRepeat()); a.songRepeat = mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'"
  };
  let statement = commands[action];
  if (action === 'seek' && Number.isFinite(value) && value >= 0 && value <= 86400) statement = `a.playerPosition = ${value}`;
  if (action === 'volume' && Number.isFinite(value) && value >= 0 && value <= 100) statement = `a.soundVolume = ${Math.round(value)}`;
  if (!name || !statement) throw new Error('无效操作');
  if (!(await processRunning(name))) throw new Error(`请先打开 ${name === 'Music' ? 'Apple Music' : name}。`);
  const code = `function run() { var a=Application(${JSON.stringify(name)}); if (!a.running()) return 'not-running'; ${statement}; return 'ok'; }`;
  try {
    const result = await execute('/usr/bin/osascript', ['-l', 'JavaScript', '-e', code], { timeout: 5000, maxBuffer: 1024 * 1024 });
    if (result.stdout.trim() !== 'ok') throw new Error('not-running');
    // The wheel sends many steps in a row; the next poll reports where it landed.
    return action === 'volume' ? null : await getState();
  } catch (err) { throw new Error(scriptError(err, name === 'Music' ? 'Apple Music' : name)); }
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 960, height: 720, minWidth: 760, minHeight: 570,
    title: '间奏', backgroundColor: '#c8c8c8', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  windowRef.loadFile(path.join(__dirname, 'index.html'));
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('player:get-state', getState);
  ipcMain.handle('player:command', (_event, source, action, value) => command(source, action, value));
  ipcMain.handle('player:always-on-top', (_event, enabled) => {
    if (windowRef && !windowRef.isDestroyed()) windowRef.setAlwaysOnTop(Boolean(enabled));
    return windowRef ? windowRef.isAlwaysOnTop() : false;
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
