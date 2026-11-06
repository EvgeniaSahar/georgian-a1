// ============================================================
//  Морфология: склонение существительных/прилагательных,
//  спряжение глаголов, обратный индекс «форма → слово»
// ============================================================
const VOWELS = 'აეიოუ';
const isGeo = s => /^[ა-ჿ]+$/.test(s);

// ---------- словарь ----------
const DICT = {};          // слово → [{ru, pos, s, u}]
const addDict = (geo, e) => { const a = (DICT[geo] = DICT[geo] || []); if (!a.some(x => x.ru === e.ru)) a.push(e); };
DICT_RAW.trim().split('\n').forEach(line => {
  const [geo, ru, pos, s, u] = line.split('|');
  if (geo && ru) addDict(geo.trim(), { ru: ru.trim(), pos: (pos || '').trim(), s: (s || '').trim(), u: (u || '').trim() });
});
// слова из уроков, которых нет в словаре
LESSONS.forEach(L => L.words.forEach(([geo, ru]) => { const g = geo.replace(/[?!]/g, ''); if (isGeo(g) && !DICT[g]) addDict(g, { ru, pos: '', s: '', u: '' }); }));

// ---------- склонение ----------
const CASES = [
  ['nom', 'Именительный', 'кто? что? — подлежащее; дополнение в прошедшем'],
  ['erg', 'Эргатив', 'кто? — подлежащее в прошедшем: ანამ თქვა'],
  ['dat', 'Дательный', 'кому? что? — дополнение в настоящем; «мне хочется»'],
  ['gen', 'Родительный', 'чей? чего?'],
  ['ins', 'Творительный', 'чем? на чём? — ბარათით (картой)'],
  ['adv', 'Обстоятельственный', 'как? кем? — ქართულად (по-грузински)'],
  ['voc', 'Звательный', 'обращение: ნინო!, ბატონო!'],
];
const POSTS = [
  ['ში', 'в', 'dat'], ['ზე', 'на; о; в (о времени)', 'dat'], ['თან', 'у, около; с (кем)', 'dat'],
  ['დან', 'из, от', 'ins'], ['მდე', 'до', 'adv'], ['თვის', 'для', 'gen'], ['კენ', 'в сторону', 'gen'], ['გან', 'от (кого); из (чего)', 'gen'],
];
const NOUN_POS = new Set(['n', 'adj', 'name', '']);

function stemType(lemma) {
  if (lemma === 'კაფე') return 'o';
  const last = lemma.slice(-1);
  if (last === 'ი') return 'c';
  if (last === 'ა') return 'a';
  if (last === 'ე') return 'e';
  if (last === 'ო' || last === 'უ') return 'o';
  return null;
}
function caseSet(t, L, s) {
  if (t === 'c') { const st = L.slice(0, -1), ss = s || st; return { nom: st + 'ი', erg: st + 'მა', dat: st + 'ს', gen: ss + 'ის', ins: ss + 'ით', adv: ss + 'ად', voc: st + 'ო' }; }
  if (t === 'a') { const ss = s || L.slice(0, -1); return { nom: L, erg: L + 'მ', dat: L + 'ს', gen: ss + 'ის', ins: ss + 'ით', adv: s ? s + 'ად' : L + 'დ', voc: L + 'ვ' }; }
  if (t === 'e') { const ss = L.slice(0, -1); return { nom: L, erg: L + 'მ', dat: L + 'ს', gen: ss + 'ის', ins: ss + 'ით', adv: L + 'დ', voc: L + 'ვ' }; }
  if (t === 'o') return { nom: L, erg: L + 'მ', dat: L + 'ს', gen: s ? s + 'ის' : L + 'ს', ins: s ? s + 'ით' : L + 'თი', adv: L + 'დ', voc: L };
}
function pluralBase(t, L, s) {
  if (t === 'c') return (s || L.slice(0, -1)) + 'ებ';
  if (t === 'a') return (s || L.slice(0, -1)) + 'ებ';
  return L + 'ებ';
}
function postForm(c, post) {
  const [suf, , base] = post; const f = c[base];
  if (base === 'dat') { if (suf === 'თან') return VOWELS.includes(f.slice(-2, -1)) ? f + 'თან' : f.slice(0, -1) + 'თან'; return f.slice(0, -1) + suf; }
  if (base === 'ins') return f.endsWith('ით') ? f.slice(0, -2) + 'იდან' : f.slice(0, -2) + 'დან';
  if (base === 'adv') return f.endsWith('ად') ? f.slice(0, -2) + 'ამდე' : f.slice(0, -1) + 'მდე';
  return f + suf; // gen
}
// полная таблица: {sg:{nom..voc, ში..}, pl:{…}, type}
function declension(lemma) {
  const e = (DICT[lemma] || [])[0] || {}; const t = stemType(lemma); if (!t) return null;
  const sg = caseSet(t, lemma, e.s);
  const P = pluralBase(t, lemma, e.s);
  const pl = { nom: P + 'ი', erg: P + 'მა', dat: P + 'ს', gen: P + 'ის', ins: P + 'ით', adv: P + 'ად', voc: P + 'ო' };
  POSTS.forEach(p => { sg[p[0]] = postForm(sg, p); pl[p[0]] = postForm(pl, p); });
  return { sg, pl, type: t, syncope: e.s || '' };
}

