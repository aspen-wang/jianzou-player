(() => {
  const $ = (id) => document.getElementById(id);
  const sourceButtons = [...document.querySelectorAll('.source')];
  const ui = Object.fromEntries(['status', 'title', 'artist', 'album', 'seek', 'elapsed', 'remaining', 'previous', 'play', 'next', 'message', 'pin', 'turntable-fallback'].map(id => [id, $(id)]));
  let selected = null;
  let manuallySelected = false;
  let currentState = {sources: {}, activeSource: null};
  let stateStamp = 0;
  let focused = null;
  let scrubbing = false;
  let polling = false;
  let commandBusy = false;
  let commandError = '';
  let alwaysOnTop = false;

  const sourceName = (source) => source === 'spotify' ? 'Spotify' : 'Apple Music';
  const time = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = String(value % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
  };
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function render() {
    const sources = currentState.sources || {};
    if (!manuallySelected && currentState.activeSource) selected = currentState.activeSource;
    if (!selected) selected = 'spotify';
    const track = sources[selected] || {};
    const hasTrack = Boolean(track.running && track.title);
    const duration = Math.max(0, Number(track.duration) || 0);
    const position = Math.max(0, Number(track.position) || 0);
    const error = commandError || track.error || '';
    sourceButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.source === selected));
    });
    setText(ui.status, hasTrack ? (track.playing ? '正在播放' : '已暂停') : '等待播放');
    setText(ui.title, hasTrack ? track.title : '还没有播放音乐');
    setText(ui.artist, hasTrack ? (track.artist || '未知艺术家') : `打开 ${sourceName(selected)}，播放一首歌。`);
    ui.album.hidden = !hasTrack || !track.album;
    setText(ui.album, track.album || '');
    // A control stays enabled while a command runs: disabling it would drop
    // keyboard focus, and command() already ignores a second press.
    for (const button of [ui.previous, ui.play, ui.next]) button.disabled = !hasTrack;
    ui.seek.disabled = !hasTrack || duration <= 0;
    ui.play.setAttribute('aria-label', track.playing && hasTrack ? '暂停' : '播放');
    setText(ui.play, track.playing && hasTrack ? '暂停' : '播放');
    ui.pin.setAttribute('aria-pressed', String(alwaysOnTop));
    ui.pin.setAttribute('aria-label', alwaysOnTop ? '取消窗口置顶' : '保持窗口置顶');
    if (!scrubbing) {
      ui.seek.max = String(duration || 1);
      ui.seek.value = String(Math.min(position, duration || 0));
      setText(ui.elapsed, time(position));
      setText(ui.remaining, time(duration));
      ui.seek.setAttribute('aria-valuetext', `${time(position)} / ${time(duration)}`);
    }
    setText(ui.message, error);
    try {
      window.turntable?.update?.({selected, sources, track, error, alwaysOnTop, focus: document.hasFocus() ? focused : null});
    } catch (_) {
      ui['turntable-fallback'].classList.add('visible');
    }
  }

  async function refresh() {
    if (polling || commandBusy || !window.player) return;
    polling = true;
    try {
      currentState = await window.player.getState();
      stateStamp = performance.now();
      render();
    } catch (_) {
      commandError = '无法读取播放状态，请重试。';
      render();
    } finally { polling = false; }
  }
  async function command(action, value) {
    const track = currentState.sources?.[selected];
    if (!selected || !window.player || commandBusy || !track?.running || !track?.title) return;
    if (!['playPause', 'previous', 'next', 'seek'].includes(action)) return;
    if (action === 'seek' && (!Number.isFinite(value) || value < 0 || value > Number(track.duration || 0))) return;
    commandBusy = true;
    commandError = '';
    render();
    try {
      const updated = await window.player.command(selected, action, value);
      if (updated) { currentState = updated; stateStamp = performance.now(); }
    } catch (err) {
      commandError = err?.message || '操作没有完成，请重试。';
    } finally {
      commandBusy = false;
      scrubbing = false;
      render();
      refresh();
    }
  }
  function selectSource(source) {
    if (!['spotify', 'music'].includes(source)) return;
    selected = source;
    manuallySelected = true;
    commandError = '';
    scrubbing = false;
    render();
    refresh();
  }
  async function togglePin() {
    if (!window.player?.setAlwaysOnTop) return;
    try {
      alwaysOnTop = await window.player.setAlwaysOnTop(!alwaysOnTop);
      commandError = '';
    } catch (_) { commandError = '无法更改窗口置顶设置。'; }
    render();
  }
  function action(name, value) {
    if (name === 'source') selectSource(value);
    else if (name === 'pin') togglePin();
    else command(name, value);
  }
  // These controls are worked from the keyboard while the machine is on screen,
  // so each press also moves the matching key and focus is shown on the machine.
  const press = (name) => window.turntable?.press?.(name);
  const focusNames = {pin: 'pin', play: 'playPause', previous: 'previous', next: 'next', seek: 'seek'};
  ui['turntable-fallback'].addEventListener('focusin', (event) => { focused = event.target.dataset?.source || focusNames[event.target.id] || null; render(); });
  ui['turntable-fallback'].addEventListener('focusout', () => { focused = null; render(); });
  window.addEventListener('focus', render);
  window.addEventListener('blur', render);
  sourceButtons.forEach(button => button.addEventListener('click', () => { press(button.dataset.source); selectSource(button.dataset.source); }));
  ui.pin.addEventListener('click', () => { press('pin'); togglePin(); });
  ui.play.addEventListener('click', () => { press('playPause'); command('playPause'); });
  ui.previous.addEventListener('click', () => { press('previous'); command('previous'); });
  ui.next.addEventListener('click', () => { press('next'); command('next'); });
  // Arrow keys move the stylus five seconds at a time; Home returns to the start.
  ui.seek.addEventListener('keydown', (event) => {
    const step = {ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, Home: -Infinity}[event.key];
    if (!step) return;
    event.preventDefault();
    const track = currentState.sources?.[selected] || {};
    const live = (Number(track.position) || 0) + (track.playing ? (performance.now() - stateStamp) / 1000 : 0);
    command('seek', Math.min(Math.max(0, live + step), Number(track.duration) || 0));
  });
  ui.seek.addEventListener('input', () => {
    scrubbing = true;
    setText(ui.elapsed, time(Number(ui.seek.value)));
  });
  ui.seek.addEventListener('change', () => command('seek', Number(ui.seek.value)));
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (event.code === 'Space' && !['BUTTON', 'INPUT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      if (!ui.play.disabled) { press('playPause'); command('playPause'); }
    }
  });
  if (window.turntable?.onAction && window.turntable?.update) {
    try { window.turntable.onAction(action); }
    catch (_) { ui['turntable-fallback'].classList.add('visible'); }
  } else {
    ui['turntable-fallback'].classList.add('visible');
  }
  render();
  if (window.player) {
    refresh();
    setInterval(refresh, 1500);
  } else {
    commandError = '无法连接播放器，请重新打开应用。';
    render();
  }
})();
