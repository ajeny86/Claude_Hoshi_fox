/*
  iHoshi — редизайн экрана карты (ноябрь 2026).
  Ничего не меняет в движке глав: читает тот же сохранённый прогресс
  и по нему рисует огоньки, следы и полоску «Ты здесь».
*/
(() => {
  'use strict';
  const mapHome = document.querySelector('[data-map-home]');
  if (!mapHome || !document.body.classList.contains('rd')) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lang = 'ru';
  try { lang = localStorage.getItem('hoshi-language-choice') || sessionStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  const en = lang === 'en';

  /* ---------- Тексты ---------- */
  const T = en ? {
    part1: 'Part 1', part1name: 'Japanese Spirits', part1info: '4 chapters · you are here',
    part2name: 'Japanese Traditions', part2info: 'Hanami, Tanabata, Tsukimi', parts: 'Journey parts',
    continue: 'Continue reading', start: 'Start reading',
    here: (s, n) => `You are here · screen ${s} of ${n}`, done: 'Journey complete',
    chapter: n => `Chapter ${n}`, guide: 'Guide for parents', rowDone: 'Completed', rowAhead: 'Ahead'
  } : {
    part1: 'Часть 1', part1name: 'Японские духи', part1info: '4 главы · ты здесь',
    part2name: 'Японские традиции', part2info: 'Ханами, Танабата, Цукими', parts: 'Части путешествия',
    continue: 'Продолжить чтение', start: 'Начать чтение',
    here: (s, n) => `Ты здесь · экран ${s} из ${n}`, done: 'Путешествие пройдено',
    chapter: n => `Глава ${n}`, guide: 'Памятка для родителей', rowDone: 'Пройдена', rowAhead: 'Впереди'
  };
  const TITLES = en
    ? { 1: 'Temple of the White Foxes', 2: 'Tracks in the Snow', 3: 'The Forest Mystery', 4: 'The Valley of Mist' }
    : { 1: 'Храм белых лис', 2: 'Следы на снегу', 3: 'Лесная загадка', 4: 'Долина туманов' };
  const SCREENS = { 1: 6, 2: 7, 3: 7, 4: 6 };
  document.querySelectorAll('[data-rd-text]').forEach(el => {
    const value = T[el.dataset.rdText];
    if (typeof value === 'string') el.textContent = value;
  });
  document.getElementById('rd-guide')?.setAttribute('aria-label', T.guide);

  /* ---------- Прогресс из того же хранилища, что и у движка ---------- */
  const STORE = en ? 'hoshi-unified-chapters-v1-en' : 'hoshi-unified-chapters-v1';
  const SEEN = `hoshi-redesign-lit-${lang}`;
  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null') || {}; } catch (e) { return {}; }
  };
  const isDone = (st, id) => Boolean(st.chapters?.[id]?.completed || st.chapters?.[id]?.reward);
  const readSeen = () => {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch (e) { return new Set(); }
  };
  const writeSeen = set => { try { localStorage.setItem(SEEN, JSON.stringify([...set])); } catch (e) {} };

  /* Следующая глава путешествия: первая непройденная */
  const nextChapter = st => [1, 2, 3, 4].find(id => !isDone(st, id)) || 0;

  /* ---------- Следы между главами (координаты в пикселях карты 1672×941) ---------- */
  const IW = 1672, IH = 941;
  const ROUTES = {
    1: [[268, 508], [244, 540], [252, 576], [296, 604], [348, 628]],
    2: [[862, 578], [898, 532], [922, 484], [938, 446]],
    3: [[1196, 428], [1232, 452], [1214, 496], [1174, 530], [1168, 574], [1188, 610]]
  };
  const PAW = '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15.5" rx="5" ry="4.3"/><ellipse cx="5.6" cy="9.6" rx="2" ry="2.6" transform="rotate(-18 5.6 9.6)"/><ellipse cx="9.6" cy="6" rx="2.1" ry="2.8" transform="rotate(-6 9.6 6)"/><ellipse cx="14.4" cy="6" rx="2.1" ry="2.8" transform="rotate(6 14.4 6)"/><ellipse cx="18.4" cy="9.6" rx="2" ry="2.6" transform="rotate(18 18.4 9.6)"/></svg>';
  const spline = (pts, steps) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  };
  const trail = document.getElementById('rd-trail');
  Object.entries(ROUTES).forEach(([route, pts]) => {
    const line = spline(pts, 20), acc = [0];
    for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const total = acc[acc.length - 1], n = Math.max(2, Math.floor(total / 30));
    let j = 0;
    for (let k = 1; k <= n; k++) {
      const d = k * total / (n + 0.5);
      while (j < acc.length - 2 && acc[j + 1] < d) j++;
      const a = line[j], b = line[j + 1], f = (d - acc[j]) / ((acc[j + 1] - acc[j]) || 1);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), side = (k % 2 ? 1 : -1) * 7;
      const x = a[0] + (b[0] - a[0]) * f - Math.sin(ang) * side, y = a[1] + (b[1] - a[1]) * f + Math.cos(ang) * side;
      const paw = document.createElement('span');
      paw.className = 'rd-paw';
      paw.dataset.route = route;
      paw.innerHTML = PAW;
      paw.style.left = `${x / IW * 100}%`;
      paw.style.top = `${y / IH * 100}%`;
      paw.style.setProperty('--r', `${ang * 180 / Math.PI + 90}deg`);
      trail?.appendChild(paw);
    }
  });

  /* ---------- Анимации ---------- */
  const sparkle = host => {
    if (reduce || !host) return;
    const burst = document.createElement('span'); burst.className = 'rd-burst'; host.appendChild(burst);
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('i'); s.className = 'rd-spark';
      s.style.setProperty('--a', `${i * 36 + Math.random() * 14}deg`);
      s.style.setProperty('--d', `${-38 - Math.random() * 26}px`);
      s.style.animationDelay = `${Math.random() * 0.15}s`;
      host.appendChild(s);
    }
    setTimeout(() => host.querySelectorAll('.rd-burst,.rd-spark').forEach(e => e.remove()), 1400);
  };
  const walk = (route, onEnd) => {
    const paws = [...document.querySelectorAll(`.rd-paw[data-route="${route}"]`)];
    paws.forEach((p, k) => {
      if (reduce) { p.classList.add('lit'); return; }
      setTimeout(() => p.classList.add('walk'), (k + 1) * 170);
    });
    setTimeout(onEnd, reduce ? 0 : paws.length * 170 + 300);
  };

  /* ---------- Обновление карты ---------- */
  const stop = id => mapHome.querySelector(`[data-map-chapter="${id}"]`);
  const refresh = () => {
    const st = readState(), seen = readSeen(), next = nextChapter(st);

    // огонёк текущей и подсветка
    [1, 2, 3, 4].forEach(id => stop(id)?.classList.toggle('rd-current', id === next));

    // следы: уже виденные — горят спокойно; новые — с анимацией
    const fresh = [];
    [1, 2, 3, 4].forEach(id => {
      const done = isDone(st, id);
      if (done && !seen.has(id)) fresh.push(id);
      document.querySelectorAll(`.rd-paw[data-route="${id}"]`).forEach(p => {
        p.classList.remove('walk');
        p.classList.toggle('lit', done && seen.has(id));
      });
    });
    fresh.forEach((id, i) => {
      const s = stop(id), fx = s?.querySelector('.rd-fx');
      setTimeout(() => {
        s?.classList.remove('rd-igniting'); void s?.offsetWidth; s?.classList.add('rd-igniting');
        sparkle(fx);
        setTimeout(() => walk(id, () => {
          const nx = stop(id + 1);
          if (nx && id + 1 === next) { nx.classList.remove('rd-beckon'); void nx.offsetWidth; nx.classList.add('rd-beckon'); }
        }), reduce ? 0 : 900);
      }, reduce ? 0 : 450 + i * 300);
      seen.add(id);
    });
    if (fresh.length) writeSeen(seen);

    // список глав (вертикальный экран)
    [1, 2, 3, 4].forEach(id => {
      const row = mapHome.querySelector(`[data-rd-row="${id}"]`), small = mapHome.querySelector(`[data-rd-row-s="${id}"]`);
      if (!row) return;
      const done = isDone(st, id), cur = id === next;
      row.classList.toggle('rd-current', cur);
      row.classList.toggle('rd-done', done);
      row.querySelector('strong').textContent = TITLES[id];
      const max = Number(st.chapters?.[id]?.max) || 1;
      small.textContent = done ? T.rowDone : cur ? T.here(Math.min(max, SCREENS[id]), SCREENS[id]) : T.rowAhead;
    });

    // полоска «Ты здесь»
    const hereS = document.getElementById('rd-here-s'), hereT = document.getElementById('rd-here-t'), go = document.getElementById('rd-go');
    if (next) {
      const max = Math.max(1, Math.min(SCREENS[next], Number(st.chapters?.[next]?.max) || 1));
      hereS.textContent = T.here(max, SCREENS[next]);
      hereT.textContent = `${T.chapter(next)} · ${TITLES[next]}`;
      go.textContent = max > 1 ? T.continue : T.start;
      go.dataset.rdChapter = String(next);
      go.hidden = false;
    } else {
      hereS.textContent = T.done;
      hereT.textContent = `${T.part1} · ${T.part1name}`;
      go.hidden = true;
    }
  };

  document.getElementById('rd-go')?.addEventListener('click', e => {
    stop(e.currentTarget.dataset.rdChapter || 1)?.click();
  });
  mapHome.querySelectorAll('[data-rd-row]').forEach(row => row.addEventListener('click', () => stop(row.dataset.rdRow)?.click()));
  document.getElementById('rd-guide')?.addEventListener('click', () => {
    document.querySelector('[data-parent-guide-open]')?.click();
  });

  /* ---------- Список частей ---------- */
  const partBtn = document.getElementById('rd-part-btn'), partPop = document.getElementById('rd-part-pop');
  const closeParts = () => { partPop.hidden = true; partBtn.setAttribute('aria-expanded', 'false'); };
  partBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const open = partPop.hidden;
    partPop.hidden = !open;
    partBtn.setAttribute('aria-expanded', String(open));
    if (open) partPop.querySelector('a,[aria-current]')?.focus?.();
  });
  document.addEventListener('click', e => { if (!partPop.hidden && !partPop.contains(e.target)) closeParts(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !partPop.hidden) { closeParts(); partBtn.focus(); } });

  /* Обновляем карту каждый раз, когда движок её показывает */
  const run = () => { if (!mapHome.hidden) requestAnimationFrame(refresh); };
  new MutationObserver(run).observe(mapHome, { attributes: true, attributeFilter: ['hidden'] });
  run();
})();

