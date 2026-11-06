// ============================================================
//  UI v2 · mobile-first оболочка: «Сегодня», «Курс», урок из 4 шагов,
//  «Ещё», настройки, лимит новых карточек, резервная копия.
// ============================================================

// ---------- иконки (единый набор, 24×24, обводка) ----------
const ICONS = {
  today: '<path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  course: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 7h7M9 11h5"/>',
  review: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  reader: '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
const ic = (name, size = 22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------- навигация ----------
const NAV = [['home', 'Сегодня', 'today'], ['course', 'Курс', 'course'], ['review', 'Повтор', 'review'], ['reader', 'Читалка', 'reader'], ['more', 'Ещё', 'more']];
const SECTION_OF = { home: 'home', course: 'course', lesson: 'course', practice: 'course', drill: 'course', alphabet: 'course', review: 'review', reader: 'reader', more: 'more', phrasebook: 'more', numbers: 'more', method: 'more', settings: 'more' };
function renderNav() {
  const html = NAV.map(([k, n, i]) => `<a href="#${k}" data-nav="${k}">${ic(i)}<span>${n}</span>${k === 'review' ? '<b class="nav-badge" id="dueBadge"></b>' : ''}</a>`).join('');
  $('.tabbar').innerHTML = html; $('.sidenav').innerHTML = html;
}
renderNav();

// ---------- лимит новых карточек ----------
const newLimit = () => S.newLimit || 15;
const newLeftToday = () => Math.max(0, newLimit() - (S.newDay === today() ? (S.newCount || 0) : 0));
function dueQueue() {
  const now = Date.now(); const rev = [], fresh = [];
  for (const [id, c] of Object.entries(S.srs)) { if (!ITEMS[id] || c.due > now) continue; (c.seen || c.r > 0 ? rev : fresh).push(id); }
  return [...rev, ...fresh.slice(0, newLeftToday())];
}
const dueCount = () => dueQueue().length;
function updateHeader() {
  const d = dueCount();
  $$('#dueBadge, .nav-badge').forEach(b => b.textContent = d ? (d > 99 ? '99+' : d) : '');
  const st = $('#streak'); if (st) st.textContent = '🔥 ' + (S.streak.count || 0);
  document.body.classList.toggle('hide-tr', !S.translit);
}
// постоянное хранилище (Safari иначе может стереть данные)
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- роутер ----------
const LEGACY_TAB = { words: ['learn', 'words'], phrases: ['learn', 'phrases'], dialogue: ['learn', 'dialogue'], vocab: ['learn', 'vocab'], grammar: ['understand'], practice: ['train'], drills: ['train'], mission: ['apply'] };
function route() {
  keyHandler = null; stopSpeech();
  const parts = (location.hash.slice(1) || 'home').split('/'); const [p, a, b, c] = parts;
  const views = { home: viewToday, course: viewCourse, alphabet: viewAlphabet, lesson: viewLesson, practice: viewPractice, drill: viewDrill, review: viewReview, phrasebook: viewPhrasebook, numbers: viewNumbers, method: viewMethod, reader: viewReader, more: viewMore, settings: viewSettings };
  document.body.dataset.view = p;
  (views[p] || viewToday)(a, b, c);
  const sec = SECTION_OF[p] || 'home';
  $$('[data-nav]').forEach(l => { const on = l.dataset.nav === sec; l.classList.toggle('active', on); on ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current'); });
  window.scrollTo(0, 0); updateHeader();
}

// ---------- прогресс урока: 4 шага ----------
const STEPS = [['learn', 'Узнать', 'слова, фразы, диалог'], ['understand', 'Понять', 'грамматика'], ['train', 'Тренировать', 'упражнения'], ['apply', 'Применить', 'миссия в жизни']];
function stepDone(L, k) {
  const st = S.lessons[L.id] || {}; const seen = st.seen || {};
  if (k === 'learn') return !!seen.learn; if (k === 'understand') return !!seen.understand;
  if (k === 'train') return lessonDone(L.id); return !!st.m;
}
const lessonSteps = L => STEPS.filter(([k]) => stepDone(L, k)).length;
const lessonComplete = L => lessonSteps(L) === 4;
const nextStep = L => (STEPS.find(([k]) => !stepDone(L, k)) || STEPS[0]);
const alphaDone = () => LETTER_GROUPS.every((g, i) => S.groups[i]);
const alphaCount = () => LETTER_GROUPS.filter((g, i) => S.groups[i]).length;
function currentLesson() { return LESSONS.find(L => !lessonComplete(L)) || LESSONS[LESSONS.length - 1]; }

function ring(pct, size = 64, stroke = 7, label = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--brand)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${label ? `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-t">${label}</text>` : ''}</svg>`;
}
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
function weekStrip() {
  const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayStr(d); out.push(`<div class="wd ${S.days[k] ? 'on' : ''} ${i === 0 ? 'today' : ''}"><i>${S.days[k] ? ic('check', 14) : ''}</i><span>${DOW[d.getDay()]}</span></div>`); }
  return `<div class="week">${out.join('')}</div>`;
}

// ============================================================
//  СЕГОДНЯ
// ============================================================
function viewToday() {
  const goal = S.goal || 30, xpToday = S.days[today()] || 0;
  const due = dueCount();
  const L = currentLesson(); const [nk, nn] = nextStep(L);
  const showAlpha = !alphaDone() && LESSONS.every(x => lessonSteps(x) === 0);
  const tasks = [];
  if (due) tasks.push({ href: '#review', icon: 'review', t: `Повторить ${due} ${plural(due, 'карточку', 'карточки', 'карточек')}`, m: `≈${Math.max(1, Math.round(due * 8 / 60))} мин · самое важное`, done: false });
  else if (Object.keys(S.srs).length) tasks.push({ href: '#review', icon: 'review', t: 'Повторение', m: 'на сегодня всё повторено', done: true });
  if (showAlpha) { const g = LETTER_GROUPS.findIndex((x, i) => !S.groups[i]); tasks.push({ href: `#alphabet/${g}`, icon: 'course', t: `Алфавит: группа ${g + 1} из ${LETTER_GROUPS.length}`, m: LETTER_GROUPS[g].letters.split('').join(' '), done: false, geo: true }); }
  tasks.push({ href: `#lesson/${L.id}/${nk}`, icon: 'course', t: `${L.emoji} ${L.title}: ${nn.toLowerCase()}`, m: `Урок ${L.id} · шаг ${STEPS.findIndex(s => s[0] === nk) + 1} из 4`, done: false });
  const mL = LESSONS.find(x => stepDone(x, 'learn') && !stepDone(x, 'apply')) || L;
  tasks.push({ href: `#lesson/${mL.id}/apply`, icon: 'flag', t: 'Миссия дня', m: mL.mission.split('.')[0] + '.', done: !!(S.lessons[mL.id] || {}).m });
  const first = tasks.find(t => !t.done) || tasks[0];
  const d = new Date();
  app.innerHTML = `
  <div class="page today">
    <header class="page-head">
      <div><div class="eyebrow">${d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1 class="geo-title">გამარჯობა!</h1></div>
    </header>
    <section class="card goal-card">
      ${ring(xpToday / goal, 72, 8, `${Math.min(xpToday, goal)}`)}
      <div class="goal-txt"><b>${xpToday >= goal ? 'Цель дня выполнена 🎉' : `Цель дня: ${goal} очков`}</b><span>${S.streak.count ? `🔥 ${S.streak.count} ${plural(S.streak.count, 'день', 'дня', 'дней')} подряд` : 'Начни серию — заходи каждый день'}</span>${weekStrip()}</div>
    </section>
    <h2 class="sec">План на сегодня</h2>
    <ol class="plan">${tasks.map((t, i) => `<li><a href="${t.href}" class="task ${t.done ? 'done' : ''}"><span class="task-n">${t.done ? ic('check', 18) : i + 1}</span><span class="task-b"><b>${esc(t.t)}</b><small class="${t.geo ? 'geo' : ''}">${esc(t.m)}</small></span>${ic('chev', 18)}</a></li>`).join('')}</ol>
    <a class="btn btn-primary btn-block" href="${first.href}">${tasks.every(t => t.done) ? 'Всё сделано — продолжить урок' : 'Начать занятие'}</a>
    <h2 class="sec">Мой курс</h2>
    ${lessonCard(L, true)}
    <div class="quick">
      <a href="#numbers" class="qtile"><span class="qi">12</span><b>Числа и цены</b></a>
      <a href="#phrasebook" class="qtile"><span class="qi geo">ა</span><b>Разговорник</b></a>
    </div>
  </div>`;
}
function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; }
function lessonCard(L, big) {
  const n = lessonSteps(L);
  return `<a class="card lcard2 ${big ? 'big' : ''} ${n === 4 ? 'done' : ''}" href="#lesson/${L.id}">
    <span class="lc-em">${L.emoji}</span>
    <span class="lc-b"><small>Урок ${L.id}</small><b>${esc(L.title)}</b><span class="geo lc-geo">${esc(L.geo)}</span>
      <span class="dots" aria-label="${n} из 4 шагов">${STEPS.map(([k]) => `<i class="${stepDone(L, k) ? 'on' : ''}"></i>`).join('')}</span></span>
    ${n === 4 ? `<span class="lc-ok">${ic('check', 18)}</span>` : ic('chev', 18)}
  </a>`;
}

// ============================================================
//  КУРС
// ============================================================
function viewCourse() {
  const ac = alphaCount();
  const doneN = LESSONS.filter(lessonComplete).length;
  app.innerHTML = `<div class="page">
    <header class="page-head"><div><div class="eyebrow">Уровень A1 · ${doneN} из ${LESSONS.length} уроков</div><h1>Курс</h1></div></header>
    <div class="progress-line"><i style="width:${Math.round((doneN + ac / LETTER_GROUPS.length) / (LESSONS.length + 1) * 100)}%"></i></div>
    <h2 class="sec">Старт</h2>
    <a class="card lcard2 ${ac === LETTER_GROUPS.length ? 'done' : ''}" href="#alphabet">
      <span class="lc-em geo" style="color:var(--brand);font-weight:700">ა</span>
      <span class="lc-b"><small>Урок 0</small><b>Алфавит</b><span class="geo lc-geo">ანბანი</span>
      <span class="dots">${LETTER_GROUPS.map((g, i) => `<i class="${S.groups[i] ? 'on' : ''}"></i>`).join('')}</span></span>${ac === LETTER_GROUPS.length ? `<span class="lc-ok">${ic('check', 18)}</span>` : ic('chev', 18)}</a>
    <h2 class="sec">Темы</h2>
    <div class="stack">${LESSONS.map(L => lessonCard(L)).join('')}</div>
  </div>`;
}

// ============================================================
//  УРОК: 4 шага
// ============================================================
function viewLesson(idArg, stepArg = '', subArg) {
  const L = LESSONS.find(x => x.id === +idArg); if (!L) return viewCourse();
  let step = stepArg, sub = subArg;
  if (LEGACY_TAB[step]) { [step, sub] = [LEGACY_TAB[step][0], sub || LEGACY_TAB[step][1]]; }
  if (!STEPS.some(s => s[0] === step)) step = stepArg ? 'learn' : nextStep(L)[0];
  const st = lessonState(L.id); st.seen = st.seen || {};
  if ((step === 'learn' || step === 'understand') && !st.seen[step]) { st.seen[step] = 1; save(); }
  const si = STEPS.findIndex(s => s[0] === step);
  let body = '';
  if (step === 'learn') body = learnStep(L, sub);
  else if (step === 'understand') body = `<p class="lead">🎯 ${esc(L.goal)}</p><div class="card grammar">${L.grammar}</div>`;
  else if (step === 'train') body = trainStep(L);
  else body = applyStep(L);
  const next = STEPS[si + 1]; const nextL = LESSONS.find(x => x.id === L.id + 1);
  app.innerHTML = `<div class="page lesson">
    <div class="appbar"><a class="iconbtn" href="#course" aria-label="Назад к курсу">${ic('back')}</a>
      <div class="ab-t"><small>Урок ${L.id} · ${lessonSteps(L)}/4</small><b>${L.emoji} ${esc(L.title)}</b></div>
      <button class="iconbtn tr-toggle ${S.translit ? 'on' : ''}" id="trT" aria-pressed="${S.translit}" title="Транскрипция">аб</button></div>
    <nav class="stepper" aria-label="Шаги урока">${STEPS.map(([k, n], i) => `<a href="#lesson/${L.id}/${k}" class="${k === step ? 'cur' : ''} ${stepDone(L, k) ? 'ok' : ''}" ${k === step ? 'aria-current="step"' : ''}><i>${stepDone(L, k) ? ic('check', 14) : i + 1}</i><span>${n}</span></a>`).join('')}</nav>
    <div class="step-body">${body}</div>
    <div class="cta-bar">${next ? `<a class="btn btn-primary btn-block" href="#lesson/${L.id}/${next[0]}">Дальше: ${next[1]} ${ic('chev', 18)}</a>` : nextL ? `<a class="btn btn-primary btn-block" href="#lesson/${nextL.id}">Следующий урок: ${nextL.emoji} ${esc(nextL.title)}</a>` : `<a class="btn btn-primary btn-block" href="#course">К курсу</a>`}</div>
  </div>`;
  $('#trT').onclick = () => { S.translit = !S.translit; save(); viewLesson(L.id, step, sub); toast(S.translit ? 'Транскрипция включена' : 'Транскрипция скрыта — читаем по-грузински 💪', 2000); };
  bindLessonStep(L, step, sub);
}
const LEARN_SUBS = [['words', 'Слова'], ['phrases', 'Фразы'], ['dialogue', 'Диалог'], ['vocab', 'Ещё слова']];
function learnStep(L, sub = 'words') {
  if (!LEARN_SUBS.some(s => s[0] === sub)) sub = 'words';
  const seg = `<div class="seg" role="tablist">${LEARN_SUBS.filter(s => s[0] !== 'vocab' || VOCAB[L.id]).map(([k, n]) => `<a role="tab" href="#lesson/${L.id}/learn/${k}" class="${k === sub ? 'on' : ''}" aria-selected="${k === sub}">${n}</a>`).join('')}</div>`;
  let inner = '';
  if (sub === 'words' || sub === 'phrases') {
    const list = L.items.filter(i => i.kind === (sub === 'words' ? 'w' : 'p'));
    inner = `<div class="row between"><p class="hint">Послушай → скажи вслух → закрой перевод и проверь себя</p><button class="btn btn-sm btn-tonal" id="playAll">${ic('play', 16)} Всё</button></div><div class="list">${list.map(itemRow).join('')}</div>`;
  } else if (sub === 'dialogue') {
    const d = L.dialogue;
    inner = `<div class="row between"><h3 class="h3">${esc(d.title)}</h3><span class="row"><button class="btn btn-sm btn-tonal" id="hideRu">Скрыть перевод</button><button class="btn btn-sm btn-tonal" id="playDlg">${ic('play', 16)}</button></span></div>
      <div class="dlg" id="dlg">${d.lines.map(([who, geo, ru]) => who === '—' ? `<div class="dlg-sep">${esc(geo)}</div>` : `<div class="bubble ${who === 'Анна' ? 'me' : ''}">${sayBtn(geo)}<div class="who">${esc(who)}</div><div class="geo">${esc(geo)}</div>${trHTML(geo)}<div class="ru">${esc(ru)}</div></div>`).join('')}</div>
      <p class="hint" style="margin-top:14px">Прочитай с переводом → скрой перевод и пойми сам(а) → прочитай вслух за Анну.</p>`;
  } else {
    const groups = VOCAB[L.id] || [];
    inner = `<p class="hint">Дополнительные слова по теме. Учи по одной группе: послушай → потренируй → добавь в повторение.</p>
      ${groups.map((g, gi) => { const ids = L.items.filter(i => i.kind === 'x' && i.group === gi); const sc = (S.lessons[L.id] || {}).x || {}; return `<details class="card vgroup"><summary><span class="vname">${esc(g.name)}</span><small>${g.items.length}${sc[gi] != null ? ` · ✓ ${Math.round(sc[gi] * 100)}%` : ''}</small></summary>
        <div class="row" style="margin:12px 0"><a class="btn btn-sm btn-primary" href="#practice/${L.id}/x/${gi}">Тренировать</a><button class="btn btn-sm btn-tonal" data-addg="${gi}">＋ В повторение</button><button class="btn btn-sm btn-tonal" data-playg="${gi}" aria-label="Прослушать">${ic('play', 16)}</button></div>
        <div class="list">${ids.map(itemRow).join('')}</div></details>`; }).join('')}`;
  }
  return seg + inner + `<a class="report" target="_blank" rel="noopener" href="https://github.com/EvgeniaSahar/georgian-a1/issues/new?title=${encodeURIComponent('Ошибка в уроке ' + L.id + ': ' + L.title)}&body=${encodeURIComponent('Слово или фраза:\n\nЧто не так:\n')}">${ic('flag', 14)} Нашли ошибку в грузинском? Сообщите</a>`;
}
function trainStep(L) {
  const st = S.lessons[L.id] || {}; const sc = v => v == null ? '' : `<span class="score">${Math.round(v * 100)}%</span>`;
  return `<p class="hint">Сначала основная тренировка — после неё урок засчитывается и слова попадают в повторение. Упражнения ниже — для закрепления.</p>
    <div class="list">
      <a class="row-link" href="#practice/${L.id}/w"><span class="rl-i">📝</span><span class="rl-b"><b>Слова урока</b><small>${L.words.length} слов · выбор, перевод, письмо</small></span>${sc(st.w)}${ic('chev', 18)}</a>
      <a class="row-link" href="#practice/${L.id}/p"><span class="rl-i">💬</span><span class="rl-b"><b>Фразы урока</b><small>${L.phrases.length} фраз · понимание и сборка</small></span>${sc(st.p)}${ic('chev', 18)}</a>
    </div>
    <h3 class="h3" style="margin-top:22px">Упражнения</h3>
    ${drillsTabHTML(L)}`;
}
function applyStep(L) {
  const st = S.lessons[L.id] || {};
  return `<div class="card mission2"><div class="eyebrow">Миссия в реальной жизни</div><p class="mission-t">${esc(L.mission)}</p>
    <button class="btn btn-block ${st.m ? 'btn-tonal' : 'btn-primary'}" id="missionDone">${st.m ? `${ic('check', 18)} Выполнено` : 'Я сделал(а) это!'}</button>
    ${st.m ? `<div class="feel"><span>Как прошло?</span>${['😅', '🙂', '🤩'].map((e, i) => `<button class="${st.feel === i ? 'on' : ''}" data-feel="${i}" aria-label="${['трудно', 'нормально', 'отлично'][i]}">${e}</button>`).join('')}</div>` : ''}</div>
    <p class="hint" style="margin-top:14px">Слово, сказанное живому человеку, запоминается лучше десяти повторений с экрана. Ошибки — это нормально: грузины очень радуются, когда с ними пытаются говорить на их языке.</p>`;
}
function bindLessonStep(L, step, sub) {
  const pa = $('#playAll'); if (pa) pa.onclick = () => speakQueue(L.items.filter(i => i.kind === (sub === 'phrases' ? 'p' : 'w')).map(i => i.geo));
  const hr = $('#hideRu'); if (hr) hr.onclick = () => { const d = $('#dlg'); d.classList.toggle('hide-ru'); hr.textContent = d.classList.contains('hide-ru') ? 'Показать перевод' : 'Скрыть перевод'; };
  const pd = $('#playDlg'); if (pd) pd.onclick = () => speakQueue(L.dialogue.lines.filter(l => l[0] !== '—').map(l => l[1]));
  $$('[data-addg]').forEach(b => b.onclick = () => { addToSRS(L.items.filter(i => i.kind === 'x' && i.group === +b.dataset.addg).map(i => i.id)); b.textContent = '✓ Добавлено'; b.disabled = true; toast(`Добавлено. Новые слова будут приходить порциями по ${newLimit()} в день.`); });
  $$('[data-playg]').forEach(b => b.onclick = () => speakQueue(L.items.filter(i => i.kind === 'x' && i.group === +b.dataset.playg).map(i => i.geo)));
  if (step === 'train') bindDrillsTab(L);
  const md = $('#missionDone'); if (md) md.onclick = () => { const st = lessonState(L.id); if (!st.m) { st.m = true; addXP(20); toast('ყოჩაღ! Молодец! 🎉'); } else { st.m = false; save(); } viewLesson(L.id, 'apply'); };
  $$('[data-feel]').forEach(b => b.onclick = () => { lessonState(L.id).feel = +b.dataset.feel; save(); viewLesson(L.id, 'apply'); });
}
// чипы блоков упражнений перерисовывают шаг «Тренировать»
function bindDrillsTab(L) { $$('[data-blk]').forEach(b => b.onclick = () => { drillBlock[L.id] = b.dataset.blk; viewLesson(L.id, 'train'); }); }

// ============================================================
//  ЕЩЁ и НАСТРОЙКИ
// ============================================================
function viewMore() {
  const rows = [
    ['#phrasebook', '💬', 'Разговорник', 'поиск по всем словам и фразам'],
    ['#numbers', '🔢', 'Числа и цены', 'понимать цены на слух'],
    ['#alphabet', 'ა', 'Алфавит', `${alphaCount()} из ${LETTER_GROUPS.length} групп`],
    ['#method', '🧠', 'Как учиться', 'методика, план на день, озвучка'],
    ['#settings', '⚙️', 'Настройки', 'цель, транскрипция, резервная копия'],
  ];
  app.innerHTML = `<div class="page"><header class="page-head"><h1>Ещё</h1></header>
    <div class="list">${rows.map(([h, i, t, m]) => `<a class="row-link" href="${h}"><span class="rl-i ${i === 'ა' ? 'geo' : ''}">${i}</span><span class="rl-b"><b>${t}</b><small>${m}</small></span>${ic('chev', 18)}</a>`).join('')}</div>
    <div class="card about"><b>Гза · გზა — «путь»</b><p>Курс грузинского для тех, кто живёт в Грузии. Тексты и упражнения написаны для курса; темы идут в порядке, привычном по учебникам для иностранцев. Нашли ошибку в грузинском — <a target="_blank" rel="noopener" href="https://github.com/EvgeniaSahar/georgian-a1/issues/new">сообщите</a>.</p></div>
  </div>`;
}
function viewSettings() {
  const opt = (key, vals, cur) => `<div class="seg seg-sm">${vals.map(([v, n]) => `<button data-set="${key}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  app.innerHTML = `<div class="page">
    <div class="appbar"><a class="iconbtn" href="#more" aria-label="Назад">${ic('back')}</a><div class="ab-t"><b>Настройки</b></div><span></span></div>
    <section class="card set"><b>Цель дня</b><small>Сколько очков опыта набирать каждый день</small>${opt('goal', [[20, 'Лёгкая · 20'], [30, 'Обычная · 30'], [50, 'Серьёзная · 50']], S.goal || 30)}</section>
    <section class="card set"><b>Новых карточек в день</b><small>Остальные подождут — так повторение не превращается в завал</small>${opt('newLimit', [[10, '10'], [15, '15'], [25, '25'], [40, '40']], newLimit())}</section>
    <section class="card set row between"><span><b>Транскрипция кириллицей</b><small>Выключи, когда уверенно читаешь по-грузински</small></span>
      <button class="switch ${S.translit ? 'on' : ''}" id="swTr" role="switch" aria-checked="${S.translit}" aria-label="Транскрипция"><i></i></button></section>
    <a class="card set row-link" href="#method"><span class="rl-b"><b>Голос и озвучка</b><small>нейросеть «Натия» или системный голос</small></span>${ic('chev', 18)}</a>
    <section class="card set"><b>Резервная копия</b><small>Прогресс хранится только в этом браузере. Сохрани копию — и сможешь перенести его на другой телефон или восстановить.</small>
      <div class="row" style="margin-top:10px"><button class="btn btn-sm btn-primary" id="bkSave">Скачать копию</button><label class="btn btn-sm btn-tonal">Восстановить<input type="file" id="bkLoad" accept="application/json,.json" hidden></label></div></section>
    <section class="card set"><b>Сбросить прогресс</b><small>Удалит все карточки, уроки и серию</small><div style="margin-top:10px"><button class="btn btn-sm btn-danger" id="reset">Сбросить</button></div></section>
  </div>`;
  $$('[data-set]').forEach(b => b.onclick = () => { S[b.dataset.set] = +b.dataset.v; save(); viewSettings(); });
  $('#swTr').onclick = () => { S.translit = !S.translit; save(); viewSettings(); };
  $('#bkSave').onclick = () => { const blob = new Blob([JSON.stringify({ app: 'gza', v: 1, date: today(), state: S })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gza-progress-${today()}.json`; a.click(); toast('Копия сохранена в «Загрузки»'); };
  $('#bkLoad').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!j.state || !j.state.srs) throw 0; if (!confirm('Заменить текущий прогресс данными из копии?')) return; S = Object.assign(defaults(), j.state); save(); toast('Прогресс восстановлен ✓'); location.reload(); } catch (err) { toast('Это не файл копии Гза'); } }; r.readAsText(f); };
  $('#reset').onclick = () => { if (confirm('Точно стереть весь прогресс? Это нельзя отменить.')) { S = defaults(); save(); toast('Прогресс сброшен'); location.hash = 'home'; } };
}
