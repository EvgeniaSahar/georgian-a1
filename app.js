// ============================================================
//  Билики · движок сайта
// ============================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const app = $('#app');

// ---------- транскрипция кириллицей (’ = гортанный звук) ----------
const TR = { 'ა':'а','ბ':'б','გ':'г','დ':'д','ე':'э','ვ':'в','ზ':'з','თ':'т','ი':'и','კ':'к’','ლ':'л','მ':'м','ნ':'н','ო':'о','პ':'п’','ჟ':'ж','რ':'р','ს':'с','ტ':'т’','უ':'у','ფ':'п','ქ':'к','ღ':'гъ','ყ':'къ','შ':'ш','ჩ':'ч','ც':'ц','ძ':'дз','წ':'ц’','ჭ':'ч’','ხ':'х','ჯ':'дж','ჰ':'h' };
const translit = s => [...s].map(c => TR[c] ?? c).join('');
const trHTML = geo => `<span class="tr">${esc(translit(geo))}</span>`;
const norm = s => s.replace(/[.,!?;:«»"“”—–\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// ---------- реестр карточек ----------
const ITEMS = {};
LESSONS.forEach(L => {
  L.items = [];
  L.words.forEach((w, i) => { const it = { id: `${L.id}w${i}`, geo: w[0], ru: w[1], lesson: L.id, kind: 'w' }; ITEMS[it.id] = it; L.items.push(it); });
  L.phrases.forEach((w, i) => { const it = { id: `${L.id}p${i}`, geo: w[0], ru: w[1], lesson: L.id, kind: 'p' }; ITEMS[it.id] = it; L.items.push(it); });
});
ALPHABET.forEach((a, i) => { ITEMS['a' + i] = { id: 'a' + i, geo: a[0], ru: `${translit(a[0])} — ${a[2]}`, kw: a[3], kwru: a[4], kind: 'l' }; });
const letterIdx = ch => ALPHABET.findIndex(a => a[0] === ch);

const READ_EXTRA = [['ლომი','лев'],['სალამი','салями'],['მელა','лиса'],['სული','душа'],['რომი','ром'],['ბანანი','банан'],['ნინო','Нино (имя)'],['ბიჭი','мальчик, парень'],['გოგო','девочка, девушка'],['თამარი','Тамар (имя)'],['ქართული','грузинский (язык)'],['საქართველო','Грузия'],['ბათუმი','Батуми'],['ქუთაისი','Кутаиси']];

// ---------- состояние ----------
const KEY = 'bilikebi_a1_v1';
const defaults = () => ({ srs: {}, lessons: {}, groups: {}, xp: 0, streak: { last: null, count: 0 }, translit: true, days: {}, texts: [], custom: {} });
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = defaults(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} updateHeader(); }
const dayStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dayStr(new Date());
function touchStreak() {
  const t = today(); if (S.streak.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak.count = S.streak.last === dayStr(y) ? S.streak.count + 1 : 1;
  S.streak.last = t;
}
function addXP(n) { S.xp += n; S.days[today()] = (S.days[today()] || 0) + n; touchStreak(); save(); }
const lessonState = id => (S.lessons[id] = S.lessons[id] || {});
const lessonDone = id => { const s = S.lessons[id]; return !!(s && s.w != null && s.p != null); };

// ---------- интервальные повторения (SM-2) ----------
const midnight = (addDays = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + addDays); return d.getTime(); };
function addToSRS(ids) { ids.forEach(id => { if (!S.srs[id]) S.srs[id] = { e: 2.5, i: 0, r: 0, due: Date.now(), l: 0 }; }); save(); }
function dueIds() { const now = Date.now(); return Object.keys(S.srs).filter(id => ITEMS[id] && S.srs[id].due <= now); }
function gradeCard(id, q) { // q: 1 забыл, 3 трудно, 4 хорошо, 5 легко
  const c = S.srs[id];
  if (q < 3) { c.r = 0; c.i = 0; c.l++; c.due = Date.now(); }
  else {
    if (c.r === 0) c.i = q === 5 ? 3 : 1;
    else if (c.r === 1) c.i = q === 3 ? 2 : q === 5 ? 6 : 4;
    else c.i = Math.max(c.i + 1, Math.round(c.i * c.e * (q === 3 ? 0.7 : q === 5 ? 1.3 : 1)));
    c.r++; c.due = midnight(c.i);
  }
  c.e = Math.max(1.3, c.e + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  save();
}
const learnedCount = () => Object.values(S.srs).filter(c => c.r >= 2).length;

// ---------- озвучка ----------
let kaVoice = null, voiceWarned = false;
function pickVoice() { const vs = speechSynthesis.getVoices(); kaVoice = vs.find(v => /^ka(-|_|$)/i.test(v.lang)) || vs.find(v => /georgian|ქართ/i.test(v.name)) || null; }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!kaVoice) { toast('🔇 В этом браузере нет грузинского голоса. Откройте сайт в Microsoft Edge — там есть голоса Eka и Giorgi. А пока читайте по транскрипции.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.voice = kaVoice; u.lang = kaVoice.lang; u.rate = 0.85; speechSynthesis.speak(u);
}
function speakQueue(texts) { if (!kaVoice) return speak(''); speechSynthesis.cancel(); texts.forEach(t => { const u = new SpeechSynthesisUtterance(t); u.voice = kaVoice; u.lang = kaVoice.lang; u.rate = 0.85; speechSynthesis.speak(u); }); }
const sayBtn = (geo, cls = '') => `<button class="speak ${cls}" data-say="${esc(geo)}" title="Послушать">🔊</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.preventDefault(); e.stopPropagation(); speak(b.dataset.say); } }, true);

let toastT;
function toast(msg, ms = 3800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

// ---------- шапка ----------
function updateHeader() {
  const d = dueIds().length;
  $('#dueBadge').textContent = d || '';
  $('#streak').textContent = '🔥 ' + (S.streak.count || 0);
  $('#translitBtn').classList.toggle('on', S.translit);
  document.body.classList.toggle('hide-tr', !S.translit);
}
$('#translitBtn').onclick = () => { S.translit = !S.translit; save(); toast(S.translit ? 'Транскрипция включена' : 'Транскрипция скрыта — читаем по-грузински 💪', 2000); };

// ---------- клавиатура ----------
let keyHandler = null;
document.addEventListener('keydown', e => { if (keyHandler && !e.metaKey && !e.ctrlKey && !e.altKey) keyHandler(e); });

// ---------- роутер ----------
function route() {
  keyHandler = null; if ('speechSynthesis' in window) speechSynthesis.cancel();
  const [p, a, b] = (location.hash.slice(1) || 'home').split('/');
  const views = { home: viewHome, alphabet: viewAlphabet, lesson: viewLesson, practice: viewPractice, review: viewReview, phrasebook: viewPhrasebook, numbers: viewNumbers, method: viewMethod, reader: viewReader };
  (views[p] || viewHome)(a, b);
  $$('.topnav a, .bottomnav a').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + p));
  window.scrollTo(0, 0); updateHeader();
}
window.addEventListener('hashchange', route);

// ============================================================
//  ГЛАВНАЯ
// ============================================================
function viewHome() {
  const groupsDone = LETTER_GROUPS.filter((g, i) => S.groups[i]).length;
  const next = LESSONS.find(L => !lessonDone(L.id));
  const due = dueIds().length;
  const doneN = LESSONS.filter(L => lessonDone(L.id)).length;
  let cta;
  if (groupsDone < LETTER_GROUPS.length && doneN === 0) cta = `<a class="btn" href="#alphabet">Начать с алфавита →</a> ${next ? `<a class="btn ghost" href="#lesson/${next.id}">или сразу Урок 1</a>` : ''}`;
  else cta = `${next ? `<a class="btn" href="#lesson/${next.id}">Продолжить: ${next.emoji} ${esc(next.title)} →</a>` : '<span>🎉 Все уроки A1 пройдены!</span>'} ${due ? `<a class="btn ghost" href="#review">Повторить ${due}</a>` : ''}`;

  app.innerHTML = `
  <section class="hero">
    <div class="hero-letters">ქართ</div>
    <h1>გამარჯობა! 👋</h1>
    <p>Грузинский для жизни в Грузии: рынок, маршрутка, соседи, аптека. Уровень A1 — от алфавита до первых разговоров. 15 минут в день.</p>
    <div class="row">${cta}</div>
  </section>
  <div class="stats">
    <div class="stat"><b>${Object.keys(S.srs).length}</b><span>карточек в повторении</span></div>
    <div class="stat"><b>${due}</b><span>повторить сегодня</span></div>
    <div class="stat"><b>${doneN}/${LESSONS.length}</b><span>уроков пройдено</span></div>
    <div class="stat"><b>${S.xp}</b><span>очков опыта</span></div>
  </div>

  <div class="sec-title"><h2>Путь A1</h2><span class="muted small">рекомендуется по порядку</span></div>
  <div class="grid g2">
    <a class="card lcard ${groupsDone === LETTER_GROUPS.length ? 'done' : ''} ${groupsDone < LETTER_GROUPS.length && doneN === 0 ? 'next' : ''}" href="#alphabet">
      <div class="em geo" style="color:var(--wine);font-weight:700">ა</div>
      <div><div class="num">Урок 0</div><div class="t">Алфавит</div><div class="gt">ანბანი · ${groupsDone}/${LETTER_GROUPS.length} групп</div></div>
      ${groupsDone === LETTER_GROUPS.length ? '<span class="check">✓</span>' : ''}
    </a>
    ${LESSONS.map(L => `
    <a class="card lcard ${lessonDone(L.id) ? 'done' : ''} ${next && next.id === L.id && !(groupsDone < LETTER_GROUPS.length && doneN === 0) ? 'next' : ''}" href="#lesson/${L.id}">
      <div class="em">${L.emoji}</div>
      <div><div class="num">Урок ${L.id}</div><div class="t">${esc(L.title)}</div><div class="gt">${esc(L.geo)}</div></div>
      ${lessonDone(L.id) ? '<span class="check">✓</span>' : ''}
    </a>`).join('')}
  </div>

  <div class="sec-title"><h2>Тренажёры</h2></div>
  <div class="grid g3">
    <a class="card lcard" href="#review"><div class="em">🔁</div><div><div class="t">Повторение</div><div class="muted small">${due ? due + ' карточек ждут' : 'на сегодня всё'}</div></div></a>
    <a class="card lcard" href="#numbers"><div class="em">🔢</div><div><div class="t">Числа и цены</div><div class="muted small">понимать на слух</div></div></a>
    <a class="card lcard" href="#reader"><div class="em">📖</div><div><div class="t">Читалка</div><div class="muted small">свой текст + разбор слов</div></div></a>
    <a class="card lcard" href="#phrasebook"><div class="em">💬</div><div><div class="t">Разговорник</div><div class="muted small">поиск по всем фразам</div></div></a>
    <a class="card lcard" href="#method"><div class="em">🧠</div><div><div class="t">Как учиться</div><div class="muted small">методика и план</div></div></a>
  </div>`;
}

// ============================================================
//  АЛФАВИТ
// ============================================================
function viewAlphabet(mode, gArg) {
  if (mode === 'quiz') return letterQuiz(+gArg);
  if (mode === 'read') return readingDrill(+gArg);
  let g = mode != null && mode !== '' ? +mode : LETTER_GROUPS.findIndex((x, i) => !S.groups[i]);
  if (g < 0 || isNaN(g)) g = 0;
  const grp = LETTER_GROUPS[g];
  app.innerHTML = `
  <h1>Алфавит <span class="geo muted" style="font-size:20px">ანბანი</span></h1>
  <div class="card" style="margin-top:12px">
    <p style="margin-top:0">✨ <b>33 буквы, нет заглавных, читается так же, как пишется.</b> Выучишь алфавит — сможешь читать любые вывески. Учим группами: в каждой группе — посмотри буквы, пройди тренировку, потом читай слова только из знакомых букв.</p>
    <details><summary><b>Главная трудность: тройки согласных</b></summary>
      <p class="small">В грузинском есть звуки «с выдохом» (придыхательные) и «со щелчком горла» (гортанные, абруптивы). Для гортанного: задержи дыхание, сомкни горло и произнеси звук — получится резкий «щелчок». В транскрипции он отмечен знаком <b>’</b>.</p>
      <table class="grammar triads" style="width:100%"><tr><th>звонкий</th><th>с выдохом</th><th>гортанный ’</th></tr>
      <tr><td>დ д</td><td>თ т</td><td>ტ т’</td></tr><tr><td>გ г</td><td>ქ к</td><td>კ к’</td></tr>
      <tr><td>ბ б</td><td>ფ п</td><td>პ п’</td></tr><tr><td>ძ дз</td><td>ც ц</td><td>წ ц’</td></tr>
      <tr><td>ჯ дж</td><td>ჩ ч</td><td>ჭ ч’</td></tr><tr><td>ღ гъ</td><td>ხ х</td><td>ყ къ</td></tr></table>
    </details>
  </div>
  <div class="agroups">${LETTER_GROUPS.map((x, i) => `<button class="agroup ${i === g ? 'active' : ''} ${S.groups[i] ? 'done' : ''}" data-g="${i}"><div class="small muted">Группа ${i + 1}</div><div class="ls">${x.letters}</div></button>`).join('')}</div>
  <div class="card">
    <div class="row"><h3 style="margin:0">Группа ${g + 1}: ${esc(grp.name)}</h3></div>
    <p class="muted small" style="margin:.3em 0 14px">${esc(grp.tip)} Нажми на букву, чтобы узнать звук и слово-подсказку.</p>
    <div class="letters">${[...grp.letters].map(ch => { const a = ALPHABET[letterIdx(ch)]; return `<div class="letter" data-l="${ch}"><div class="L">${ch}</div><div class="lat">${esc(translit(ch))}</div></div>`; }).join('')}</div>
    <div class="row" style="margin-top:18px">
      <a class="btn" href="#alphabet/quiz/${g}">🎯 Тренировать буквы</a>
      <a class="btn ghost" href="#alphabet/read/${g}">📖 Читать слова</a>
    </div>
  </div>
  <div class="sec-title"><h2>Все 33 буквы</h2></div>
  <div class="letters">${ALPHABET.map(a => { const gi = LETTER_GROUPS.findIndex(x => x.letters.includes(a[0])); return `<div class="letter ${S.groups[gi] ? '' : 'dim'}" data-l="${a[0]}"><div class="L">${a[0]}</div><div class="lat">${esc(translit(a[0]))}</div></div>`; }).join('')}</div>`;
  $$('.agroup').forEach(b => b.onclick = () => location.hash = 'alphabet/' + b.dataset.g);
  $$('.letter').forEach(el => el.onclick = () => letterModal(el.dataset.l));
}
function letterModal(ch) {
  const a = ALPHABET[letterIdx(ch)];
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><div class="ldetail">
    <div class="L">${a[0]}</div>
    <div style="flex:1;min-width:200px">
      <div class="q-label">Звук</div><h2 style="margin:0">${esc(translit(a[0]))} <span class="muted small">(${esc(a[1])})</span></h2>
      <p>${esc(a[2])}</p>
      <div class="q-label">Слово-ключ</div>
      <div class="row"><span class="geo" style="font-size:24px;font-weight:600">${a[3]}</span>${sayBtn(a[3])}</div>
      <div>${trHTML(a[3])} — ${esc(a[4])}</div>
    </div></div>
    <div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn sm light" data-close>Закрыть</button></div></div>`;
  m.onclick = e => { if (e.target === m || e.target.dataset.close != null) { m.remove(); keyHandler = prevKH; } };
  const prevKH = keyHandler; keyHandler = e => { if (e.key === 'Escape') { m.remove(); keyHandler = prevKH; } };
  document.body.appendChild(m);
}
function letterQuiz(g) {
  const cur = [...LETTER_GROUPS[g].letters];
  const prev = LETTER_GROUPS.slice(0, g).flatMap(x => [...x.letters]);
  const all = ALPHABET.map(a => a[0]);
  const qs = [];
  shuffle(cur).forEach(ch => qs.push({ t: 'l2s', ch }));
  shuffle(cur).forEach(ch => qs.push({ t: 's2l', ch }));
  sample(prev, Math.min(4, prev.length)).forEach(ch => qs.push({ t: Math.random() < .5 ? 'l2s' : 's2l', ch }));
  const questions = qs.map(q => {
    const a = ALPHABET[letterIdx(q.ch)];
    const pool = shuffle([...new Set([...cur, ...prev])].filter(x => x !== q.ch));
    const others = (pool.length >= 3 ? pool : shuffle(all.filter(x => x !== q.ch))).slice(0, 3);
    if (q.t === 'l2s') return { type: 'mcq', label: 'Как читается буква?', prompt: q.ch, promptGeo: true, big: true, options: shuffle([q.ch, ...others]).map(x => ({ v: x, text: translit(x) })), answer: q.ch, optGeo: false, explain: { geo: a[3], ru: `${a[0]} = «${translit(a[0])}» — ${a[2]}. Слово: ${a[4]}` } };
    return { type: 'mcq', label: 'Найди букву', prompt: `«${translit(q.ch)}» — как в слове «${a[4]}»`, options: shuffle([q.ch, ...others]).map(x => ({ v: x, text: x })), answer: q.ch, optGeo: true, bigOpts: true, explain: { geo: a[3], ru: `${a[0]} = «${translit(a[0])}». ${a[4]}` } };
  });
  runExercise({
    title: `Буквы · группа ${g + 1}`, questions, back: '#alphabet/' + g,
    onFinish: score => {
      if (score >= 0.8) { S.groups[g] = true; addToSRS(cur.map(ch => 'a' + letterIdx(ch))); }
      addXP(10 + Math.round(score * 10));
    },
    nextLinks: score => score >= 0.8 ? `<a class="btn" href="#alphabet/read/${g}">📖 Теперь читаем слова →</a>` : '',
  });
}
function readingDrill(g) {
  const known = new Set(LETTER_GROUPS.slice(0, g + 1).flatMap(x => [...x.letters]));
  const cands = [...Object.values(ITEMS).filter(it => it.kind === 'w').map(it => [it.geo, it.ru]), ...ALPHABET.map(a => [a[3], a[4]]), ...READ_EXTRA];
  const seen = new Set();
  const pool = cands.filter(([geo]) => { const clean = geo.replace(/[?!]/g, ''); if (seen.has(clean) || !/^[ა-ჿ]+$/.test(clean)) return false; seen.add(clean); return [...clean].every(c => known.has(c)); }).map(([geo, ru]) => [geo.replace(/[?!]/g, ''), ru]);
  if (pool.length < 4) { app.innerHTML = `<div class="empty"><div class="big">📖</div>Пока мало слов из этих букв. Пройди следующую группу!<br><br><a class="btn" href="#alphabet">К алфавиту</a></div>`; return; }
  // приоритет — слова с буквами новой группы
  const fresh = new Set(LETTER_GROUPS[g].letters);
  const ranked = shuffle(pool).sort((a, b) => [...b[0]].some(c => fresh.has(c)) - [...a[0]].some(c => fresh.has(c)));
  const chosen = ranked.slice(0, 10);
  const questions = shuffle(chosen).map(([geo, ru]) => {
    const others = sample(pool.filter(p => p[0] !== geo), 3).map(p => p[0]);
    return { type: 'mcq', label: 'Прочитай слово', prompt: geo, promptGeo: true, big: true, hideTr: true, options: shuffle([geo, ...others]).map(x => ({ v: x, text: translit(x) })), answer: geo, explain: { geo, ru } };
  });
  runExercise({ title: `Чтение · буквы групп 1–${g + 1}`, questions, back: '#alphabet/' + g, onFinish: s => addXP(5 + Math.round(s * 10)), nextLinks: () => g < LETTER_GROUPS.length - 1 ? `<a class="btn" href="#alphabet/${g + 1}">Следующая группа →</a>` : `<a class="btn" href="#lesson/1">Алфавит пройден! К уроку 1 →</a>` });
}

// ============================================================
//  УРОК
// ============================================================
const TABS = [['words', 'Слова'], ['phrases', 'Фразы'], ['dialogue', 'Диалог'], ['grammar', 'Грамматика'], ['practice', 'Практика'], ['mission', 'Миссия']];
function itemRow(it) { return `<div class="item">${sayBtn(it.geo)}<div class="txt"><div class="geo">${esc(it.geo)}</div>${trHTML(it.geo)}</div><div class="ru" style="text-align:right;max-width:45%">${esc(it.ru)}</div></div>`; }
function viewLesson(idArg, tab = 'words') {
  const L = LESSONS.find(x => x.id === +idArg); if (!L) return viewHome();
  const st = lessonState(L.id);
  let body = '';
  if (tab === 'words' || tab === 'phrases') {
    const list = L.items.filter(i => i.kind === (tab === 'words' ? 'w' : 'p'));
    body = `<p class="muted small">🔊 Послушай → произнеси вслух → закрой перевод рукой и проверь себя. ${tab === 'phrases' ? 'Учи фразы целиком, как одно длинное слово.' : ''}</p>
      <div class="items">${list.map(itemRow).join('')}</div>
      <div class="row" style="margin-top:18px"><a class="btn" href="#practice/${L.id}/${tab === 'words' ? 'w' : 'p'}">🎯 Тренировать ${tab === 'words' ? 'слова' : 'фразы'} →</a>
      <button class="btn ghost" id="playAll">▶︎ Прослушать всё</button></div>`;
  } else if (tab === 'dialogue') {
    const d = L.dialogue;
    const me = 'Анна';
    body = `<div class="row" style="margin-bottom:14px"><h3 style="margin:0">${esc(d.title)}</h3><span class="spacer"></span>
      <button class="btn sm light" id="hideRu">🙈 Скрыть перевод</button><button class="btn sm light" id="playDlg">▶︎ Озвучить</button></div>
      <div class="dlg" id="dlg">${d.lines.map(([who, geo, ru]) => who === '—' ? `<div class="dlg-sep">${esc(geo)}</div>` : `
        <div class="bubble ${who === me ? 'me' : ''}">${sayBtn(geo)}<div class="who">${esc(who)}</div><div class="geo">${esc(geo)}</div>${trHTML(geo)}<div class="ru">${esc(ru)}</div></div>`).join('')}</div>
      <div class="tip" style="margin-top:18px">💡 <b>Как работать с диалогом:</b> 1) прочитай с переводом; 2) скрой перевод и пойми сам(а) — наведи на строку, чтобы подсмотреть; 3) прочитай вслух за Анну; 4) разыграй, отвечая вместо Анны своими словами.</div>`;
  } else if (tab === 'grammar') {
    body = `<div class="card grammar">${L.grammar}</div>`;
  } else if (tab === 'practice') {
    const sc = v => v == null ? '<span class="muted">не пройдено</span>' : `<b style="color:var(--ok)">${Math.round(v * 100)}%</b>`;
    body = `<div class="grid g2">
      <div class="card"><h3>🎯 Слова</h3><p class="muted small">${L.words.length} слов · выбор, обратный перевод, письмо на грузинской клавиатуре</p><p>Лучший результат: ${sc(st.w)}</p><a class="btn" href="#practice/${L.id}/w">Начать</a></div>
      <div class="card"><h3>🧩 Фразы</h3><p class="muted small">${L.phrases.length} фраз · понимание, перевод, сборка фразы из слов</p><p>Лучший результат: ${sc(st.p)}</p><a class="btn" href="#practice/${L.id}/p">Начать</a></div>
    </div>
    <p class="muted small" style="margin-top:14px">После тренировки все слова и фразы урока попадают в <a href="#review">Повторение</a> — оно будет напоминать их по графику интервальных повторений. ${L.id > 1 ? 'В практику подмешиваются слова прошлых уроков.' : ''}</p>`;
  } else if (tab === 'mission') {
    body = `<div class="mission"><h3>🎯 Миссия в реальной жизни</h3><p style="font-size:17px">${esc(L.mission)}</p>
      <label class="row" style="margin-top:14px;cursor:pointer"><input type="checkbox" id="missionChk" ${st.m ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--wine)"> <b>Выполнено!</b> <span class="muted small">(+20 очков)</span></label></div>
      <p class="muted small" style="margin-top:14px">Почему это важно: слово, сказанное живому человеку в настоящей ситуации, запоминается в разы лучше, чем 10 повторений с экрана. Не бойся ошибок — грузины очень радуются, когда иностранец пытается говорить на их языке.</p>`;
  }
  const nextL = LESSONS.find(x => x.id === L.id + 1);
  app.innerHTML = `
    <a href="#home" class="small">← Все уроки</a>
    <div class="lhead"><div class="em">${L.emoji}</div><div><div class="muted small">Урок ${L.id} · A1</div><h1 style="margin:0">${esc(L.title)}</h1><div class="geo" style="color:var(--wine)">${esc(L.geo)}</div></div></div>
    <div class="goal">🎯 <b>Цель:</b> ${esc(L.goal)}</div>
    <div class="tabs">${TABS.map(([k, n]) => `<a class="tab ${k === tab ? 'active' : ''}" href="#lesson/${L.id}/${k}">${n}${(k === 'practice' && lessonDone(L.id)) || (k === 'mission' && st.m) ? ' ✓' : ''}</a>`).join('')}</div>
    ${body}
    <div class="row" style="margin-top:28px;border-top:1px solid var(--line);padding-top:16px">
      ${(() => { const i = TABS.findIndex(t => t[0] === tab); return i < TABS.length - 1 ? `<a class="btn light" href="#lesson/${L.id}/${TABS[i + 1][0]}">Дальше: ${TABS[i + 1][1]} →</a>` : nextL ? `<a class="btn light" href="#lesson/${nextL.id}">Следующий урок: ${nextL.emoji} ${esc(nextL.title)} →</a>` : ''; })()}
    </div>`;
  const pa = $('#playAll'); if (pa) pa.onclick = () => speakQueue(L.items.filter(i => i.kind === (tab === 'words' ? 'w' : 'p')).map(i => i.geo));
  const hr = $('#hideRu'); if (hr) hr.onclick = () => { const d = $('#dlg'); d.classList.toggle('hide-ru'); hr.textContent = d.classList.contains('hide-ru') ? '👁 Показать перевод' : '🙈 Скрыть перевод'; };
  const pd = $('#playDlg'); if (pd) pd.onclick = () => speakQueue(L.dialogue.lines.filter(l => l[0] !== '—').map(l => l[1]));
  const mc = $('#missionChk'); if (mc) mc.onchange = () => { st.m = mc.checked; if (mc.checked) { addXP(20); toast('ყოჩაღ! Молодец! 🎉'); } else save(); };
}

// ============================================================
//  ПРАКТИКА УРОКА
// ============================================================
function distractors(it, n, field) {
  const same = shuffle(LESSONS.find(L => L.id === it.lesson).items.filter(x => x.kind === it.kind && x.id !== it.id && x[field] !== it[field]));
  const other = shuffle(Object.values(ITEMS).filter(x => x.kind === it.kind && x.lesson !== it.lesson));
  const out = [];
  for (const x of [...same, ...other]) { if (out.length >= n) break; if (!out.some(o => o[field] === x[field])) out.push(x); }
  return out;
}
function mkMCQ(it, dir) {
  if (dir === 'listen') return { type: 'mcq', label: 'Послушай и выбери перевод', listen: it.geo, prompt: '🔊', options: shuffle([it, ...distractors(it, 3, 'ru')]).map(x => ({ v: x.id, text: x.ru })), answer: it.id, explain: it };
  if (dir === 'g2r') return { type: 'mcq', label: 'Что это значит?', prompt: it.geo, promptGeo: true, options: shuffle([it, ...distractors(it, 3, 'ru')]).map(x => ({ v: x.id, text: x.ru })), answer: it.id, explain: it };
  return { type: 'mcq', label: 'Как сказать по-грузински?', prompt: it.ru, options: shuffle([it, ...distractors(it, 3, 'geo')]).map(x => ({ v: x.id, text: x.geo })), answer: it.id, optGeo: true, explain: it };
}
function mkBuild(it) {
  const toks = it.geo.split(' ');
  const extra = distractors(it, 2, 'geo').flatMap(x => x.geo.split(' ')).filter(t => !toks.some(k => norm(k) === norm(t)));
  return { type: 'build', label: 'Собери фразу', prompt: it.ru, tokens: shuffle([...toks, ...sample(extra, 1)]), answer: it.geo, explain: it };
}
function mkType(it) { return { type: 'type', label: 'Напиши по-грузински', prompt: it.ru, answer: it.geo, explain: it }; }

function viewPractice(idArg, kind = 'w') {
  const L = LESSONS.find(x => x.id === +idArg); if (!L) return viewHome();
  const items = shuffle(L.items.filter(i => i.kind === kind));
  const n = items.length;
  const qs = items.map((it, i) => {
    const stage = i / n; // от узнавания к воспроизведению
    if (kind === 'w') {
      const typable = [...it.geo].length <= 9 && /^[ა-ჿ]+$/.test(it.geo);
      if (stage < .35) return mkMCQ(it, kaVoice && Math.random() < .4 ? 'listen' : 'g2r');
      if (stage < .7 || !typable) return mkMCQ(it, 'r2g');
      return mkType(it);
    } else {
      const buildable = it.geo.split(' ').length >= 2;
      if (stage < .3) return mkMCQ(it, kaVoice && Math.random() < .4 ? 'listen' : 'g2r');
      if (stage < .55 || !buildable) return mkMCQ(it, 'r2g');
      return mkBuild(it);
    }
  });
  // чередование: 3 карточки из прошлых уроков
  const prevPool = Object.values(ITEMS).filter(x => x.kind === kind && x.lesson < L.id && S.srs[x.id]);
  sample(prevPool, 3).forEach(it => qs.splice(Math.floor(Math.random() * qs.length), 0, Object.assign(mkMCQ(it, Math.random() < .5 ? 'g2r' : 'r2g'), { label: '🔀 Из прошлых уроков' })));
  runExercise({
    title: `${L.emoji} ${L.title} · ${kind === 'w' ? 'слова' : 'фразы'}`, questions: qs, back: `#lesson/${L.id}/practice`,
    onFinish: score => {
      const st = lessonState(L.id); st[kind] = Math.max(st[kind] || 0, score);
      addToSRS(L.items.filter(i => i.kind === kind).map(i => i.id));
      addXP(10 + Math.round(score * 20));
    },
    nextLinks: () => kind === 'w' ? `<a class="btn" href="#practice/${L.id}/p">Теперь фразы →</a>` : `<a class="btn" href="#lesson/${L.id}/mission">🎯 Миссия урока →</a>`,
  });
}

// ============================================================
//  ДВИЖОК УПРАЖНЕНИЙ
// ============================================================
const KB_ROWS = [['qქ','wწ','eე','rრ','tტ','yყ','uუ','iი','oო','pპ'], ['aა','sს','dდ','fფ','gგ','hჰ','jჯ','kკ','lლ'], ['zზ','xხ','cც','vვ','bბ','nნ','mმ'], ['Wჭ','Rღ','Tთ','Sშ','Jჟ','Zძ','Cჩ']];
const KBMAP = {}; KB_ROWS.flat().forEach(k => KBMAP[k[0]] = k.slice(1));
const coarse = matchMedia('(pointer:coarse)').matches;
function geoKeyboard(input) {
  const wrap = document.createElement('div'); wrap.className = 'kb';
  wrap.innerHTML = KB_ROWS.map((r, i) => `<div class="kb-row">${r.map(k => `<button type="button" data-k="${k.slice(1)}"><small>${i === 3 ? '⇧' + k[0].toLowerCase() : k[0]}</small>${k.slice(1)}</button>`).join('')}${i === 3 ? '<button type="button" class="wide" data-k="⌫">⌫</button>' : ''}</div>`).join('') + `<div class="kb-row"><button type="button" class="wide" style="max-width:260px" data-k=" ">пробел</button></div>`;
  wrap.addEventListener('mousedown', e => e.preventDefault());
  wrap.onclick = e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? s;
    if (k === '⌫') { if (s === en && s > 0) { input.value = input.value.slice(0, s - 1) + input.value.slice(en); input.setSelectionRange(s - 1, s - 1); } else { input.value = input.value.slice(0, s) + input.value.slice(en); input.setSelectionRange(s, s); } }
    else { input.value = input.value.slice(0, s) + k + input.value.slice(en); input.setSelectionRange(s + 1, s + 1); }
    input.dispatchEvent(new Event('input'));
  };
  // физическая клавиатура: любая раскладка → грузинская по положению клавиш
  input.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || /[ა-ჿ]/.test(e.key) || !/^Key[A-Z]$/.test(e.code)) return;
    const l = e.code[3]; const ch = (e.shiftKey && KBMAP[l]) || KBMAP[l.toLowerCase()];
    if (!ch) return; e.preventDefault();
    const s = input.selectionStart, en = input.selectionEnd;
    input.value = input.value.slice(0, s) + ch + input.value.slice(en); input.setSelectionRange(s + 1, s + 1);
  });
  if (coarse) input.setAttribute('inputmode', 'none');
  return wrap;
}