/* ---------- Шаг 2: экраны глав ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lang = 'ru';
  try { lang = localStorage.getItem('hoshi-language-choice') || sessionStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  document.body.dataset.rdLang = lang;

  // Кнопка «Карта» в верхней панели (нажимает существующую кнопку движка)
  const inner = document.querySelector('.top-inner');
  const listBtn = document.querySelector('[data-chapter-list]');
  if (inner && listBtn && !document.querySelector('.rd-map-btn')) {
    const left = document.createElement('div'); left.className = 'rd-top-left';
    const mapBtn = document.createElement('button');
    mapBtn.type = 'button'; mapBtn.className = 'rd-map-btn';
    mapBtn.setAttribute('aria-label', lang === 'en' ? 'Back to the map' : 'К карте');
    mapBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg><span>' + (lang === 'en' ? 'Map' : 'Карта') + '</span>';
    mapBtn.addEventListener('click', () => document.querySelector('[data-open-map]')?.click());
    inner.insertBefore(left, inner.firstChild);
    left.appendChild(mapBtn);
    left.appendChild(listBtn);
  }

  // Подложка под текущую главу
  const chapters = [...document.querySelectorAll('section.chapter[data-chapter]')];
  const syncChapter = () => {
    const open = chapters.find(c => !c.hidden);
    if (open) document.body.dataset.rdChapter = open.dataset.chapter; else delete document.body.dataset.rdChapter;
  };
  chapters.forEach(c => new MutationObserver(syncChapter).observe(c, { attributes: true, attributeFilter: ['hidden'] }));
  syncChapter();

  // Слоги через тире
  document.querySelectorAll('.word-parts,.syllable-parts').forEach(el => {
    if (el.dataset.rdDashed) return;
    const parts = el.textContent.split(/\s*·\s*/);
    if (parts.length < 2) return;
    el.dataset.rdDashed = '1';
    el.textContent = '';
    parts.forEach((p, i) => {
      el.append(p);
      if (i < parts.length - 1) { const d = document.createElement('span'); d.className = 'rd-dash'; d.textContent = '–'; el.append(d); }
    });
  });

  // Огонёк-проводник: картинка и мягкое сияние внутри каждой кнопки «дальше»
  const FLAME = 'hoshi_flame_icon_v1.webp';
  const addGuide = btn => {
    if (btn.classList.contains('opened') || btn.querySelector('.rd-guide')) return;
    const g = document.createElement('span'); g.className = 'rd-guide'; g.setAttribute('aria-hidden', 'true');
    g.innerHTML = '<span class="rd-glow"></span><img src="' + FLAME + '" alt="">';
    btn.prepend(g);
  };
  document.querySelectorAll('.next').forEach(addGuide);

  // Вспышка огонька при касании «дальше»
  document.addEventListener('click', e => {
    const btn = e.target.closest('.next');
    if (!btn || btn.classList.contains('opened') || reduce) return;
    btn.classList.remove('rd-going'); void btn.offsetWidth; btn.classList.add('rd-going');
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('i'); s.className = 'rd-spark';
      s.style.left = '50%'; s.style.top = '50px';
      s.style.setProperty('--a', `${i * 36 + Math.random() * 14}deg`);
      s.style.setProperty('--d', `${-40 - Math.random() * 26}px`);
      btn.appendChild(s);
    }
    setTimeout(() => { btn.classList.remove('rd-going'); btn.querySelectorAll('.rd-spark').forEach(x => x.remove()); }, 900);
  }, true);
})();

