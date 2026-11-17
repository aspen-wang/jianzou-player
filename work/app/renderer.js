(() => {
  const $ = (id) => document.getElementById(id);
  const sourceButtons = [...document.querySelectorAll('.source')];
  const ui = Object.fromEntries(['status', 'title', 'artist', 'album', 'seek', 'elapsed', 'remaining', 'previous', 'play', 'next', 'message', 'pin', 'turntable-fallback'].map(id => [id, $(id)]));
  let selected = null;
  let manuallySelected = false;
  let currentState = {sources: {}, activeSource: null};
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
    for (const button of [ui.previous, ui.play, ui.next]) button.disabled = !hasTrack || commandBusy;
    ui.seek.disabled = !hasTrack || duration <= 0 || commandBusy;
    ui.play.setAttribute('aria-label', track.playing && hasTrack ? '暂停' : '播放');
    setText(ui.play, track.playing && hasTrack ? '暂停' : '播放');
    ui.pin.setAttribute('aria-pressed', String(alwaysOnTop));
    ui.pin.setAttribute('aria-label', alwaysOnTop ? '取消窗口置顶' : '保持窗口置顶');
    if (!scrubbing) {
      ui.seek.max = String(duration || 1);
      ui.seek.value = String(Math.min(position, duration || 0));
      setText(ui.elapsed, time(position));
      setText(ui.remaining, time(duration));
    }
    setText(ui.message, error);
    try {
      window.turntable?.update?.({selected, sources, track, error, alwaysOnTop});
    } catch (_) {
      ui['turntable-fallback'].classList.add('visible');
    }
  }

  async function refresh() {
    if (polling || commandBusy || !window.player) return;
    polling = true;
    try {
      currentState = await window.player.getState();
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
      if (updated) currentState = updated;
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
  sourceButtons.forEach(button => button.addEventListener('click', () => selectSource(button.dataset.source)));
  ui.pin.addEventListener('click', togglePin);
  ui.play.addEventListener('click', () => command('playPause'));
  ui.previous.addEventListener('click', () => command('previous'));
  ui.next.addEventListener('click', () => command('next'));
  ui.seek.addEventListener('input', () => {
    scrubbing = true;
    setText(ui.elapsed, time(Number(ui.seek.value)));
  });
  ui.seek.addEventListener('change', () => command('seek', Number(ui.seek.value)));
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (event.code === 'Space' && !['BUTTON', 'INPUT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      if (!ui.play.disabled) command('playPause');
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
