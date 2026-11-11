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
    if (btn.querySelector('.rd-guide')) return;
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
    ? { tap: 'Tap — the word will join', done: 'Word joined' }
    : { tap: 'Коснись — слово соберётся', done: 'Слово собрано' };

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
      const knot = document.createElement('span'); knot.className = 'rd-knot'; knot.setAttribute('aria-hidden', 'true');
      card.appendChild(knot);
      const hint = document.createElement('span');
      hint.className = 'rd-word-hint';
      const hintText = document.createElement('span');
      const sakura = document.createElement('span'); sakura.className = 'rd-sakura'; sakura.setAttribute('aria-hidden', 'true');
      hint.append(hintText, sakura);
      card.appendChild(hint);
      const setJoined = on => {
        card.classList.toggle('rd-joined', on);
        card.setAttribute('aria-pressed', String(on));
        hintText.textContent = on ? T.done : T.tap;
      };
      const petals = () => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        for (let i = 0; i < 7; i++) {
          const p = document.createElement('i'); p.className = 'rd-petal';
          p.style.setProperty('--x', `${30 + Math.random() * 40}%`);
          p.style.setProperty('--y', `${30 + Math.random() * 30}%`);
          p.style.setProperty('--dx', `${(Math.random() - .5) * 180}px`);
          p.style.setProperty('--dy', `${-30 - Math.random() * 60}px`);
          p.style.setProperty('--rot', `${(Math.random() - .5) * 540}deg`);
          p.style.animationDelay = `${Math.random() * .2}s`;
          card.appendChild(p);
          setTimeout(() => p.remove(), 2000);
        }
      };
      setJoined(false);
      const toggle = () => {
                const on = !card.classList.contains('rd-joined');
        setJoined(on); if (on) petals(); unlockIfDone();
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

/* ---------- Глава 1: ответ «огоньком» — верный летит и зажигает основной ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  const FLAME = 'hoshi_flame_icon_v1.webp';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.answer').forEach(a => {
    if (a.querySelector('.rd-afl')) return;
    const f = document.createElement('span'); f.className = 'rd-afl'; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<img src="' + FLAME + '" alt="">';
    a.prepend(f);
  });
  const ch1 = () => document.body.dataset.rdChapter === '1';
  document.addEventListener('click', e => {
    const a = e.target.closest('.answer');
    if (!a) return;
    // движок уже обработал клик (наш скрипт подключён после него)
    requestAnimationFrame(() => {
      if (!a.classList.contains('correct-choice')) return;
      const q = a.closest('.question') || a.closest('.page');
      const next = q?.querySelector('.next') || a.closest('.page')?.querySelector('.next');
      const target = next?.querySelector('.rd-guide');
      if (!next || !target || reduce) return;
      next.classList.add('rd-wait');
      const from = a.querySelector('.rd-afl').getBoundingClientRect();
      setTimeout(() => {
        const to = target.getBoundingClientRect();
        const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
        const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
        const fly = document.createElement('img'); fly.src = document.body.dataset.rdChapter === '2' ? 'hoshi_paw_up_v1.svg' : FLAME; fly.className = 'rd-flyer'; fly.alt = '';
        fly.style.left = fx + 'px'; fly.style.top = fy + 'px';
        document.body.appendChild(fly);
        a.classList.add('rd-sent');
        // плавная дуга с лёгким покачиванием, как у парящего огонька
        const cx = fx + (tx - fx) * 0.15, cy = fy + (ty - fy) * 0.55; // без подскока: сразу плавно вниз
        const frames = [], N = 30;
        for (let i = 0; i <= N; i++) {
          const t = i / N, u = 1 - t;
          const x = u * u * fx + 2 * u * t * cx + t * t * tx + Math.sin(t * Math.PI * 2) * 5 * u;
          const y = u * u * fy + 2 * u * t * cy + t * t * ty;
          const sc = 1 + 0.12 * t;
          frames.push({ transform: `translate(${x - fx}px,${y - fy}px) scale(${sc.toFixed(3)}) rotate(${(Math.sin(t * Math.PI * 3) * 4).toFixed(1)}deg)` });
        }
        const anim = fly.animate(frames, { duration: 1400, easing: 'cubic-bezier(.45,.05,.3,1)' });
        anim.onfinish = () => {
          fly.remove();
          next.classList.remove('rd-wait'); next.classList.add('rd-ignite');
          setTimeout(() => next.classList.remove('rd-ignite'), 1000);
        };
      }, 550);
    });
  });
})();

/* ---------- Глава 1, экран 5: у каждого искомого слова — свой огонёк ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  document.querySelectorAll('.search-target').forEach(t => {
    if (t.querySelector('.rd-tfl')) return;
    const f = document.createElement('span'); f.className = 'rd-tfl'; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<img src="hoshi_flame_icon_v1.webp" alt="">';
    t.prepend(f);
  });
  const FLAME = 'hoshi_flame_icon_v1.webp';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fly = (fromEl, toEl, delay, done) => setTimeout(() => {
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const fx = a.left + a.width / 2, fy = a.top + a.height / 2, tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    const el = document.createElement('img'); el.src = document.body.dataset.rdChapter === '2' ? 'hoshi_paw_up_v1.svg' : FLAME; el.className = 'rd-flyer'; el.alt = '';
    el.style.left = fx + 'px'; el.style.top = fy + 'px'; document.body.appendChild(el);
    fromEl.classList.add('rd-gone');
    const cx = fx + (tx - fx) * 0.15, cy = fy + (ty - fy) * 0.55, frames = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, u = 1 - t;
      const x = u * u * fx + 2 * u * t * cx + t * t * tx + Math.sin(t * Math.PI * 2) * 5 * u;
      const y = u * u * fy + 2 * u * t * cy + t * t * ty;
      frames.push({ transform: `translate(${x - fx}px,${y - fy}px) scale(${(1 + 0.12 * t).toFixed(3)})`, opacity: t > .9 ? (1 - t) * 10 : 1 });
    }
    el.animate(frames, { duration: 1400, easing: 'cubic-bezier(.45,.05,.3,1)' }).onfinish = () => { el.remove(); done && done(); };
  }, delay);
  // когда все слова найдены — огоньки слетаются к главному и зажигают его
  document.addEventListener('click', e => {
    const hunt = e.target.closest('[data-word-hunt]');
    if (!hunt) return;
    const screen = hunt.closest('[data-screen]'), next = screen?.querySelector('.next');
    const targets = [...(screen?.querySelectorAll('.search-target') || [])];
    if (!next || !targets.length || screen.dataset.rdFlown) return;
    requestAnimationFrame(() => {
      if (!targets.every(t => t.classList.contains('found'))) return;
      screen.dataset.rdFlown = '1';
      const goal = next.querySelector('.rd-guide');
      if (reduce || !goal) return;
      next.classList.add('rd-wait');
      targets.forEach((t, i) => fly(t.querySelector('.rd-tfl'), goal, 700 + i * 160, i === targets.length - 1 ? () => {
        next.classList.remove('rd-wait'); next.classList.add('rd-ignite');
        setTimeout(() => next.classList.remove('rd-ignite'), 1000);
      } : null));
    });
  });
  // все слова уже найдены (вернулись к экрану или перезагрузили) — маленьких огоньков нет
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-word-hunt]');
    if (h) h.closest('[data-screen]').dataset.rdLive = '1';
  }, true);
  const hideIfDone = () => document.querySelectorAll('[data-word-hunt]').forEach(h => {
    const sc = h.closest('[data-screen]');
    if (!sc || sc.dataset.rdLive) return;
    const t = [...sc.querySelectorAll('.search-target')];
    if (t.length && t.every(x => x.classList.contains('found')))
      sc.querySelectorAll('.rd-tfl:not(.rd-gone)').forEach(f => f.classList.add('rd-gone'));
  });
  hideIfDone();
  const mo = new MutationObserver(hideIfDone);
  document.querySelectorAll('[data-word-hunt]').forEach(h => {
    const sc = h.closest('[data-screen]');
    if (sc) mo.observe(sc, { attributes: true, attributeFilter: ['hidden'] });
    sc?.querySelectorAll('.search-target').forEach(t => mo.observe(t, { attributes: true, attributeFilter: ['class'] }));
  });
})();

/* ---------- Глава 1, финал: подпись огонька в таблетке, текст пояснений в span ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  document.querySelectorAll('.next[data-reward]').forEach(btn => {
    if (btn.querySelector('.rd-pill')) return;
    const texts = [...btn.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    if (!texts.length) return;
    const pill = document.createElement('span'); pill.className = 'rd-pill';
    pill.textContent = texts.map(t => t.textContent.trim()).join(' ');
    texts.forEach(t => t.remove()); btn.appendChild(pill);
  });
  document.querySelectorAll('.meaning-note p').forEach(p => {
    if (p.querySelector(':scope>span')) return;
    const span = document.createElement('span');
    while (p.firstChild) span.appendChild(p.firstChild);
    p.appendChild(span);
  });
})();

/* ---------- Награда: цепочка синих следов у перехода дальше ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  document.querySelectorAll('.inari-reward:not(.ponta-reward):not(.echo-reward) .reward-continue, [data-chapter="2"] .next').forEach(btn => {
    const guide = btn.querySelector('.rd-guide');
    if (!guide || guide.querySelector('.rd-steps')) return;
    const steps = document.createElement('span'); steps.className = 'rd-steps';
    steps.innerHTML = '<i></i><i></i><i></i><i></i>';
    guide.appendChild(steps);
  });
  let lang = 'ru'; try { lang = localStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  if (lang === 'en') document.body.classList.add('rd-en');
})();

/* ---------- Награда главы 1: пока тайны не раскрыты — подсказка вместо перехода ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  let lang = 'ru'; try { lang = localStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  document.querySelectorAll('.inari-reward:not(.echo-reward) .inari-complete').forEach(done => {
    if (done.parentElement.querySelector('.rd-locked')) return;
    const p = document.createElement('p'); p.className = 'rd-locked';
    const ponta = done.closest('.ponta-reward');
    p.textContent = lang === 'en' ? (ponta ? 'Open all four tanuki secrets to continue the journey.' : 'Open all four secrets of Inari to continue the journey.') : (ponta ? 'Открой все четыре секрета тануки — и сможешь продолжить путь.' : 'Открой все четыре тайны Инари — и сможешь продолжить путь.');
    done.after(p);
  });
})();

/* ---------- Глава 2: когда путь открыт, движок перерисовывает кнопку — возвращаем следы ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  const ensure = btn => {
    if (btn.querySelector('.rd-steps')) return;
    let g = btn.querySelector('.rd-guide');
    if (!g) {
      g = document.createElement('span'); g.className = 'rd-guide'; g.setAttribute('aria-hidden', 'true');
      g.innerHTML = '<span class="rd-glow"></span><img src="hoshi_flame_icon_v1.webp" alt="">';
      btn.prepend(g);
    }
    const st = document.createElement('span'); st.className = 'rd-steps';
    st.innerHTML = '<i></i><i></i><i></i><i></i>';
    g.appendChild(st);
  };
  document.querySelectorAll('[data-chapter="2"] .next').forEach(btn => {
    ensure(btn);
    new MutationObserver(() => ensure(btn)).observe(btn, { childList: true });
  });
})();

/* ---------- Следы: по очереди синеют 1, 2, 3, 4, держатся и снова белеют (скриптом — работает везде) ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  const prep = () => document.querySelectorAll('.rd-steps i').forEach(i => { if (!i.querySelector('b')) i.appendChild(document.createElement('b')); });
  let step = 0;
  setInterval(() => {
    prep();
    step = (step + 1) % 7;               // 0 — все белые, 1..4 — по очереди синеют, 5..6 — все синие
    document.querySelectorAll('.rd-steps').forEach(row => {
      [...row.children].forEach((i, k) => i.classList.toggle('on', k < step));
    });
  }, 600);
})();

/* ---------- Награда главы 2: пока секреты не открыты — подсказка вместо перехода ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  let lang = 'ru'; try { lang = localStorage.getItem('hoshi-language-choice') || 'ru'; } catch (e) {}
  document.querySelectorAll('.tracker-reward [data-tracker-prize]').forEach(prize => {
    if (prize.parentElement.querySelector('.rd-locked')) return;
    const p = document.createElement('p'); p.className = 'rd-locked';
    p.textContent = lang === 'en' ? 'Open all three secrets to continue the journey.' : 'Открой все три секрета — и сможешь продолжить путь.';
    prize.after(p);
  });
})();

/* ---------- Награда главы 2: искры при открытии секрета и знак из трёх лапок ---------- */
(() => {
  'use strict';
  if (!document.body.classList.contains('rd')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.tracker-reward [data-tracker-prize]').forEach(prize => {
    if (prize.querySelector('.rd-sign')) return;
    const sign = document.createElement('span'); sign.className = 'rd-sign'; sign.setAttribute('aria-hidden', 'true');
    sign.innerHTML = '<i></i><i></i><i></i>';
    prize.prepend(sign);
  });
  const burst = (host, n) => {
    if (reduce) return;
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i'); s.className = 'rd-tspark' + (k % 3 ? ' star' : '');
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
      s.style.setProperty('--x', `${35 + Math.random() * 30}%`); s.style.setProperty('--y', `${35 + Math.random() * 30}%`);
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d * .7 - 40}px`);
      s.style.setProperty('--rot', `${(Math.random() - .5) * 120}deg`);
      s.style.animationDelay = `${.25 + Math.random() * .3}s`;
      host.appendChild(s); setTimeout(() => s.remove(), 2400);
    }
  };
  document.addEventListener('click', e => {
    const card = e.target.closest('.tracker-token');
    if (!card) return;
    requestAnimationFrame(() => { if (card.classList.contains('lit') && !card.dataset.rdBurst) { card.dataset.rdBurst = '1'; burst(card, 22); } });
  });
})();