// ---------- спряжение ----------
const PERS = ['я', 'ты', 'он/она', 'мы', 'вы', 'они'];
const PERS_INV = ['мне (я)', 'тебе (ты)', 'ему/ей', 'нам (мы)', 'вам (вы)', 'им (они)'];
function presentFromStem(st) {
  if (st.endsWith('ები')) return ['ვ' + st, st, st.slice(0, -1) + 'ა', 'ვ' + st + 'თ', st + 'თ', st + 'ან'];
  if (st.endsWith('ი')) return ['ვ' + st, st, st + 'ს', 'ვ' + st + 'თ', st + 'თ', st.slice(0, -1) + 'იან'];
  return ['ვ' + st, st, st + 'ს', 'ვ' + st + 'თ', st + 'თ', st + 'ენ'];
}
const VERBS = {};  // масдар → {ru, pres, imperf, aor, fut, flag}
VERBS_RAW.trim().split('\n').forEach(line => {
  const [m, ru, pres, aor, fut, flag] = line.split('|').map(x => (x || '').trim());
  if (!m) return;
  const v = { lemma: m, ru, flag };
  if (pres.startsWith('@')) {
    const st = pres.slice(1); v.pres = presentFromStem(st);
    if (!st.endsWith('ი')) v.imperf = ['ვ' + st + 'დი', st + 'დი', st + 'და', 'ვ' + st + 'დით', st + 'დით', st + 'დნენ'];
  } else v.pres = pres.split(',');
  if (aor) v.aor = aor.split(',');
  if (fut) v.fut = fut.split(',');
  VERBS[m] = v;
  addDict(m, { ru: ru + ' (масдар — «начальная форма» глагола)', pos: 'vn', s: '', u: '' });
});
const TENSES = [['pres', 'Настоящее'], ['imperf', 'Прошедшее длительное'], ['aor', 'Прошедшее (совершённое)'], ['fut', 'Будущее']];

