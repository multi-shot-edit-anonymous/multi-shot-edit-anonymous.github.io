/* MoviEdit project page — interactions
   - sticky nav state + mobile menu
   - reveal-on-scroll
   - play/pause videos only while in view (saves CPU with many loops)
   - before/after drag comparator (with base↔top time sync)
   - draft → final toggle
*/
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- nav ---------------------------------------------------------------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const navToggle = document.getElementById('navtoggle');
  const navLinks = document.getElementById('navlinks');
  navToggle?.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  navLinks?.addEventListener('click', (e) => {
    if (e.target.closest('a')) { navLinks.classList.remove('open'); navToggle?.setAttribute('aria-expanded', 'false'); }
  });

  /* ---- reveal on scroll --------------------------------------------------- */
  const revealables = document.querySelectorAll('.reveal');
  if (reduce) {
    revealables.forEach((el) => el.classList.add('in'));
  } else {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealables.forEach((el) => ro.observe(el));
  }

  /* ---- play videos only while in view ------------------------------------- */
  const vids = document.querySelectorAll('video[data-vid]');
  const playSafe = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const vo = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; playSafe(v); }
      else if (!v.paused) v.pause();
    });
  }, { threshold: 0.2 });
  vids.forEach((v) => vo.observe(v));

  /* ---- before / after comparator ------------------------------------------ */
  const compares = [];
  document.querySelectorAll('[data-compare]').forEach((el) => {
    const base = el.querySelector('.compare__layer--base video');
    const top = el.querySelector('.compare__layer--top video');
    let pos = 50;
    const set = (x) => {
      const r = el.getBoundingClientRect();
      pos = Math.min(94, Math.max(6, ((x - r.left) / r.width) * 100));
      el.style.setProperty('--pos', pos + '%');
    };
    el.style.setProperty('--pos', pos + '%');
    let dragging = false;
    const down = (e) => { dragging = true; set((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); };
    const move = (e) => { if (dragging) set((e.touches ? e.touches[0] : e).clientX); };
    const up = () => { dragging = false; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    compares.push({ base, top });
  });
  // keep the two layers time-aligned
  if (compares.length) {
    const sync = () => {
      for (const c of compares) {
        if (c.base && c.top && !c.base.paused && c.base.readyState > 1 && c.top.readyState > 1) {
          if (Math.abs(c.base.currentTime - c.top.currentTime) > 0.09) c.top.currentTime = c.base.currentTime;
        }
      }
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  }

  /* ---- draft / final / comparison + example switcher ---------------------- */
  const stageVideo = document.getElementById('stageVideo');
  if (stageVideo) {
    const EX = {
      a: { preview: 'asset/cascaded/a/draft_edit.mp4', final: 'asset/cascaded/a/final_video.mp4', poster: 'asset/media/cascaded/a.jpg' },
      b: { preview: 'asset/cascaded/b/draft_edit.mp4', final: 'asset/cascaded/b/final_video.mp4', poster: 'asset/media/cascaded/b.jpg' },
    };
    const EX_ORDER = ['a', 'b'];
    const stageBtns = document.querySelectorAll('.toggle__btn[data-stage]');
    const singleFig = document.querySelector('[data-stage-single]');
    const compareFig = document.querySelector('[data-stage-compare]');
    const cmpBase = document.getElementById('stageCmpBase');
    const cmpTop = document.getElementById('stageCmpTop');
    const cmpVids = compareFig ? Array.from(compareFig.querySelectorAll('video')) : [];
    let curEx = 'a', curStage = 'compare';

    const setSrc = (videoEl, src) => {
      const s = videoEl.querySelector('source');
      if (s.getAttribute('src') !== src) { s.setAttribute('src', src); videoEl.load(); }
    };

    const render = () => {
      const ex = EX[curEx];
      stageBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stage === curStage)));
      if (curStage === 'compare') {
        if (singleFig) singleFig.hidden = true;
        if (compareFig) compareFig.hidden = false;
        stageVideo.pause();
        setSrc(cmpBase, ex.final);
        setSrc(cmpTop, ex.preview);
        cmpVids.forEach((v) => { if (v.preload === 'none') v.preload = 'auto'; playSafe(v); });
        return;
      }
      if (compareFig) compareFig.hidden = true;
      if (singleFig) singleFig.hidden = false;
      cmpVids.forEach((v) => v.pause());
      stageVideo.poster = ex.poster;
      setSrc(stageVideo, curStage === 'preview' ? ex.preview : ex.final);
      playSafe(stageVideo);
    };

    stageBtns.forEach((b) => b.addEventListener('click', () => { curStage = b.dataset.stage; render(); }));
    const cycleEx = (dir) => { const i = EX_ORDER.indexOf(curEx); curEx = EX_ORDER[(i + dir + EX_ORDER.length) % EX_ORDER.length]; render(); };
    document.getElementById('stagePrev')?.addEventListener('click', () => cycleEx(-1));
    document.getElementById('stageNext')?.addEventListener('click', () => cycleEx(1));
    render(); // default view (Comparison)
  }

  /* ---- teaser carousel (directional slide) + wheel + sound ---------------- */
  const slides = Array.from(document.querySelectorAll('.teaser__slide'));
  const soundBtn = document.getElementById('soundBtn');
  const unmuteBtn = document.getElementById('unmuteBtn');
  const prevBtn = document.getElementById('teaserPrev');
  const nextBtn = document.getElementById('teaserNext');
  const frame = document.querySelector('.teaser__frame');
  if (slides.length) {
    const n = slides.length, DUR = 620;
    let idx = 0, soundOn = false, inView = true, animating = false;
    const active = () => slides[idx];
    const prep = (v) => { if (v.preload === 'none') v.preload = 'auto'; };
    const updateSoundBtn = () => {
      if (!soundBtn) return;
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      soundBtn.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    };
    slides[0].classList.add('is-visible');
    prep(slides[0]); prep(slides[1 % n]);

    // slide from `dir` (1 = next → new enters from the right; -1 = prev → from the left)
    const go = (to, dir) => {
      to = ((to % n) + n) % n;
      if (to === idx || animating) return;
      animating = true;
      const cur = active(), nxt = slides[to];
      prep(nxt);
      nxt.muted = !soundOn;
      try { nxt.currentTime = 0; } catch (e) {}
      nxt.style.transition = 'none';
      nxt.style.transform = 'translateX(' + (dir * 100) + '%)';
      nxt.classList.add('is-visible');
      void nxt.offsetWidth;                       // reflow so the off-screen start sticks
      nxt.style.transition = '';
      requestAnimationFrame(() => {
        nxt.style.transform = 'translateX(0)';
        cur.style.transform = 'translateX(' + (-dir * 100) + '%)';
      });
      if (inView) playSafe(nxt);
      window.setTimeout(() => {
        cur.classList.remove('is-visible');
        cur.pause();
        cur.style.transition = 'none';
        cur.style.transform = 'translateX(0)';
        void cur.offsetWidth;
        cur.style.transition = '';
        idx = to;
        animating = false;
        prep(slides[(idx + 1) % n]);
      }, DUR);
    };

    slides.forEach((v, k) => v.addEventListener('ended', () => { if (k === idx && !animating) go(idx + 1, 1); }));
    if (prevBtn) prevBtn.addEventListener('click', () => go(idx - 1, -1));
    if (nextBtn) nextBtn.addEventListener('click', () => go(idx + 1, 1));

    // horizontal wheel / trackpad swipe → prev/next
    if (frame) {
      let wheelLock = false;
      frame.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 16) return; // ignore vertical scroll
        e.preventDefault();
        if (wheelLock || animating) return;
        wheelLock = true;
        const d = e.deltaX > 0 ? 1 : -1;
        go(idx + d, d);
        window.setTimeout(() => { wheelLock = false; }, DUR + 60);
      }, { passive: false });
    }

    const setSound = (on) => { soundOn = on; active().muted = !on; if (on) { active().volume = 1; playSafe(active()); } updateSoundBtn(); };
    const dismiss = () => { if (unmuteBtn) unmuteBtn.classList.add('is-hidden'); };
    if (unmuteBtn) unmuteBtn.addEventListener('click', () => { setSound(true); dismiss(); });
    if (soundBtn) soundBtn.addEventListener('click', () => { setSound(!soundOn); dismiss(); });

    if (frame) {
      new IntersectionObserver((ents) => {
        ents.forEach((e) => { inView = e.isIntersecting; if (inView) playSafe(active()); else active().pause(); });
      }, { threshold: 0.25 }).observe(frame);
    }
    if (inView) playSafe(slides[0]);
  }

  /* ---- intro feature rail: ‹ › buttons + mouse drag (native swipe also works) */
  const introScroll = document.getElementById('introScroll');
  if (introScroll) {
    const railPrev = document.getElementById('railPrev');
    const railNext = document.getElementById('railNext');
    const step = () => {
      const box = introScroll.querySelector('.introbox');
      const g = parseFloat(getComputedStyle(introScroll).gap) || 20;
      return box ? box.getBoundingClientRect().width + g : introScroll.clientWidth * 0.8;
    };
    const updateRail = () => {
      const max = introScroll.scrollWidth - introScroll.clientWidth - 2;
      if (railPrev) railPrev.disabled = introScroll.scrollLeft <= 2;
      if (railNext) railNext.disabled = introScroll.scrollLeft >= max;
    };
    if (railPrev) railPrev.addEventListener('click', () => introScroll.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (railNext) railNext.addEventListener('click', () => introScroll.scrollBy({ left: step(), behavior: 'smooth' }));
    introScroll.addEventListener('scroll', updateRail, { passive: true });
    window.addEventListener('resize', updateRail);
    updateRail();
    // drag-to-scroll (mouse only; touch/trackpad use native scroll)
    let down = false, sx = 0, sl = 0, moved = false;
    introScroll.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = introScroll.scrollLeft;
      try { introScroll.setPointerCapture(e.pointerId); } catch (err) {}
      introScroll.classList.add('is-grabbing');
    });
    introScroll.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      introScroll.scrollLeft = sl - dx;
    });
    const endDrag = () => { down = false; introScroll.classList.remove('is-grabbing'); };
    introScroll.addEventListener('pointerup', endDrag);
    introScroll.addEventListener('pointercancel', endDrag);
    introScroll.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  /* ---- results galleries: input pinned + synced edit list (real-world + AI) - */
  const SOUND_SVG = '<svg class="icon-off" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><svg class="icon-on" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16.5 8.8a5 5 0 0 1 0 6.4M19 6.4a8.5 8.5 0 0 1 0 11.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const initGallery = (sectionId, sourcesEl, inputEl, editsEl, clips) => {
    if (!sourcesEl || !inputEl || !editsEl || !clips.length) return;
    let active = 0, master = null, followers = [], inView = false, soundOn = false;

    const instr = (e) => {
      if (e.type === 'image') {
        const rows = e.pairs.map((p) => `<div class="rw-ba"><img src="${p.orig}" alt="original frame"><span class="rw-ba__arrow" aria-hidden="true">&rarr;</span><img class="is-edit" src="${p.img}" alt="edited frame"></div>`).join('');
        return `<div class="rw-instr"><span class="rw-instr__kind">Edit instruction</span><div class="rw-ba-list">${rows}</div></div>`;
      }
      return `<div class="rw-instr"><span class="rw-instr__kind">Edit instruction</span><p class="rw-instr__text">&ldquo;${e.text}&rdquo;</p></div>`;
    };

    // Section-level playback: while any part of the section is on screen, all its
    // videos play (already running when you look → no per-row scroll lag). When the
    // section is fully scrolled past (up or down), everything in it pauses.
    const play = () => [master, ...followers].forEach((v) => v && playSafe(v));
    const pause = () => [master, ...followers].forEach((v) => v && v.pause());

    const setSoundBtn = (on) => {
      const b = inputEl.querySelector('[data-rwsound]'); if (!b) return;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Turn input audio off' : 'Turn input audio on');
    };

    const render = () => {
      const c = clips[active];
      soundOn = false;
      // like the teaser: the reference audio is baked into the (muted) input video,
      // so unmuting is instant — the button just flips master.muted.
      const soundBtn = c.sound ? `<button class="rw-sound" type="button" data-rwsound aria-pressed="false" aria-label="Turn input audio on">${SOUND_SVG}</button>` : '';
      inputEl.innerHTML = `<figure class="rw-frame"><video data-rwmaster muted loop playsinline preload="auto" poster="${c.inputPoster}"><source src="${c.input}" type="video/mp4"></video><span class="rw-tag">Original video</span>${soundBtn}</figure>`;
      editsEl.innerHTML = c.edits.map((e) => `<article class="rw-edit"><figure class="rw-frame"><video data-rwout muted loop playsinline preload="auto" poster="${e.poster}"><source src="${e.out}" type="video/mp4"></video><span class="rw-tag rw-tag--out">Edited video</span></figure>${instr(e)}</article>`).join('');
      master = inputEl.querySelector('video[data-rwmaster]');
      followers = Array.from(editsEl.querySelectorAll('video[data-rwout]'));
      if (inView) play();
    };

    // toggle input audio — flip mute and restart input + all outputs from the top, in sync
    inputEl.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-rwsound]'); if (!b) return;
      soundOn = !soundOn;
      if (master) master.muted = !soundOn;
      [master, ...followers].forEach((v) => { if (v) { try { v.currentTime = 0; } catch (e) {} playSafe(v); } });
      setSoundBtn(soundOn);
    });

    sourcesEl.innerHTML = clips.map((c, i) =>
      `<button class="rw-source" role="tab" aria-selected="${i === 0}" data-i="${i}"><span class="rw-source__dot"></span><video muted loop playsinline preload="none" poster="${c.inputPoster}"><source src="${c.input}" type="video/mp4"></video></button>`).join('');
    sourcesEl.addEventListener('click', (ev) => {
      const b = ev.target.closest('.rw-source'); if (!b) return;
      active = +b.dataset.i;
      sourcesEl.querySelectorAll('.rw-source').forEach((x) => x.setAttribute('aria-selected', String(+x.dataset.i === active)));
      render();
    });

    render();

    // play only while the section is on screen; pause once it's fully scrolled past
    new IntersectionObserver((ents) => {
      ents.forEach((en) => { inView = en.isIntersecting; if (inView) play(); else pause(); });
    }, { threshold: 0 }).observe(document.getElementById(sectionId));

    if (!reduce) {
      // keep the outputs frame-aligned to the input while playing
      const tick = () => {
        if (master && !master.paused && master.readyState > 0) {
          const mt = master.currentTime;
          followers.forEach((f) => {
            if (!f.paused && f.readyState > 1 && Math.abs(f.currentTime - mt) > 0.06) { try { f.currentTime = mt; } catch (e) {} }
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  // real-world
  const RWP = 'asset/media/real-world/', RWB = 'asset/real-world/1_lala/', BK = 'asset/real-world/2_book/',
        TIT = 'asset/real-world/3_titanic/', THP = 'asset/real-world/4_three_people/',
        MGN = 'asset/real-world/5_man_gun/', TWO = 'asset/real-world/6_two_woman/';
  initGallery('realworld', document.getElementById('rwSources'), document.getElementById('rwInput'), document.getElementById('rwEdits'), [
    {
      input: RWB + 'input_video_blur.mp4', inputPoster: RWP + '1lala-input.jpg',
      edits: [
        { out: RWB + '1_remove_man/output_video_blur.mp4', poster: RWP + '1lala-1_remove_man.jpg', type: 'text', text: 'Remove the man.' },
        { out: RWB + '2_remove_woman/output_video_blur.mp4', poster: RWP + '1lala-2_remove_woman.jpg', type: 'image', pairs: [{ orig: RWP + '1lala-orig-96.jpg', img: RWP + '1lala-edit-96.jpg' }] },
        { out: RWB + '3_man_outfit_mustard/output_video_blur.mp4', poster: RWP + '1lala-3_man_outfit_mustard.jpg', type: 'text', text: 'Change the appearance of the man to match a retro 1970s mustard corduroy blazer with wide lapels.' },
        { out: RWB + '4_woman_outfit_black/output_video_blur.mp4', poster: RWP + '1lala-4_woman_outfit_black.jpg', type: 'image', pairs: [{ orig: RWP + '1lala-orig-192.jpg', img: RWP + '1lala-edit-192.jpg' }] },
        { out: RWB + '5_man_outfit_rain_hood/output_video_blur.mp4', poster: RWP + '1lala-5_man_outfit_rain_hood.jpg', type: 'image', pairs: [{ orig: RWP + '1lala-orig-32.jpg', img: RWP + '1lala-edit-32.jpg' }] },
        { out: RWB + '6_man_swap_doctor/output_video_blur.mp4', poster: RWP + '1lala-6_man_swap_doctor.jpg', type: 'text', text: 'Replace the man with another woman in a crisp white medical coat with a stethoscope.' },
      ],
    },
    {
      input: BK + 'input_video_blur.mp4', inputPoster: RWP + '2book-input.jpg',
      edits: [
        { out: BK + '1_remove_man/output_video_blur.mp4', poster: RWP + '2book-1_remove_man.jpg', type: 'text', text: 'Remove the man in an olive-green pullover.' },
        { out: BK + '2_woman_blonde/output_video_blur.mp4', poster: RWP + '2book-2_woman_blonde.jpg', type: 'image', pairs: [{ orig: RWP + '2book-orig-312.jpg', img: RWP + '2book-edit-312.jpg' }] },
        { out: BK + '3_replace_man/output_video_blur.mp4', poster: RWP + '2book-3_replace_man.jpg', type: 'text', text: 'Replace the man in an olive-green pullover with another white plastic mannequin.' },
        { out: BK + '4_man_outfit/output_video_blur.mp4', poster: RWP + '2book-4_man_outfit.jpg', type: 'text', text: 'Change the appearance of the man in an olive-green pullover to match a futuristic silver metallic jumpsuit.' },
        { out: BK + '5_global/output_video_blur.mp4', poster: RWP + '2book-5_global.jpg', type: 'image', pairs: [{ orig: RWP + '2book-orig-88.jpg', img: RWP + '2book-edit-88.jpg' }] },
      ],
    },
    {
      input: TIT + 'input_video_blur.mp4', inputPoster: RWP + '3titanic-input.jpg',
      edits: [
        { out: TIT + '1_remove_woman/output_video_blur.mp4', poster: RWP + '3titanic-1_remove_woman.jpg', type: 'text', text: 'Remove the woman with reddish-brown hair.' },
        { out: TIT + '2_man_outfit/output_video_blur.mp4', poster: RWP + '3titanic-2_man_outfit.jpg', type: 'image', pairs: [{ orig: RWP + '3titanic-orig-168.jpg', img: RWP + '3titanic-edit-168.jpg' }] },
        { out: TIT + '3_replace_man/output_video_blur.mp4', poster: RWP + '3titanic-3_replace_man.jpg', type: 'text', text: 'Replace the man in a brown overcoat with another woman in a navy double-breasted peacoat with brass buttons.' },
        { out: TIT + '4_global/output_video_blur.mp4', poster: RWP + '3titanic-4_global.jpg', type: 'image', pairs: [{ orig: RWP + '3titanic-orig-160.jpg', img: RWP + '3titanic-edit-160.jpg' }] },
      ],
    },
    {
      input: THP + 'input_video_blur.mp4', inputPoster: RWP + '4three-input.jpg',
      edits: [
        { out: THP + '1_remove_old_man/output_video_blur.mp4', poster: RWP + '4three-1_remove_old_man.jpg', type: 'text', text: 'Remove the old man in a blue shirt.' },
        { out: THP + '2_remove_woman/output_video_blur.mp4', poster: RWP + '4three-2_remove_woman.jpg', type: 'text', text: 'Remove the woman in a floral dress.' },
        { out: THP + '4_woman_outfit/output_video_blur.mp4', poster: RWP + '4three-4_woman_outfit.jpg', type: 'image', pairs: [{ orig: RWP + '4three-orig-296.jpg', img: RWP + '4three-edit-296.jpg' }] },
        { out: THP + '5_replace_woman/output_video_blur.mp4', poster: RWP + '4three-5_replace_woman.jpg', type: 'image', pairs: [{ orig: RWP + '4three-orig-200.jpg', img: RWP + '4three-edit-200.jpg' }] },
        { out: THP + '7_multi_seg/output_video_blur.mp4', poster: RWP + '4three-7_multi_seg.jpg', type: 'image', pairs: [{ orig: RWP + '4three-orig-40.jpg', img: RWP + '4three-edit-40.jpg' }, { orig: RWP + '4three-orig-152.jpg', img: RWP + '4three-edit-152.jpg' }] },
      ],
    },
    {
      input: MGN + 'input_video_blur.mp4', inputPoster: RWP + '5mangun-input.jpg',
      edits: [
        { out: MGN + '1_remove_man/output_video_blur.mp4', poster: RWP + '5mangun-1_remove_man.jpg', type: 'text', text: 'Remove the man in a tan overcoat.' },
        { out: MGN + '2_man_blonde/output_video_blur.mp4', poster: RWP + '5mangun-2_man_blonde.jpg', type: 'image', pairs: [{ orig: RWP + '5mangun-orig-176.jpg', img: RWP + '5mangun-edit-176.jpg' }] },
        { out: MGN + '3_man_outfit/output_video_blur.mp4', poster: RWP + '5mangun-3_man_outfit.jpg', type: 'image', pairs: [{ orig: RWP + '5mangun-orig-184.jpg', img: RWP + '5mangun-edit-184.jpg' }] },
        { out: MGN + '4_replace_man/output_video_blur.mp4', poster: RWP + '5mangun-4_replace_man.jpg', type: 'text', text: 'Replace the man with another white woman in a black jacket with a platinum blonde bob haircut.' },
      ],
    },
    {
      input: TWO + 'input_video_blur.mp4', inputPoster: RWP + '6twowoman-input.jpg',
      edits: [
        { out: TWO + '1_remove_woman_cream/output_video_blur.mp4', poster: RWP + '6twowoman-1_remove_woman_cream.jpg', type: 'text', text: 'Remove the woman in a cream cardigan.' },
        { out: TWO + '2_woman_pink_hat/output_video_blur.mp4', poster: RWP + '6twowoman-2_woman_pink_hat.jpg', type: 'image', pairs: [{ orig: RWP + '6twowoman-orig-232.jpg', img: RWP + '6twowoman-edit-232.jpg' }] },
        { out: TWO + '3_woman_cream_outfit/output_video_blur.mp4', poster: RWP + '6twowoman-3_woman_cream_outfit.jpg', type: 'text', text: 'Change the appearance of the woman in a cream cardigan to match a pink floral summer dress with flutter sleeves.' },
        { out: TWO + '4_replace_woman_cream/output_video_blur.mp4', poster: RWP + '6twowoman-4_replace_woman_cream.jpg', type: 'image', pairs: [{ orig: RWP + '6twowoman-orig-16.jpg', img: RWP + '6twowoman-edit-16.jpg' }] },
        { out: TWO + '5_segmentation/output_video_blur.mp4', poster: RWP + '6twowoman-5_segmentation.jpg', type: 'image', pairs: [{ orig: RWP + '6twowoman-orig-32.jpg', img: RWP + '6twowoman-edit-32.jpg' }] },
        { out: TWO + '6_global/output_video_blur.mp4', poster: RWP + '6twowoman-6_global.jpg', type: 'text', text: 'Change the scene environment to harsh noon sunlight with strong heat shimmer.' },
      ],
    },
  ]);

  // AI-generated
  const AIP = 'asset/media/ai-generated/';
  const SQ = 'asset/ai-generated/1_squid/', TT = 'asset/ai-generated/2_titantic/', LA = 'asset/ai-generated/3_lala/', DK = 'asset/ai-generated/4_dark/', MG = 'asset/ai-generated/5_man_gun/', JK = 'asset/ai-generated/6_joker/', CF = 'asset/ai-generated/7_men_coffee/', CO = 'asset/ai-generated/8_men_company/', WS = 'asset/ai-generated/9_woman_sing/', WM = 'asset/ai-generated/10_woman_monster/', MC = 'asset/ai-generated/11_man-child-subway/';
  initGallery('aigen', document.getElementById('aiSources'), document.getElementById('aiInput'), document.getElementById('aiEdits'), [
    {
      input: AIP + '2titanic-input-audio.mp4', inputPoster: AIP + '2titanic-input.jpg', sound: true,
      edits: [
        { out: TT + '1_remove_man/output_video.mp4', poster: AIP + '2titanic-1_remove_man.jpg', type: 'text', text: 'Remove the man.' },
        { out: TT + '2_remove_woman/output_video.mp4', poster: AIP + '2titanic-2_remove_woman.jpg', type: 'text', text: 'Remove the woman.' },
        { out: TT + '3_man_add_vest/output_video.mp4', poster: AIP + '2titanic-3_man_add_vest.jpg', type: 'image', pairs: [{ orig: AIP + '2titanic-orig-128.jpg', img: TT + '3_man_add_vest/edited_frame_128.jpg' }] },
        { out: TT + '4_woman_add_hat/output_video.mp4', poster: AIP + '2titanic-4_woman_add_hat.jpg', type: 'text', text: 'Add an ivory straw sun hat with a black ribbon to the woman.' },
        { out: TT + '5_man_swap_old_man/output_video.mp4', poster: AIP + '2titanic-5_man_swap_old_man.jpg', type: 'text', text: 'Change the appearance of the man in a brown overcoat to match an elderly, weathered facial appearance.' },
        { out: TT + '6_man_swap_woman/output_video.mp4', poster: AIP + '2titanic-6_man_swap_woman.jpg', type: 'image', pairs: [{ orig: AIP + '2titanic-orig-256.jpg', img: TT + '6_man_swap_woman/edited_frame_256.jpg' }] },
        { out: TT + '7_multi_1/output_video.mp4', poster: AIP + '2titanic-7_multi_1.jpg', type: 'image', pairs: [{ orig: AIP + '2titanic-orig-32.jpg', img: TT + '7_multi_1/edited_frame_32.jpg' }, { orig: AIP + '2titanic-orig-88.jpg', img: TT + '7_multi_1/edited_frame_88.jpg' }] },
        { out: TT + '8_multi_2/output_video.mp4', poster: AIP + '2titanic-8_multi_2.jpg', type: 'image', pairs: [{ orig: AIP + '2titanic-orig-0.jpg', img: TT + '8_multi_2/edited_frame_0.jpg' }, { orig: AIP + '2titanic-orig-56.jpg', img: TT + '8_multi_2/edited_frame_56.jpg' }] },
        { out: TT + '9_style/output_video.mp4', poster: AIP + '2titanic-9_style.jpg', type: 'image', pairs: [{ orig: AIP + '2titanic-orig-208.jpg', img: TT + '9_style/edited_frame_208.jpg' }] },
      ],
    },
    {
      input: AIP + '3lala-input-audio.mp4', inputPoster: AIP + '3lala-input.jpg', sound: true,
      edits: [
        { out: LA + '1_remove_man/output_video.mp4', poster: AIP + '3lala-1_remove_man.jpg', type: 'text', text: 'Remove the man.' },
        { out: LA + '2_add_woman_goggles/output_video.mp4', poster: AIP + '3lala-2_add_woman_goggles.jpg', type: 'text', text: 'Add mirrored chrome wraparound ski goggles to the woman.' },
        { out: LA + '3_man_rain_hood/output_video.mp4', poster: AIP + '3lala-3_man_rain_hood.jpg', type: 'image', pairs: [{ orig: AIP + '3lala-orig-208.jpg', img: LA + '3_man_rain_hood/edited_frame_208.jpg' }] },
        { out: LA + '4_woman_black_dress/output_video.mp4', poster: AIP + '3lala-4_woman_black_dress.jpg', type: 'image', pairs: [{ orig: AIP + '3lala-orig-176.jpg', img: LA + '4_woman_black_dress/edited_frame_176.jpg' }] },
        { out: LA + '5_man_blazer/output_video.mp4', poster: AIP + '3lala-5_man_blazer.jpg', type: 'text', text: 'Change the appearance of the man in a red jacket to match a retro beige corduroy blazer with wide lapels.' },
        { out: LA + '6_woman_man/output_video.mp4', poster: AIP + '3lala-6_woman_man.jpg', type: 'text', text: 'Replace the woman in a yellow dress with another man in a rugged brown waxed canvas field jacket.' },
        { out: LA + '7_style/output_video.mp4', poster: AIP + '3lala-7_style.jpg', type: 'image', pairs: [{ orig: AIP + '3lala-orig-208.jpg', img: LA + '7_style/edited_frame_208.jpg' }] },
      ],
    },
    {
      input: AIP + '4dark-input-audio.mp4', inputPoster: AIP + '4dark-input.jpg', sound: true,
      edits: [
        { out: DK + '1_remove_batman/output_video.mp4', poster: AIP + '4dark-1_remove_batman.jpg', type: 'text', text: 'Remove the man in a black tactical suit and a dark mask.' },
        { out: DK + '2_remove_joker/output_video.mp4', poster: AIP + '4dark-2_remove_joker.jpg', type: 'image', pairs: [{ orig: AIP + '4dark-orig-200.jpg', img: DK + '2_remove_joker/edited_frame_200.jpg' }] },
        { out: DK + '3_joker_green_scarf/output_video.mp4', poster: AIP + '4dark-3_joker_green_scarf.jpg', type: 'text', text: 'Add a dark green scarf to the Joker man with clown makeup.' },
        { out: DK + '4_joker_outfit/output_video.mp4', poster: AIP + '4dark-4_joker_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '4dark-orig-96.jpg', img: DK + '4_joker_outfit/edited_frame_96.jpg' }] },
        { out: DK + '5_batman_captain/output_video.mp4', poster: AIP + '4dark-5_batman_captain.jpg', type: 'image', pairs: [{ orig: AIP + '4dark-orig-224.jpg', img: DK + '5_batman_captain/edited_frame_224.jpg' }] },
        { out: DK + '6_style/output_video.mp4', poster: AIP + '4dark-6_style.jpg', type: 'text', text: 'Apply the style of a crayon drawing — scribbled color fills, overlapping strokes, sketchy shading, wavy uneven outlines — to the entire scene.' },
      ],
    },
    {
      input: AIP + '5mangun-input-audio.mp4', inputPoster: AIP + '5mangun-input.jpg', sound: true,
      edits: [
        { out: MG + '1_remove_man/output_video.mp4', poster: AIP + '5mangun-1_remove_man.jpg', type: 'text', text: 'Remove the man in a tan overcoat.' },
        { out: MG + '2_man_outfit/output_video.mp4', poster: AIP + '5mangun-2_man_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '5mangun-orig-264.jpg', img: MG + '2_man_outfit/edited_frame_264.jpg' }] },
        { out: MG + '3_man_hair/output_video.mp4', poster: AIP + '5mangun-3_man_hair.jpg', type: 'image', pairs: [{ orig: AIP + '5mangun-orig-56.jpg', img: MG + '3_man_hair/edited_frame_56.jpg' }] },
        { out: MG + '4_man_woman/output_video.mp4', poster: AIP + '5mangun-4_man_woman.jpg', type: 'text', text: 'Replace the man in a tan overcoat and a blue shirt with another woman in a high-visibility neon orange utility vest.' },
        { out: MG + '5_global/output_video.mp4', poster: AIP + '5mangun-5_global.jpg', type: 'image', pairs: [{ orig: AIP + '5mangun-orig-328.jpg', img: MG + '5_global/edited_frame_328.jpg' }] },
      ],
    },
    {
      input: AIP + '6joker-input-audio.mp4', inputPoster: AIP + '6joker-input.jpg', sound: true,
      edits: [
        { out: JK + '1_remove_old_man/output_video.mp4', poster: AIP + '6joker-1_remove_old_man.jpg', type: 'text', text: 'Remove the old man in a grey suit.' },
        { out: JK + '2_add_ear_muff/output_video.mp4', poster: AIP + '6joker-2_add_ear_muff.jpg', type: 'text', text: 'Add fuzzy leopard-print winter earmuffs to the Joker man with clown makeup.' },
        { out: JK + '3_old_man_outfit/output_video.mp4', poster: AIP + '6joker-3_old_man_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '6joker-orig-40.jpg', img: JK + '3_old_man_outfit/edited_frame_40.jpg' }] },
        { out: JK + '4_replace_joker/output_video.mp4', poster: AIP + '6joker-4_replace_joker.jpg', type: 'image', pairs: [{ orig: AIP + '6joker-orig-328.jpg', img: JK + '4_replace_joker/edited_frame_328.jpg' }] },
        { out: JK + '5_replace_old_man/output_video.mp4', poster: AIP + '6joker-5_replace_old_man.jpg', type: 'image', pairs: [{ orig: AIP + '6joker-orig-40.jpg', img: JK + '5_replace_old_man/edited_frame_40.jpg' }] },
      ],
    },
    {
      input: AIP + '7coffee-input-audio.mp4', inputPoster: AIP + '7coffee-input.jpg', sound: true,
      edits: [
        { out: CF + '1_remove_man/output_video.mp4', poster: AIP + '7coffee-1_remove_man.jpg', type: 'text', text: 'Remove the man in an olive green t-shirt.' },
        { out: CF + '2_man_outfit/output_video.mp4', poster: AIP + '7coffee-2_man_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '7coffee-orig-176.jpg', img: CF + '2_man_outfit/edited_frame_176.jpg' }] },
        { out: CF + '3_add_scarf/output_video.mp4', poster: AIP + '7coffee-3_add_scarf.jpg', type: 'text', text: 'Add a knit mustard yellow infinity scarf to both men.' },
        { out: CF + '4_replace_man/output_video.mp4', poster: AIP + '7coffee-4_replace_man.jpg', type: 'image', pairs: [{ orig: AIP + '7coffee-orig-320.jpg', img: CF + '4_replace_man/edited_frame_320.jpg' }] },
        { out: CF + '5_style/output_video.mp4', poster: AIP + '7coffee-5_style.jpg', type: 'text', text: 'Apply the style of flat vector — solid colors, geometric shapes, no shadows, minimalist 2D appearance — to the entire scene.' },
      ],
    },
    {
      input: AIP + '8company-input-audio.mp4', inputPoster: AIP + '8company-input.jpg', sound: true,
      edits: [
        { out: CO + '1_remove/output_video.mp4', poster: AIP + '8company-1_remove.jpg', type: 'text', text: 'Remove the man in a light beige leather jacket.' },
        { out: CO + '2_man_outfit/output_video.mp4', poster: AIP + '8company-2_man_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '8company-orig-136.jpg', img: CO + '2_man_outfit/edited_frame_136.jpg' }] },
        { out: CO + '3_man_old/output_video.mp4', poster: AIP + '8company-3_man_old.jpg', type: 'image', pairs: [{ orig: AIP + '8company-orig-176.jpg', img: CO + '3_man_old/edited_frame_176.jpg' }] },
        { out: CO + '4_man_woman/output_video.mp4', poster: AIP + '8company-4_man_woman.jpg', type: 'image', pairs: [{ orig: AIP + '8company-orig-328.jpg', img: CO + '4_man_woman/edited_frame_328.jpg' }] },
        { out: CO + '5_snow/output_video.mp4', poster: AIP + '8company-5_snow.jpg', type: 'text', text: 'Change the scene environment to dense snowfall with large visible drifting snowflakes and a frozen wintry atmosphere.' },
      ],
    },
    {
      input: AIP + '1squid-input-audio.mp4', inputPoster: AIP + '1squid-input.jpg', sound: true,
      edits: [
        { out: SQ + '1_remove_man_green/output_video.mp4', poster: AIP + '1squid-1_remove_man_green.jpg', type: 'text', text: 'Remove the man in a green athletic uniform.' },
        { out: SQ + '2_remove_man_purple/output_video.mp4', poster: AIP + '1squid-2_remove_man_purple.jpg', type: 'image', pairs: [{ orig: AIP + '1squid-orig-48.jpg', img: SQ + '2_remove_man_purple/edited_frrame_48.jpg' }] },
        { out: SQ + '3_add_cycling_helmet/output_video.mp4', poster: AIP + '1squid-3_add_cycling_helmet.jpg', type: 'image', pairs: [{ orig: AIP + '1squid-orig-200.jpg', img: SQ + '3_add_cycling_helmet/edited_frame_200.jpg' }] },
        { out: SQ + '4_another_man/output_video.mp4', poster: AIP + '1squid-4_another_man.jpg', type: 'image', pairs: [{ orig: AIP + '1squid-orig-208.jpg', img: SQ + '4_another_man/edited_frame_208.jpg' }] },
        { out: SQ + '5_foggy/output_video.mp4', poster: AIP + '1squid-5_foggy.jpg', type: 'text', text: 'Change the scene environment to dim, eerie nocturnal fog with cold bluish ambient light.' },
      ],
    },
    {
      input: AIP + '9sing-input-audio.mp4', inputPoster: AIP + '9sing-input.jpg', sound: true,
      edits: [
        { out: WS + '1_remove/output_video.mp4', poster: AIP + '9sing-1_remove.jpg', type: 'text', text: 'Remove the woman in a green sequin dress.' },
        { out: WS + '2_outfit/output_video.mp4', poster: AIP + '9sing-2_outfit.jpg', type: 'image', pairs: [{ orig: AIP + '9sing-orig-248.jpg', img: WS + '2_outfit/edited_frame_248.jpg' }] },
        { out: WS + '3_outfit/output_video.mp4', poster: AIP + '9sing-3_outfit.jpg', type: 'text', text: 'Change the appearance of the woman in a green sequin dress to match a grey business blazer.' },
        { out: WS + '4_hair/output_video.mp4', poster: AIP + '9sing-4_hair.jpg', type: 'image', pairs: [{ orig: AIP + '9sing-orig-136.jpg', img: WS + '4_hair/edited_frame_136.jpg' }] },
        { out: WS + '5_style/output_video.mp4', poster: AIP + '9sing-5_style.jpg', type: 'image', pairs: [{ orig: AIP + '9sing-orig-136.jpg', img: WS + '5_style/edited_frame_136.jpg' }] },
      ],
    },
    {
      input: AIP + '10monster-input-audio.mp4', inputPoster: AIP + '10monster-input.jpg', sound: true,
      edits: [
        { out: WM + '1_remove/output_video.mp4', poster: AIP + '10monster-1_remove.jpg', type: 'text', text: 'Remove the woman in pink hair.' },
        { out: WM + '2_red-dress/output_video.mp4', poster: AIP + '10monster-2_red-dress.jpg', type: 'image', pairs: [{ orig: AIP + '10monster-orig-160.jpg', img: WM + '2_red-dress/edited_frame_160.jpg' }] },
        { out: WM + '3_blonde/output_video.mp4', poster: AIP + '10monster-3_blonde.jpg', type: 'text', text: 'Change the appearance of the woman in pink hair to match long, wavy golden blonde hair.' },
        { out: WM + '4_woman-black/output_video.mp4', poster: AIP + '10monster-4_woman-black.jpg', type: 'image', pairs: [{ orig: AIP + '10monster-orig-248.jpg', img: WM + '4_woman-black/edited_image_248.jpg' }] },
        { out: WM + '5_night/output_video.mp4', poster: AIP + '10monster-5_night.jpg', type: 'text', text: 'Change the scene environment to deep midnight with heavy moonlight and cool ambient indigo tones.' },
        { out: WM + '6_style/output_video.mp4', poster: AIP + '10monster-6_style.jpg', type: 'image', pairs: [{ orig: AIP + '10monster-orig-136.jpg', img: WM + '6_style/edited_frame_136.jpg' }] },
      ],
    },
    {
      input: AIP + '11subway-input-audio.mp4', inputPoster: AIP + '11subway-input.jpg', sound: true,
      edits: [
        { out: MC + '1_remove-child/output_video.mp4', poster: AIP + '11subway-1_remove-child.jpg', type: 'text', text: 'Remove the child.' },
        { out: MC + '2_black-texture-man/output_video.mp4', poster: AIP + '11subway-2_black-texture-man.jpg', type: 'image', pairs: [{ orig: AIP + '11subway-orig-400.jpg', img: MC + '2_black-texture-man/edited_frame_400.png' }] },
        { out: MC + '3_black/output_video.mp4', poster: AIP + '11subway-3_black.jpg', type: 'image', pairs: [{ orig: AIP + '11subway-orig-144.jpg', img: MC + '3_black/edited_frame_144.jpg' }] },
        { out: MC + '4_background/output_video.mp4', poster: AIP + '11subway-4_background.jpg', type: 'text', text: 'Change the appearance of the floor to match a green grass lawn.' },
        { out: MC + '5_light/output_video.mp4', poster: AIP + '11subway-5_light.jpg', type: 'image', pairs: [{ orig: AIP + '11subway-orig-336.jpg', img: MC + '5_light/edited_frame_336.jpg' }] },
      ],
    },
  ]);
})();
