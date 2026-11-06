// ============================================================
//  Читалка: свой текст → клик по слову → перевод, разбор,
//  склонение/спряжение, ситуации употребления
// ============================================================

// свои карточки из читалки → в общий реестр
Object.entries(S.custom || {}).forEach(([id, c]) => { ITEMS[id] = { id, geo: c.geo, ru: c.ru, kind: 'c' }; });
function addCustomCard(geo, ru) {
  const exists = Object.values(ITEMS).find(it => it.geo === geo && (it.kind === 'w' || it.kind === 'c'));
  if (exists) { addToSRS([exists.id]); return false; }
  const id = 'c' + Date.now().toString(36);
  S.custom[id] = { geo, ru }; ITEMS[id] = { id, geo, ru, kind: 'c' }; addToSRS([id]); return true;
}
function myLemmas() {
  const set = new Set();
  Object.keys(S.srs).forEach(id => { const it = ITEMS[id]; if (it && it.kind !== 'l' && !it.geo.includes(' ')) set.add(it.geo.replace(/[?!]/g, '')); });
  return set;
}

// ---------- онлайн-перевод ----------
const trCache = new Map();
async function translateOnline(text) {
  if (trCache.has(text)) return trCache.get(text);
  let out = null;
  try {
    const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=ka&tl=ru&dt=t&dt=bd&q=' + encodeURIComponent(text));
    if (r.ok) {
      const j = await r.json();
      const main = (j[0] || []).map(x => x[0]).join('');
      const alts = (j[1] || []).map(([pos, words]) => `${pos}: ${(words || []).slice(0, 5).join(', ')}`);
      out = { main, alts, src: 'Google Переводчик' };
    }
  } catch (e) {}
  if (!out) try {
    const r = await fetch('https://api.mymemory.translated.net/get?langpair=ka|ru&q=' + encodeURIComponent(text));
    const j = await r.json(); if (j.responseData) out = { main: j.responseData.translatedText, alts: [], src: 'MyMemory' };
  } catch (e) {}
  trCache.set(text, out); return out;
}