function runExercise({ title, questions, back, onFinish, nextLinks }) {
  const queue = questions.map(q => ({ ...q, tries: 0 }));
  const total = queue.length; let done = 0, firstTry = 0; const missed = [];
  let answered = false;

  function render() {
    const q = queue[0]; answered = false;
    const pct = Math.round(done / total * 100);
    const exGeo = q.explain && q.explain.geo;
    let inner = '';
    if (q.type === 'mcq') {
      inner = `<div class="opts">${q.options.map((o, i) => `<button class="opt ${q.optGeo ? 'geo' : ''}" data-v="${esc(o.v)}" ${q.bigOpts ? 'style="font-size:34px;text-align:center"' : ''}><span class="k">${i + 1}</span>${esc(o.text)}${q.optGeo && !q.bigOpts ? ` <span class="tr small" style="margin-left:6px">${esc(translit(o.text))}</span>` : ''}</button>`).join('')}</div>`;
    } else if (q.type === 'build') {
      inner = `<div class="build-answer" id="ba"></div><div class="build-pool" id="bp">${q.tokens.map((t, i) => `<button class="tok" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
    } else if (q.type === 'type') {
      inner = `<input class="type-input" id="ti" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ქართულად…"><div id="kbh"></div>
        <p class="muted small">Печатай латиницей на своей клавиатуре — буквы превратятся в грузинские (a→ა, Shift+t→თ). <button class="btn sm light" id="hint" type="button">Подсказка</button></p>`;
    }
    const promptHTML = q.listen
      ? `<button class="btn" id="listenBtn" style="font-size:22px;padding:18px 28px">🔊 Слушать</button>`
      : `<div class="q-prompt ${q.promptGeo ? 'geo' : ''}" ${q.big ? 'style="font-size:64px"' : ''}>${esc(q.prompt)}</div>${q.promptGeo && !q.hideTr && !q.big ? `<div class="q-sub">${trHTML(q.prompt)}</div>` : '<div class="q-sub"></div>'}`;
    app.innerHTML = `<div class="ex-wrap">
      <div class="row"><a href="${back}" class="small">✕ Выйти</a><span class="spacer"></span><span class="small muted">${esc(title)}</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="card">
        <div class="q-label">${esc(q.label)}${q.tries ? ' · ещё раз' : ''}</div>
        ${promptHTML}
        ${inner}
        <div class="feedback" id="fb"></div>
        <div class="ex-foot">${q.type !== 'mcq' ? '<button class="btn ghost" id="skip">Не знаю</button><button class="btn" id="check">Проверить</button>' : ''}<button class="btn" id="next" style="display:none">Дальше →</button></div>
      </div>
      <p class="muted small" style="text-align:center;margin-top:10px">Клавиши: ${q.type === 'mcq' ? '<kbd>1</kbd>–<kbd>4</kbd> выбор, ' : ''}<kbd>Enter</kbd> дальше</p>
    </div>`;

    if (q.listen) { $('#listenBtn').onclick = () => speak(q.listen); setTimeout(() => speak(q.listen), 250); }
    if (q.type === 'mcq') $$('.opt').forEach(b => b.onclick = () => answer(b.dataset.v === String(q.answer), b));
    if (q.type === 'build') {
      const ba = $('#ba'), bp = $('#bp'); const picked = [];
      bp.onclick = e => { const b = e.target.closest('.tok'); if (!b || answered) return; b.classList.add('used'); picked.push(+b.dataset.i); const c = document.createElement('button'); c.className = 'tok'; c.textContent = q.tokens[+b.dataset.i]; c.dataset.i = b.dataset.i; ba.appendChild(c); };
      ba.onclick = e => { const b = e.target.closest('.tok'); if (!b || answered) return; picked.splice(picked.indexOf(+b.dataset.i), 1); bp.querySelector(`[data-i="${b.dataset.i}"]`).classList.remove('used'); b.remove(); };
      $('#check').onclick = () => { if (!picked.length) return; answer(norm(picked.map(i => q.tokens[i]).join(' ')) === norm(q.answer)); };
    }
    if (q.type === 'type') {
      const ti = $('#ti'); $('#kbh').appendChild(geoKeyboard(ti)); if (!coarse) ti.focus();
      $('#check').onclick = () => { if (!ti.value.trim()) return; answer(norm(ti.value) === norm(q.answer)); };
      $('#hint').onclick = () => { $('.q-sub').innerHTML = `подсказка: ${esc(translit(q.answer))}`; $('.q-sub').style.display = 'block'; q.hinted = true; };
    }
    const sk = $('#skip'); if (sk) sk.onclick = () => answer(false);
    $('#next').onclick = advance;
    keyHandler = e => {
      if (e.key === 'Enter') { e.preventDefault(); if (answered) advance(); else if ($('#check')) $('#check').click(); return; }
      if (!answered && q.type === 'mcq' && /^[1-4]$/.test(e.key)) { const b = $$('.opt')[+e.key - 1]; if (b) b.click(); }
    };
  }

  function answer(ok, btn) {
    if (answered) return; answered = true;
    const q = queue[0];
    $$('.opt').forEach(b => { b.disabled = true; if (b.dataset.v === String(q.answer)) b.classList.add('right'); });
    if (btn && !ok) btn.classList.add('wrong');
    $$('#check,#skip').forEach(b => b.style.display = 'none');
    const ti = $('#ti'); if (ti) { ti.readOnly = true; ti.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; }
    const ex = q.explain || {};
    const fb = $('#fb'); fb.className = 'feedback show ' + (ok ? 'ok' : 'bad');
    fb.innerHTML = `<div class="row"><b>${ok ? (['ყოჩაღ! Отлично!', 'სწორია! Верно!', 'Браво! 👏'][Math.floor(Math.random() * 3)]) : 'Не совсем. Правильно:'}</b></div>
      ${ex.geo ? `<div class="row" style="margin-top:6px">${sayBtn(ex.geo)}<div><div class="geo">${esc(ex.geo)}</div><span class="tr" style="color:var(--gold)">${esc(translit(ex.geo))}</span> <span style="color:var(--ink)">— ${esc(ex.ru)}</span></div></div>` : ''}`;
    if (ex.geo && kaVoice) speak(ex.geo);
    if (ok && !q.tries && !q.hinted) firstTry++;
    if (!ok) { if (!q.tries) missed.push(ex); queue.push({ ...q, tries: q.tries + 1, options: q.options && shuffle(q.options), tokens: q.tokens && shuffle(q.tokens) }); }
    else done++;
    $('#next').style.display = ''; $('#next').focus({ preventScroll: true });
  }
  function advance() { queue.shift(); if (queue.length) render(); else finish(); }
  function finish() {
    keyHandler = null;
    const score = firstTry / total;
    onFinish && onFinish(score);
    const pct = Math.round(score * 100);
    app.innerHTML = `<div class="ex-wrap"><div class="card result">
      <div class="big">${pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : '💪'}</div>
      <h2>${pct >= 90 ? 'ბრწყინვალე! Блестяще!' : pct >= 70 ? 'კარგია! Хорошо!' : 'Хорошая тренировка!'}</h2>
      <p class="muted">С первой попытки: <b>${firstTry} из ${total}</b> (${pct}%). Ошибки повторены до правильного ответа.</p>
      ${missed.length ? `<div style="text-align:left;margin:18px 0"><div class="q-label">Обрати внимание</div><div class="items">${missed.filter(m => m.geo).map(m => itemRow(m)).join('')}</div></div>` : ''}
      <div class="row" style="justify-content:center;margin-top:16px">${nextLinks ? nextLinks(score) : ''}<button class="btn ghost" id="again">Ещё раз</button><a class="btn light" href="${back}">Назад</a></div>
    </div></div>`;
    $('#again').onclick = () => route();
  }
  render();
}

