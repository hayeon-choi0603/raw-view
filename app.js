// ── PIN 로직 ──
const pinState = { login: [], signup: [] };

function pinInput(form, num) {
  const state = pinState[form];
  if (state.length >= 4) return;
  state.push(num);
  updatePinUI(form);
}

function pinDel(form) {
  pinState[form].pop();
  updatePinUI(form);
}

function updatePinUI(form) {
  const state = pinState[form];
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`${form}-pin-${i}`);
    if (i < state.length) {
      dot.textContent = state[i];
      dot.classList.add('filled');
      dot.classList.remove('active');
    } else {
      dot.textContent = '';
      dot.classList.remove('filled');
      dot.classList.toggle('active', i === state.length);
    }
  }
}

function getPin(form) {
  return pinState[form].join('');
}

function resetPin(form) {
  pinState[form] = [];
  updatePinUI(form);
}

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

// ── 카테고리 ──
const TC = {
  visual: { label: '시각',    color: '#e05a48' },
  idea:   { label: '아이디어', color: '#c9a440' },
  ux:     { label: '경험',    color: '#52906e' },
};
const RECRUIT_TYPES = {
  contest: { label: '공모전', color: '#e05a48' },
  project: { label: '프로젝트', color: '#c9a440' },
  study:   { label: '스터디', color: '#52906e' },
  etc:     { label: '기타', color: '#666' },
};