// ---------- обратный индекс ----------
const FORMS = new Map();     // форма → [{lemma, kind, desc, key, num}]
const LEMMA_FORMS = {};      // лемма → Set(форм)
function addForm(form, info) {
  if (!form) return;
  const a = FORMS.get(form) || []; if (!a.some(x => x.lemma === info.lemma && x.desc === info.desc)) a.push(info); FORMS.set(form, a);
  (LEMMA_FORMS[info.lemma] = LEMMA_FORMS[info.lemma] || new Set()).add(form);
}
const CASE_NAME = Object.fromEntries(CASES.map(c => [c[0], c[1].toLowerCase()]));
for (const lemma of Object.keys(DICT)) {
  const entries = DICT[lemma];
  const lessonOnly = entries.every(e => e.pos === '');
  addForm(lemma, { lemma, kind: 'w', lessonOnly, desc: entries.some(e => NOUN_POS.has(e.pos) && e.pos !== '') ? 'начальная форма (именительный падеж, ед. ч.)' : 'начальная (словарная) форма', key: 'nom', num: 'sg' });
  if (!entries.some(e => NOUN_POS.has(e.pos) || e.pos === 'vn' || e.pos === 'num')) continue;
  const d = declension(lemma); if (!d) continue;
  for (const num of ['sg', 'pl']) {
    const nn = num === 'sg' ? 'ед. ч.' : 'мн. ч.';
    CASES.forEach(([k]) => (num === 'pl' || k !== 'nom') && addForm(d[num][k], { lemma, kind: 'n', key: k, num, desc: `${nn}, ${CASE_NAME[k]} падеж` }));
    POSTS.forEach(([suf, mean, base]) => addForm(d[num][suf], { lemma, kind: 'n', key: suf, num, desc: `${nn}, ${CASE_NAME[base]} + послелог -${suf} «${mean}»` }));
  }
  if (entries.some(e => e.pos === 'adj') && lemma.endsWith('ი'))
    addForm(lemma.slice(0, -1), { lemma, kind: 'n', key: 'short', num: 'sg', desc: 'усечённая форма прилагательного — перед существительным в дательном/обстоятельственном падеже (დიდ სახლში — в большом доме)' });
  if (entries.some(e => e.pos === 'adj')) addForm(d.sg.adv, { lemma, kind: 'n', key: 'adv', num: 'sg', desc: 'наречие «как?» (на -ად): ლამაზად — красиво' });
}
for (const v of Object.values(VERBS)) {
  const P = v.flag === 'inv' ? PERS_INV : PERS;
  TENSES.forEach(([k, name]) => (v[k] || []).forEach((f, i) => addForm(f, { lemma: v.lemma, kind: 'v', key: k, idx: i, desc: `глагол: ${name.toLowerCase()} время, ${P[i]}` + (k === 'aor' && (i === 1 || i === 4) && v.flag !== 'inv' ? ' — эта же форма служит повелительным наклонением («сделай!»)' : '') })));
}
EXTRA_FORMS_RAW.trim().split('\n').forEach(line => { const [f, m, d] = line.split('|'); if (f) addForm(f.trim(), { lemma: m.trim(), kind: VERBS[m.trim()] ? 'v' : 'x', desc: d.trim() }); });

const IDIOMS = IDIOMS_RAW.trim().split('\n').map(l => { const [g, r] = l.split('|'); return { geo: g.trim(), ru: r.trim(), toks: g.trim().split(' ') }; });
LESSONS.forEach(L => L.phrases.forEach(([g, r]) => { const t = g.replace(/[?!.,]/g, '').split(' '); if (t.length >= 2 && t.length <= 4 && !IDIOMS.some(i => i.geo === t.join(' '))) IDIOMS.push({ geo: t.join(' '), ru: r, toks: t }); }));

