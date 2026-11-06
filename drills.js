// ============================================================
//  Упражнения к каждому блоку: произношение, письмо, перевод.
//  Типы заданий как в учебниках для иностранцев (вкл. «Билики»),
//  сами задания генерируются из слов и фраз курса.
// ============================================================

// ---------- трудные звуки ----------
const SOUND_TIPS = {
  'ყ': 'ყ — очень глубокий «къ» из самого горла',
  'ღ': 'ღ — звонкое «гъ» в горле, как французское r',
  'ხ': 'ხ — «х», глубже русского',
  'კ': 'კ — гортанный к’: задержи дыхание и «щёлкни» горлом',
  'ტ': 'ტ — гортанный т’: без выдоха, со «щелчком»',
  'პ': 'პ — гортанный п’: губы сомкнуты, без выдоха',
  'წ': 'წ — гортанный ц’: резко, без выдоха',
  'ჭ': 'ჭ — гортанный ч’: резко, без выдоха',
  'ქ': 'ქ — «к» с лёгким выдохом',
  'თ': 'თ — «т» с лёгким выдохом',
  'ფ': 'ფ — «п» с лёгким выдохом',
  'ც': 'ც — «ц» с лёгким выдохом',
  'ჩ': 'ჩ — «ч» с лёгким выдохом',
  'ძ': 'ძ — «дз» одним звуком',
  'ჯ': 'ჯ — «дж» одним звуком',
  'ჟ': 'ჟ — «ж»',
};
const HARD = 'ყღკტპწჭ';
// группы похожих звуков: какой из них в слове?
const SOUND_SETS = [
  { letters: 'ქკყ', label: { 'ქ': 'ქ — к с выдохом', 'კ': 'კ — к’ гортанный', 'ყ': 'ყ — къ глубокий' } },
  { letters: 'თტდ', label: { 'თ': 'თ — т с выдохом', 'ტ': 'ტ — т’ гортанный', 'დ': 'დ — д звонкий' } },
  { letters: 'ფპბ', label: { 'ფ': 'ფ — п с выдохом', 'პ': 'პ — п’ гортанный', 'ბ': 'ბ — б звонкий' } },
  { letters: 'ცწძ', label: { 'ც': 'ც — ц с выдохом', 'წ': 'წ — ц’ гортанный', 'ძ': 'ძ — дз звонкий' } },
  { letters: 'ჩჭჯ', label: { 'ჩ': 'ჩ — ч с выдохом', 'ჭ': 'ჭ — ч’ гортанный', 'ჯ': 'ჯ — дж звонкий' } },
  { letters: 'ღხგ', label: { 'ღ': 'ღ — гъ в горле', 'ხ': 'ხ — х', 'გ': 'გ — г обычный' } },
];
const setOf = ch => SOUND_SETS.find(s => s.letters.includes(ch));
const hiliteHTML = geo => [...geo].map(c => SOUND_TIPS[c] ? `<span class="hl ${HARD.includes(c) ? 'hard' : ''}">${c}</span>` : esc(c)).join('');
const hardness = geo => [...geo].filter(c => HARD.includes(c)).length * 2 + [...geo].filter(c => SOUND_TIPS[c]).length + (/[^აეიოუ\s]{4,}/.test(geo) ? 2 : 0);

