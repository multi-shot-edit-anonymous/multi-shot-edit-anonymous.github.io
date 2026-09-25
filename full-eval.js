/* MoviEdit — Full Eval Results. Standalone: does not depend on main.js or eval.js. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FPS = 24, SRC_FRAMES = 361;
  const BASE = 'asset/eval/';

  /* ---------------------------------------------------------------- nav */
  const nav = $('#nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  const navToggle = $('#navtoggle'), navLinks = $('#navlinks');
  navToggle?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  const DATA = JSON.parse($('#fe-data').textContent);
  const TASKS = { add: 'Add', remove: 'Remove', appearance_change: 'Appearance change', swap: 'Swap', environment_change: 'Environment change', stylization: 'Stylization' };
  const CATS = ['C1', 'C2', 'C3A', 'C3B', 'C4', 'C5', 'C6', 'C7', 'C8'];
  const GROUP = { ours: 'Ours', private: 'Proprietary', open: 'Open-source' };
  const ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const ICON_FRAME = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17" stroke="currentColor" stroke-width="1.6"/></svg>';

  const state = { setting: 'v2v', idx: 0, focus: 'MoviEdit', playing: true, waiting: false };
  const scenarios = () => DATA.scenarios[state.setting];
  const models = () => DATA.models[state.setting];
  const cur = () => scenarios()[state.idx];

  /* ---------------------------------------------------------- scenario list */
  const items = $$('.fe-item');
  const catSel = $('#feCat'), taskSel = $('#feTask'), search = $('#feSearch'), countEl = $('#feCount');
  catSel.innerHTML = '<option value="all">All categories</option>' + CATS.map((c) => `<option value="${c}">${c}</option>`).join('');
  taskSel.innerHTML = '<option value="all">All tasks</option>' + Object.entries(TASKS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  const visibleIdx = () => items.map((li, i) => (li.hidden ? -1 : i)).filter((i) => i >= 0);
  const applyFilter = () => {
    const q = search.value.trim().toLowerCase(), c = catSel.value, t = taskSel.value;
    let n = 0;
    items.forEach((li) => {
      const txt = (li.dataset.id + ' ' + li.textContent).toLowerCase();
      const ok = (c === 'all' || li.dataset.cat === c) && (t === 'all' || li.dataset.task === t) && (!q || txt.includes(q));
      li.hidden = !ok; if (ok) n++;
    });
    countEl.textContent = n === items.length ? '128 scenarios' : n ? `${n} of 128 scenarios` : 'No scenarios match.';
  };
  [catSel, taskSel].forEach((s) => s.addEventListener('change', applyFilter));
  let qT = null;
  search.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(applyFilter, 120); });
  applyFilter();
  items.forEach((li, i) => $('.fe-item__btn', li).addEventListener('click', () => select(i, true)));

  /* ------------------------------------------------------------- media */
  const bigSrc = $('#feBigSrc'), bigFocus = $('#feBigFocus'), grid = $('#feGrid');
  const vid = (src, frames) => `<video muted playsinline preload="auto" data-frames="${frames}" src="${esc(BASE + src)}"></video>`;
  const emptyHtml = (reason) => `<div class="fe-empty">${/safety/i.test(reason) ? ICON_SHIELD : ICON_FRAME}<span>${esc(reason)}</span></div>`;
  const heldBadge = (m) => (m.frames < SRC_FRAMES ? `<span class="fe-badge" data-held="${m.frames}">${Math.round(m.frames / FPS)} s output</span>` : '');

  const renderFocus = () => {
    const r = cur(), m = models().find((x) => x.name === state.focus) || models()[0];
    const out = r.outputs[m.name];
    bigFocus.innerHTML = `<span class="fe-label${m.group === 'ours' ? ' fe-label--edit' : ''}">${esc(m.name)} <small>${GROUP[m.group]}</small></span>` +
      (out ? vid(out, m.frames) + heldBadge(m) : emptyHtml((r.missing || {})[m.name] || 'No output'));
    $$('.fe-tile', grid).forEach((t) => t.classList.toggle('is-focus', t.dataset.model === m.name));
  };

  const render = () => {
    const r = cur();
    const ref = r.reference_frame_indices ? r.reference_frame_indices[0] : null;
    $('#feScnMeta').innerHTML = `<span class="bm-mono">${esc(r.instruction_id)}</span><span>${esc(TASKS[r.task])}</span><span>${esc(r.sample_id.split('_')[0])} · ${r.cuts.length + 1} shots · 15 s</span>` +
      (ref !== null ? `<span>IV2V reference · frame ${ref}</span>` : '');
    $('#feScnInstr').textContent = r.edit_instruction;
    bigSrc.innerHTML = `<span class="fe-label">Source</span>${vid(r.source_video, SRC_FRAMES)}`;

    let tiles = '';
    if (ref !== null) {
      const png = r.edited_frame_paths[String(ref)];
      tiles += `<article class="fe-tile fe-tile--ref"><div class="fe-tile__media"><img class="fe-refimg" src="${esc(BASE + png)}" alt="Edited reference frame ${ref}"><span class="fe-badge">frame ${ref}</span></div>
        <div class="fe-tile__cap"><span class="fe-tile__name">Edited reference</span><a class="fe-tile__dl" href="${esc(BASE + png)}" target="_blank" rel="noopener" title="Open PNG">png</a></div></article>`;
    }
    models().forEach((m) => {
      const out = r.outputs[m.name];
      tiles += `<article class="fe-tile${m.group === 'ours' ? ' is-ours' : ''}" data-model="${esc(m.name)}">
        <button type="button" class="fe-tile__pick" aria-label="Show ${esc(m.name)} large"><div class="fe-tile__media">${out ? vid(out, m.frames) + heldBadge(m) : emptyHtml((r.missing || {})[m.name] || 'No output')}</div></button>
        <div class="fe-tile__cap"><span class="fe-tile__name">${esc(m.name)}</span><span class="fe-tile__grp">${GROUP[m.group]}</span>${out ? `<a class="fe-tile__dl" href="${esc(BASE + out)}" download title="${esc(out)}">mp4</a>` : ''}</div></article>`;
    });
    grid.innerHTML = tiles;
    renderFocus();

    // timeline: shots + reference-frame marker
    const bounds = [0, ...r.cuts, SRC_FRAMES];
    $('#feShots').innerHTML = bounds.slice(0, -1).map((b, i) => `<span data-n="${i + 1}" style="flex:${bounds[i + 1] - b}"></span>`).join('');
    const rm = $('#feRefMark');
    rm.hidden = ref === null;
    if (ref !== null) { rm.style.left = (ref / (SRC_FRAMES - 1)) * 100 + '%'; rm.title = `Reference frame ${ref}`; }

    items.forEach((li, i) => li.classList.toggle('is-active', i === state.idx));
    const act = items[state.idx], box = $('#feScroll');
    if (act && !act.hidden) {
      const top = act.offsetTop - box.offsetTop, h = act.offsetHeight;
      if (top < box.scrollTop || top + h > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 2 + h / 2;
    }
    history.replaceState(null, '', `#${state.setting}/${r.instruction_id}`);
    startScenario();
  };

  /* ------------------------------------------------------------ sync engine
     The source video is the clock. Every other video follows it; outputs that are
     shorter than the source hold their last frame until the source loops. */
  const allVids = () => $$('video', $('#feViewer'));
  const master = () => $('video', bigSrc);
  const endOf = (v) => (+v.dataset.frames || SRC_FRAMES) / FPS;
  const playSafe = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const seekAll = (t) => allVids().forEach((v) => { const e = endOf(v); try { v.currentTime = Math.min(t, e - 0.03); } catch (_) {} });
  let startTimer = null;
  function startScenario() {
    clearTimeout(startTimer);
    state.waiting = true;
    const go = () => { state.waiting = false; seekAll(0); if (state.playing) allVids().forEach(playSafe); };
    const vids = allVids();
    let ready = 0;
    const check = () => { if (++ready >= vids.length) { clearTimeout(startTimer); go(); } };
    vids.forEach((v) => (v.readyState >= 3 ? check() : v.addEventListener('canplay', check, { once: true })));
    startTimer = setTimeout(go, 3000);
  }
  const setPlaying = (p) => {
    state.playing = p;
    $('#fePlay').setAttribute('aria-pressed', String(p));
    $('#fePlay').setAttribute('aria-label', p ? 'Pause' : 'Play');
    if (p) { const m = master(); if (m && m.ended) seekAll(0); allVids().forEach((v) => { if (v.currentTime < endOf(v) - 0.05) playSafe(v); }); }
    else allVids().forEach((v) => v.pause());
  };
  $('#fePlay').addEventListener('click', () => setPlaying(!state.playing));

  const tick = () => {
    const m = master();
    if (m && !state.waiting) {
      const t = m.currentTime;
      if (state.playing && m.ended) { seekAll(0); allVids().forEach(playSafe); }
      let stalled = false;
      allVids().forEach((v) => {
        if (v === m) return;
        const e = endOf(v);
        const badge = v.parentElement.querySelector('[data-held]');
        if (t >= e - 0.04) {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - (e - 0.03)) > 0.1) { try { v.currentTime = e - 0.03; } catch (_) {} }
          badge?.classList.add('is-held');
        } else {
          badge?.classList.remove('is-held');
          // big gaps: jump; small gaps: nudge the playback rate so it catches up without a visible seek
          const diff = v.currentTime - t;
          if (Math.abs(diff) > 0.25 || !state.playing) { if (Math.abs(diff) > 0.02) { try { v.currentTime = t; } catch (_) {} } v.playbackRate = 1; }
          else v.playbackRate = Math.abs(diff) > 0.015 ? Math.min(1.25, Math.max(0.75, 1 - diff * 4)) : 1;
          if (state.playing && v.paused && !m.paused) playSafe(v);
          if (state.playing && v.readyState < 3) stalled = true;
        }
      });
      // hold the clock while any follower is still buffering, so nothing drifts
      if (state.playing) { if (stalled && !m.paused) m.pause(); else if (!stalled && m.paused && !m.ended) playSafe(m); }
      const f = Math.min(SRC_FRAMES - 1, Math.round(t * FPS));
      const pct = (f / (SRC_FRAMES - 1)) * 100;
      $('#feFill').style.width = pct + '%';
      $('#feHead').style.left = pct + '%';
      $('#feClock').textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')} · f ${f}`;
      $('#feTimeline').setAttribute('aria-valuenow', String(f));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // scrubbing
  const tl = $('#feTimeline');
  let scrubbing = false, wasPlaying = false;
  const seekFromX = (x) => { const r = tl.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (x - r.left) / r.width)); seekAll(p * (SRC_FRAMES - 1) / FPS); };
  tl.addEventListener('pointerdown', (e) => {
    if (e.target.id === 'feRefMark') return;
    scrubbing = true; wasPlaying = state.playing; if (wasPlaying) setPlaying(false);
    tl.setPointerCapture(e.pointerId); seekFromX(e.clientX);
  });
  tl.addEventListener('pointermove', (e) => { if (scrubbing) seekFromX(e.clientX); });
  const endScrub = () => { if (!scrubbing) return; scrubbing = false; if (wasPlaying) setPlaying(true); };
  tl.addEventListener('pointerup', endScrub);
  tl.addEventListener('pointercancel', endScrub);
  tl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    const m = master(); if (m) seekAll(Math.max(0, m.currentTime + (e.key === 'ArrowRight' ? 1 : -1)));
  });
  $('#feRefMark').addEventListener('click', (e) => {
    e.stopPropagation();
    const ref = cur().reference_frame_indices; if (!ref) return;
    setPlaying(false); seekAll(ref[0] / FPS);
  });

  /* ------------------------------------------------------------ selection */
  function select(i, userAction) {
    if (i < 0 || i >= scenarios().length) return;
    state.idx = i;
    if (userAction && !state.playing) setPlaying(true);
    render();
  }
  const step = (d) => {
    const vis = visibleIdx(); if (!vis.length) return;
    const k = vis.indexOf(state.idx);
    const next = k < 0 ? vis[0] : vis[(k + d + vis.length) % vis.length];
    select(next, false);
  };
  $('#fePrev').addEventListener('click', () => step(-1));
  $('#feNext').addEventListener('click', () => step(1));
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.fe-tile__pick'); if (!b) return;
    state.focus = b.closest('.fe-tile').dataset.model; renderFocus();
    const m = master(); const v = $('video', bigFocus);
    if (m && v) { const e2 = endOf(v); v.currentTime = Math.min(m.currentTime, e2 - 0.03); if (state.playing && m.currentTime < e2) playSafe(v); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea,[role="slider"]')) return;
    if (e.key === ' ') { e.preventDefault(); setPlaying(!state.playing); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  /* -------------------------------------------------------------- setting */
  const setSetting = (s, keepIdx) => {
    const id = cur() && cur().instruction_id;
    state.setting = s;
    $$('[data-fesetting]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fesetting === s)));
    $$('[data-fe-show]').forEach((el) => { el.hidden = el.dataset.feShow !== s; });
    $('#feStatModels').textContent = models().length;
    const nOut = scenarios().reduce((a, r) => a + Object.values(r.outputs).filter(Boolean).length, 0);
    $('#feStatOutputs').textContent = nOut.toLocaleString('en-US');
    if (!models().some((m) => m.name === state.focus)) state.focus = 'MoviEdit';
    if (keepIdx && id) state.idx = Math.max(0, scenarios().findIndex((r) => r.instruction_id === id));
    render();
  };
  $$('[data-fesetting]').forEach((b) => b.addEventListener('click', () => setSetting(b.dataset.fesetting, true)));

  /* ------------------------------------------------ data card: first row */
  const K = (k) => `<span class="j-k">"${esc(k)}"</span>`, S = (v) => (v === null ? '<span class="j-n">null</span>' : `<span class="j-s">"${esc(v)}"</span>`);
  const rowHtml = (r, iv) => {
    let s = `{${K('instruction_id')}: ${S(r.instruction_id)}, ${K('sample_id')}: ${S(r.sample_id)}, ${K('task')}: ${S(r.task)},\n ${K('edit_instruction')}: ${S(r.edit_instruction)},\n ${K('source_video')}: ${S(r.source_video)},\n`;
    if (iv) {
      const f = String(r.reference_frame_indices[0]);
      s += ` ${K('reference_frame_indices')}: [<span class="j-n">${f}</span>], ${K('edited_frame_paths')}: {${S(f)}: ${S(r.edited_frame_paths[f])}},\n`;
    }
    s += ` <span class="j-new">${K('outputs')}</span>: {\n` + Object.entries(r.outputs).map(([k, v]) => `   ${K(k)}: ${S(v)}`).join(',\n') + '\n }';
    return s + '}';
  };
  $('#feRowV2v').innerHTML = rowHtml(DATA.scenarios.v2v[0], false);
  $('#feRowIv2v').innerHTML = rowHtml(DATA.scenarios.iv2v[0], true);

  /* ---------------------------------------------------------------- init */
  const m = location.hash.match(/^#(v2v|iv2v)\/(.+)$/);
  if (m) {
    state.setting = m[1];
    const i = DATA.scenarios[m[1]].findIndex((r) => r.instruction_id === decodeURIComponent(m[2]));
    if (i >= 0) state.idx = i;
  }
  setSetting(state.setting, false);
  setPlaying(true);
})();