// ---------- ИИ-разбор (Claude, ключ пользователя) ----------
const AI_KEY = 'bilikebi_ai_key';
const aiKey = () => { try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; } };
const aiCache = new Map();
const AI_SYSTEM = `Ты — опытный преподаватель грузинского языка для русскоязычных взрослых, которые живут в Грузии (уровень A1–A2). Тебе дают слово из текста и предложение, где оно встретилось. Объясни по-русски — коротко, понятно и практично. Формат — markdown, строго такие разделы:

### Перевод
Значение именно в этом предложении, потом 1–2 других частых значения.

### Начальная форма
Словарная форма. Для глагола — масдар и форма «он/она» настоящего времени.

### Разбор формы
Из каких частей состоит слово в тексте (основа + приставки/окончания/послелоги) и что значит каждая часть.

### Грамматика
Для существительного/прилагательного — компактная таблица: падеж | ед. ч. | мн. ч. (им., эрг., дат., род., твор., обст.). Для глагола — спряжение в настоящем (6 лиц) и время той формы, что в тексте. Отметь особенности: «перевёрнутый» глагол (მინდა-тип), выпадение гласной, неправильные формы.

### Когда используют
3 бытовые ситуации из жизни в Грузии, в каждой — пример на грузинском и перевод.

### Ловушки
1–2 пункта: похожие слова, частые ошибки русскоязычных.

Грузинские слова пиши грузинскими буквами. Если не уверен — честно скажи. Не больше 350 слов.`;
async function aiExplain(word, sentence) {
  const k = word + '\n' + sentence; if (aiCache.has(k)) return aiCache.get(k);
  const { default: Anthropic } = await import('https://esm.sh/@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true });
  try {
    const msg = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: `Слово: ${word}\nПредложение: ${sentence}` }],
    });
    if (msg.stop_reason === 'refusal') return { error: 'Модель отказалась отвечать на этот запрос. Попробуйте другое слово.' };
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const out = { text: text + (msg.stop_reason === 'max_tokens' ? '\n\n_(ответ обрезан)_' : '') };
    aiCache.set(k, out); return out;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'Ключ API не подошёл. Проверьте его: Читалка → «ИИ-разбор слов» внизу страницы.' };
    if (e instanceof Anthropic.PermissionDeniedError) return { error: 'У ключа нет доступа к этой модели.' };
    if (e instanceof Anthropic.RateLimitError) return { error: 'Слишком много запросов или закончился баланс. Подождите минуту.' };
    if (e instanceof Anthropic.APIConnectionError) return { error: 'Нет соединения с сервером Claude. Проверьте интернет.' };
    if (e instanceof Anthropic.APIError) return { error: `Ошибка API (${e.status || '?'}): ${e.message}` };
    return { error: 'Не получилось: ' + e.message };
  }
}
function md(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>').replace(/_([^_]+)_/g, '<i>$1</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = text.split('\n'); let html = '', list = null, table = [];
  const flushT = () => { if (!table.length) return; const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)); html += '<table>' + rows.map((r, i) => '<tr>' + r.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => i ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`).join('') + '</tr>').join('') + '</table>'; table = []; };
  let items = [];
  const closeList = () => { if (list) { html += `<${list}>${items.map(i => `<li>${inline(i)}</li>`).join('')}</${list}>`; list = null; items = []; } };
  for (const l of lines) {
    if (/^\s*\|/.test(l)) { closeList(); table.push(l); continue; } else flushT();
    let m;
    if ((m = l.match(/^#{1,6}\s+(.*)/))) { closeList(); html += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); list = 'ul'; } items.push(m[1]); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); list = 'ol'; } items.push(m[1]); }
    else if (l.trim()) { closeList(); html += `<p>${inline(l)}</p>`; }
    else closeList();
  }
  closeList(); flushT(); return html;
}

// ---------- тексты ----------
function textSentences(body) {
  return body.split(/\n\s*\n|\n/).filter(p => p.trim()).flatMap(p => (p.match(/[^.!?…]+[.!?…]*["»“]*\s*/g) || [p]).map(s => s.trim()).filter(Boolean));
}
const allTexts = () => [...READER_SAMPLES, ...(S.texts || [])];
function viewReader(a, b) {
  if (a === 'new' || a === 'edit') return readerEditor(b);
  if (a) return readerRead(a);
  const mine = S.texts || [];
  app.innerHTML = `
    <h1>Читалка 📖</h1>
    <p class="muted">Вставь любой грузинский текст — объявление, сообщение от хозяина квартиры, меню, новость, песню. Нажми на слово: увидишь перевод, разбор формы, склонение или спряжение и примеры, когда это слово используют.</p>
    <div class="row" style="margin:14px 0"><a class="btn" href="#reader/new">＋ Добавить свой текст</a></div>
    ${mine.length ? `<div class="sec-title"><h2>Мои тексты</h2></div><div class="grid g2">${mine.map(t => textCard(t, true)).join('')}</div>` : ''}
    <div class="sec-title"><h2>Тексты для начала</h2><span class="muted small">написаны для курса</span></div>
    <div class="grid g2">${READER_SAMPLES.map(t => textCard(t)).join('')}</div>
    ${aiSettingsHTML()}`;
  bindAiSettings();
  $$('[data-del]').forEach(b => b.onclick = e => { e.preventDefault(); if (confirm('Удалить текст?')) { S.texts = S.texts.filter(t => t.id !== b.dataset.del); save(); route(); } });
}
function textCard(t, mine) {
  const preview = t.body.replace(/\s+/g, ' ').slice(0, 90);
  return `<a class="card" href="#reader/${t.id}" style="display:block;color:var(--ink)">
    <div class="row"><b>${esc(t.title)}</b>${t.level ? `<span class="chip" style="padding:1px 8px">${t.level}</span>` : ''}<span class="spacer"></span>${mine ? `<span class="chip" data-del="${t.id}" title="Удалить">🗑</span>` : ''}</div>
    <div class="geo muted small" style="margin-top:6px">${esc(preview)}…</div></a>`;
}
function readerEditor(id) {
  const t = id ? (S.texts || []).find(x => x.id === id) : null;
  app.innerHTML = `<a href="#reader" class="small">← Читалка</a><h1>${t ? 'Редактировать текст' : 'Новый текст'}</h1>
    <div class="card">
      <label class="q-label">Название</label>
      <input class="search" id="tt" value="${esc(t ? t.title : '')}" placeholder="Например: Сообщение от хозяина">
      <label class="q-label">Текст на грузинском</label>
      <textarea id="tb" class="search geo" style="min-height:260px;font-size:18px;line-height:1.7;resize:vertical" placeholder="ჩასვით ტექსტი აქ…">${esc(t ? t.body : '')}</textarea>
      <div class="row">
        <label class="btn ghost sm" style="cursor:pointer">📂 Загрузить .txt<input type="file" id="tf" accept=".txt,text/plain" hidden></label>
        <span class="muted small">или просто вставьте текст (⌘V / долгое нажатие → Вставить)</span>
        <span class="spacer"></span><button class="btn" id="tsave">Сохранить и читать →</button>
      </div>
    </div>`;
  $('#tf').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#tb').value = r.result; if (!$('#tt').value) $('#tt').value = f.name.replace(/\.[^.]+$/, ''); }; r.readAsText(f, 'utf-8'); };
  $('#tsave').onclick = () => {
    const body = $('#tb').value.trim(); if (!body) return toast('Вставьте текст');
    if (!/[ა-ჿ]/.test(body)) return toast('В тексте нет грузинских букв');
    const title = $('#tt').value.trim() || body.slice(0, 30) + '…';
    if (t) { t.title = title; t.body = body; } else { S.texts = S.texts || []; const nt = { id: 't' + Date.now().toString(36), title, body }; S.texts.unshift(nt); id = nt.id; }
    save(); location.hash = 'reader/' + (t ? t.id : id);
  };
}

function readerRead(id) {
  const t = allTexts().find(x => x.id === id); if (!t) return viewReader();
  const mine = myLemmas();
  let wi = 0; const stats = { mine: 0, dict: 0, unk: 0 };
  const sentences = [];
  const paras = t.body.split(/\n\s*\n|\n/).filter(p => p.trim());
  const html = paras.map(p => {
    const sents = p.match(/[^.!?…]+[.!?…]*["»“]*\s*/g) || [p];
    return '<p>' + sents.map(s => {
      const si = sentences.length; sentences.push(s.trim());
      return s.split(/([ა-ჿ]+)/).map(part => {
        if (!isGeo(part)) return esc(part);
        const an = analyze(part); const lemmas = new Set(an.results.map(r => r.lemma));
        const cls = [...lemmas].some(l => mine.has(l)) ? 'k-mine' : an.results.length ? 'k-dict' : 'k-unk';
        stats[cls.slice(2)]++;
        return `<span class="w ${cls}" data-w="${part}" data-s="${si}" data-i="${wi++}">${part}</span>`;
      }).join('');
    }).join('') + '</p>';
  }).join('');
  const total = stats.mine + stats.dict + stats.unk || 1;
  const own = (S.texts || []).some(x => x.id === id);
  app.innerHTML = `<a href="#reader" class="small">← Читалка</a>
    <div class="row" style="margin:6px 0 4px"><h1 style="margin:0">${esc(t.title)}</h1><span class="spacer"></span>
      ${own ? `<a class="btn sm light" href="#reader/edit/${id}">✏️ Изменить</a>` : ''}
      <button class="btn sm light" id="readAll">▶︎ Озвучить</button><button class="btn sm light" id="trAll">🌐 Перевод текста</button></div>
    <div class="legend small muted"><span><i class="lg k-mine"></i>в моих карточках · ${Math.round(stats.mine / total * 100)}%</span><span><i class="lg k-dict"></i>есть разбор · ${Math.round(stats.dict / total * 100)}%</span><span><i class="lg k-unk"></i>новое слово · ${Math.round(stats.unk / total * 100)}%</span></div>
    <div class="reader-wrap">
      <div><div class="card rtext" id="rtext">${html}</div><div class="card" id="trBox" style="display:none;margin-top:12px"></div>
        <p class="muted small">💡 Нажимай на слова. Метод: прочитай текст целиком → нажимай на незнакомое → добавь 5–10 нужных слов в повторение → перечитай завтра.</p></div>
      <aside class="wpanel card" id="wp"><div class="empty" style="padding:30px 10px"><div class="big">👆</div>Нажми на любое слово в тексте</div></aside>
    </div>`;
  $('#readAll').onclick = () => speakQueue(sentences);
  $('#trAll').onclick = async () => {
    const box = $('#trBox'); box.style.display = ''; box.innerHTML = '<span class="muted">Перевожу…</span>';
    const parts = await Promise.all(paras.map(p => translateOnline(p)));
    box.innerHTML = `<div class="q-label">Машинный перевод (может быть неточным)</div>` + parts.map(x => `<p>${esc(x ? x.main : '—')}</p>`).join('') + `<p class="muted small">Сначала попробуй понять сам(а) — перевод для проверки.</p>`;
  };
  $('#rtext').onclick = e => {
    const w = e.target.closest('.w'); if (!w) return;
    $$('.w.sel').forEach(x => x.classList.remove('sel')); w.classList.add('sel');
    const sentence = sentences[+w.dataset.s];
    const toks = sentence.match(/[ა-ჿ]+/g) || [];
    const sameBefore = $$(`.w[data-s="${w.dataset.s}"]`).indexOf(w);
    openWord(w.dataset.w, sentence, toks, sameBefore);
  };
}

const POS_RU = { n: 'существительное', adj: 'прилагательное', adv: 'наречие', pron: 'местоимение', q: 'вопросительное слово', num: 'числительное', conj: 'союз', part: 'частица', post: 'послелог', int: 'междометие / обращение', name: 'имя собственное', vn: 'глагол (масдар)', '': 'слово из урока' };
function openWord(word, sentence, toks, idx) {
  const wp = $('#wp'); wp.classList.add('open');
  const an = analyze(word);
  const idiom = idiomAt(toks, idx);
  const byLemma = new Map(); an.results.forEach(r => { if (!byLemma.has(r.lemma)) byLemma.set(r.lemma, []); byLemma.get(r.lemma).push(r); });
  const firstRu = (() => { const l = [...byLemma.keys()][0]; return l && DICT[l] ? DICT[l][0].ru : (l && VERBS[l] ? VERBS[l].ru : ''); })();

  const lemmaBlocks = [...byLemma.entries()].map(([lemma, infos], bi) => {
    const entries = DICT[lemma] || [];
    const verb = VERBS[lemma];
    const isNoun = entries.some(e => NOUN_POS.has(e.pos) || e.pos === 'vn' || e.pos === 'num') && declension(lemma);
    const usage = entries.map(e => e.u).filter(Boolean);
    const ex = examplesFor(lemma);
    const tabId = 'tb' + bi;
    return `<div class="lemma">
      <div class="row"><span class="geo" style="font-size:22px;font-weight:700">${esc(lemma)}</span>${sayBtn(lemma)}<span class="spacer"></span>
        <button class="btn sm light" data-add="${esc(lemma)}" data-ru="${esc((entries[0] || {}).ru || (verb || {}).ru || '')}">＋ в повторение</button></div>
      ${trHTML(lemma)}
      ${(entries.length ? entries : verb ? [{ ru: verb.ru, pos: 'vn' }] : []).map(e => `<div style="margin-top:4px"><b>${esc(e.ru)}</b> <span class="muted small">· ${POS_RU[e.pos] || ''}</span></div>`).join('')}
      <div class="formbox">${infos.map(i => `<div>🔎 <b>${esc(word)}</b> — ${esc(i.desc)}${i.particle ? `<br><span class="muted small">+ частица ${esc(i.particle)}</span>` : ''}</div>`).join('')}</div>
      ${verb ? `<div class="small muted">${verb.flag === 'inv' ? '⚠️ «Перевёрнутый» глагол: тот, кто «хочет/имеет/любит», стоит в дательном падеже — <span class="geo">მე მინდა</span> = «мне хочется». Приставка показывает, кому: <b>მ</b>- мне, <b>გ</b>- тебе, <b>უ/ს/ჰ</b>- ему, <b>გვ</b>- нам.' : verb.flag === 'irr' ? '⚠️ Неправильный глагол — формы нужно запомнить.' : 'Лицо показывают приставка <b>ვ-</b> (я, мы) и окончания: <b>-ს</b> он/она, <b>-თ</b> мн. ч., <b>-ენ/-ან</b> они.'}</div>` : ''}
      ${usage.length ? `<div class="usage"><div class="q-label">Когда используют</div>${usage.map(u => `<p>${esc(u)}</p>`).join('')}</div>` : ''}
      ${ex.length ? `<div class="usage"><div class="q-label">Примеры из уроков</div>${ex.map(([g, r]) => `<div class="ex">${sayBtn(g)}<div><div class="geo">${esc(g)}</div><div class="muted small">${esc(r)}</div></div></div>`).join('')}</div>` : ''}
      ${isNoun || verb ? `<details class="tbl" ${bi === 0 && !matchMedia('(max-width:900px)').matches ? 'open' : ''}><summary>${verb ? '📋 Спряжение' : '📋 Склонение'}</summary><div id="${tabId}" style="overflow-x:auto">${verb ? conjTable(verb, word) : declTable(lemma, word)}</div></details>` : ''}
    </div>`;
  }).join('<hr>');

  const g = an.guess;
  const guessBlock = !byLemma.size ? `<div class="formbox">${g ? `🔎 Слова нет в словаре курса. ${g.lemma ? `Похоже на <b class="geo">${esc(g.lemma)}</b> (${esc(DICT[g.lemma][0].ru)}) + ` : `Возможно: основа <b class="geo">${esc(g.stem)}</b> + `}окончание <b class="geo">-${esc(g.ending.replace('-', ''))}</b> — ${esc(g.meaning)}.` : '🔎 Слова нет в словаре курса — смотри онлайн-перевод ниже.'}</div>` : '';

  wp.innerHTML = `
    <div class="row"><span class="geo" style="font-size:30px;font-weight:700">${esc(word)}</span>${sayBtn(word)}<span class="spacer"></span><button class="chip" id="wpClose">✕</button></div>
    ${trHTML(word)}
    ${idiom && idiom.toks.length > 1 ? `<div class="idiom">🧩 Выражение: <b class="geo">${esc(idiom.geo)}</b> — ${esc(idiom.ru)}</div>` : ''}
    ${lemmaBlocks}${guessBlock}
    <div class="usage"><div class="q-label">Онлайн-перевод</div><div id="onl" class="small muted">загружаю…</div>
      <button class="btn sm light" id="trSent" style="margin-top:8px">🌐 Перевести предложение</button><div id="sentTr" class="small" style="margin-top:6px"></div></div>
    <div class="usage"><div class="q-label">🤖 Подробный разбор от ИИ</div>
      ${aiKey() ? `<button class="btn sm" id="aiBtn">Объяснить слово в этом предложении</button>` : `<p class="small muted">Перевод в контексте, разбор, полная грамматика и ситуации — для любого слова. Нужен свой ключ API Claude: см. «ИИ-разбор» внизу <a href="#reader">страницы Читалки</a>.</p>`}
      <div id="aiOut" class="ai"></div></div>
    <div class="row small" style="margin-top:10px">
      <a target="_blank" rel="noopener" href="https://en.wiktionary.org/wiki/${encodeURIComponent([...byLemma.keys()][0] || word)}#Georgian">Wiktionary ↗</a>
      <a target="_blank" rel="noopener" href="https://translate.google.com/?sl=ka&tl=ru&text=${encodeURIComponent(sentence)}">Google Translate ↗</a>
      ${!byLemma.size ? `<span class="spacer"></span><button class="btn sm light" id="addUnk">＋ в повторение</button>` : ''}
    </div>`;
  $('#wpClose').onclick = () => { wp.classList.remove('open'); $$('.w.sel').forEach(x => x.classList.remove('sel')); };
  $$('[data-add]', wp).forEach(b => b.onclick = async () => {
    let ru = b.dataset.ru; if (!ru) { const o = await translateOnline(b.dataset.add); ru = o ? o.main : '?'; }
    const added = addCustomCard(b.dataset.add, ru.replace(/ \(масдар.*\)$/, ''));
    b.textContent = '✓ в повторении'; b.disabled = true; toast(added ? 'Добавлено в повторение 🔁' : 'Это слово уже есть в курсе — добавлено в повторение');
  });
  translateOnline(word).then(o => { const el = $('#onl'); if (!el) return; el.innerHTML = o ? `<b style="color:var(--ink)">${esc(o.main)}</b>${o.alts.length ? '<br>' + o.alts.map(esc).join('<br>') : ''}<br><span style="font-size:11px">${o.src} · машинный перевод</span>` : 'Нет связи с сервисом перевода.';
    const au = $('#addUnk'); if (au) au.onclick = () => { addCustomCard(word, o ? o.main : '?'); au.textContent = '✓ в повторении'; au.disabled = true; toast('Добавлено в повторение 🔁'); }; });
  $('#trSent').onclick = async () => { const el = $('#sentTr'); el.textContent = 'Перевожу…'; const o = await translateOnline(sentence); el.innerHTML = `<span class="geo">${esc(sentence)}</span><br><b>${esc(o ? o.main : 'Нет связи')}</b>`; };
  const ab = $('#aiBtn'); if (ab) ab.onclick = async () => {
    ab.disabled = true; ab.textContent = 'Думаю… (5–20 сек)'; const out = $('#aiOut');
    const r = await aiExplain(word, sentence);
    out.innerHTML = r.error ? `<p style="color:var(--bad)">${esc(r.error)}</p>` : md(r.text);
    ab.textContent = 'Готово ✓';
  };
  wp.scrollTop = 0; requestAnimationFrame(() => { wp.scrollTop = 0; });
}

function declTable(lemma, word) {
  const d = declension(lemma); if (!d) return '';
  const cell = f => `<td class="geo ${f === word ? 'hit' : ''}">${esc(f)}</td>`;
  return `<table class="decl"><tr><th>Падеж</th><th>ед. ч.</th><th>мн. ч.</th></tr>
    ${CASES.map(([k, n, q]) => `<tr><td><b>${n}</b><div class="muted" style="font-size:11px">${esc(q)}</div></td>${cell(d.sg[k])}${cell(d.pl[k])}</tr>`).join('')}
    <tr><th colspan="3">С послелогами</th></tr>
    ${POSTS.slice(0, 6).map(([s, m]) => `<tr><td><b>-${s}</b> <span class="muted">«${esc(m)}»</span></td>${cell(d.sg[s])}${cell(d.pl[s])}</tr>`).join('')}
  </table>${d.syncope ? `<p class="small muted">⚠️ Выпадение гласной: в родительном, творительном и мн. числе основа <span class="geo">${esc(d.syncope)}-</span>.</p>` : ''}
  <p class="small muted">Формы построены по правилам; редкие исключения возможны.</p>`;
}
function conjTable(v, word) {
  const P = v.flag === 'inv' ? PERS_INV : PERS;
  const cols = TENSES.filter(([k]) => v[k]);
  return `<table class="decl"><tr><th></th>${cols.map(([, n]) => `<th>${n}</th>`).join('')}</tr>
    ${P.map((p, i) => `<tr><td><b>${p}</b></td>${cols.map(([k]) => `<td class="geo ${v[k][i] === word ? 'hit' : ''}">${esc(v[k][i])}</td>`).join('')}</tr>`).join('')}</table>`;
}

// ---------- настройки ИИ ----------
function aiSettingsHTML() {
  const k = aiKey();
  return `<details class="card" style="margin-top:24px" ${k ? '' : ''}><summary><b>🤖 ИИ-разбор слов (по желанию)</b> <span class="muted small">${k ? '· подключён ✓' : '· не подключён'}</span></summary>
    <p class="small">Встроенный словарь знает около 600 бытовых слов и их формы. Для <b>любого</b> слова можно получить подробный разбор от Claude: перевод в контексте, части слова, таблицы склонения/спряжения, ситуации употребления.</p>
    <ol class="small" style="padding-left:18px">
      <li>Создай ключ на <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com → API Keys</a> (нужна оплата картой; один разбор стоит примерно 1–3 цента).</li>
      <li>Вставь ключ сюда. Он хранится <b>только в этом браузере</b> и отправляется только в Anthropic.</li>
    </ol>
    <div class="row"><input type="password" id="aiKeyIn" class="search" style="margin:0;flex:1;min-width:220px" placeholder="sk-ant-…" value="" autocomplete="off">
      <button class="btn sm" id="aiKeySave">Сохранить</button>${k ? '<button class="btn sm ghost" id="aiKeyDel">Удалить ключ</button>' : ''}</div>
    <p class="small muted">Не вставляй ключ на чужом или общем компьютере.</p></details>`;
}
function bindAiSettings() {
  const s = $('#aiKeySave'); if (s) s.onclick = () => { const v = $('#aiKeyIn').value.trim(); if (!v.startsWith('sk-')) return toast('Ключ должен начинаться с sk-'); try { localStorage.setItem(AI_KEY, v); } catch (e) {} toast('Ключ сохранён в этом браузере ✓'); route(); };
  const d = $('#aiKeyDel'); if (d) d.onclick = () => { try { localStorage.removeItem(AI_KEY); } catch (e) {} toast('Ключ удалён'); route(); };
}

route();
