const SB_URL = 'https://icbkaqjefvzufthhgtkv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYmthcWplZnZ6dWZ0aGhndGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQzMjAsImV4cCI6MjA4ODgwMDMyMH0.rwtsq7PEIvWMvOMveG0DxcspkvUE3yL3wJ9QWwLmLfE';

const sb = {
  async get(table, q='') {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${table}?${q}`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      });
      if (!r.ok) return [];
      return r.json();
    } catch(e) { return []; }
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
    } catch(e) { return null; }
  },
  async patch(table, id, body) {
    try {
      await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch(e) {}
  }
};

const TC = {
  visual: { label: '시각',    color: '#c94a3a' },
  idea:   { label: '아이디어', color: '#b89640' },
  ux:     { label: '경험',    color: '#4a8060' },
};

const LS = {
  save(k,v) { try { localStorage.setItem('rv_'+k, JSON.stringify(v)); } catch(e){} },
  load(k,d) { try { const v=localStorage.getItem('rv_'+k); return v?JSON.parse(v):d; } catch(e){return d;} }
};

let myNick = LS.load('nick', null);
if (!myNick) { myNick='anon_'+Math.floor(Math.random()*900+10); LS.save('nick', myNick); }

let hasPosted   = LS.load('hasPosted', false);
let fbCount     = LS.load('fbCount', 0);
let myPostIds   = LS.load('myPostIds', []);
let myFbHistory = LS.load('myFbHistory', []);

let posts=[], comments={}, curPost=null, curType=null, imgData=null, curFilter='all';

function saveLocal() {
  LS.save('hasPosted',hasPosted); LS.save('fbCount',fbCount);
  LS.save('myPostIds',myPostIds); LS.save('myFbHistory',myFbHistory);
}

function gateUpdate() {
  const locked=hasPosted&&fbCount<3;
  for(let i=0;i<3;i++) document.getElementById('p'+i).classList.toggle('on',hasPosted&&i<fbCount);
  const badge=document.getElementById('gate-badge');
  if(locked){badge.textContent=fbCount+'/3';badge.style.display='flex';}else badge.style.display='none';
  const lbl=document.getElementById('gate-label'), status=document.getElementById('gate-status');
  if(!hasPosted){lbl.textContent='첫 작업은 자유롭게. 이후엔 피드백 3회 필요.';status.textContent='';}
  else if(fbCount>=3){lbl.textContent='피드백 3회 완료. 작업을 올릴 수 있어요.';status.textContent='업로드 가능';}
  else{lbl.textContent=`업로드까지 피드백 ${3-fbCount}회 더 필요해요.`;status.textContent=`${fbCount} / 3`;}
}

function timeStr(ts) {
  if (!ts) return '방금';
  return new Date(ts).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function renderPosts(f='all') {
  const filtered=f==='all'?posts:posts.filter(p=>p.wanted&&p.wanted.includes(f));
  document.getElementById('post-count').textContent=filtered.length;
  document.getElementById('stat-posts').textContent=posts.length;
  document.getElementById('stat-fb').textContent=posts.reduce((a,p)=>a+(p.comment_count||0),0);
  const grid=document.getElementById('grid');
  if(!filtered.length){grid.innerHTML='<div class="empty">아직 작업이 없어요</div>';return;}
  grid.innerHTML=filtered.map(p=>{
    const isMe=myPostIds.includes(p.id);
    const wanted=p.wanted||[];
    const tags=wanted.map(w=>TC[w]?`<span class="wanted-tag" style="border-color:${TC[w].color}55;color:${TC[w].color}">${TC[w].label}</span>`:'').join('');
    const lines=wanted.map(w=>TC[w]?`<div class="type-line-seg" style="background:${TC[w].color}"></div>`:'').join('');
    return `<div class="post-card" onclick="openPost(${p.id})">
      <div class="post-img-wrap">
        <img src="${p.img||''}" alt="" loading="lazy">
        <div class="type-line">${lines}</div>
      </div>
      <div class="post-body">
        <div class="post-meta">
          <span class="post-author">${isMe?myNick+' (나)':(p.author||'anon')}</span>
          <span class="post-time">${timeStr(p.created_at)}</span>
        </div>
        <div class="post-title">${p.title}</div>
        <div class="post-desc">${p.description||''}</div>
        <div class="post-footer">
          <span class="feedback-count">${p.comment_count||0}개의 피드백</span>
          <div class="wanted-tags">${tags}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filter(type,btn) {
  curFilter=type;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderPosts(type);
}

async function openPost(id) {
  const p=posts.find(x=>x.id===id); if(!p) return;
  curPost=id; curType=null;
  const wanted=p.wanted||[];
  document.getElementById('m-title-nav').textContent=p.title;
  document.getElementById('m-title').textContent=p.title;
  document.getElementById('m-desc').textContent=p.description||'';
  document.getElementById('m-img').src=p.img||'';
  document.getElementById('m-badges').innerHTML=wanted.map(w=>TC[w]?
    `<span class="badge" style="border-color:${TC[w].color};color:${TC[w].color}">${TC[w].label} 원해요</span>`:''
  ).join('');
  document.getElementById('c-list').innerHTML=`<div style="text-align:center;padding:24px;font-family:'Space Mono',monospace;font-size:0.58rem;color:#333;letter-spacing:2px">불러오는 중...</div>`;
  const data=await sb.get('comments',`post_id=eq.${id}&order=created_at.asc`);
  comments[id]=Array.isArray(data)?data:[];
  resetTypeChips();
  document.getElementById('c-input').value='';
  document.getElementById('post-modal').classList.add('open');
  document.body.style.overflow='hidden';
  renderComments(id);
}
function closeModal(){document.getElementById('post-modal').classList.remove('open');document.body.style.overflow='';}

function renderComments(postId) {
  const list=document.getElementById('c-list');
  const cs=comments[postId]||[];
  if(!cs.length){list.innerHTML=`<div style="text-align:center;padding:24px;font-family:'Space Mono',monospace;font-size:0.58rem;color:#222;letter-spacing:2px;text-transform:uppercase">첫 번째 피드백을 남겨봐요</div>`;return;}
  list.innerHTML=cs.map(c=>{
    const t=TC[c.type]||TC.visual;
    const isMe=c.author===myNick;
    return `<div class="comment" style="border-left-color:${t.color}77">
      <div class="comment-header">
        <span class="comment-type" style="color:${t.color}">${t.label}</span>
        <span class="comment-author">${isMe?myNick+' (나)':(c.author||'anon')}</span>
      </div>
      <div class="comment-text">${c.text}</div>
      <button class="helpful-btn ${c.liked?'on':''}" onclick="helpful(${postId},${c.id},this)">도움됐어요 ${c.helpful||0}</button>
    </div>`;
  }).join('');
}

async function helpful(pid,cid,btn) {
  const cs=comments[pid]||[], c=cs.find(x=>x.id===cid); if(!c) return;
  c.liked=!c.liked; c.helpful=(c.helpful||0)+(c.liked?1:-1);
  btn.classList.toggle('on',c.liked); btn.textContent=`도움됐어요 ${c.helpful}`;
  await sb.patch('comments',cid,{helpful:c.helpful});
  toast(c.liked?'도움됐어요':'취소됐어요');
}

function pickType(btn) {
  resetTypeChips(); btn.classList.add('selected'); curType=btn.dataset.t;
  const c=TC[curType].color; btn.style.cssText=`background:${c};border-color:${c};color:#000`;
}
function resetTypeChips(){document.querySelectorAll('.type-chip').forEach(c=>{c.classList.remove('selected');c.style.cssText='';})}

async function sendComment() {
  const text=document.getElementById('c-input').value.trim();
  if(!text){toast('내용을 입력해요');return;}
  if(!curType){toast('피드백 타입을 선택해요');return;}
  const p=posts.find(x=>x.id===curPost);
  const newC=await sb.post('comments',{post_id:curPost,type:curType,text,author:myNick,helpful:0});
  if(newC){
    if(!comments[curPost]) comments[curPost]=[];
    comments[curPost].push({...newC,liked:false});
    p.comment_count=(p.comment_count||0)+1;
    await sb.patch('posts',curPost,{comment_count:p.comment_count});
  }
  myFbHistory.unshift({postId:curPost,postTitle:p.title,type:curType,text,time:timeStr(new Date())});
  if(hasPosted&&fbCount<3){
    fbCount++;gateUpdate();
    if(fbCount===3) toast('피드백 3회 완료. 이제 작업을 올릴 수 있어요.');
    else toast(`피드백 등록 (${fbCount}/3)`);
  } else toast('피드백이 등록됐어요');
  saveLocal();renderComments(curPost);renderPosts(curFilter);
  document.getElementById('c-input').value='';
  curType=null;resetTypeChips();
  document.getElementById('c-list').scrollTop=9999;
}

function openUpload() {
  const locked=hasPosted&&fbCount<3;
  document.getElementById('locked-view').style.display=locked?'block':'none';
  document.getElementById('open-view').style.display=locked?'none':'block';
  if(locked){for(let i=0;i<3;i++) document.getElementById('lp'+i).classList.toggle('on',i<fbCount);document.getElementById('locked-sub').textContent=`${fbCount} / 3`;}
  document.getElementById('upload-modal').classList.add('open');document.body.style.overflow='hidden';
}
function closeUpload(){document.getElementById('upload-modal').classList.remove('open');document.body.style.overflow='';}

function onFile(e) {
  const file=e.target.files[0];if(!file) return;
  const r=new FileReader();
  r.onload=ev=>{
    imgData=ev.target.result;
    const prev=document.getElementById('preview');
    prev.src=imgData;prev.style.display='block';
    document.querySelector('.drop-label').style.display='none';
    document.querySelector('.drop-sub').style.display='none';
  };r.readAsDataURL(file);
}

function toggleW(btn) {
  btn.classList.toggle('on');
  const c=TC[btn.dataset.v].color;
  btn.style.cssText=btn.classList.contains('on')?`background:${c};border-color:${c};color:#000`:'';
}

async function doPost() {
  const title=document.getElementById('u-title').value.trim();
  const desc=document.getElementById('u-desc').value.trim();
  const wanted=[...document.querySelectorAll('.w-opt.on')].map(b=>b.dataset.v);
  if(!title){toast('제목을 입력해요');return;}
  if(!wanted.length){toast('피드백 타입을 선택해요');return;}
  const btn=document.querySelector('.submit-btn');
  btn.textContent='올리는 중...';btn.style.opacity='0.6';
  const newPost=await sb.post('posts',{
    title, description:desc||'작업을 봐주세요.',
    img:imgData||'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80',
    wanted, author:myNick, comment_count:0
  });
  btn.textContent='올리기';btn.style.opacity='';
  if(newPost&&newPost.id){
    posts.unshift(newPost);myPostIds.push(newPost.id);
    hasPosted=true;fbCount=0;saveLocal();gateUpdate();renderPosts(curFilter);closeUpload();
    document.getElementById('u-title').value='';document.getElementById('u-desc').value='';
    document.getElementById('preview').style.display='none';
    document.querySelector('.drop-label').style.display='';document.querySelector('.drop-sub').style.display='';
    document.querySelectorAll('.w-opt').forEach(b=>{b.classList.remove('on');b.style.cssText='';});
    imgData=null;toast('작업이 올라갔어요');
  } else toast('오류가 났어요. Supabase 설정을 확인해줘요.');
}

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

document.getElementById('post-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.getElementById('upload-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeUpload();});

async function init() {
  document.getElementById('grid').innerHTML='<div class="empty" style="color:#2a2a2a">불러오는 중...</div>';
  const data=await sb.get('posts','order=created_at.desc');
  posts=Array.isArray(data)?data:[];
  renderPosts(curFilter);gateUpdate();
}
init();