// ---------- запись голоса и распознавание ----------
let recorder = null, recStream = null, recUrl = null;
function stopRecording() { try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (e) {} }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function sayPanelHTML(q) {
  return `<div class="saybox">
    ${q.tips.length ? `<div class="small" style="margin:10px 0">${q.tips.map(t => `<div>🔸 ${esc(t)}</div>`).join('')}</div>` : ''}
    ${/[^აეიოუ\s]{4,}/.test(q.prompt) ? '<div class="small" style="margin-bottom:10px">🔸 Много согласных подряд — не вставляй между ними гласные.</div>' : ''}
    <ol class="small muted" style="padding-left:18px;margin:8px 0">
      <li>Послушай образец (или прочитай по транскрипции).</li><li>Скажи вслух 3 раза — медленно, потом в обычном темпе.</li><li>Запиши себя и сравни с образцом.</li></ol>
    <div class="row">
      <button class="btn sm light" id="sayListen">🔊 Образец</button>
      ${navigator.mediaDevices && window.MediaRecorder ? '<button class="btn sm light" id="recBtn">🎙 Записать себя</button><button class="btn sm light" id="recPlay" style="display:none">▶︎ Моя запись</button>' : ''}
      ${SR ? '<button class="btn sm light" id="srBtn">🎤 Проверить распознаванием</button>' : ''}
    </div>
    <div id="srOut" class="small" style="margin-top:8px"></div></div>`;
}
function bindSayPanel(q) {
  $('#sayListen').onclick = () => speak(q.prompt);
  const rb = $('#recBtn');
  if (rb) rb.onclick = async () => {
    if (recorder && recorder.state === 'recording') { stopRecording(); return; }
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = []; recorder = new MediaRecorder(recStream);
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        recStream.getTracks().forEach(t => t.stop());
        if (recUrl) URL.revokeObjectURL(recUrl);
        recUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        const b = $('#recBtn'); if (b) b.textContent = '🎙 Записать ещё раз';
        const pb = $('#recPlay'); if (pb) { pb.style.display = ''; pb.onclick = () => new Audio(recUrl).play(); new Audio(recUrl).play(); }
      };
      recorder.start(); rb.textContent = '⏹ Стоп';
      setTimeout(stopRecording, 6000);
    } catch (e) { toast('Нет доступа к микрофону: разреши его в настройках браузера.'); }
  };
  const sb = $('#srBtn');
  if (sb) sb.onclick = () => {
    const out = $('#srOut'); const r = new SR(); r.lang = 'ka-GE'; r.interimResults = false; r.maxAlternatives = 5;
    out.textContent = '🎤 Говори…';
    r.onresult = e => {
      const alts = [...e.results[0]].map(a => a.transcript);
      const target = norm(q.prompt);
      const hit = alts.some(a => norm(a) === target || norm(a).includes(target) || target.includes(norm(a)) && norm(a).length > target.length * .7);
      out.innerHTML = hit ? `✅ Распознано верно: <span class="geo">${esc(alts[0])}</span>` : `🤔 Услышано: <span class="geo">${esc(alts[0])}</span> — попробуй ещё раз, чётче выделяя трудные звуки.`;
    };
    r.onerror = e => { out.textContent = e.error === 'language-not-supported' ? 'Этот браузер не распознаёт грузинскую речь. Используй запись и сравнение.' : e.error === 'not-allowed' ? 'Нет доступа к микрофону.' : 'Не расслышал. Попробуй ещё раз.'; };
    r.onend = () => { if (out.textContent === '🎤 Говори…') out.textContent = 'Ничего не услышал — попробуй ещё раз.'; };
    try { r.start(); } catch (e) { out.textContent = 'Распознавание недоступно.'; }
  };
}

// ---------- блоки урока ----------
function lessonBlocks(L) {
  const blocks = [
    { key: 'w', name: '📝 Слова урока', items: L.items.filter(i => i.kind === 'w') },
    { key: 'p', name: '💬 Фразы', items: L.items.filter(i => i.kind === 'p') },
    { key: 'd', name: '🎭 Диалог', items: L.dialogue.lines.filter(l => l[0] !== '—').map(([, geo, ru], i) => ({ id: `${L.id}d${i}`, geo, ru, kind: 'd', lesson: L.id })) },
  ];
  (VOCAB[L.id] || []).forEach((g, gi) => blocks.push({ key: 'x' + gi, name: g.name, items: L.items.filter(i => i.kind === 'x' && i.group === gi) }));
  return blocks;
}
const cleanGeo = g => g.replace(/[?!.,«»„“]/g, '').trim();

