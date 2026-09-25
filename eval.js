/* MoviEdit — Benchmark / Full Eval pages. Standalone: does not depend on main.js. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

  /* ------------------------------------------------------------- reveal */
  const revealables = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) revealables.forEach((el) => el.classList.add('in'));
  else {
    const ro = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => ro.observe(el));
  }

  /* shared tooltip helper: one floating box per container */
  const makeTip = (host) => {
    const tip = document.createElement('div');
    tip.className = 'bm-tip'; tip.setAttribute('role', 'status');
    host.appendChild(tip);
    return {
      show(html, x, y) {
        tip.innerHTML = html; tip.classList.add('on');
        const hw = host.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = x + 14, top = y - th - 10;
        if (left + tw > hw) left = x - tw - 14;
        if (left < 0) left = Math.max(0, Math.min(hw - tw, x - tw / 2));
        if (top < 0) top = y + 16;
        tip.style.left = left + 'px'; tip.style.top = top + 'px';
      },
      hide() { tip.classList.remove('on'); },
    };
  };

  /* ================================================================ BENCH */
  const dataEl = $('#bench-data');
  const BENCH = dataEl ? JSON.parse(dataEl.textContent) : null;
  const GLOBAL_TASKS = new Set(['environment_change', 'stylization']);
  const CAT_META = {
    C1: { focus: 'Cross-shot localization under pose and viewpoint changes.' },
    C2: { focus: 'Target selection across shots, and leaving shots alone when the target is absent.' },
    C3A: { focus: 'Telling apart two competing people of the same gender.' },
    C3B: { focus: 'Binding the edit to one of two people who appear together.' },
    C4: { focus: 'Localization with three possible candidates.' },
    C5: { focus: 'Finding the target in a crowded scene.' },
    C6: { focus: 'Grounding across species and keeping identity.' },
    C7: { other: 'Medium', focus: 'Stylized 3D, stop-motion, watercolor, claymation, anime and paper-cut.' },
    C8: { other: 'Global', focus: 'Stylization, lighting, weather and time of day, with no subject to find.' },
  };

  if (BENCH) {
    const videos = BENCH.videos;
    const byId = Object.fromEntries(videos.map((v) => [v.id, v]));
    const catOrder = Object.keys(BENCH.categories);
    const taskOrder = Object.keys(BENCH.tasks);
    const stripBg = (v) => `--n:${v.shots};background-image:url(${v.strip})`;
    const posFor = (i, n) => (n > 1 ? (i / (n - 1)) * 100 : 0) + '% 0';

    /* ---- hero wall of shot strips (4 rows, each duplicated for a seamless loop) */
    const wall = $('#bmWall');
    if (wall) {
      const rows = [[], [], [], []];
      videos.forEach((v, i) => rows[i % 4].push(v));
      wall.innerHTML = rows.map((row, k) => {
        const items = row.map((v) => `<span class="bm-wall__item" style="${stripBg(v)}"></span>`).join('');
        return `<div class="bm-wall__row${k % 2 ? ' bm-wall__row--rev' : ''}" style="--dur:${150 + k * 22}s">${items}${items}</div>`;
      }).join('');
    }

    /* ---- category cards */
    const catsEl = $('#bmCats');
    if (catsEl) {
      catsEl.innerHTML = catOrder.map((c) => {
        const vs = videos.filter((v) => v.category === c);
        const rep = vs[0], m = CAT_META[c] || {};
        return `<article class="bm-cat${m.other ? ' bm-cat--other' : ''}" data-cat="${c}">
          <video class="bm-cat__video" muted loop playsinline preload="none" src="${esc(rep.video)}" style="${stripBg(rep)}" aria-label="Example: ${esc(rep.id)}"></video>
          <div class="bm-cat__body">
            <p class="bm-cat__top"><span class="bm-cat__code">${c}${m.other ? ' · ' + m.other : ''}</span><span class="bm-cat__count">${vs.length} videos · ${vs.length * 2} edits</span></p>
            <h3 class="bm-cat__name">${esc(BENCH.categories[c])}</h3>
            <p class="bm-cat__focus">${esc(m.focus || '')}</p>
          </div></article>`;
      }).join('');
      // play each example only while it is on screen
      const catVids = $$('.bm-cat__video', catsEl);
      if (!reduce && 'IntersectionObserver' in window) {
        const vo = new IntersectionObserver((entries) => entries.forEach((en) => {
          const v = en.target;
          if (en.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
          else v.pause();
        }), { threshold: 0.25 });
        catVids.forEach((v) => vo.observe(v));
      }
    }

    /* ---- unit chart: one square per scenario, grouped by task */
    const unitsEl = $('#bmUnits'), unitsFig = unitsEl?.closest('.bm-units');
    if (unitsEl) {
      const scen = [];
      taskOrder.forEach((t) => videos.forEach((v) => v.prompts.forEach((p) => { if (p.task === t) scen.push({ v, p }); })));
      const color = (t) => (GLOBAL_TASKS.has(t) ? 'var(--e-teal)' : 'var(--e-amber)');
      unitsEl.innerHTML = scen.map((s, i) => `<button type="button" class="bm-unit" data-i="${i}" data-task="${s.p.task}" style="--sw:${color(s.p.task)}" aria-label="${esc(BENCH.tasks[s.p.task])}: ${esc(s.p.edit_instruction)}"></button>`).join('');
      const nLocal = scen.filter((s) => !GLOBAL_TASKS.has(s.p.task)).length;
      unitsEl.insertAdjacentHTML('afterend', `<div class="bm-units__groups"><span>Local · ${nLocal} (${Math.round(nLocal / scen.length * 100)}%)</span><span>Global · ${scen.length - nLocal} (${Math.round((scen.length - nLocal) / scen.length * 100)}%)</span></div>`);
      const legend = $('#bmUnitsLegend');
      legend.innerHTML = taskOrder.map((t) => {
        const n = scen.filter((s) => s.p.task === t).length;
        return `<button type="button" class="bm-ulg" data-task="${t}" aria-pressed="false" style="--sw:${color(t)}"><i></i>${esc(BENCH.tasks[t])} <b>${n}</b></button>`;
      }).join('');
      const read = $('#bmUnitsRead');
      let pinned = null;
      const hl = (task) => {
        unitsFig.classList.toggle('is-dim', !!task);
        $$('.bm-unit', unitsEl).forEach((u) => u.classList.toggle('is-hl', u.dataset.task === task));
        $$('.bm-ulg', legend).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.task === pinned)));
      };
      $$('.bm-ulg', legend).forEach((b) => {
        b.addEventListener('pointerenter', () => hl(b.dataset.task));
        b.addEventListener('pointerleave', () => hl(pinned));
        b.addEventListener('click', () => { pinned = pinned === b.dataset.task ? null : b.dataset.task; hl(pinned); });
      });
      const showScen = (u) => {
        const s = scen[+u.dataset.i];
        read.innerHTML = `<b>${esc(BENCH.tasks[s.p.task])}</b> · <span class="bm-mono">${esc(s.v.id)}</span><br>${esc(s.p.edit_instruction)}`;
      };
      unitsEl.addEventListener('pointerover', (e) => { const u = e.target.closest('.bm-unit'); if (u) showScen(u); });
      unitsEl.addEventListener('focusin', (e) => { const u = e.target.closest('.bm-unit'); if (u) showScen(u); });
      unitsEl.addEventListener('click', (e) => { const u = e.target.closest('.bm-unit'); if (u) openPlayer(scen[+u.dataset.i].v.id); });
    }

    /* ---- browse: filters, search, view toggle, show-more */
    const grid = $('#bmGrid'), tableWrap = $('#bmTable');
    const cards = $$('.bm-card', grid), trows = $$('tbody tr', tableWrap);
    const PREVIEW = 12;
    const state = { cat: 'all', task: 'all', q: '', view: 'grid', expanded: false };
    const catChips = $('#bmCatChips'), taskChips = $('#bmTaskChips');
    catChips.innerHTML = `<button type="button" class="bm-chip" data-cat="all" aria-pressed="true">All categories</button>` +
      catOrder.map((c) => `<button type="button" class="bm-chip" data-cat="${c}" aria-pressed="false" title="${esc(BENCH.categories[c])}">${c}<small>${videos.filter((v) => v.category === c).length}</small></button>`).join('');
    taskChips.innerHTML = `<button type="button" class="bm-chip" data-task="all" aria-pressed="true">All tasks</button>` +
      taskOrder.map((t) => `<button type="button" class="bm-chip" data-task="${t}" aria-pressed="false">${esc(BENCH.tasks[t])}</button>`).join('');

    // remember original prompt text for search highlighting; tag global tasks
    const promptEls = $$('.bm-prompt', grid);
    promptEls.forEach((el) => { el.dataset.raw = el.textContent; });
    $$('.bm-task', grid).forEach((el) => { if (GLOBAL_TASKS.has(el.parentElement.dataset.task)) el.dataset.scope = 'global'; });

    const moreWrap = $('#bmMore').parentElement, moreBtn = $('#bmMore'), countEl = $('#bmCount');
    const hi = (raw, q) => {
      if (!q) return esc(raw);
      const i = raw.toLowerCase().indexOf(q);
      return i < 0 ? esc(raw) : esc(raw.slice(0, i)) + '<mark>' + esc(raw.slice(i, i + q.length)) + '</mark>' + esc(raw.slice(i + q.length));
    };
    const apply = () => {
      const q = state.q.trim().toLowerCase();
      const filtered = state.cat !== 'all' || state.task !== 'all' || q;
      let nVid = 0, nScen = 0;
      cards.forEach((card) => {
        const v = byId[card.dataset.id];
        const okCat = state.cat === 'all' || v.category === state.cat;
        const ps = v.prompts.filter((p) => (state.task === 'all' || p.task === state.task) &&
          (!q || p.edit_instruction.toLowerCase().includes(q) || p.instruction_id.toLowerCase().includes(q)));
        const show = okCat && ps.length > 0;
        const inPreview = filtered || state.expanded || nVid < PREVIEW;
        card.hidden = !(show && inPreview);
        if (show) { nVid++; nScen += ps.length; }
      });
      promptEls.forEach((el) => { el.innerHTML = hi(el.dataset.raw, q); });
      trows.forEach((tr) => {
        const v = byId[tr.dataset.id], p = v.prompts.find((pp) => pp.instruction_id === tr.cells[0].textContent);
        tr.hidden = !((state.cat === 'all' || tr.dataset.cat === state.cat) && (state.task === 'all' || tr.dataset.task === state.task) &&
          (!q || p.edit_instruction.toLowerCase().includes(q) || p.instruction_id.toLowerCase().includes(q)));
      });
      const shownCards = cards.filter((c) => !c.hidden).length;
      moreWrap.hidden = state.view !== 'grid' || filtered || state.expanded;
      countEl.textContent = nScen === 0 ? 'No scenarios match these filters. Try another category or task.'
        : state.view === 'grid'
        ? `Showing ${shownCards} of ${nVid} videos · ${nScen} instructions${filtered ? '' : state.expanded ? '' : ' · all 64 are in the page source and the table view'}`
        : `${trows.filter((r) => !r.hidden).length} of 128 edit scenarios`;
      $$('.bm-chip', catChips).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      $$('.bm-chip', taskChips).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.task === state.task)));
    };
    const setFilter = (patch) => { Object.assign(state, patch); apply(); };
    catChips.addEventListener('click', (e) => { const b = e.target.closest('.bm-chip'); if (b) setFilter({ cat: b.dataset.cat }); });
    taskChips.addEventListener('click', (e) => { const b = e.target.closest('.bm-chip'); if (b) setFilter({ task: b.dataset.task }); });
    let qT = null;
    $('#bmSearch').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => setFilter({ q: e.target.value }), 120); });
    $$('.bm-view .toggle__btn').forEach((b) => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      $$('.bm-view .toggle__btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      grid.hidden = state.view !== 'grid'; tableWrap.hidden = state.view !== 'table';
      apply();
    }));
    moreBtn.addEventListener('click', () => setFilter({ expanded: true }));
    // V2V / IV2V setting: IV2V reveals edited reference frames (cards, table, player)
    const setBMode = (m) => {
      document.documentElement.classList.toggle('bm-iv2v', m === 'iv2v');
      $$('[data-bmode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.bmode === m)));
      $$('[data-bmode-show]').forEach((x) => { x.hidden = x.dataset.bmodeShow !== m; });
    };
    $$('[data-bmode]').forEach((b) => b.addEventListener('click', () => setBMode(b.dataset.bmode)));
    setBMode('v2v');
    apply();

    // card hover: scrub across shots by pointer x
    grid.addEventListener('pointermove', (e) => {
      const m = e.target.closest('.bm-card__media'); if (!m) return;
      const strip = $('.bm-strip', m), n = +strip.style.getPropertyValue('--n');
      const r = m.getBoundingClientRect();
      const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
      strip.style.backgroundPosition = posFor(i, n);
      $$('.bm-card__ticks i', m).forEach((t, k) => t.classList.toggle('on', k === i));
    });
    grid.addEventListener('pointerout', (e) => {
      const m = e.target.closest('.bm-card__media'); if (!m || m.contains(e.relatedTarget)) return;
      $('.bm-strip', m).style.backgroundPosition = '0 0';
      $$('.bm-card__ticks i', m).forEach((t) => t.classList.remove('on'));
    });
    grid.addEventListener('click', (e) => { const m = e.target.closest('[data-open]'); if (m) openPlayer(m.dataset.open); });

    /* ---- player dialog */
    const dlg = $('#bmPlayer'), pv = $('#bmPlayerVideo');
    let curV = null;
    function openPlayer(id) {
      const v = byId[id]; if (!v || !dlg) return;
      curV = v;
      $('#bmPlayerTitle').innerHTML = `<b>${esc(v.id)}</b>${esc(BENCH.categories[v.category])} · ${v.shots} shots · 15 s · <a href="${esc(v.video)}" download style="text-decoration:underline;text-underline-offset:3px">download mp4</a>`;
      const starts = [0, ...v.cuts];
      $('#bmPlayerShots').innerHTML = starts.map((f, k) => `<div class="bm-shotbtn" aria-hidden="true"><span style="${stripBg(v)};background-position:${posFor(k, v.shots)}"></span><em>Shot ${k + 1}</em></div>`).join('');
      $('#bmPlayerPrompts').innerHTML = v.prompts.map((p) => {
        const f = p.reference_frame_indices[0];
        return `<li data-instruction-id="${esc(p.instruction_id)}"><span class="bm-task"${GLOBAL_TASKS.has(p.task) ? ' data-scope="global"' : ''}>${esc(BENCH.tasks[p.task])}</span><span class="bm-prompt">${esc(p.edit_instruction)}</span>
          <span class="bm-ref"><span class="bm-ref__lbl">IV2V ref · frame ${f}</span><span class="bm-ref__pair">
          <button type="button" class="bm-ref__seek" data-t="${(f / 24).toFixed(3)}" title="Jump to frame ${f}"><img src="${esc(p.ref_thumbs.orig)}" alt="Source frame ${f}"></button>
          <i aria-hidden="true">&rarr;</i><a href="${esc(p.edited_frame_paths[String(f)])}" target="_blank" rel="noopener" title="Open edited reference frame (PNG)"><img class="is-edit" src="${esc(p.ref_thumbs.edit)}" alt="Edited reference frame ${f}"></a></span></span></li>`;
      }).join('');
      pv.src = v.video; pv.muted = true;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      const p = pv.play(); if (p && p.catch) p.catch(() => {});
    }
    const closePlayer = () => { pv.pause(); pv.removeAttribute('src'); pv.load(); curV = null; if (dlg.open) dlg.close(); };
    $('#bmPlayerClose')?.addEventListener('click', closePlayer);
    dlg?.addEventListener('click', (e) => { if (e.target === dlg) closePlayer(); });
    dlg?.addEventListener('close', () => { if (curV) closePlayer(); });
    $('#bmPlayerPrompts')?.addEventListener('click', (e) => { const b = e.target.closest('.bm-ref__seek'); if (b) { pv.pause(); pv.currentTime = +b.dataset.t; } });
    pv?.addEventListener('timeupdate', () => {
      if (!curV) return;
      const f = pv.currentTime * 24; let k = 0;
      curV.cuts.forEach((c, i) => { if (f >= c) k = i + 1; });
      $$('.bm-shotbtn').forEach((b, i) => b.classList.toggle('is-on', i === k));
    });
  }

  /* ============================================================== RESULTS */
  // Paper Tab. 1 (V2V) and Tab. 2 (IV2V). Lower-is-better columns are marked dir:-1.
  const COLS_V2V = [
    { dim: 'Non-subject Preservation', m: 'LPIPS', dir: -1 },
    { dim: 'Edit Localization', m: 'Precision', dir: 1 }, { dim: 'Edit Localization', m: 'Recall', dir: 1 },
    { dim: 'Subject Preservation', m: 'MFS', dir: 1 }, { dim: 'Subject Preservation', m: 'LPIPS', dir: -1 }, { dim: 'Subject Preservation', m: 'VLM', dir: 1 },
    { dim: 'X-shot Edit Consistency', m: 'VLM', dir: 1 },
    { dim: 'Edit Prompt Alignment', m: 'CLIP', dir: 1 }, { dim: 'Edit Prompt Alignment', m: 'ViCLIP', dir: 1 }, { dim: 'Edit Prompt Alignment', m: 'VLM', dir: 1 },
    { dim: 'Video Quality', m: 'DINO', dir: 1 }, { dim: 'Video Quality', m: 'NIQE', dir: -1 }, { dim: 'Video Quality', m: 'PickS.', dir: 1 }, { dim: 'Video Quality', m: 'VLM', dir: 1 },
    { dim: 'Overall Edit Success', m: 'VLM', dir: 1, key: true },
  ];
  const COLS_IV2V = [...COLS_V2V.slice(0, 10), { dim: 'Edited-frame Fidelity', m: 'VLM', dir: 1 }, ...COLS_V2V.slice(10)];

  const MODEL_GROUP = {
    'SDEdit (HoloCine)': 'open', 'Memory-V2V': 'open', 'Lucy Edit': 'open', 'SANA-Streaming': 'open', 'Wan-Edit': 'open',
    'GenProp': 'open', 'Gemini Omni Flash': 'private', 'HappyHorse-1.0': 'private', 'Aleph 2.0': 'private', 'MoviEdit': 'ours',
  };
  const GROUP_LABEL = { open: 'Open-source', private: 'Proprietary', ours: 'Ours' };

  const RESULTS = {
    v2v: {
      cols: COLS_V2V,
      groups: [
        { label: 'Open-source', rows: [
          ['SDEdit (HoloCine)', [0.311, 0.321, 0.409, 0.535, 0.364, 0.315, 0.894, 0.222, 0.184, 0.491, 0.988, 5.56, 19.4, 0.711, 0.193]],
          ['Memory-V2V', [0.179, 0.525, 0.252, 0.630, 0.199, 0.625, 0.452, 0.215, 0.174, 0.437, 0.985, 4.82, 19.2, 0.289, 0.215]],
          ['Lucy Edit', [0.174, 0.729, 0.192, 0.647, 0.185, 0.751, 0.750, 0.213, 0.171, 0.351, 0.984, 5.82, 19.2, 0.508, 0.235]],
          ['SANA-Streaming', [0.141, 0.651, 0.430, 0.651, 0.212, 0.707, 0.490, 0.219, 0.181, 0.592, 0.984, 5.48, 19.3, 0.504, 0.354]],
          ['Wan-Edit', [0.0816, 0.840, 0.355, 0.686, 0.103, 0.809, 0.692, 0.217, 0.178, 0.515, 0.983, 5.38, 19.3, 0.568, 0.378]],
        ] },
        { label: 'Proprietary', rows: [
          ['Gemini Omni Flash', [0.153, 0.705, 0.834, 0.568, 0.193, 0.684, 0.893, 0.221, 0.194, 0.834, 0.987, 4.95, 19.8, 0.814, 0.586]],
          ['HappyHorse-1.0', [0.246, 0.729, 0.788, 0.400, 0.291, 0.728, 0.894, 0.219, 0.193, 0.815, 0.984, 5.12, 19.6, 0.691, 0.623]],
          ['Aleph 2.0', [0.0916, 0.886, 0.778, 0.671, 0.146, 0.883, 0.981, 0.225, 0.186, 0.846, 0.988, 4.95, 19.6, 0.801, 0.764]],
        ] },
        { label: 'Ours', rows: [
          ['MoviEdit', [0.0741, 0.904, 0.861, 0.695, 0.121, 0.911, 0.904, 0.227, 0.190, 0.884, 0.989, 4.85, 19.7, 0.762, 0.790]],
        ] },
      ],
      rankScope: 'all',
      radar: {
        metrics: ['ov', 'loc', 'pa', 'xs', 'sp', 'nsp', 'vq'],
        models: {
          'SDEdit (HoloCine)': { nsp: 0.311, sp: 0.315, xs: 0.894, pa: 0.491, loc: 0.517, ov: 0.193, vq: 0.711 },
          'Memory-V2V': { nsp: 0.179, sp: 0.625, xs: 0.452, pa: 0.437, loc: 0.374, ov: 0.215, vq: 0.289 },
          'Lucy Edit': { nsp: 0.174, sp: 0.751, xs: 0.75, pa: 0.351, loc: 0.317, ov: 0.235, vq: 0.508 },
          'SANA-Streaming': { nsp: 0.141, sp: 0.707, xs: 0.49, pa: 0.592, loc: 0.399, ov: 0.354, vq: 0.504 },
          'Wan-Edit': { nsp: 0.0816, sp: 0.809, xs: 0.692, pa: 0.515, loc: 0.516, ov: 0.378, vq: 0.568 },
          'Gemini Omni Flash': { nsp: 0.153, sp: 0.684, xs: 0.893, pa: 0.834, loc: 0.839, ov: 0.586, vq: 0.814 },
          'HappyHorse-1.0': { nsp: 0.246, sp: 0.728, xs: 0.894, pa: 0.815, loc: 0.858, ov: 0.623, vq: 0.691 },
          'Aleph 2.0': { nsp: 0.0916, sp: 0.883, xs: 0.981, pa: 0.846, loc: 0.79, ov: 0.764, vq: 0.801 },
          'MoviEdit': { nsp: 0.0741, sp: 0.911, xs: 0.904, pa: 0.884, loc: 0.854, ov: 0.79, vq: 0.762 },
        },
        foot: 'Non-subject preservation is plotted as 1 − LPIPS so that outward is always better. Open-source models are dashed.',
      },
    },
    iv2v: {
      cols: COLS_IV2V,
      groups: [
        { label: 'First-frame reference', rows: [
          ['HappyHorse-1.0', [0.244, 0.751, 0.828, 0.417, 0.304, 0.767, 0.925, 0.220, 0.195, 0.841, 0.680, 0.985, 5.08, 19.6, 0.707, 0.522]],
          ['GenProp', [0.0788, 0.976, 0.671, 0.698, 0.104, 0.993, 0.585, 0.232, 0.186, 0.761, 0.561, 0.989, 3.96, 19.7, 0.789, 0.581]],
          ['Aleph 2.0', [0.0412, 0.962, 0.974, 0.702, 0.0895, 0.985, 0.906, 0.231, 0.192, 0.971, 0.819, 0.989, 4.90, 19.8, 0.801, 0.806]],
          ['MoviEdit', [0.0586, 0.965, 0.938, 0.699, 0.107, 1.00, 0.981, 0.231, 0.191, 0.938, 0.828, 0.989, 4.67, 19.8, 0.797, 0.803]],
        ] },
        { label: 'Arbitrary-frame reference', rows: [
          ['HappyHorse-1.0', [0.248, 0.742, 0.793, 0.402, 0.307, 0.760, 0.913, 0.219, 0.194, 0.813, 0.636, 0.984, 5.11, 19.6, 0.709, 0.486]],
          ['Aleph 2.0', [0.0422, 0.955, 0.952, 0.705, 0.0838, 0.981, 0.865, 0.229, 0.193, 0.957, 0.801, 0.989, 4.94, 19.8, 0.807, 0.781]],
          ['MoviEdit', [0.0598, 0.963, 0.920, 0.699, 0.0996, 0.995, 0.933, 0.229, 0.192, 0.925, 0.805, 0.989, 4.78, 19.7, 0.807, 0.786]],
        ] },
      ],
      rankScope: 'group',
      radar: {
        metrics: ['ov', 'loc', 'pa', 'ef', 'xs', 'sp', 'nsp', 'vq'],
        models: {
          'HappyHorse-1.0': { nsp: 0.248, sp: 0.76, xs: 0.913, pa: 0.813, loc: 0.869, ov: 0.486, vq: 0.709, ef: 0.636 },
          'GenProp': { nsp: 0.0788, sp: 0.993, xs: 0.585, pa: 0.761, loc: 0.739, ov: 0.561, vq: 0.789, ef: 0.561 },
          'Aleph 2.0': { nsp: 0.0422, sp: 0.981, xs: 0.865, pa: 0.957, loc: 0.939, ov: 0.781, vq: 0.807, ef: 0.801 },
          'MoviEdit': { nsp: 0.0598, sp: 0.995, xs: 0.933, pa: 0.925, loc: 0.911, ov: 0.786, vq: 0.807, ef: 0.805 },
        },
        foot: 'Arbitrary-frame results, except GenProp, which only supports first-frame references. Non-subject preservation is plotted as 1 − LPIPS.',
      },
    },
  };
  const RADAR_LABEL = {
    ov: ['Overall Edit', 'Success'], loc: ['Edit', 'Localization'], pa: ['Prompt', 'Alignment'], xs: ['Cross-Shot', 'Consistency'],
    sp: ['Subject', 'Preservation'], nsp: ['Non-subject', 'Preservation'], vq: ['Video', 'Quality'], ef: ['Edited-frame', 'Fidelity'],
  };
  const RADAR_LOWER = new Set(['nsp']);

  const barsEl = $('#bmBars'), radarEl = $('#bmRadar'), legendEl = $('#bmLegend'), resEl = $('#bmResults');
  if (barsEl && radarEl && resEl) {
    let setting = 'v2v';
    let focus = 'Aleph 2.0', preview = null;
    const cur = () => RESULTS[setting];
    const focusNow = () => preview || focus;
    const fmt = (x) => (x >= 10 ? x.toFixed(1) : x < 0.1 ? x.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : x.toFixed(3));
    const fmt3 = (x) => x.toFixed(3);
    // match the paper's precision: NIQE 2 dp, PickScore 1 dp, sub-0.1 values keep 3 significant digits
    const fmtCol = (x, c) => (c.m === 'NIQE' ? x.toFixed(2) : c.m === 'PickS.' ? x.toFixed(1) : x === 1 ? '1.00' : x < 0.1 ? x.toPrecision(3) : x.toFixed(3));

    /* ---- bars */
    const barTip = makeTip(barsEl.parentElement);
    const renderBars = () => {
      const R = cur(), oi = R.cols.findIndex((c) => c.key);
      const f = focusNow();
      const bar = (name, v, best) => {
        const g = MODEL_GROUP[name];
        return `<div class="bm-bar${g === 'ours' ? ' is-ours' : ''}${name === f && g !== 'ours' ? ' is-focus' : ''}" data-model="${esc(name)}" data-v="${v}" data-best="${best}" tabindex="0">
          <span class="bm-bar__name">${esc(name)}<small>${GROUP_LABEL[g]}</small></span>
          <span class="bm-bar__track"><span class="bm-bar__fill" style="width:0" data-w="${(v * 100).toFixed(2)}"></span><span class="bm-bar__val" style="left:8px">${fmt3(v)}</span></span></div>`;
      };
      let html = '';
      if (R.rankScope === 'all') {
        const rows = R.groups.flatMap((g) => g.rows).map(([n, vals]) => [n, vals[oi]]).sort((a, b) => b[1] - a[1]);
        const best = rows[0][1];
        html = rows.map(([n, v]) => bar(n, v, best)).join('');
      } else {
        html = R.groups.map((g) => {
          const rows = g.rows.map(([n, vals]) => [n, vals[oi]]).sort((a, b) => b[1] - a[1]);
          return `<p class="bm-bargroup">${esc(g.label)}</p>` + rows.map(([n, v]) => bar(n, v, rows[0][1])).join('');
        }).join('');
      }
      html += `<div class="bm-axis" aria-hidden="true"><span></span><span class="bm-axis__ticks"><span>0</span><span>0.2</span><span>0.4</span><span>0.6</span><span>0.8</span><span>1.0</span></span></div>`;
      barsEl.innerHTML = html;
      requestAnimationFrame(() => requestAnimationFrame(() => $$('.bm-bar__fill', barsEl).forEach((el) => {
        el.style.width = el.dataset.w + '%';
        el.nextElementSibling.style.left = `calc(${el.dataset.w}% + 8px)`;
      })));
    };
    const barHover = (b, e) => {
      const name = b.dataset.model, v = +b.dataset.v, best = +b.dataset.best;
      const peers = $$('.bm-bar', barsEl).filter((x) => x.parentElement === b.parentElement);
      const ours = peers.find((x) => x.dataset.model === 'MoviEdit' && (cur().rankScope === 'all' || groupOf(x) === groupOf(b)));
      const rank = sameGroup(b).findIndex((x) => x === b) + 1;
      const d = ours && name !== 'MoviEdit' ? v - +ours.dataset.v : null;
      const r = barsEl.parentElement.getBoundingClientRect(), br = b.getBoundingClientRect();
      barTip.show(`<p class="bm-tip__h">${esc(name)}</p>
        <div class="bm-tip__r${name === 'MoviEdit' ? ' is-ours' : ''}"><i></i><span>Overall edit success</span><b>${fmt3(v)}</b></div>
        <p class="bm-tip__n">Rank ${rank} of ${sameGroup(b).length}${d !== null ? ` · ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(3)} vs MoviEdit` : v === best ? ' · best' : ''}</p>`,
      (e ? e.clientX : br.left + br.width * 0.6) - r.left, br.top - r.top + 4);
    };
    const groupOf = (b) => { let p = b.previousElementSibling; while (p && !p.classList.contains('bm-bargroup')) p = p.previousElementSibling; return p; };
    const sameGroup = (b) => $$('.bm-bar', barsEl).filter((x) => cur().rankScope === 'all' || groupOf(x) === groupOf(b));
    barsEl.addEventListener('pointermove', (e) => { const b = e.target.closest('.bm-bar'); if (b) barHover(b, e); else barTip.hide(); });
    barsEl.addEventListener('pointerleave', () => barTip.hide());
    barsEl.addEventListener('focusin', (e) => { const b = e.target.closest('.bm-bar'); if (b) barHover(b); });
    barsEl.addEventListener('focusout', () => barTip.hide());
    barsEl.addEventListener('click', (e) => { const b = e.target.closest('.bm-bar'); if (b && b.dataset.model !== 'MoviEdit') setFocus(b.dataset.model === focus ? null : b.dataset.model); });

    /* ---- radar */
    const W = 600, H = 540, CX = W / 2, CY = 276, RAD = 188;
    const radarSvg = document.createElement('div');
    radarEl.appendChild(radarSvg);
    const radarTip = makeTip(radarEl);
    const renderRadar = () => {
      const R = cur().radar, ms = R.metrics, n = ms.length;
      const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const pt = (i, v) => [CX + Math.cos(ang(i)) * RAD * v, CY + Math.sin(ang(i)) * RAD * v];
      const plotted = (m, k) => (RADAR_LOWER.has(k) ? 1 - m[k] : m[k]);
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Radar chart of key metrics per model">`;
      [0.2, 0.4, 0.6, 0.8, 1].forEach((r) => {
        s += `<polygon class="r-grid" points="${ms.map((_, i) => pt(i, r).join(',')).join(' ')}"/>`;
      });
      [0.2, 0.4, 0.6, 0.8, 1].forEach((r) => { const [x, y] = pt(0, r); s += `<text class="r-ring-lbl" x="${x + 5}" y="${y + 3}">${r === 1 ? '1.0' : r}</text>`; });
      ms.forEach((_, i) => { const [x, y] = pt(i, 1); s += `<line class="r-spoke" x1="${CX}" y1="${CY}" x2="${x}" y2="${y}"/>`; });
      // model shapes: others first, then focus, then ours on top
      const names = Object.keys(R.models);
      const f = focusNow();
      const order = [...names.filter((nm) => nm !== 'MoviEdit' && nm !== f), ...(names.includes(f) && f !== 'MoviEdit' ? [f] : []), 'MoviEdit'];
      order.forEach((nm) => {
        const g = MODEL_GROUP[nm], m = R.models[nm];
        const cls = ['r-shape', g === 'ours' ? 'is-ours' : '', nm === f && g !== 'ours' ? 'is-focus' : '', g === 'open' && nm !== f ? 'is-open' : ''].join(' ');
        s += `<polygon class="${cls}" data-model="${esc(nm)}" points="${ms.map((k, i) => pt(i, plotted(m, k)).join(',')).join(' ')}"/>`;
      });
      ['MoviEdit', f].filter((nm, i, a) => nm && R.models[nm] && a.indexOf(nm) === i).forEach((nm) => {
        const col = nm === 'MoviEdit' ? 'var(--c-ours)' : 'var(--c-focus)';
        ms.forEach((k, i) => { const [x, y] = pt(i, plotted(R.models[nm], k)); s += `<circle class="r-dot" cx="${x}" cy="${y}" r="4" fill="${col}" pointer-events="none"/>`; });
      });
      // axis labels + hover targets
      ms.forEach((k, i) => {
        const [lx, ly] = pt(i, 1.13), c = Math.cos(ang(i)), sn = Math.sin(ang(i));
        const anchor = Math.abs(c) < 0.25 ? 'middle' : c > 0 ? 'start' : 'end';
        const lines = RADAR_LABEL[k];
        const dy0 = sn < -0.9 ? -(lines.length - 1) * 15 - 2 : sn > 0.9 ? 10 : -(lines.length - 1) * 7.5 + 4;
        const [hx, hy] = pt(i, 1.02);
        s += `<line class="r-hl" data-hl="${k}" x1="${CX}" y1="${CY}" x2="${hx}" y2="${hy}"/>`;
        s += `<circle class="r-axis-hit" data-axis="${k}" cx="${pt(i, 1.12)[0]}" cy="${pt(i, 1.12)[1]}" r="46"/>`;
        s += `<text class="r-lbl${k === 'ov' ? ' is-key' : ''}" data-lbl="${k}" x="${lx}" y="${ly + dy0}" text-anchor="${anchor}" pointer-events="none">${lines.map((l, j) => `<tspan x="${lx}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
      });
      s += '</svg>';
      radarSvg.innerHTML = s;
      $('#bmRadarFoot').textContent = R.foot;
    };
    const axisTip = (k, e) => {
      const R = cur().radar, f = focusNow();
      const rows = Object.entries(R.models).map(([nm, m]) => [nm, m[k]]).sort((a, b) => (RADAR_LOWER.has(k) ? a[1] - b[1] : b[1] - a[1]));
      const html = `<p class="bm-tip__h">${RADAR_LABEL[k].join(' ')}${RADAR_LOWER.has(k) ? ' · LPIPS ↓' : ''}</p>` +
        rows.map(([nm, v]) => `<div class="bm-tip__r${nm === 'MoviEdit' ? ' is-ours' : nm === f ? ' is-focus' : ''}"><i></i><span>${esc(nm)}</span><b>${fmt(v)}</b></div>`).join('');
      const r = radarEl.getBoundingClientRect();
      radarTip.show(html, e.clientX - r.left, e.clientY - r.top);
      $$('.r-hl', radarEl).forEach((l) => l.classList.toggle('on', l.dataset.hl === k));
      $$('.r-lbl', radarEl).forEach((l) => l.classList.toggle('is-hover', l.dataset.lbl === k));
    };
    const clearAxis = () => { radarTip.hide(); $$('.r-hl.on,.r-lbl.is-hover', radarEl).forEach((l) => l.classList.remove('on', 'is-hover')); };
    radarEl.addEventListener('pointermove', (e) => {
      const a = e.target.closest('[data-axis]');
      if (a) return axisTip(a.dataset.axis, e);
      clearAxis();
      const shp = e.target.closest('.r-shape');
      const nm = shp ? shp.dataset.model : null;
      if (nm && nm !== 'MoviEdit' && nm !== preview && nm !== focus) { preview = nm; renderAll(false); }
      else if (!nm && preview) { preview = null; renderAll(false); }
    });
    radarEl.addEventListener('pointerleave', () => { clearAxis(); if (preview) { preview = null; renderAll(false); } });
    radarEl.addEventListener('click', (e) => { const shp = e.target.closest('.r-shape'); if (shp && shp.dataset.model !== 'MoviEdit') setFocus(shp.dataset.model === focus ? null : shp.dataset.model); });

    /* ---- legend (also the focus picker) */
    const renderLegend = () => {
      const models = cur().radar.models;
      const names = Object.keys(models).filter((n) => n !== 'MoviEdit').sort((a, b) => models[b].ov - models[a].ov);
      legendEl.innerHTML = `<span class="bm-lg is-ours"><i></i>MoviEdit</span>` + names.map((n) =>
        `<button type="button" class="bm-lg${MODEL_GROUP[n] === 'open' ? ' is-open' : ''}" data-model="${esc(n)}" aria-pressed="${n === focus}">${esc(n)}</button>`).join('');
    };
    legendEl.addEventListener('click', (e) => { const b = e.target.closest('button.bm-lg'); if (b) setFocus(b.dataset.model === focus ? null : b.dataset.model); });
    legendEl.addEventListener('pointerover', (e) => { const b = e.target.closest('button.bm-lg'); if (b && b.dataset.model !== preview) { preview = b.dataset.model; renderAll(false); } });
    legendEl.addEventListener('pointerleave', () => { if (preview) { preview = null; renderAll(false); } });
    // give each legend button its line swatch
    const decorateLegend = () => $$('button.bm-lg', legendEl).forEach((b) => { if (!b.querySelector('i')) b.insertAdjacentHTML('afterbegin', '<i></i>'); });

    /* ---- full table */
    const renderTable = () => {
      const R = cur(), cols = R.cols;
      // header row 1: dimension spans
      const spans = [];
      cols.forEach((c) => { const last = spans[spans.length - 1]; if (last && last.dim === c.dim) last.n++; else spans.push({ dim: c.dim, n: 1, key: c.key }); });
      let h = '<table class="bm-rtable"><thead><tr><th class="rowh" rowspan="2" scope="col">Model</th>' +
        spans.map((sp) => `<th colspan="${sp.n}" class="dimstart${sp.key ? ' is-key' : ''}" scope="colgroup">${esc(sp.dim)}</th>`).join('') + '</tr><tr>';
      let prevDim = null;
      cols.forEach((c) => { h += `<th scope="col" class="${c.dim !== prevDim ? 'dimstart' : ''}${c.key ? ' is-key' : ''}">${esc(c.m)}${c.dir > 0 ? '↑' : '↓'}</th>`; prevDim = c.dim; });
      h += '</tr></thead><tbody>';
      const rankCols = (rows) => cols.map((c, j) => {
        const vals = [...new Set(rows.map((r) => r[1][j]))].sort((a, b) => (c.dir > 0 ? b - a : a - b));
        return { best: vals[0], second: vals.length > 1 ? vals[1] : null };
      });
      const allRows = R.groups.flatMap((g) => g.rows);
      const globalRank = rankCols(allRows);
      R.groups.forEach((g) => {
        const rk = R.rankScope === 'group' ? rankCols(g.rows) : globalRank;
        h += `<tr class="grp"><td class="rowh">${esc(g.label)}</td><td colspan="${cols.length}"></td></tr>`;
        g.rows.forEach(([name, vals]) => {
          h += `<tr class="${MODEL_GROUP[name] === 'ours' ? 'is-ours' : ''}"><td class="rowh">${esc(name === 'MoviEdit' ? 'MoviEdit (Ours)' : name)}</td>`;
          prevDim = null;
          vals.forEach((v, j) => {
            const c = cols[j];
            const cls = [c.dim !== prevDim ? 'dimstart' : '', c.key ? 'key' : '', v === rk[j].best ? 'best' : v === rk[j].second ? 'second' : ''].join(' ').trim();
            h += `<td class="${cls}">${fmtCol(v, c)}</td>`; prevDim = c.dim;
          });
          h += '</tr>';
        });
      });
      h += '</tbody></table>';
      resEl.innerHTML = h;
      $('#bmTableTitle').textContent = setting === 'v2v' ? 'Full results · V2V' : 'Full results · IV2V';
    };

    const refocusBars = () => {
      const f = focusNow();
      $$('.bm-bar', barsEl).forEach((b) => b.classList.toggle('is-focus', b.dataset.model === f && b.dataset.model !== 'MoviEdit'));
    };
    function renderAll(full = true) {
      if (full) renderBars(); else refocusBars();
      renderRadar();
      if (full) {
        renderLegend(); renderTable();
      }
      decorateLegend();
      $$('button.bm-lg', legendEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.model === focus)));
    }
    function setFocus(name) { focus = name; preview = null; renderAll(false); }
    $$('[data-setting]').forEach((b) => b.addEventListener('click', () => {
      setting = b.dataset.setting;
      $$('[data-setting]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (!cur().radar.models[focus]) focus = 'Aleph 2.0';
      preview = null; renderAll(true);
    }));
    renderAll(true);
  }
})();
