// ── SUPABASE ──
const SB_URL = 'https://icbkaqjefvzufthhgtkv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYmthcWplZnZ6dWZ0aGhndGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQzMjAsImV4cCI6MjA4ODgwMDMyMH0.rwtsq7PEIvWMvOMveG0DxcspkvUE3yL3wJ9QWwLmLfE';

const sb = {
  async get(table, q = '') {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${table}?${q}`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      });
      if (!r.ok) return [];
      return r.json();
    } catch (e) { return []; }
  },
  async post(table, body) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body)
      });
      if (!r.ok) { console.error(await r.text()); return null; }
      const d = await r.json();
      return Array.isArray(d) ? d[0] : d;
    } catch (e) { return null; }
  },
  async patch(table, id, body) {
    try {
      await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {}
  },
  async delete(table, id) {
    try {
      await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      });
    } catch (e) {}
  }
};

// ── 카테고리 색상 ──
const TC = {
  visual: { label: '시각',    color: '#e05a48' },
  idea:   { label: '아이디어', color: '#c9a440' },
  ux:     { label: '경험',    color: '#52906e' },
};

// ── 로컬스토리지 ──
const LS = {
  save(k, v) { try { localStorage.setItem('rv2_' + k, JSON.stringify(v)); } catch (e) {} },
  load(k, d) { try { const v = localStorage.getItem('rv2_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
};

// ── 닉네임 고정 ──
let myNick = LS.load('nick', null);
if (!myNick) {
  myNick = 'anon_' + Math.floor(Math.random() * 900 + 10);
  LS.save('nick', myNick);
}

// ── 게이트 상태 ──
let hasPosted   = LS.load('hasPosted', false);
let fbCount     = LS.load('fbCount', 0);
let myPostIds   = LS.load('myPostIds', []);
let myFbHistory = LS.load('myFbHistory', []);

function saveLocal() {
  LS.save('hasPosted', hasPosted);
  LS.save('fbCount', fbCount);
  LS.save('myPostIds', myPostIds);
  LS.save('myFbHistory', myFbHistory);
}

// ── 전역 상태 ──
let posts = [], comments = {};
let curPost = null, curType = null, curFilter = 'all';
let imgDataBefore = null, imgDataAfter = null;

// ── 시간 포맷 ──
function timeStr(ts) {
  if (!ts) return '방금';
  return new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── GATE UPDATE ──
function gateUpdate() {
  const locked = hasPosted && fbCount < 3;
  for (let i = 0; i < 3; i++)
    document.getElementById('p' + i).classList.toggle('on', hasPosted && i < fbCount);

  const badge = document.getElementById('gate-badge');
  if (locked) { badge.textContent = fbCount + '/3'; badge.style.display = 'flex'; }
  else badge.style.display = 'none';

  const lbl    = document.getElementById('gate-label');
  const status = document.getElementById('gate-status');
  if (!hasPosted) {
    lbl.textContent    = '첫 작업은 자유롭게. 이후엔 피드백 3회 필요.';
    status.textContent = '';
  } else if (fbCount >= 3) {
    lbl.textContent    = '피드백 3회 완료. 작업을 올릴 수 있어요.';
    status.textContent = '업로드 가능';
  } else {
    lbl.textContent    = `업로드까지 피드백 ${3 - fbCount}회 더 필요해요.`;
    status.textContent = `${fbCount} / 3`;
  }
}

// ── RENDER POSTS ──
function renderPosts(f = 'all') {
  const filtered = f === 'all' ? posts : posts.filter(p => p.wanted && p.wanted.includes(f));
  document.getElementById('post-count').textContent  = filtered.length;
  document.getElementById('stat-posts').textContent  = posts.length;
  document.getElementById('stat-fb').textContent     = posts.reduce((a, p) => a + (p.comment_count || 0), 0);

  const grid = document.getElementById('grid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">아직 작업이 없어요</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isMe  = myPostIds.includes(p.id);
    const wanted = p.wanted || [];
    const tags  = wanted.map(w => TC[w] ? `<span class="wanted-tag" style="border-color:${TC[w].color}55;color:${TC[w].color}">${TC[w].label}</span>` : '').join('');
    const lines = wanted.map(w => TC[w] ? `<div class="type-line-seg" style="background:${TC[w].color}"></div>` : '').join('');
    const vBadge = p.version ? `<span class="version-chip">${p.version}</span>` : '';
    const bBadge = p.img_before ? `<span class="has-before-badge">B/A</span>` : '';

    return `<div class="post-card" onclick="openPost(${p.id})">
      <div class="post-img-wrap">
        <img src="${p.img || ''}" alt="" loading="lazy">
        ${vBadge}${bBadge}
        <div class="type-line">${lines}</div>
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-author">${isMe ? myNick + ' (나)' : (p.author || 'anon')}</span>
          <span class="post-time">${timeStr(p.created_at)}</span>
        </div>
        <div class="post-title">${p.title}</div>
        <div class="post-desc">${p.description || ''}</div>
        <div class="post-footer">
          <span class="feedback-count">${p.comment_count || 0}개의 피드백</span>
          <div class="wanted-tags">${tags}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filter(type, btn) {
  curFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPosts(type);
}

// ── OPEN POST MODAL ──
async function openPost(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  curPost = id; curType = null;

  const wanted = p.wanted || [];
  const isMe   = myPostIds.includes(id);

  document.getElementById('m-title-nav').textContent = p.title;
  document.getElementById('m-title').textContent     = p.title;
  document.getElementById('m-desc').textContent      = p.description || '';
  document.getElementById('m-badges').innerHTML = wanted.map(w => TC[w] ?
    `<span class="badge" style="border-color:${TC[w].color};color:${TC[w].color}">${TC[w].label} 원해요</span>` : ''
  ).join('');

  // 버전 뱃지
  const vEl = document.getElementById('m-version');
  vEl.textContent = p.version || '';
  vEl.style.display = p.version ? 'inline' : 'none';

  // 수정/삭제 버튼 - 내 작업만
  document.getElementById('m-edit-btn').style.display   = isMe ? 'flex' : 'none';
  document.getElementById('m-delete-btn').style.display = isMe ? 'flex' : 'none';

  // Before/After 슬라이더
  const compareWrap = document.getElementById('compare-wrap');
  const singleWrap  = document.getElementById('single-img-wrap');
  if (p.img_before && p.img) {
    document.getElementById('m-img-before').src = p.img_before;
    document.getElementById('m-img-after').src  = p.img;
    compareWrap.style.display = 'flex';
    singleWrap.style.display  = 'none';
    initCompare();
  } else {
    document.getElementById('m-img').src       = p.img || '';
    compareWrap.style.display = 'none';
    singleWrap.style.display  = 'flex';
  }

  // 스티커
  renderStickers(p);

  // 키워드 태그 초기화
  document.querySelectorAll('.kw-tag').forEach(t => t.classList.remove('active'));

  // 댓글 불러오기
  document.getElementById('c-list').innerHTML = `<div style="text-align:center;padding:24px;font-family:'Space Mono',monospace;font-size:0.58rem;color:#444;letter-spacing:2px">불러오는 중...</div>`;
  const data = await sb.get('comments', `post_id=eq.${id}&order=created_at.asc`);
  comments[id] = Array.isArray(data) ? data : [];

  resetTypeChips();
  document.getElementById('c-input').value = '';
  document.getElementById('post-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderComments(id);
}

function closeModal() {
  document.getElementById('post-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── BEFORE/AFTER SLIDER ──
function initCompare() {
  const container = document.getElementById('compare-container');
  const handle    = document.getElementById('compare-handle');
  const beforeWrap = document.getElementById('compare-before-wrap');
  let dragging = false;

  function setPos(x) {
    const rect = container.getBoundingClientRect();
    let pct = Math.min(Math.max((x - rect.left) / rect.width, 0.02), 0.98);
    beforeWrap.style.width = (pct * 100) + '%';
    handle.style.left      = (pct * 100) + '%';
  }

  container.addEventListener('mousedown',  e => { dragging = true; setPos(e.clientX); });
  container.addEventListener('touchstart', e => { dragging = true; setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('mousemove',  e => { if (dragging) setPos(e.clientX); });
  window.addEventListener('touchmove',  e => { if (dragging) setPos(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('mouseup',  () => dragging = false);
  window.addEventListener('touchend', () => dragging = false);
}

// ── STICKERS ──
function renderStickers(p) {
  const stickers = p.stickers || {};
  const list = document.getElementById('sticker-list');
  list.innerHTML = Object.entries(stickers).map(([emoji, data]) => {
    const count  = data.count || 0;
    const isMine = (data.users || []).includes(myNick);
    return `<button class="sticker-item ${isMine ? 'mine' : ''}" onclick="addSticker('${emoji}')">${emoji} ${count}</button>`;
  }).join('');
}

async function addSticker(emoji) {
  const p = posts.find(x => x.id === curPost);
  if (!p) return;
  if (!p.stickers) p.stickers = {};
  if (!p.stickers[emoji]) p.stickers[emoji] = { count: 0, users: [] };

  const entry = p.stickers[emoji];
  const idx   = entry.users.indexOf(myNick);
  if (idx >= 0) { entry.users.splice(idx, 1); entry.count--; }
  else          { entry.users.push(myNick);    entry.count++; }

  await sb.patch('posts', curPost, { stickers: p.stickers });
  renderStickers(p);
  toast(idx >= 0 ? '반응 취소' : emoji + ' 반응!');
}

// ── KEYWORD TAGS ──
async function toggleKeyword(btn, word) {
  btn.classList.toggle('active');
  const active = [...document.querySelectorAll('.kw-tag.active')].map(b => b.textContent);
  const p      = posts.find(x => x.id === curPost);
  if (!p) return;
  if (!p.keywords) p.keywords = {};
  if (!p.keywords[word]) p.keywords[word] = { count: 0, users: [] };
  const entry = p.keywords[word];
  const idx   = entry.users.indexOf(myNick);
  if (btn.classList.contains('active')) {
    if (idx < 0) { entry.users.push(myNick); entry.count++; }
  } else {
    if (idx >= 0) { entry.users.splice(idx, 1); entry.count--; }
  }
  await sb.patch('posts', curPost, { keywords: p.keywords });
  toast('태그 반응 저장됐어요');
}

// ── RENDER COMMENTS ──
function renderComments(postId) {
  const list = document.getElementById('c-list');
  const cs   = comments[postId] || [];
  if (!cs.length) {
    list.innerHTML = `<div style="text-align:center;padding:28px;font-family:'Space Mono',monospace;font-size:0.56rem;color:#333;letter-spacing:2px;text-transform:uppercase">첫 번째 피드백을 남겨봐요</div>`;
    return;
  }
  list.innerHTML = cs.map(c => {
    const t    = TC[c.type] || TC.visual;
    const isMe = c.author === myNick;
    return `<div class="comment" style="border-left-color:${t.color}99">
      <div class="comment-header">
        <span class="comment-type" style="color:${t.color}">${t.label}</span>
        <span class="comment-author">${isMe ? myNick + ' (나)' : (c.author || 'anon')}</span>
      </div>
      <div class="comment-text">${c.text}</div>
      <button class="helpful-btn ${c.liked ? 'on' : ''}" onclick="helpful(${postId},${c.id},this)">도움됐어요 ${c.helpful || 0}</button>
    </div>`;
  }).join('');
}

async function helpful(pid, cid, btn) {
  const cs = comments[pid] || [], c = cs.find(x => x.id === cid);
  if (!c) return;
  c.liked    = !c.liked;
  c.helpful  = (c.helpful || 0) + (c.liked ? 1 : -1);
  btn.classList.toggle('on', c.liked);
  btn.textContent = `도움됐어요 ${c.helpful}`;
  await sb.patch('comments', cid, { helpful: c.helpful });
  toast(c.liked ? '도움됐어요' : '취소됐어요');
}

// ── COMMENT TYPE ──
function pickType(btn) {
  resetTypeChips();
  btn.classList.add('selected');
  curType = btn.dataset.t;
  const c = TC[curType].color;
  btn.style.cssText = `background:${c};border-color:${c};color:#000`;
}
function resetTypeChips() {
  document.querySelectorAll('.type-chip').forEach(c => { c.classList.remove('selected'); c.style.cssText = ''; });
}

// ── SEND COMMENT ──
async function sendComment() {
  const text = document.getElementById('c-input').value.trim();
  if (!text)    { toast('내용을 입력해요'); return; }
  if (!curType) { toast('피드백 타입을 선택해요'); return; }

  const p    = posts.find(x => x.id === curPost);
  const newC = await sb.post('comments', { post_id: curPost, type: curType, text, author: myNick, helpful: 0 });

  if (newC) {
    if (!comments[curPost]) comments[curPost] = [];
    comments[curPost].push({ ...newC, liked: false });
    p.comment_count = (p.comment_count || 0) + 1;
    await sb.patch('posts', curPost, { comment_count: p.comment_count });
  }

  // 피드백 히스토리
  myFbHistory.unshift({ postId: curPost, postTitle: p.title, type: curType, text, time: timeStr(new Date()) });

  // ── 게이트 카운트 ── 2번째 작업부터 잠금
  if (hasPosted && fbCount < 3) {
    fbCount++;
    gateUpdate();
    if (fbCount === 3) toast('피드백 3회 완료! 이제 작업을 올릴 수 있어요 🎉');
    else toast(`피드백 등록 (${fbCount}/3)`);
  } else {
    toast('피드백이 등록됐어요');
  }

  saveLocal();
  renderComments(curPost);
  renderPosts(curFilter);
  document.getElementById('c-input').value = '';
  curType = null; resetTypeChips();
  document.getElementById('c-list').scrollTop = 9999;
}

// ── OPEN UPLOAD ──
function openUpload() {
  // 게이트: 첫 작업은 자유, 이후 fbCount < 3이면 잠금
  const locked = hasPosted && fbCount < 3;

  document.getElementById('locked-view').style.display = locked ? 'block' : 'none';
  document.getElementById('open-view').style.display   = locked ? 'none'  : 'block';

  if (locked) {
    for (let i = 0; i < 3; i++) document.getElementById('lp' + i).classList.toggle('on', i < fbCount);
    document.getElementById('locked-sub').textContent = `${fbCount} / 3`;
  }

  document.getElementById('upload-modal-title').textContent = '작업 올리기';
  document.getElementById('upload-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeUpload() {
  document.getElementById('upload-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── FILE INPUT ──
function onFile(e, which) {
  const file = e.target.files[0]; if (!file) return;
  const r    = new FileReader();
  r.onload   = ev => {
    if (which === 'before') {
      imgDataBefore = ev.target.result;
      const prev = document.getElementById('preview-before');
      prev.src = imgDataBefore; prev.style.display = 'block';
      document.querySelector('#drop-before .drop-label').style.display = 'none';
    } else {
      imgDataAfter = ev.target.result;
      const prev = document.getElementById('preview-after');
      prev.src = imgDataAfter; prev.style.display = 'block';
      document.querySelector('#drop-after .drop-label').style.display = 'none';
    }
  };
  r.readAsDataURL(file);
}

function toggleW(btn) {
  btn.classList.toggle('on');
  const c = TC[btn.dataset.v].color;
  btn.style.cssText = btn.classList.contains('on') ? `background:${c};border-color:${c};color:#000` : '';
}

// ── DO POST ──
async function doPost() {
  const title  = document.getElementById('u-title').value.trim();
  const desc   = document.getElementById('u-desc').value.trim();
  const ver    = document.getElementById('u-version').value;
  const wanted = [...document.querySelectorAll('#open-view .w-opt.on')].map(b => b.dataset.v);

  if (!title)         { toast('제목을 입력해요'); return; }
  if (!imgDataAfter)  { toast('이미지를 올려요 (After 필수)'); return; }
  if (!wanted.length) { toast('피드백 타입을 선택해요'); return; }

  const btn = document.getElementById('submit-btn');
  btn.textContent = '올리는 중...'; btn.style.opacity = '0.6';

  const newPost = await sb.post('posts', {
    title,
    description: desc || '작업을 봐주세요.',
    img:         imgDataAfter,
    img_before:  imgDataBefore || null,
    version:     ver,
    wanted,
    author:       myNick,
    comment_count: 0,
    stickers:    {},
    keywords:    {}
  });

  btn.textContent = '올리기'; btn.style.opacity = '';

  if (newPost && newPost.id) {
    posts.unshift(newPost);
    myPostIds.push(newPost.id);

    // ── 게이트 업데이트 ──
    hasPosted = true;
    fbCount   = 0;   // 올릴 때마다 다시 3회 필요

    saveLocal(); gateUpdate(); renderPosts(curFilter); closeUpload(); resetUploadForm();
    toast('작업이 올라갔어요 🔥');
  } else {
    toast('오류가 났어요. 잠시 후 다시 시도해줘요.');
  }
}

function resetUploadForm() {
  document.getElementById('u-title').value = '';
  document.getElementById('u-desc').value  = '';
  document.getElementById('u-version').value = 'v1';
  ['before','after'].forEach(w => {
    const prev = document.getElementById(`preview-${w}`);
    prev.src = ''; prev.style.display = 'none';
    const lbl = document.querySelector(`#drop-${w} .drop-label`);
    if (lbl) lbl.style.display = '';
  });
  document.querySelectorAll('#open-view .w-opt').forEach(b => { b.classList.remove('on'); b.style.cssText = ''; });
  imgDataBefore = null; imgDataAfter = null;
}

// ── EDIT ──
function openEditModal() {
  const p = posts.find(x => x.id === curPost);
  if (!p) return;
  document.getElementById('e-title').value   = p.title;
  document.getElementById('e-desc').value    = p.description || '';
  document.getElementById('e-version').value = p.version || 'v1';
  // wanted 버튼 상태
  document.querySelectorAll('#e-wanted-row .w-opt').forEach(btn => {
    const on = (p.wanted || []).includes(btn.dataset.v);
    btn.classList.toggle('on', on);
    if (on) { const c = TC[btn.dataset.v].color; btn.style.cssText = `background:${c};border-color:${c};color:#000`; }
    else btn.style.cssText = '';
  });
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

async function doEdit() {
  const title  = document.getElementById('e-title').value.trim();
  const desc   = document.getElementById('e-desc').value.trim();
  const ver    = document.getElementById('e-version').value;
  const wanted = [...document.querySelectorAll('#e-wanted-row .w-opt.on')].map(b => b.dataset.v);
  if (!title) { toast('제목을 입력해요'); return; }

  await sb.patch('posts', curPost, { title, description: desc, version: ver, wanted });
  const p = posts.find(x => x.id === curPost);
  if (p) { p.title = title; p.description = desc; p.version = ver; p.wanted = wanted; }
  closeEditModal();
  // 모달 내용도 업데이트
  document.getElementById('m-title-nav').textContent = title;
  document.getElementById('m-title').textContent     = title;
  document.getElementById('m-desc').textContent      = desc;
  document.getElementById('m-version').textContent   = ver;
  renderPosts(curFilter);
  toast('수정됐어요');
}

// ── DELETE ──
async function deletePost() {
  if (!confirm('정말 삭제할까요? 피드백도 모두 사라져요.')) return;
  await sb.delete('posts', curPost);
  posts = posts.filter(x => x.id !== curPost);
  myPostIds = myPostIds.filter(x => x !== curPost);
  saveLocal();
  closeModal();
  renderPosts(curFilter);
  toast('삭제됐어요');
}

// ── TOAST ──
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── EVENT LISTENERS ──
document.getElementById('post-modal').addEventListener('click',   e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('upload-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeUpload(); });
document.getElementById('edit-modal').addEventListener('click',   e => { if (e.target === e.currentTarget) closeEditModal(); });

// ── INIT ──
async function init() {
  document.getElementById('grid').innerHTML = '<div class="empty" style="color:#2a2a2a">불러오는 중...</div>';
  const data = await sb.get('posts', 'order=created_at.desc');
  posts = Array.isArray(data) ? data : [];
  renderPosts(curFilter);
  gateUpdate();
}

init();
