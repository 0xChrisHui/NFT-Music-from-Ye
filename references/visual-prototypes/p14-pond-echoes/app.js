(function () {
  const player = window.PondEchoPlayer;
  const spec = window.POND_ECHO;
  const root = document.documentElement;
  const playButton = document.querySelector('#play');
  const status = document.querySelector('#status');
  const position = document.querySelector('#position');
  const segment = document.querySelector('#segment');
  const glyph = document.querySelector('#current-glyph');
  const bar = document.querySelector('#progress-bar');
  const timeline = document.querySelector('#timeline');
  const themeSelect = document.querySelector('#theme-preview');
  const stateSelect = document.querySelector('#state-preview');
  const query = new URLSearchParams(location.search);

  [...spec.recipe].forEach((key, index) => {
    const mark = document.createElement('span');
    mark.dataset.index = String(index);
    mark.textContent = key;
    mark.setAttribute('aria-hidden', 'true');
    timeline.append(mark);
  });

  function setTheme(theme) {
    root.dataset.theme = theme;
    themeSelect.value = theme;
    document.querySelectorAll('[data-theme-button]').forEach((button) => {
      const active = button.dataset.themeButton === theme;
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  const stateCopy = {
    idle: ['开始播放', '等待你的触碰'],
    ready: ['开始播放', '36 段声音已经就绪'],
    loading: ['正在准备', '正在解码永久片段…'],
    playing: ['暂停', '回声正在穿过池面'],
    paused: ['继续播放', '回声停驻在这一刻'],
    ended: ['再次播放', '36 段旅程已经抵岸'],
    error: ['重试', '声音暂不可用，配方仍可读取'],
  };

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  player.subscribe((snapshot) => {
    root.dataset.state = snapshot.state;
    const copy = stateCopy[snapshot.state] || stateCopy.idle;
    playButton.textContent = copy[0];
    playButton.disabled = snapshot.state === 'loading';
    playButton.setAttribute('aria-pressed', snapshot.state === 'playing' ? 'true' : 'false');
    status.textContent = copy[1];
    position.textContent = formatTime(snapshot.positionMs);
    segment.textContent = `${String(snapshot.currentIndex + 1).padStart(2, '0')} / 36`;
    glyph.textContent = snapshot.currentKey;
    bar.style.setProperty('--progress', `${snapshot.positionMs / snapshot.durationMs * 100}%`);
    timeline.querySelectorAll('span').forEach((mark, index) => {
      mark.classList.toggle('past', index < snapshot.currentIndex);
      mark.classList.toggle('current', index === snapshot.currentIndex);
    });
    window.__pondEchoReady = true;
  });

  playButton.addEventListener('click', () => player.action());
  document.querySelectorAll('[data-theme-button]').forEach((button) => {
    button.addEventListener('click', () => setTheme(button.dataset.themeButton));
  });
  themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
  stateSelect.addEventListener('change', () => player.preview(stateSelect.value));
  document.querySelector('#copy').addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(spec.recipe);
      event.currentTarget.textContent = '已复制完整 36 位';
    } catch {
      event.currentTarget.textContent = spec.recipe;
    }
  });

  setTheme(query.get('theme') || 'a');
  if (query.has('state')) {
    stateSelect.value = query.get('state');
    player.preview(query.get('state'));
  }
})();