// ---------- генераторы ----------
function genPronunciation(items) {
  const qs = [];
  const ranked = shuffle(items).sort((a, b) => hardness(b.geo) - hardness(a.geo));
  // 1) какой звук? (различение похожих звуков)
  const cands = shuffle(items.filter(it => [...it.geo].some(c => setOf(c))));
  cands.slice(0, 4).forEach(it => {
    const chars = [...it.geo]; const idxs = chars.map((c, i) => setOf(c) ? i : -1).filter(i => i >= 0);
    const pos = idxs.sort((a, b) => HARD.includes(chars[b]) - HARD.includes(chars[a]))[0];
    const ch = chars[pos]; const set = setOf(ch);
    const shown = chars.map((c, i) => i === pos ? '<span class="gap">?</span>' : esc(c)).join('');
    qs.push({ type: 'mcq', label: '🗣 Какой звук пропущен?', html: `<div class="q-prompt geo">${shown}</div><div class="q-sub" style="color:var(--muted);font-style:normal">${esc(it.ru)}</div>`, listen: canAutoSpeak(it.geo) ? it.geo : null,
      options: shuffle([...set.letters]).map(x => ({ v: x, text: set.label[x] })), answer: ch, optGeo: false, explain: { geo: it.geo, ru: `${it.ru}. ${SOUND_TIPS[ch] || ''}` } });
  });
  // 2) произнеси вслух
  ranked.slice(0, 6).forEach(it => {
    const tips = [...new Set([...it.geo].filter(c => SOUND_TIPS[c] && (HARD.includes(c) || 'ქთფცჩ'.includes(c))))].slice(0, 3).map(c => SOUND_TIPS[c]);
    qs.push({ type: 'say', label: '🗣 Произнеси вслух', prompt: it.geo, tips, noRepeat: true, skipLabel: 'Ещё потренируюсь', checkLabel: 'Получилось ✓',
      html: `<div class="q-prompt geo">${hiliteHTML(it.geo)}</div><div class="q-sub">${trHTML(it.geo)} <span style="color:var(--muted);font-style:normal">— ${esc(it.ru)}</span></div>`, explain: it });
  });
  return qs;
}
function genWriting(items) {
  const qs = [];
  const words = items.filter(it => cleanGeo(it.geo).length >= 2);
  // 1) вставь пропущенную букву
  shuffle(words).slice(0, 5).forEach(it => {
    const g = cleanGeo(it.geo); const chars = [...g];
    const idxs = chars.map((c, i) => /[ა-ჿ]/.test(c) ? i : -1).filter(i => i >= 0);
    const pref = idxs.filter(i => setOf(chars[i]));
    const pos = (pref.length ? sample(pref, 1) : sample(idxs, 1))[0]; const ch = chars[pos];
    const set = setOf(ch);
    let opts = set ? [...set.letters] : [ch];
    while (opts.length < 4) { const r = ALPHABET[Math.floor(Math.random() * ALPHABET.length)][0]; if (!opts.includes(r)) opts.push(r); }
    const shown = chars.map((c, i) => i === pos ? '<span class="gap">＿</span>' : esc(c)).join('');
    qs.push({ type: 'mcq', label: '✍️ Вставь пропущенную букву', html: `<div class="q-prompt geo">${shown}</div><div class="q-sub" style="color:var(--muted);font-style:normal">${esc(it.ru)}</div>`,
      options: shuffle(opts).map(x => ({ v: x, text: x })), answer: ch, optGeo: true, bigOpts: true, explain: it });
  });
  // 2) диктант по транскрипции: напиши грузинскими буквами
  const short = words.filter(it => cleanGeo(it.geo).split(' ').length <= 3);
  shuffle(short).slice(0, 4).forEach(it => qs.push({ type: 'type', label: '✍️ Запиши грузинскими буквами', prompt: `«${translit(cleanGeo(it.geo))}»`, answer: cleanGeo(it.geo), explain: it,
    html: `<div class="q-prompt">«${esc(translit(cleanGeo(it.geo)))}»</div><div class="q-sub" style="color:var(--muted);font-style:normal">${esc(it.ru)}</div>` }));
  // 3) диктант на слух
  shuffle(short).slice(0, 3).filter(it => canAutoSpeak(it.geo)).forEach(it => qs.push({ type: 'type', label: '🎧 Диктант: послушай и запиши', listen: it.geo, prompt: '', answer: cleanGeo(it.geo), explain: it }));
  return qs;
}
function genTranslation(items) {
  const qs = [];
  const pool = shuffle(items);
  // 1) с грузинского — устно, с самопроверкой
  pool.slice(0, 4).forEach(it => qs.push({ type: 'self', label: '🔄 Переведи на русский (вслух или про себя)', prompt: it.geo, promptGeo: true, answerText: it.ru, noRepeat: true, explain: it }));
  // 2) на грузинский: собрать фразу / написать слово / выбрать
  pool.slice(4, 10).forEach((it, i) => {
    const g = cleanGeo(it.geo); const n = g.split(' ').length;
    if (n >= 2) qs.push({ type: 'build', label: '🔄 Переведи на грузинский: собери фразу', prompt: it.ru, tokens: shuffle(g.split(' ')), answer: g, explain: it });
    else if ([...g].length <= 10 && i % 2 === 0) qs.push({ type: 'type', label: '🔄 Переведи на грузинский и напиши', prompt: it.ru, answer: g, explain: it });
    else qs.push(drillMCQ(it, items));
  });
  return qs;
}
function drillMCQ(it, pool) {
  const others = sample(pool.filter(x => x.geo !== it.geo), 3);
  while (others.length < 3) { const r = sample(Object.values(ITEMS).filter(x => x.kind === 'w' && x.geo !== it.geo && !others.includes(x)), 1)[0]; if (!r) break; others.push(r); }
  return { type: 'mcq', label: '🔄 Как сказать по-грузински?', prompt: it.ru, options: shuffle([it, ...others]).map(x => ({ v: x.geo, text: x.geo })), answer: it.geo, optGeo: true, explain: it };
}
const DRILLS = {
  pron: { name: '🗣 Произношение', desc: 'Различай похожие звуки (ქ/კ/ყ, თ/ტ, ც/წ…) и произноси вслух: образец → повтор → запись себя → сравнение.', gen: genPronunciation },
  write: { name: '✍️ Письмо', desc: 'Вставь пропущенную букву, запиши слово по транскрипции, диктант на слух.', gen: genWriting },
  tr: { name: '🔄 Перевод', desc: 'С грузинского — устно с самопроверкой, на грузинский — собери фразу или напиши.', gen: genTranslation },
};

