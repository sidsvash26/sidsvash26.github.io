// Sign reference and quiz (the "Signs" tab of the menu).
import { SIGNS, SIGN_CATS } from './signs.js';

const $ = (id) => document.getElementById(id);
const QUIZ_LEN = 10;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const catName = (id) => SIGN_CATS.find((c) => c.id === id).name;

export function initSigns(store) {
  let cat = 'all', open = null, quiz = null;
  const best = store.get('signQuiz', {});
  const pool = () => SIGNS.filter((s) => cat === 'all' || s.cat === cat);

  // ── browse ──
  const cats = $('sg-cats');
  for (const c of SIGN_CATS) {
    const b = document.createElement('button');
    b.textContent = `${c.name.en} · ${c.id === 'all' ? SIGNS.length : SIGNS.filter((s) => s.cat === c.id).length}`;
    b.title = c.name.de;
    b.dataset.cat = c.id;
    b.onclick = () => { cat = c.id; open = null; render(); };
    cats.appendChild(b);
  }

  function render() {
    for (const b of cats.children) b.classList.toggle('on', b.dataset.cat === cat);
    const grid = $('sg-grid');
    grid.innerHTML = '';
    const groups = cat === 'all' ? SIGN_CATS.filter((c) => c.id !== 'all') : [SIGN_CATS.find((c) => c.id === cat)];
    for (const gr of groups) {
      const h = document.createElement('h3');
      h.textContent = `${gr.name.en} · ${gr.name.de}`;
      grid.appendChild(h);
      const wrap = document.createElement('div');
      wrap.className = 'sg-cards';
      for (const s of SIGNS.filter((x) => x.cat === gr.id)) {
        const b = document.createElement('button');
        b.className = `sg-card${open === s.id ? ' on' : ''}`;
        b.innerHTML = `<span class="sg-art">${s.svg}</span><b></b><i></i>`;
        b.querySelector('b').textContent = s.name.en;
        b.querySelector('i').textContent = s.name.de;
        b.onclick = () => { open = open === s.id ? null : s.id; render(); };
        wrap.appendChild(b);
        if (open === s.id) {
          const d = document.createElement('div');
          d.className = 'sg-detail';
          d.innerHTML = `<span class="sg-art big">${s.svg}</span><div><div class="eyebrow"></div><h4></h4><div class="de"></div><p></p></div>`;
          d.querySelector('.eyebrow').textContent = gr.name.en;
          d.querySelector('h4').textContent = s.name.en;
          d.querySelector('.de').textContent = s.name.de;
          d.querySelector('p').textContent = s.desc.en;
          wrap.appendChild(d);
        }
      }
      grid.appendChild(wrap);
    }
    const b = best[cat];
    $('sg-quiz-btn').textContent = `Quiz: ${catName(cat).en}${b !== undefined ? ` (best ${b}/${QUIZ_LEN})` : ''}`;
  }

  // ── quiz ──
  function startQuiz() {
    const all = pool();
    quiz = { items: shuffle([...all]).slice(0, QUIZ_LEN), i: 0, score: 0, missed: [], answered: false };
    $('signs-browse').hidden = true;
    $('signs-quiz').hidden = false;
    question();
  }

  function question() {
    const q = quiz.items[quiz.i];
    // wrong answers come from the same category where possible, so they are plausible
    let others = shuffle(SIGNS.filter((s) => s.cat === q.cat && s.id !== q.id && s.name.en !== q.name.en));
    if (others.length < 3) others = others.concat(shuffle(SIGNS.filter((s) => s.cat !== q.cat)));
    const options = shuffle([q, ...others.slice(0, 3)]);
    const pick = quiz.i % 3 === 2;                   // every third question: choose the sign for a name
    quiz.answered = false;
    $('sq-progress').textContent = `Question ${quiz.i + 1} of ${quiz.items.length}`;
    $('sq-score').textContent = `${quiz.score} correct`;
    $('sq-bar').style.width = `${(quiz.i / quiz.items.length) * 100}%`;
    $('sq-prompt').innerHTML = pick ? '<div class="sq-ask">Which one is</div><h4></h4><div class="de"></div>' : `<span class="sg-art huge">${q.svg}</span><div class="sq-ask">What does this mean?</div>`;
    if (pick) { $('sq-prompt').querySelector('h4').textContent = q.name.en; $('sq-prompt').querySelector('.de').textContent = q.name.de; }
    const box = $('sq-options');
    box.className = pick ? 'sq-options pick' : 'sq-options';
    box.innerHTML = '';
    for (const o of options) {
      const b = document.createElement('button');
      if (pick) b.innerHTML = `<span class="sg-art">${o.svg}</span>`;
      else { b.innerHTML = '<b></b><i></i>'; b.querySelector('b').textContent = o.name.en; b.querySelector('i').textContent = o.name.de; }
      b.onclick = () => answer(b, o, q);
      b.dataset.id = o.id;
      box.appendChild(b);
    }
    $('sq-feedback').hidden = true;
  }

  function answer(btn, chosen, q) {
    if (quiz.answered) return;
    quiz.answered = true;
    const right = chosen.id === q.id;
    if (right) quiz.score++; else quiz.missed.push(q);
    for (const b of $('sq-options').children) {
      b.disabled = true;
      if (b.dataset.id === q.id) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
    }
    const fb = $('sq-feedback');
    fb.hidden = false;
    fb.className = `sq-feedback ${right ? 'ok' : 'no'}`;
    fb.querySelector('b').textContent = right ? 'Correct' : `Not quite: it is "${q.name.en}"`;
    fb.querySelector('p').textContent = `${q.name.de}. ${q.desc.en}`;
    $('sq-score').textContent = `${quiz.score} correct`;
    $('sq-next').textContent = quiz.i === quiz.items.length - 1 ? 'See result' : 'Next';
  }

  function next() {
    if (!quiz.answered) return;
    quiz.i++;
    if (quiz.i < quiz.items.length) { question(); return; }
    const n = quiz.items.length;
    if (best[cat] === undefined || quiz.score > best[cat]) { best[cat] = quiz.score; store.set('signQuiz', best); }
    $('sq-bar').style.width = '100%';
    $('sq-progress').textContent = `${catName(cat).en} quiz`;
    $('sq-score').textContent = '';
    $('sq-prompt').innerHTML = `<div class="sq-result"><span>${quiz.score}</span>/${n}</div><div class="sq-ask">${quiz.score === n ? 'Flawless.' : quiz.score >= n * 0.8 ? 'Good. A few to revisit.' : 'Worth another round.'}</div>`;
    const box = $('sq-options');
    box.className = 'sq-review';
    box.innerHTML = quiz.missed.length ? '<h3>To revisit</h3>' : '';
    for (const s of quiz.missed) {
      const d = document.createElement('div');
      d.className = 'sg-detail';
      d.innerHTML = `<span class="sg-art big">${s.svg}</span><div><h4></h4><div class="de"></div><p></p></div>`;
      d.querySelector('h4').textContent = s.name.en;
      d.querySelector('.de').textContent = s.name.de;
      d.querySelector('p').textContent = s.desc.en;
      box.appendChild(d);
    }
    const fb = $('sq-feedback');
    fb.hidden = false;
    fb.className = 'sq-feedback end';
    fb.querySelector('b').textContent = '';
    fb.querySelector('p').textContent = '';
    $('sq-next').textContent = 'Try again';
    quiz.done = true;
  }

  $('sg-quiz-btn').onclick = startQuiz;
  $('sq-next').onclick = () => { if (quiz && quiz.done) startQuiz(); else next(); };
  $('sq-back').onclick = () => { quiz = null; $('signs-quiz').hidden = true; $('signs-browse').hidden = false; render(); };
  render();
}