// ============================================================
//  ПОВТОРЕНИЕ (SRS)
// ============================================================
function viewReview() {
  let queue = shuffle(dueIds()).slice(0, 40);
  if (!Object.keys(S.srs).length) {
    app.innerHTML = `<div class="empty"><div class="big">🔁</div><h2>Здесь будут твои карточки</h2><p>Пройди тренировку алфавита или урока — слова автоматически попадут в интервальные повторения.</p><a class="btn" href="#home">К урокам</a></div>`; return;
  }
  if (!queue.length) {
    const next = Math.min(...Object.values(S.srs).map(c => c.due));
    const days = Math.max(1, Math.round((next - Date.now()) / 864e5));
    app.innerHTML = `<div class="empty"><div class="big">✅</div><h2>На сегодня всё повторено!</h2><p>Следующие карточки — через ${days} дн. Карточек всего: ${Object.keys(S.srs).length}, выучено надёжно: ${learnedCount()}.</p><a class="btn" href="#home">На главную</a></div>`; return;
  }
  const startN = queue.length; let reviewed = 0;
  function render() {
    if (!queue.length) { addXP(reviewed); app.innerHTML = `<div class="empty"><div class="big">🏆</div><h2>ყოჩაღ! Повторение завершено</h2><p>Повторено карточек: ${reviewed}. Серия: 🔥 ${S.streak.count} дн.</p><a class="btn" href="#home">На главную</a></div>`; keyHandler = null; return; }
    const id = queue[0], it = ITEMS[id], c = S.srs[id];
    const reverse = it.kind !== 'l' && c.r >= 2 && Math.random() < .5;
    let revealed = false;
    const front = reverse
      ? `<div class="q-label">Скажи вслух по-грузински</div><div class="big">${esc(it.ru)}</div>`
      : `<div class="q-label">${it.kind === 'l' ? 'Как читается буква?' : 'Что это значит?'}</div><div class="big geo" ${it.kind === 'l' ? 'style="font-size:90px"' : ''}>${esc(it.geo)}</div>${it.kind !== 'l' ? `<div class="q-sub">${trHTML(it.geo)}</div>` : ''}`;
    const backHTML = it.kind === 'l'
      ? `<h3>${esc(it.ru)}</h3><div class="row" style="justify-content:center">${sayBtn(it.kw)}<span class="geo" style="font-size:22px">${esc(it.kw)}</span> — ${esc(it.kwru)}</div>`
      : reverse ? `<div class="row" style="justify-content:center">${sayBtn(it.geo)}<span class="big geo" style="font-size:32px">${esc(it.geo)}</span></div><div>${trHTML(it.geo)}</div>`
      : `<h3 style="margin:0">${esc(it.ru)}</h3>${sayBtn(it.geo)}`;
    app.innerHTML = `<div class="ex-wrap">
      <div class="row"><a href="#home" class="small">✕ Выйти</a><span class="spacer"></span><span class="small muted">Осталось: ${queue.length}</span></div>
      <div class="progress"><i style="width:${Math.round(Math.min(1, reviewed / Math.max(startN, 1)) * 100)}%"></i></div>
      <div class="card flash" id="fc">${front}<div class="back" id="back" style="display:none">${backHTML}</div>
        <p class="muted small" id="tapHint" style="margin-top:20px">Вспомни ответ, потом нажми (или <kbd>пробел</kbd>)</p></div>
      <div class="grades" id="gr" style="display:none">
        <button class="gr0" data-q="1">Забыл<small>сегодня ещё раз</small></button>
        <button class="gr1" data-q="3">Трудно<small>${c.r === 0 ? '1 дн' : 'скоро'}</small></button>
        <button class="gr2" data-q="4">Хорошо<small>${c.r === 0 ? '1 дн' : c.r === 1 ? '4 дн' : Math.round(c.i * c.e) + ' дн'}</small></button>
        <button class="gr3" data-q="5">Легко<small>${c.r === 0 ? '3 дн' : c.r === 1 ? '6 дн' : Math.round(c.i * c.e * 1.3) + ' дн'}</small></button>
      </div></div>`;
    const reveal = () => { if (revealed) return; revealed = true; $('#back').style.display = ''; $('#tapHint').style.display = 'none'; $('#gr').style.display = ''; if (kaVoice) speak(it.kind === 'l' ? it.kw : it.geo); };
    $('#fc').onclick = e => { if (!e.target.closest('[data-say]')) reveal(); };
    $$('#gr button').forEach(b => b.onclick = () => grade(+b.dataset.q));
    function grade(q) { gradeCard(id, q); queue.shift(); reviewed++; if (q < 3) queue.splice(Math.min(queue.length, 3 + Math.floor(Math.random() * 3)), 0, id); render(); }
    keyHandler = e => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (revealed && /^[1-4]$/.test(e.key)) grade([1, 3, 4, 5][+e.key - 1]);
    };
  }
  render();
}