// ── 로컬스토리지 ──
const LS = {
  save(k, v) { try { localStorage.setItem('rv3_' + k, JSON.stringify(v)); } catch (e) {} },
  load(k, d) { try { const v = localStorage.getItem('rv3_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
};

// ── 유저 상태 ──
// ── 어드민 ──
const ADMIN = 'hanniicorn';
function isAdmin() { return currentUser && currentUser.username === ADMIN; }

let currentUser = LS.load('user', null); // { id, username }
let hasPosted   = LS.load('hasPosted', false);
let fbCount     = LS.load('fbCount', 0);

function saveLocal() {
  LS.save('user', currentUser);
  LS.save('hasPosted', hasPosted);
  LS.save('fbCount', fbCount);
}

// ── 전역 상태 ──
let posts = [], comments = {}, recruits = [], recruitComments = {};
let curPost = null, curType = null, curFilter = 'all';
let curRecruit = null, curRecruitFilter = 'all';
let imgData = null, curRecruitType = 'contest';

// ── 시간 포맷 ──
function timeStr(ts) {
  if (!ts) return '방금';
  return new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════
// AUTH
// ══════════════════════════════
function switchAuth(mode) {
  document.getElementById('login-form').style.display  = mode === 'login'  ? 'flex' : 'none';
  document.getElementById('signup-form').style.display = mode === 'signup' ? 'flex' : 'none';
  document.getElementById('tab-login').classList.toggle('active',  mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  updatePinUI('login');
  updatePinUI('signup');
}

async function doLogin() {
  const username = document.getElementById('login-id').value.trim();
  const errEl    = document.getElementById('login-err');
  errEl.textContent = '';

  const password = getPin('login');
  if (!username) { errEl.textContent = '아이디를 입력해요'; return; }
  if (password.length < 4) { errEl.textContent = 'PIN 4자리를 입력해요'; return; }

  const rows = await sb.get('profiles', `username=eq.${encodeURIComponent(username)}&select=id,username,password_hash`);
  if (!rows.length) { errEl.textContent = '존재하지 않는 아이디예요'; return; }

  const user = rows[0];
  // 간단한 해시 비교 (실제 서비스엔 bcrypt 권장)
  const hash = await simpleHash(password);
  if (user.password_hash !== hash) { errEl.textContent = '비밀번호가 틀렸어요'; return; }

  currentUser = { id: user.id, username: user.username };
  saveLocal();
  resetPin('login');
  enterApp();
}

async function doSignup() {
  const username = document.getElementById('signup-id').value.trim();
  const pw       = getPin('signup');
  const errEl    = document.getElementById('signup-err');
  errEl.textContent = '';

  if (!username)              { errEl.textContent = '아이디를 입력해요'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = '아이디는 영문·숫자·_ 만 가능해요'; return; }
  if (pw.length < 4)          { errEl.textContent = 'PIN 4자리를 모두 입력해요'; return; }

  // 중복 체크
  const existing = await sb.get('profiles', `username=eq.${encodeURIComponent(username)}&select=id`);
  if (existing.length) { errEl.textContent = '이미 사용 중인 아이디예요'; return; }

  const hash = await simpleHash(pw);
  const id   = crypto.randomUUID();
  const newUser = await sb.post('profiles', { id, username, password_hash: hash });
  if (!newUser) { errEl.textContent = '가입에 실패했어요. 다시 시도해줘요'; return; }

  currentUser = { id, username };
  saveLocal();
  resetPin('signup');
  enterApp();
  toast(`${username}님 환영해요!`);
}

// SHA-256 간단 해시
async function simpleHash(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function doLogout() {
  currentUser = null;
  hasPosted = false; fbCount = 0;
  saveLocal();
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  updateNavAuth();
  toast('로그아웃됐어요');
}

function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  updateNavAuth();
  gateUpdate();
}

// ══════════════════════════════
// TAB
// ══════════════════════════════
function switchTab(tab, btn) {
  document.getElementById('tab-feed').style.display    = tab === 'feed'    ? 'block' : 'none';
  document.getElementById('tab-recruit').style.display = tab === 'recruit' ? 'block' : 'none';
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'recruit') loadRecruits();
}

// ══════════════════════════════
// GATE
// ══════════════════════════════
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
    lbl.textContent = '첫 작업은 자유롭게. 이후엔 피드백 3회 필요.'; status.textContent = '';
  } else if (fbCount >= 3) {
    lbl.textContent = '피드백 3회 완료. 작업을 올릴 수 있어요.'; status.textContent = '업로드 가능';
  } else {
    lbl.textContent = `업로드까지 피드백 ${3 - fbCount}회 더 필요해요.`; status.textContent = `${fbCount} / 3`;
  }
}

// ══════════════════════════════
// POSTS
// ══════════════════════════════
function renderPosts(f = 'all') {
  const filtered = f === 'all' ? posts : posts.filter(p => p.wanted && p.wanted.includes(f));
  document.getElementById('post-count').textContent = filtered.length;
  document.getElementById('stat-posts').textContent = posts.length;
  document.getElementById('stat-fb').textContent    = posts.reduce((a, p) => a + (p.comment_count || 0), 0);

  const grid = document.getElementById('grid');
  if (!filtered.length) { grid.innerHTML = '<div class="empty">아직 작업이 없어요</div>'; return; }

  grid.innerHTML = filtered.map(p => {
    const isMe  = (currentUser && p.user_id === currentUser.id) || isAdmin();
    const wanted = p.wanted || [];
    const tags  = wanted.map(w => TC[w] ? `<span class="wanted-tag" style="border-color:${TC[w].color}55;color:${TC[w].color}">${TC[w].label}</span>` : '').join('');
    const lines = wanted.map(w => TC[w] ? `<div class="type-line-seg" style="background:${TC[w].color}"></div>` : '').join('');
    const vBadge = p.version ? `<span class="version-chip">${p.version}</span>` : '';
    return `<div class="post-card" onclick="openPost(${p.id})">
      <div class="post-img-wrap">
        <img src="${p.img || ''}" alt="" loading="lazy">
        ${vBadge}
        <div class="type-line">${lines}</div>
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-author">${isMe ? currentUser.username + ' (나)' : (p.author || 'anon')}</span>
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

function filterPosts(type, btn) {
  curFilter = type;
  document.querySelectorAll('#tab-feed .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPosts(type);
}

// ── 포스트 모달 ──
async function openPost(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  curPost = id; curType = null;

  const isMe   = (currentUser && p.user_id === currentUser.id) || isAdmin();
  const wanted = p.wanted || [];

  document.getElementById('m-title-nav').textContent = p.title;
  document.getElementById('m-title').textContent     = p.title;
  document.getElementById('m-desc').textContent      = p.description || '';
  document.getElementById('m-img').src               = p.img || '';
  document.getElementById('m-badges').innerHTML = wanted.map(w => TC[w] ?
    `<span class="badge" style="border-color:${TC[w].color};color:${TC[w].color}">${TC[w].label} 원해요</span>` : ''
  ).join('');

  const vEl = document.getElementById('m-version');
  vEl.textContent  = p.version || '';
  vEl.style.display = p.version ? 'inline' : 'none';

  document.getElementById('m-edit-btn').style.display   = isMe ? 'flex' : 'none';
  document.getElementById('m-delete-btn').style.display = isMe ? 'flex' : 'none';

  document.querySelectorAll('.kw-tag').forEach(t => t.classList.remove('active'));

  document.getElementById('c-list').innerHTML = `<div style="text-align:center;padding:24px;font-family:'Space Mono',monospace;font-size:0.56rem;color:#444;letter-spacing:2px">불러오는 중...</div>`;
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

// ── 댓글 렌더 ──
function renderComments(postId) {
  const list = document.getElementById('c-list');
  const cs   = comments[postId] || [];
  if (!cs.length) {
    list.innerHTML = `<div style="text-align:center;padding:28px;font-family:'Space Mono',monospace;font-size:0.54rem;color:#333;letter-spacing:2px;text-transform:uppercase">첫 번째 피드백을 남겨봐요</div>`;
    return;
  }
  list.innerHTML = cs.map(c => {
    const t    = TC[c.type] || TC.visual;
    const isMe = (currentUser && c.user_id === currentUser.id) || isAdmin();
    const delBtn = isMe ? `<button class="delete-comment-btn" onclick="deleteComment(${postId},${c.id},event)">✕</button>` : '';
    return `<div class="comment" style="border-left-color:${t.color}99" id="comment-${c.id}">
      <div class="comment-header">
        <div class="comment-header-left">
          <span class="comment-type" style="color:${t.color}">${t.label}</span>
          <span class="comment-author">${isMe ? currentUser.username + ' (나)' : (c.author || 'anon')}</span>
        </div>
        <div class="comment-actions">
          <button class="helpful-btn ${c.liked ? 'on' : ''}" onclick="helpful(${postId},${c.id},this)">도움됐어요 ${c.helpful || 0}</button>
          ${delBtn}
        </div>
      </div>
      <div class="comment-text">${c.text}</div>
    </div>`;
  }).join('');
}

async function helpful(pid, cid, btn) {
  const cs = comments[pid] || [], c = cs.find(x => x.id === cid);
  if (!c) return;
  c.liked   = !c.liked;
  c.helpful = (c.helpful || 0) + (c.liked ? 1 : -1);
  btn.classList.toggle('on', c.liked);
  btn.textContent = `도움됐어요 ${c.helpful}`;
  await sb.patch('comments', cid, { helpful: c.helpful });
  toast(c.liked ? '도움됐어요' : '취소됐어요');
}

async function deleteComment(postId, commentId, e) {
  e.stopPropagation();
  if (!confirm('댓글을 삭제할까요?')) return;
  await sb.delete('comments', commentId);
  comments[postId] = (comments[postId] || []).filter(c => c.id !== commentId);
  const p = posts.find(x => x.id === postId);
  if (p) { p.comment_count = Math.max(0, (p.comment_count || 1) - 1); await sb.patch('posts', postId, { comment_count: p.comment_count }); }
  renderComments(postId);
  renderPosts(curFilter);
  toast('댓글이 삭제됐어요');
}

// ── 피드백 타입 ──
function pickType(btn) {
  resetTypeChips(); btn.classList.add('selected'); curType = btn.dataset.t;
  const c = TC[curType].color; btn.style.cssText = `background:${c};border-color:${c};color:#000`;
}
function resetTypeChips() {
  document.querySelectorAll('.type-chip').forEach(c => { c.classList.remove('selected'); c.style.cssText = ''; });
}

// ── 댓글 전송 ──
async function sendComment() {
  if (!requireLogin('피드백을 남기려면 먼저 회원가입 해줘요!')) return;
  const text = document.getElementById('c-input').value.trim();
  if (!text)    { toast('내용을 입력해요'); return; }
  if (!curType) { toast('피드백 타입을 선택해요'); return; }

  const p    = posts.find(x => x.id === curPost);
  const newC = await sb.post('comments', {
    post_id: curPost, type: curType, text,
    author: currentUser.username, user_id: currentUser.id, helpful: 0
  });

  if (newC) {
    if (!comments[curPost]) comments[curPost] = [];
    comments[curPost].push({ ...newC, liked: false });
    p.comment_count = (p.comment_count || 0) + 1;
    await sb.patch('posts', curPost, { comment_count: p.comment_count });
  }

  // 게이트
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

// ── 키워드 태그 ──
async function toggleKeyword(btn, word) {
  btn.classList.toggle('active');
  const p = posts.find(x => x.id === curPost); if (!p) return;
  if (!p.keywords) p.keywords = {};
  if (!p.keywords[word]) p.keywords[word] = { count: 0, users: [] };
  const entry = p.keywords[word];
  const idx   = entry.users.indexOf(currentUser.id);
  if (btn.classList.contains('active')) { if (idx < 0) { entry.users.push(currentUser.id); entry.count++; } }
  else { if (idx >= 0) { entry.users.splice(idx, 1); entry.count--; } }
  await sb.patch('posts', curPost, { keywords: p.keywords });
  toast('반응 저장됐어요');
}

// ── 업로드 ──
function openUpload() {
  if (!requireLogin('작업을 올리려면 먼저 회원가입 해줘요!')) return;
  const locked = hasPosted && fbCount < 3;
  document.getElementById('locked-view').style.display = locked ? 'block' : 'none';
  document.getElementById('open-view').style.display   = locked ? 'none'  : 'block';
  if (locked) {
    for (let i = 0; i < 3; i++) document.getElementById('lp' + i).classList.toggle('on', i < fbCount);
    document.getElementById('locked-sub').textContent = `${fbCount} / 3`;
  }
  document.getElementById('upload-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeUpload() {
  document.getElementById('upload-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function onFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const r    = new FileReader();
  r.onload   = ev => {
    imgData = ev.target.result;
    const prev = document.getElementById('preview-img');
    prev.src = imgData; prev.style.display = 'block';
    document.getElementById('drop-label').style.display = 'none';
  };
  r.readAsDataURL(file);
}

function toggleW(btn) {
  btn.classList.toggle('on');
  const c = TC[btn.dataset.v] ? TC[btn.dataset.v].color : '#888';
  btn.style.cssText = btn.classList.contains('on') ? `background:${c};border-color:${c};color:#000` : '';
}

async function doPost() {
  const title  = document.getElementById('u-title').value.trim();
  const desc   = document.getElementById('u-desc').value.trim();
  const ver    = document.getElementById('u-version').value;
  const wanted = [...document.querySelectorAll('#open-view .w-opt.on')].map(b => b.dataset.v);
  if (!title)         { toast('제목을 입력해요'); return; }
  if (!imgData)       { toast('이미지를 올려요'); return; }
  if (!wanted.length) { toast('피드백 타입을 선택해요'); return; }

  const btn = document.getElementById('submit-btn');
  btn.textContent = '올리는 중...'; btn.style.opacity = '0.6';

  const newPost = await sb.post('posts', {
    title, description: desc || '작업을 봐주세요.',
    img: imgData, version: ver, wanted,
    author: currentUser.username, user_id: currentUser.id,
    comment_count: 0, keywords: {}
  });

  btn.textContent = '올리기'; btn.style.opacity = '';

  if (newPost && newPost.id) {
    posts.unshift(newPost);
    hasPosted = true; fbCount = 0;
    saveLocal(); gateUpdate(); renderPosts(curFilter); closeUpload(); resetUploadForm();
    toast('작업이 올라갔어요 🔥');
  } else {
    toast('오류가 났어요. 다시 시도해줘요.');
  }
}

function resetUploadForm() {
  document.getElementById('u-title').value   = '';
  document.getElementById('u-desc').value    = '';
  document.getElementById('u-version').value = 'v1';
  const prev = document.getElementById('preview-img');
  prev.src = ''; prev.style.display = 'none';
  document.getElementById('drop-label').style.display = '';
  document.querySelectorAll('#open-view .w-opt').forEach(b => { b.classList.remove('on'); b.style.cssText = ''; });
  imgData = null;
}

// ── 수정 ──
function openEditModal() {
  const p = posts.find(x => x.id === curPost); if (!p) return;
  document.getElementById('e-title').value   = p.title;
  document.getElementById('e-desc').value    = p.description || '';
  document.getElementById('e-version').value = p.version || 'v1';
  document.querySelectorAll('#e-wanted-row .w-opt').forEach(btn => {
    const on = (p.wanted || []).includes(btn.dataset.v);
    btn.classList.toggle('on', on);
    if (on) { const c = TC[btn.dataset.v].color; btn.style.cssText = `background:${c};border-color:${c};color:#000`; }
    else btn.style.cssText = '';
  });
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal() { document.getElementById('edit-modal').classList.remove('open'); }

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
  document.getElementById('m-title-nav').textContent = title;
  document.getElementById('m-title').textContent     = title;
  document.getElementById('m-desc').textContent      = desc;
  document.getElementById('m-version').textContent   = ver;
  renderPosts(curFilter);
  toast('수정됐어요');
}

// ── 삭제 ──
async function deletePost() {
  if (!confirm('작업을 삭제할까요? 피드백도 모두 사라져요.')) return;
  await sb.delete('posts', curPost);
  posts = posts.filter(x => x.id !== curPost);
  closeModal();
  renderPosts(curFilter);
  toast('삭제됐어요');
}

// ══════════════════════════════
// RECRUIT
// ══════════════════════════════
async function loadRecruits() {
  document.getElementById('recruit-list').innerHTML = '<div class="empty" style="color:#2a2a2a">불러오는 중...</div>';
  const data = await sb.get('recruits', 'order=created_at.desc');
  recruits = Array.isArray(data) ? data : [];
  document.getElementById('stat-users').textContent = recruits.length;
  renderRecruits(curRecruitFilter);
}

function renderRecruits(f = 'all') {
  const filtered = f === 'all' ? recruits : recruits.filter(r => r.type === f);
  document.getElementById('recruit-count').textContent = filtered.length;
  const list = document.getElementById('recruit-list');
  if (!filtered.length) { list.innerHTML = '<div class="empty">아직 모집 글이 없어요</div>'; return; }
  list.innerHTML = filtered.map(r => {
    const t = RECRUIT_TYPES[r.type] || RECRUIT_TYPES.etc;
    const deadlineStr = r.deadline ? `마감 ${r.deadline}` : '';
    return `<div class="recruit-card" onclick="openRecruitDetail(${r.id})">
      <span class="recruit-type-badge" style="border-color:${t.color};color:${t.color}">${t.label}</span>
      <div class="recruit-body">
        <div class="recruit-title">${r.title}</div>
        <div class="recruit-desc">${r.description || ''}</div>
        <div class="recruit-meta">
          <span class="recruit-author">${r.author || 'anon'}</span>
          <span class="recruit-time">${timeStr(r.created_at)}</span>
          ${deadlineStr ? `<span class="recruit-deadline">${deadlineStr}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterRecruit(type, btn) {
  curRecruitFilter = type;
  document.querySelectorAll('#tab-recruit .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRecruits(type);
}

// ── 모집 업로드 ──
let recruitTypeSelected = 'contest';
function openRecruitUpload() {
  document.getElementById('recruit-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeRecruitUpload() {
  document.getElementById('recruit-modal').classList.remove('open');
  document.body.style.overflow = '';
}
function pickRecruitType(btn) {
  document.querySelectorAll('#recruit-modal .w-opt').forEach(b => { b.classList.remove('on'); b.style.cssText = ''; });
  btn.classList.add('on');
  recruitTypeSelected = btn.dataset.v;
  const t = RECRUIT_TYPES[recruitTypeSelected];
  btn.style.cssText = `background:${t.color};border-color:${t.color};color:#fff`;
}
// 기본 선택
document.addEventListener('DOMContentLoaded', () => {
  const defaultBtn = document.querySelector('#recruit-modal .w-opt[data-v="contest"]');
  if (defaultBtn) pickRecruitType(defaultBtn);
});

async function doRecruitPost() {
  const title    = document.getElementById('r-title').value.trim();
  const desc     = document.getElementById('r-desc').value.trim();
  const deadline = document.getElementById('r-deadline').value;
  if (!title) { toast('제목을 입력해요'); return; }

  const newR = await sb.post('recruits', {
    title, description: desc, type: recruitTypeSelected,
    deadline: deadline || null,
    author: currentUser.username, user_id: currentUser.id
  });

  if (newR && newR.id) {
    recruits.unshift(newR);
    renderRecruits(curRecruitFilter);
    closeRecruitUpload();
    document.getElementById('r-title').value    = '';
    document.getElementById('r-desc').value     = '';
    document.getElementById('r-deadline').value = '';
    toast('모집 글이 올라갔어요!');
  } else {
    toast('오류가 났어요. 다시 시도해줘요.');
  }
}

// ── 모집 상세 ──
async function openRecruitDetail(id) {
  const r = recruits.find(x => x.id === id); if (!r) return;
  curRecruit = id;
  const isMe = (currentUser && r.user_id === currentUser.id) || isAdmin();
  const t    = RECRUIT_TYPES[r.type] || RECRUIT_TYPES.etc;

  document.getElementById('rd-title-nav').textContent = r.title;
  document.getElementById('rd-title').textContent     = r.title;
  document.getElementById('rd-desc').textContent      = r.description || '';
  document.getElementById('rd-type').textContent      = t.label;
  document.getElementById('rd-type').style.cssText    = `border-color:${t.color};color:${t.color}`;
  document.getElementById('rd-author').textContent    = r.author || 'anon';
  document.getElementById('rd-time').textContent      = timeStr(r.created_at);
  document.getElementById('rd-deadline').textContent  = r.deadline ? `마감 ${r.deadline}` : '';
  document.getElementById('rd-delete-btn').style.display = isMe ? 'flex' : 'none';

  document.getElementById('rd-c-list').innerHTML = `<div style="font-family:'Space Mono',monospace;font-size:0.54rem;color:#444;letter-spacing:2px">불러오는 중...</div>`;
  document.getElementById('rd-c-input').value = '';
  document.getElementById('recruit-detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  const data = await sb.get('recruit_comments', `recruit_id=eq.${id}&order=created_at.asc`);
  recruitComments[id] = Array.isArray(data) ? data : [];
  renderRecruitComments(id);
}
function closeRecruitDetail() {
  document.getElementById('recruit-detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderRecruitComments(recruitId) {
  const list = document.getElementById('rd-c-list');
  const cs   = recruitComments[recruitId] || [];
  if (!cs.length) {
    list.innerHTML = `<div style="font-family:'Space Mono',monospace;font-size:0.54rem;color:#333;letter-spacing:2px">첫 댓글을 남겨봐요</div>`;
    return;
  }
  list.innerHTML = cs.map(c => {
    const isMe = (currentUser && c.user_id === currentUser.id) || isAdmin();
    const delBtn = isMe ? `<button class="delete-comment-btn" onclick="deleteRecruitComment(${recruitId},${c.id},event)">✕</button>` : '';
    return `<div class="rd-comment" id="rc-${c.id}">
      <div class="rd-comment-header">
        <span class="rd-comment-author">${isMe ? currentUser.username + ' (나)' : (c.author || 'anon')}</span>
        ${delBtn}
      </div>
      <div class="rd-comment-text">${c.text}</div>
    </div>`;
  }).join('');
}

async function sendRecruitComment() {
  if (!requireLogin('댓글을 남기려면 먼저 회원가입 해줘요!')) return;
  const text = document.getElementById('rd-c-input').value.trim();
  if (!text) { toast('댓글을 입력해요'); return; }
  const newC = await sb.post('recruit_comments', {
    recruit_id: curRecruit, text,
    author: currentUser.username, user_id: currentUser.id
  });
  if (newC) {
    if (!recruitComments[curRecruit]) recruitComments[curRecruit] = [];
    recruitComments[curRecruit].push(newC);
    renderRecruitComments(curRecruit);
    document.getElementById('rd-c-input').value = '';
    document.getElementById('rd-c-list').scrollTop = 9999;
    toast('댓글이 등록됐어요');
  }
}

async function deleteRecruitComment(recruitId, commentId, e) {
  e.stopPropagation();
  if (!confirm('댓글을 삭제할까요?')) return;
  await sb.delete('recruit_comments', commentId);
  recruitComments[recruitId] = (recruitComments[recruitId] || []).filter(c => c.id !== commentId);
  renderRecruitComments(recruitId);
  toast('삭제됐어요');
}

async function deleteRecruit() {
  if (!confirm('모집 글을 삭제할까요?')) return;
  await sb.delete('recruits', curRecruit);
  recruits = recruits.filter(x => x.id !== curRecruit);
  closeRecruitDetail();
  renderRecruits(curRecruitFilter);
  toast('삭제됐어요');
}

function updateNavAuth() {
  const loggedIn = !!currentUser;
  document.getElementById('btn-logout').style.display    = loggedIn ? '' : 'none';
  document.getElementById('btn-login-nav').style.display = loggedIn ? 'none' : '';
  document.getElementById('nav-user').textContent        = loggedIn ? currentUser.username : '';
}

function closeAuthScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

function goToAuth() {
  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  switchAuth('signup');
}

// ── 로그인 체크 → 회원가입 화면으로 ──
function requireLogin(msg) {
  if (currentUser) return true;
  // 모달 닫기
  ['post-modal','upload-modal','edit-modal','recruit-modal','recruit-detail-modal'].forEach(id => {
    document.getElementById(id).classList.remove('open');
  });
  document.body.style.overflow = '';
  // 앱 숨기고 회원가입 탭 보여주기
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  switchAuth('signup');
  toast(msg || '먼저 회원가입 해줘요!');
  return false;
}


function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── EVENT LISTENERS ──
document.getElementById('post-modal').addEventListener('click',          e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('upload-modal').addEventListener('click',        e => { if (e.target === e.currentTarget) closeUpload(); });
document.getElementById('edit-modal').addEventListener('click',          e => { if (e.target === e.currentTarget) closeEditModal(); });
document.getElementById('recruit-modal').addEventListener('click',       e => { if (e.target === e.currentTarget) closeRecruitUpload(); });
document.getElementById('recruit-detail-modal').addEventListener('click',e => { if (e.target === e.currentTarget) closeRecruitDetail(); });

// Enter 키
document.getElementById('login-id').addEventListener('keydown',  e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('signup-id').addEventListener('keydown', e => { if (e.key === 'Enter') doSignup(); });

// ── INIT ──
async function init() {
  document.getElementById('grid').innerHTML = '<div class="empty" style="color:#2a2a2a">불러오는 중...</div>';
  const data = await sb.get('posts', 'order=created_at.desc');
  posts = Array.isArray(data) ? data : [];
  renderPosts(curFilter);
  gateUpdate();
}

// ── 시작: 항상 앱 먼저 보여주기 ──
document.getElementById('auth-screen').style.display = 'none';
document.getElementById('app').style.display = 'block';
updateNavAuth();
init();