// ---------- разбор слова ----------
const PARTICLES = [['ც', '-ც «тоже, и»: მეც — я тоже'], ['ვე', '-ვე «именно, же, сразу»: ახლავე — сейчас же'], ['ღა', '-ღა «только, уже»'], ['ო', '-ო — передача чужих слов («мол, говорит»)'], ['ა', '-ა — краткое «есть» (= არის): დედაა — это мама']];
const GUESS_ENDINGS = [
  ['ებისთვის', 'мн. ч. + «для»'], ['ებიდან', 'мн. ч. + «из, от»'], ['ებამდე', 'мн. ч. + «до»'], ['ებთან', 'мн. ч. + «у, с»'],
  ['ებში', 'мн. ч. + «в»'], ['ებზე', 'мн. ч. + «на, о»'], ['ების', 'мн. ч., родительный'], ['ებით', 'мн. ч., творительный'],
  ['ებმა', 'мн. ч., эргатив'], ['ებს', 'мн. ч., дательный'], ['ები', 'мн. ч.'], ['ისთვის', '«для»'], ['იდან', '«из, от»'],
  ['ამდე', '«до»'], ['ისკენ', '«в сторону»'], ['ში', '«в»'], ['ზე', '«на, о»'], ['თან', '«у, с»'], ['დან', '«из, от»'], ['მდე', '«до»'],
  ['ით', 'творительный «чем?»'], ['ის', 'родительный «чей?»'], ['მა', 'эргатив (подлежащее в прошедшем)'], ['ად', '«как?» — наречие или обстоятельственный падеж'],
];
function analyze(word) {
  const res = []; const seen = new Set();
  const push = (info, extra) => { const k = info.lemma + '|' + info.desc + '|' + (extra || ''); if (seen.has(k)) return; seen.add(k); res.push(Object.assign({}, info, extra ? { particle: extra } : {})); };
  (FORMS.get(word) || []).forEach(i => push(i));
  if (!res.length) for (const [p, d] of PARTICLES) {
    if (word.length > p.length + 1 && word.endsWith(p)) { const base = word.slice(0, -p.length); (FORMS.get(base) || []).forEach(i => push(i, d)); if (p === 'ა' && base.endsWith('ი') === false) (FORMS.get(base + 'ი') || []).forEach(i => push(i, d)); }
    if (res.length) break;
  }
  // слово из урока, которое на самом деле форма глагола, — показываем разбор глагола
  if (res.some(r => r.kind === 'v')) for (let i = res.length - 1; i >= 0; i--) if (res[i].lessonOnly) res.splice(i, 1);
  let guess = null;
  if (!res.length) {
    for (const [end, d] of GUESS_ENDINGS) {
      if (word.length - end.length < 2 || !word.endsWith(end)) continue;
      const st = word.slice(0, -end.length);
      const syn = 'აეო'.split('').map(v => st.slice(0, -1) + v + st.slice(-1) + 'ი'); // выпавшая гласная: რესტორნ → რესტორანი
      const cand = [st + 'ი', st + 'ა', st + 'ე', st, st + 'ო', ...syn].find(c => DICT[c]);
      guess = { ending: end, meaning: d, stem: st, lemma: cand || null }; break;
    }
    if (!guess && word.startsWith('ვ') && word.length > 3) guess = { ending: 'ვ-', meaning: 'похоже на глагол в форме «я» или «мы» (приставка ვ-)', stem: word.slice(1), lemma: null };
  }
  return { word, results: res, guess };
}
function idiomAt(tokens, i) {
  // tokens: массив грузинских слов предложения; i — индекс слова
  let best = null;
  for (const id of IDIOMS) {
    const n = id.toks.length;
    for (let s = Math.max(0, i - n + 1); s <= i; s++) {
      if (s + n > tokens.length) continue;
      if (id.toks.every((t, k) => tokens[s + k] === t) && (!best || n > best.toks.length)) best = id;
    }
  }
  return best;
}
function examplesFor(lemma, limit = 4) {
  const forms = LEMMA_FORMS[lemma] || new Set([lemma]);
  const out = [];
  const consider = (geo, ru) => { if (out.length >= limit || out.some(o => o[0] === geo)) return; const toks = geo.replace(/[?!.,«»„“]/g, ' ').split(/\s+/); if (toks.some(t => forms.has(t))) out.push([geo, ru]); };
  LESSONS.forEach(L => { L.phrases.forEach(([g, r]) => consider(g, r)); L.dialogue.lines.forEach(([, g, r]) => r && consider(g, r)); });
  return out;
}

// ---------- тексты для чтения ----------
const READER_SAMPLES = [
  { id: 's1', title: 'Мой день · ჩემი დღე', level: 'A1', body: `მე ანა მქვია. თბილისში ვცხოვრობ, ვაკეში. დილით ყავას ვსვამ და ხაჭაპურს ვჭამ. მერე სახლიდან ვმუშაობ.

საღამოს ბაზარში მივდივარ. ბაზარში ხილი და ბოსტნეული ძალიან იაფია. გამყიდველები ძალიან კეთილები არიან.

მე ქართულს ვსწავლობ, მაგრამ ჯერ ცოტა ვლაპარაკობ. ჩემი მეზობელი ნინო მეხმარება. ნინო ძალიან კარგი მეგობარია.` },
  { id: 's2', title: 'На рынке · ბაზარში', level: 'A1+', body: `შაბათს ბაზარში წავედი. ბაზარი ჩემი სახლიდან შორს არ არის.

ვიყიდე ორი კილო პომიდორი, ერთი კილო კიტრი და ნახევარი კილო ყველი. გამყიდველმა მითხრა: „ეს ყველი ძალიან გემრიელია!“ მართლა გემრიელი იყო.

სულ თხუთმეტი ლარი გადავიხადე. სახლში ტაქსით დავბრუნდი.` },
  { id: 's3', title: 'Погода в Тбилиси · ამინდი თბილისში', level: 'A2', body: `თბილისში ზაფხულში ძალიან ცხელა. ივლისში და აგვისტოში ხშირად ორმოცი გრადუსია.

ზამთარში ცივა, მაგრამ თოვლი იშვიათად მოდის. გაზაფხული და შემოდგომა ყველაზე ლამაზი დროა.

შემოდგომაზე რთველია — ხალხი სოფელში მიდის, ყურძენს კრეფს და ღვინოს აყენებს.` },
];