// ---------- вкладка урока ----------
let drillBlock = {};
function drillsTabHTML(L) {
  const blocks = lessonBlocks(L); const cur = drillBlock[L.id] || 'all';
  const res = (lessonState(L.id).d) || {};
  return `<p class="muted small">Выбери блок и тип упражнения. Каждое упражнение каждый раз собирается заново из слов блока — повторяй сколько угодно.</p>
    <div class="row" style="margin:10px 0 16px;gap:6px">${[{ key: 'all', name: '📚 Весь урок' }, ...blocks].map(b => `<button class="chip ${b.key === cur ? 'on' : ''}" data-blk="${b.key}">${esc(b.name)}</button>`).join('')}</div>
    <div class="grid g3">${Object.entries(DRILLS).map(([k, d]) => { const sc = res[k + '_' + cur]; return `<div class="card"><h3>${d.name}</h3><p class="muted small">${d.desc}</p>
      ${sc != null ? `<p class="small">Лучший результат: <b style="color:var(--ok)">${Math.round(sc * 100)}%</b></p>` : ''}<a class="btn sm" href="#drill/${L.id}/${k}/${cur}">Начать</a></div>`; }).join('')}</div>
    <div class="tip" style="margin-top:16px">💡 Произношение с записью голоса лучше делать в тихом месте. Проверка распознаванием работает в Chrome и на Android; если её нет, сравнивай свою запись с образцом на слух.</div>`;
}
function bindDrillsTab(L) { $$('[data-blk]').forEach(b => b.onclick = () => { drillBlock[L.id] = b.dataset.blk; viewLesson(L.id, 'drills'); }); }

function viewDrill(idArg, kind, blk = 'all') {
  const L = LESSONS.find(x => x.id === +idArg); const d = DRILLS[kind]; if (!L || !d) return viewHome();
  const blocks = lessonBlocks(L);
  const items = blk === 'all' ? [...blocks[0].items, ...blocks[1].items] : (blocks.find(b => b.key === blk) || blocks[0]).items;
  const bname = blk === 'all' ? 'весь урок' : (blocks.find(b => b.key === blk) || {}).name || '';
  const qs = d.gen(items);
  if (!qs.length) { app.innerHTML = `<div class="empty"><div class="big">🤷</div>В этом блоке мало подходящих слов для такого упражнения.<br><br><a class="btn" href="#lesson/${L.id}/drills">Назад</a></div>`; return; }
  runExercise({
    title: `${L.emoji} ${d.name} · ${bname}`, questions: qs, back: `#lesson/${L.id}/drills`,
    onFinish: score => { const st = lessonState(L.id); st.d = st.d || {}; const k = kind + '_' + blk; st.d[k] = Math.max(st.d[k] || 0, score); addToSRS(items.filter(i => ITEMS[i.id]).map(i => i.id)); addXP(5 + Math.round(score * 15)); },
    nextLinks: () => { const ks = Object.keys(DRILLS); const nk = ks[(ks.indexOf(kind) + 1) % ks.length]; return `<a class="btn" href="#drill/${L.id}/${nk}/${blk}">Дальше: ${DRILLS[nk].name} →</a>`; },
  });
}