// ============================================================
//  ЧИСЛА
// ============================================================
const UNITS = ['ნული', 'ერთი', 'ორი', 'სამი', 'ოთხი', 'ხუთი', 'ექვსი', 'შვიდი', 'რვა', 'ცხრა', 'ათი', 'თერთმეტი', 'თორმეტი', 'ცამეტი', 'თოთხმეტი', 'თხუთმეტი', 'თექვსმეტი', 'ჩვიდმეტი', 'თვრამეტი', 'ცხრამეტი'];
const TWENTIES = ['', 'ოც', 'ორმოც', 'სამოც', 'ოთხმოც'];
const stem = w => w.endsWith('ი') ? w.slice(0, -1) : w;
function numGeo(n) {
  if (n < 20) return UNITS[n];
  if (n < 100) { const t = Math.floor(n / 20), r = n % 20; return r ? TWENTIES[t] + 'და' + UNITS[r] : TWENTIES[t] + 'ი'; }
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; const hw = h === 1 ? 'ას' : stem(UNITS[h]) + 'ას'; return r ? hw + ' ' + numGeo(r) : hw + 'ი'; }
  const th = Math.floor(n / 1000), r = n % 1000; const tw = th === 1 ? 'ათას' : numGeo(th) + ' ათას'; return r ? tw + ' ' + numGeo(r) : tw + 'ი';
}
function viewNumbers(range = '20') {
  const ranges = { '20': ['1–20', 20], '100': ['1–100', 100], '1000': ['до 1000', 1000], 'price': ['Цены 💰', 0] };
  let streak = 0, mode;
  app.innerHTML = `<a href="#home" class="small">← Главная</a><h1>Числа и цены</h1>
    <p class="muted">Грузинские числа строятся двадцатками: 30 = «20 и 10», 50 = «2×20 и 10». Подробно — в <a href="#lesson/2/grammar">уроке 2</a>. Тренируй, пока не начнёшь понимать цены на рынке без пересчёта.</p>
    <div class="row" style="margin:14px 0">${Object.entries(ranges).map(([k, [n]]) => `<button class="chip ${k === range ? 'on' : ''}" data-r="${k}">${n}</button>`).join('')}<span class="spacer"></span><span class="streak" id="nstreak">✓ 0 подряд</span></div>
    <div class="ex-wrap"><div class="card" id="nc"></div></div>`;
  $$('[data-r]').forEach(b => b.onclick = () => viewNumbers(b.dataset.r));
  function gen() {
    if (range === 'price') { const l = 1 + Math.floor(Math.random() * 60), t = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 75, 45, 95][Math.floor(Math.random() * 14)]; return { n: l + t / 100, geo: `${numGeo(l)} ლარი${t ? ' და ' + numGeo(t) + ' თეთრი' : ''}`, digits: t ? `${l}.${String(t).padStart(2, '0')}` : `${l}` }; }
    const max = ranges[range][1]; const n = 1 + Math.floor(Math.random() * max); return { n, geo: numGeo(n), digits: String(n) };
  }
  function next() {
    const x = gen(); mode = Math.random() < .6 ? 'read' : 'pick';
    const nc = $('#nc'); let answered = false;
    if (mode === 'read') {
      nc.innerHTML = `<div class="q-label">Напиши цифрами</div><div class="row">${sayBtn(x.geo)}<div class="q-prompt geo" style="font-size:28px">${esc(x.geo)}</div></div><div class="q-sub">${trHTML(x.geo)}</div>
        <input class="type-input" id="ni" inputmode="decimal" autocomplete="off" placeholder="${range === 'price' ? 'например 3.50' : 'число'}" style="font-family:Inter">
        <div class="feedback" id="fb"></div><div class="ex-foot"><button class="btn" id="go">Проверить</button></div>`;
      const ni = $('#ni'); ni.focus();
      const check = () => {
        if (answered) return next(); if (!ni.value.trim()) return;
        answered = true; const v = parseFloat(ni.value.replace(',', '.')); const ok = Math.abs(v - x.n) < 0.001;
        fb(ok, x); $('#go').textContent = 'Дальше →';
      };
      $('#go').onclick = check; keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); check(); } };
    } else {
      const opts = new Set([x.geo]); let guard = 0;
      while (opts.size < 4 && guard++ < 50) { const y = gen(); if (Math.abs(y.n - x.n) > 0) opts.add(y.geo); }
      const list = shuffle([...opts]);
      nc.innerHTML = `<div class="q-label">Выбери, как это сказать</div><div class="q-prompt" style="font-size:44px">${range === 'price' ? x.digits + ' ₾' : x.digits}</div>
        <div class="opts">${list.map((o, i) => `<button class="opt geo" data-v="${esc(o)}"><span class="k">${i + 1}</span>${esc(o)}</button>`).join('')}</div>
        <div class="feedback" id="fb"></div><div class="ex-foot"><button class="btn" id="go" style="display:none">Дальше →</button></div>`;
      const pick = b => { if (answered) return; answered = true; const ok = b.dataset.v === x.geo; $$('.opt').forEach(o => { o.disabled = true; if (o.dataset.v === x.geo) o.classList.add('right'); }); if (!ok) b.classList.add('wrong'); fb(ok, x); $('#go').style.display = ''; };
      $$('.opt').forEach(b => b.onclick = () => pick(b));
      $('#go').onclick = next;
      keyHandler = e => { if (e.key === 'Enter' && answered) next(); else if (!answered && /^[1-4]$/.test(e.key)) pick($$('.opt')[+e.key - 1]); };
    }
  }
  function fb(ok, x) {
    streak = ok ? streak + 1 : 0; $('#nstreak').textContent = `✓ ${streak} подряд`;
    if (ok && streak % 10 === 0) addXP(5);
    const f = $('#fb'); f.className = 'feedback show ' + (ok ? 'ok' : 'bad');
    f.innerHTML = `<b>${ok ? 'სწორია! Верно!' : 'Правильно:'}</b> ${esc(x.digits)} = <span class="geo" style="color:var(--ink)">${esc(x.geo)}</span>`;
    if (kaVoice) speak(x.geo);
  }
  next();
}

