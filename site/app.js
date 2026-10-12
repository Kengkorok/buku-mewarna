/* Buku Mewarna — offline coloring game (tap-to-fill + brush). No dependencies. */
(() => {
  'use strict';

  const VB = 400;                       // all pages use a 400x400 viewBox
  const INK = '#3d3350';
  const SVG_STYLE =
    '<style>' +
    '.r{fill:#ffffff;stroke:' + INK + ';stroke-width:4;stroke-linejoin:round;stroke-linecap:round}' +
    '.d{fill:none;stroke:' + INK + ';stroke-width:4;stroke-linecap:round;stroke-linejoin:round}' +
    '.f{fill:' + INK + ';stroke:none}' +
    '</style>';

  const PALETTE = [
    '#ff4d6d', '#ff7a45', '#ffb703', '#ffe066', '#c1f000', '#8bd3a8',
    '#2ec4b6', '#4cc9f0', '#4361ee', '#7b2cbf', '#c77dff', '#ff8fab',
    '#e63946', '#f77f00', '#06d6a0', '#118ab2', '#3a0ca3', '#7209b7',
    '#a4133c', '#7f5539', '#adb5bd', '#f5f5f5', '#111111', '#ffffff'
  ];

  const CATS = [
    { id: 'all',       name: '⭐ Semua' },
    { id: 'haiwan',    name: '🐱 Haiwan' },
    { id: 'kenderaan', name: '🚗 Kenderaan' },
    { id: 'makanan',   name: '🍦 Makanan' },
    { id: 'alam',      name: '🌈 Alam' },
    { id: 'lain',      name: '🤖 Lain-lain' },
    { id: 'mandala',   name: '🌀 Mandala' },
    { id: 'saved',     name: '🖼️ Hasil Seni' }
  ];

  /* ---------------------------------------------------------- mandala art */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function mandalaSvg(seed) {
    const rnd = mulberry32(seed);
    const cx = 200, cy = 200;
    let s = '';
    const rings = 3 + Math.floor(rnd() * 2);
    for (let ring = 0; ring < rings; ring++) {
      const count = 6 + ring * 6 + Math.floor(rnd() * 3) * 2;
      const dist = 74 + ring * 34;
      const rx = 12 + rnd() * 7, ry = 24 + rnd() * 12;
      const off = ring * (180 / count);
      for (let k = 0; k < count; k++) {
        const a = k * 360 / count + off;
        const rad = a * Math.PI / 180;
        const px = cx + dist * Math.cos(rad), py = cy + dist * Math.sin(rad);
        s += '<ellipse class="r" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" rx="' +
          rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" transform="rotate(' + (a + 90).toFixed(1) +
          ' ' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"/>';
      }
    }
    s += '<circle class="r" cx="' + cx + '" cy="' + cy + '" r="58"/>';
    s += '<circle class="r" cx="' + cx + '" cy="' + cy + '" r="34"/>';
    const dots = 8 + Math.floor(rnd() * 5);
    for (let k = 0; k < dots; k++) {
      const a = k * 360 / dots + 10;
      const rad = a * Math.PI / 180;
      s += '<circle class="f" cx="' + (cx + 46 * Math.cos(rad)).toFixed(1) + '" cy="' +
        (cy + 46 * Math.sin(rad)).toFixed(1) + '" r="3"/>';
    }
    return s;
  }

  /* ---------------------------------------------------------- page data */
  const PAGES = (window.PAGES || []).slice();
  for (let i = 1; i <= 12; i++) {
    PAGES.push({ id: 'mandala' + i, title: 'Mandala ' + i, cat: 'mandala', svg: mandalaSvg(1000 + i * 37) });
  }
  const byId = {};
  PAGES.forEach(p => byId[p.id] = p);

  /* ---------------------------------------------------------- state */
  const S = {
    view: 'gallery', cat: 'all', page: null,
    fills: {}, strokes: [], act: [], ptr: -1,
    tool: 'fill', color: '#ff4d6d', size: 16, sound: true,
    cur: null, drag: false, regionEls: [], tapCount: 0
  };
  const SAVED_KEY = 'bm.saved';
  const savedList = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { return []; } };
  const saveList = l => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(l)); } catch (e) {} };

  /* ---------------------------------------------------------- dom */
  const $ = s => document.querySelector(s);
  const bar = $('#bar'), title = $('#title'), hint = $('#hint'), btnBack = $('#btn-back'),
    gallery = $('#gallery'), catsEl = $('#cats'), grid = $('#grid'),
    stagewrap = $('#stagewrap'), stage = $('#stage'), artHolder = $('#art-holder'),
    brush = $('#brush'), effects = $('#effects'), paletteEl = $('#palette'), tools = $('#tools'),
    sizeEl = $('#size'), customEl = $('#custom'), btnUndo = $('#btn-undo'),
    btnRedo = $('#btn-redo'), btnSound = $('#btn-sound'), toastEl = $('#toast');

  /* ---------------------------------------------------------- sound */
  let AC = null;
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
  function ac() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function pop(step) {
    if (!S.sound) return;
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    const f = 392 * Math.pow(2, SCALE[step % SCALE.length] / 12);
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + 0.32);
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'triangle'; o2.frequency.value = f * 2.01;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.045, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.13);
    o2.connect(g2).connect(a.destination);
    o2.start(t); o2.stop(t + 0.14);
  }
  function chime() {
    if (!S.sound) return;
    [0, 4, 7, 12].forEach((n, i) => setTimeout(() => pop(n + 5), i * 90));
  }

  /* ---------------------------------------------------------- sparkles */
  function sparkle(x, y, color) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i');
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.8;
      const dist = 26 + Math.random() * 44;
      d.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(0) + 'px');
      d.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(0) + 'px');
      d.style.background = color;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.animationDelay = (i * 14) + 'ms';
      effects.appendChild(d);
      setTimeout(() => d.remove(), 800);
    }
    const ring = document.createElement('i');
    ring.className = 'ring';
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    ring.style.borderColor = color;
    effects.appendChild(ring);
    setTimeout(() => ring.remove(), 650);
  }

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.hidden = true; }, ms || 1500);
  }

  /* ---------------------------------------------------------- gallery view */
  function renderCats() {
    catsEl.innerHTML = '';
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip' + (S.cat === c.id ? ' on' : '');
      b.textContent = c.name;
      b.onclick = () => { S.cat = c.id; renderCats(); renderGrid(); };
      catsEl.appendChild(b);
    });
  }

  function thumbSvg(p) {
    return '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">' + SVG_STYLE + p.svg + '</svg>';
  }

  function renderGrid() {
    grid.innerHTML = '';
    if (S.cat === 'saved') {
      const list = savedList();
      if (!list.length) {
        grid.innerHTML = '<div class="empty">Belum ada hasil seni. Warnakan sesuatu, tekan 💾 untuk simpan.</div>';
        return;
      }
      list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        const img = document.createElement('img');
        img.src = item.d; img.alt = 'Hasil seni';
        const b = document.createElement('b');
        b.textContent = new Date(item.t).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const del = document.createElement('button');
        del.className = 'del'; del.textContent = 'Padam';
        del.onclick = e => {
          e.stopPropagation();
          saveList(savedList().filter(x => x.t !== item.t));
          renderGrid(); toast('Dipadam');
        };
        card.onclick = () => downloadDataUrl(item.d, 'mewarna-' + item.t + '.jpg');
        card.appendChild(img); card.appendChild(b); card.appendChild(del);
        grid.appendChild(card);
      });
      return;
    }
    PAGES.filter(p => S.cat === 'all' || p.cat === S.cat).forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      const holder = document.createElement('div');
      holder.innerHTML = thumbSvg(p);
      const b = document.createElement('b');
      b.textContent = p.title;
      card.appendChild(holder.firstChild); card.appendChild(b);
      card.onclick = () => openPage(p);
      grid.appendChild(card);
    });
  }

  function showGallery() {
    S.view = 'gallery';
    title.textContent = 'Buku Mewarna';
    hint.textContent = '';
    btnBack.hidden = true;
    stagewrap.hidden = true;
    gallery.hidden = false;
    renderGrid();
  }

  /* ---------------------------------------------------------- coloring view */
  function openPage(p) {
    S.page = p;
    S.fills = {}; S.strokes = []; S.act = []; S.ptr = -1; S.tapCount = 0;
    artHolder.innerHTML = '<svg id="art" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">' +
      SVG_STYLE + p.svg + '</svg>';
    S.regionEls = Array.prototype.slice.call(artHolder.querySelectorAll('.r'));
    S.regionEls.forEach((el, i) => { el.dataset.i = i; });
    S.view = 'color';
    title.textContent = p.title;
    hint.textContent = 'Tekan untuk warnakan';
    btnBack.hidden = false;
    gallery.hidden = true;
    stagewrap.hidden = false;
    updateBtns();
    requestAnimationFrame(layout);
  }

  function layout() {
    const wrapRect = stagewrap.getBoundingClientRect();
    const toolsRect = tools.getBoundingClientRect();
    const availH = wrapRect.height - toolsRect.height - 22;
    const availW = wrapRect.width - 26;
    const s = Math.max(150, Math.floor(Math.min(availH, availW)));
    stage.style.width = s + 'px';
    stage.style.height = s + 'px';
    sizeBrush();
  }

  function sizeBrush() {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    brush.width = Math.round(r.width * dpr);
    brush.height = Math.round(r.height * dpr);
    redrawBrush();
  }

  function renderStrokes(ctx, w, h, scale) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const st of S.strokes) {
      ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.size;
      const p = st.pts;
      ctx.beginPath();
      if (p.length === 1) {
        ctx.fillStyle = st.color;
        ctx.arc(p[0][0], p[0][1], st.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const xc = (p[i][0] + p[i + 1][0]) / 2, yc = (p[i][1] + p[i + 1][1]) / 2;
        ctx.quadraticCurveTo(p[i][0], p[i][1], xc, yc);
      }
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  function redrawBrush() {
    renderStrokes(brush.getContext('2d'), brush.width, brush.height, brush.width / VB);
  }

  function toVB(e) {
    const r = stage.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * VB, (e.clientY - r.top) / r.height * VB];
  }

  /* ---------------------------------------------------------- fills + undo */
  function setFill(i, color) {
    const el = S.regionEls[i];
    if (!el) return;
    el.style.fill = color;
    S.fills[i] = color;
  }
  function snap() {
    return { fills: Object.assign({}, S.fills), strokes: S.strokes.map(s => ({ color: s.color, size: s.size, erase: s.erase, pts: s.pts.map(p => p.slice()) })) };
  }
  function restore(s) {
    S.fills = Object.assign({}, s.fills);
    S.regionEls.forEach((el, i) => { el.style.fill = S.fills[i] || '#ffffff'; });
    S.strokes = s.strokes.map(x => ({ color: x.color, size: x.size, erase: x.erase, pts: x.pts.map(p => p.slice()) }));
    redrawBrush();
  }
  function pushAct(a) {
    S.act = S.act.slice(0, S.ptr + 1);
    S.act.push(a);
    S.ptr = S.act.length - 1;
    updateBtns();
  }
  function applyAct(a) {
    if (a.t === 'fill') setFill(a.i, a.to);
    else if (a.t === 'snap') restore(a.after);
  }
  function revertAct(a) {
    if (a.t === 'fill') setFill(a.i, a.from);
    else if (a.t === 'snap') restore(a.before);
  }
  function undo() {
    if (S.ptr < 0) return;
    revertAct(S.act[S.ptr]); S.ptr--; updateBtns();
  }
  function redo() {
    if (S.ptr >= S.act.length - 1) return;
    S.ptr++; applyAct(S.act[S.ptr]); updateBtns();
  }
  function updateBtns() {
    btnUndo.disabled = S.ptr < 0;
    btnRedo.disabled = S.ptr >= S.act.length - 1;
  }

  /* ---------------------------------------------------------- stage input */
  function evPoint(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  stage.addEventListener('contextmenu', e => e.preventDefault());

  stage.addEventListener('pointerdown', e => {
    if (S.view !== 'color') return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const pt = evPoint(e);
    if (S.tool === 'fill') {
      const el = e.target.closest ? e.target.closest('.r') : null;
      if (!el || el.dataset.i === undefined) return;
      const i = +el.dataset.i;
      const from = S.fills[i] || '#ffffff';
      if (from === S.color) return;
      setFill(i, S.color);
      pushAct({ t: 'fill', i: i, from: from, to: S.color });
      sparkle(pt[0], pt[1], S.color);
      pop(S.tapCount++);
      return;
    }
    stage.setPointerCapture(e.pointerId);
    S.drag = true;
    S.cur = { color: S.color, size: S.size, erase: S.tool === 'eraser', pts: [toVB(e)] };
    redrawBrush();
    drawLiveSegment(true);
  });

  stage.addEventListener('pointermove', e => {
    if (!S.drag || !S.cur) return;
    S.cur.pts.push(toVB(e));
    drawLiveSegment(false);
  });

  function endStroke() {
    if (!S.drag || !S.cur) return;
    S.drag = false;
    if (S.cur.pts.length) {
      S.strokes.push(S.cur);
      pushAct({ t: 'snap', before: { fills: Object.assign({}, S.fills), strokes: S.strokes.slice(0, -1).map(s => ({ color: s.color, size: s.size, erase: s.erase, pts: s.pts.map(p => p.slice()) })) }, after: snap() });
    }
    S.cur = null;
    redrawBrush();
  }
  stage.addEventListener('pointerup', endStroke);
  stage.addEventListener('pointercancel', endStroke);

  function drawLiveSegment(first) {
    // live feedback: draw only the newest segment, then full redraw on pointerup
    const ctx = brush.getContext('2d');
    const p = S.cur.pts;
    const scale = brush.width / VB;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = S.cur.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = S.cur.color;
    ctx.lineWidth = S.cur.size;
    ctx.beginPath();
    if (p.length === 1) {
      ctx.fillStyle = S.cur.color;
      ctx.arc(p[0][0], p[0][1], S.cur.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const n = p.length;
      const a = p[n - 2], b = p[n - 1];
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------- magic + clear */
  function magic() {
    if (S.view !== 'color') return;
    const before = snap();
    const ids = S.regionEls.map((_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    const step = Math.max(12, Math.min(45, Math.round(900 / Math.max(1, ids.length))));
    ids.forEach((i, k) => {
      setTimeout(() => {
        const c = PALETTE[Math.floor(Math.random() * (PALETTE.length - 2))];
        setFill(i, c);
        if (k % 2 === 0) pop(k);
      }, k * step);
    });
    setTimeout(() => { pushAct({ t: 'snap', before: before, after: snap() }); chime(); }, ids.length * step + 80);
  }

  function clearAll() {
    if (S.view !== 'color') return;
    const before = snap();
    S.fills = {}; S.strokes = []; S.cur = null;
    S.regionEls.forEach(el => { el.style.fill = '#ffffff'; });
    redrawBrush();
    pushAct({ t: 'snap', before: before, after: snap() });
    toast('Dikosongkan');
  }

  /* ---------------------------------------------------------- save */
  function compose(size) {
    return new Promise((resolve, reject) => {
      const svgEl = $('#art');
      if (!svgEl) return reject(new Error('no art'));
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', size);
      clone.setAttribute('height', size);
      const xml = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const layer = document.createElement('canvas');
        layer.width = size; layer.height = size;
        renderStrokes(layer.getContext('2d'), size, size, size / VB);
        ctx.drawImage(layer, 0, 0);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('render failed')); };
      img.src = url;
    });
  }

  function downloadDataUrl(dataUrl, name) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function saveArt() {
    if (S.view !== 'color') return;
    try {
      const full = await compose(1200);
      const dataUrl = full.toDataURL('image/png');
      downloadDataUrl(dataUrl, 'mewarna-' + (S.page ? S.page.id : 'seni') + '.png');
      const thumb = document.createElement('canvas');
      thumb.width = 560; thumb.height = 560;
      const tctx = thumb.getContext('2d');
      tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, 560, 560);
      tctx.drawImage(full, 0, 0, 560, 560);
      const list = savedList();
      list.unshift({ t: Date.now(), d: thumb.toDataURL('image/jpeg', 0.82) });
      while (list.length > 12) list.pop();
      saveList(list);
      chime();
      toast('Disimpan! 💾  (lihat 🖼️ Hasil Seni)', 2200);
    } catch (err) {
      toast('Gagal simpan 😕');
    }
  }

  /* ---------------------------------------------------------- palette + tools */
  function renderPalette() {
    paletteEl.innerHTML = '';
    PALETTE.forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw' + (S.color.toLowerCase() === c.toLowerCase() ? ' on' : '');
      b.style.background = c;
      b.onclick = () => {
        S.color = c;
        if (S.tool === 'eraser') setTool('fill');
        renderPalette();
      };
      paletteEl.appendChild(b);
    });
  }

  function setTool(t) {
    S.tool = t;
    brush.style.pointerEvents = (t === 'fill') ? 'none' : 'auto';
    Array.prototype.forEach.call(document.querySelectorAll('.tbtn[data-tool]'), b => {
      b.classList.toggle('on', b.dataset.tool === t);
    });
    hint.textContent = t === 'fill' ? 'Tekan untuk warnakan' : (t === 'eraser' ? 'Gosok untuk padam' : 'Lukis dengan berus');
  }

  /* ---------------------------------------------------------- wire up */
  document.querySelectorAll('.tbtn[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  btnBack.onclick = showGallery;
  btnUndo.onclick = undo;
  btnRedo.onclick = redo;
  $('#btn-magic').onclick = magic;
  $('#btn-clear').onclick = clearAll;
  $('#btn-save').onclick = saveArt;
  sizeEl.oninput = () => { S.size = +sizeEl.value; };
  customEl.oninput = () => {
    S.color = customEl.value;
    if (S.tool === 'eraser') setTool('fill');
    renderPalette();
  };
  btnSound.onclick = () => {
    S.sound = !S.sound;
    btnSound.textContent = S.sound ? '🔊' : '🔇';
    try { localStorage.setItem('bm.sound', S.sound ? '1' : '0'); } catch (e) {}
    if (S.sound) pop(2);
  };
  window.addEventListener('resize', () => { if (S.view === 'color') layout(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (S.view === 'color') layout(); }, 250));
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
  });

  /* ---------------------------------------------------------- boot */
  try {
    if (localStorage.getItem('bm.sound') === '0') S.sound = false;
  } catch (e) {}
  btnSound.textContent = S.sound ? '🔊' : '🔇';
  renderCats();
  renderGrid();
  renderPalette();
  setTool('fill');
  sizeEl.value = S.size;
  updateBtns();
})();