/* ---------- Глава 1, экран 2: собери слова из слогов, чтобы открыть путь ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  let lang = 'ru';
  try { lang = localStorage.getItem('hoshi-language-choice') || sessionStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  const T = lang === 'en'
    ? { tap: 'tap to join the parts', done: 'word joined' }
    : { tap: 'коснись — слово соберётся', done: 'слово собрано' };

  document.querySelectorAll('.word-cards').forEach(box => {
    const page = box.closest('.page');
    const next = page?.querySelector('.next[data-next]');
    const cards = [...box.querySelectorAll('.word-card')];
    if (!cards.length) return;
    const passed = () => next?.classList.contains('opened');

    const unlockIfDone = () => {
      if (!next || passed()) return;
      if (cards.every(c => c.classList.contains('rd-joined'))) next.classList.add('ready');
    };

    cards.forEach(card => {
      card.classList.add('rd-word');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      const whole = card.querySelector('strong')?.textContent.trim() || '';
      card.setAttribute('aria-label', whole);
      const hint = document.createElement('span');
      hint.className = 'rd-word-hint';
      hint.textContent = T.tap;
      card.appendChild(hint);
      const seal = document.createElement('span'); seal.className = 'rd-seal'; seal.setAttribute('aria-hidden', 'true'); seal.textContent = '✓';
      card.appendChild(seal);
      const setJoined = on => {
        card.classList.toggle('rd-joined', on);
        card.setAttribute('aria-pressed', String(on));
        hint.textContent = on ? T.done : T.tap;
      };
      setJoined(false);
      const toggle = () => {
        card.classList.remove('rd-swing'); void card.offsetWidth; card.classList.add('rd-swing');
        setJoined(!card.classList.contains('rd-joined')); unlockIfDone();
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      card._rdSetJoined = setJoined;
    });

    // Если экран уже пройден — слова собраны; иначе путь закрыт, пока слова не собраны
    const sync = () => {
      if (passed()) cards.forEach(c => c._rdSetJoined(true));
      else if (!cards.every(c => c.classList.contains('rd-joined'))) next?.classList.remove('ready');
    };
    sync();
    if (next) new MutationObserver(() => { if (passed()) cards.forEach(c => c._rdSetJoined(true)); }).observe(next, { attributes: true, attributeFilter: ['class'] });
    if (page) new MutationObserver(sync).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  });
})();