// ============================================================
//  РАЗГОВОРНИК
// ============================================================
function viewPhrasebook() {
  app.innerHTML = `<h1>Разговорник</h1><p class="muted">Все слова и фразы курса. Ищи по-русски, по-грузински или транскрипцией.</p>
    <input class="search" id="q" placeholder="Например: сколько стоит, ყავა, мадлоба…" autocomplete="off">
    <div id="res"></div>`;
  const q = $('#q'), res = $('#res');
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const match = it => !s || it.ru.toLowerCase().includes(s) || it.geo.includes(s) || translit(it.geo).replace(/’/g, '').includes(s.replace(/['’]/g, ''));
    res.innerHTML = LESSONS.map(L => { const its = L.items.filter(match).sort((a, b) => (b.kind === 'p') - (a.kind === 'p')); return its.length ? `<div class="sec-title"><h3 style="margin:0">${L.emoji} ${esc(L.title)}</h3><a class="small" href="#lesson/${L.id}">к уроку →</a></div><div class="items">${its.map(itemRow).join('')}</div>` : ''; }).join('') || '<div class="empty">Ничего не найдено</div>';
  };
  q.oninput = draw; draw(); if (!coarse) q.focus();
}

// ============================================================
//  МЕТОДИКА
// ============================================================
function viewMethod() {
  app.innerHTML = `<a href="#home" class="small">← Главная</a><h1>Как учиться</h1>
    <p class="muted">Курс идёт по темам учебника «Билики» (путь от алфавита к бытовым ситуациям), но построен на методиках, которые доказанно работают для взрослых.</p>
    <div class="card" style="margin:16px 0">
      <h3>📅 План на день — 15–20 минут</h3>
      <ol style="margin:0;padding-left:20px;line-height:1.9">
        <li><b>5 мин — <a href="#review">Повторение</a>.</b> Всегда сначала. Не пропускай: это фундамент.</li>
        <li><b>10 мин — новый материал:</b> одна вкладка урока (слова → фразы → диалог → грамматика → практика). Один урок ≈ 3–5 дней.</li>
        <li><b>1 миссия в жизни.</b> Скажи что-то по-грузински реальному человеку.</li>
        <li><b>Бонус:</b> читай вывески на улице, слушай, как говорят в маршрутке. Ты погружён(а) в язык каждый день — используй это.</li>
      </ol>
    </div>
    <div class="grid g2">${METHOD.map(([ic, t, d]) => `<div class="card method"><div class="ic">${ic}</div><div><h3>${t}</h3><p class="muted small" style="margin:0">${d}</p></div></div>`).join('')}</div>
    <div class="card" style="margin-top:16px">
      <h3>🔊 Про озвучку</h3>
      <p class="small" style="margin:0">Озвучка использует голоса вашей системы. Грузинские голоса гарантированно есть в браузере <b>Microsoft Edge</b> (Windows, Mac, Android, iPhone) — голоса Eka и Giorgi. ${kaVoice ? `<br>✅ Сейчас найден голос: <b>${esc(kaVoice.name)}</b>.` : '<br>⚠️ В текущем браузере грузинский голос не найден — кнопки 🔊 подскажут, что делать.'}</p>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>⌨️ Грузинская клавиатура</h3>
      <p class="small" style="margin:0">Печатай латинскими клавишами — сайт сам превратит их в грузинские буквы (стандартная раскладка): a→ა, b→ბ, g→გ… Для «двойных» звуков — Shift: <b>Shift+t → თ</b>, <b>Shift+w → ჭ</b>, <b>Shift+r → ღ</b>, <b>Shift+s → შ</b>, <b>Shift+c → ჩ</b>, <b>Shift+z → ძ</b>, <b>Shift+j → ჟ</b>. Добавьте грузинскую раскладку в телефон — пригодится для переписки.</p>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>💾 Прогресс</h3>
      <p class="small">Весь прогресс хранится в этом браузере. Очков: ${S.xp}, карточек: ${Object.keys(S.srs).length}.</p>
      <button class="btn sm ghost" id="reset">Сбросить прогресс</button>
    </div>`;
  $('#reset').onclick = () => { if (confirm('Точно стереть весь прогресс?')) { S = defaults(); save(); toast('Прогресс сброшен'); route(); } };
}

// route() вызывается в конце reader.js
