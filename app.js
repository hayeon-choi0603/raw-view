// ══ PIN ══
const pinState={login:[],signup:[]};
function pinInput(f,n){if(pinState[f].length>=4)return;pinState[f].push(n);updatePinUI(f)}
function pinDel(f){pinState[f].pop();updatePinUI(f)}
function updatePinUI(f){const s=pinState[f];for(let i=0;i<4;i++){const d=document.getElementById(`${f}-pin-${i}`);if(i<s.length){d.textContent=s[i];d.classList.add('filled');d.classList.remove('active')}else{d.textContent='';d.classList.remove('filled');d.classList.toggle('active',i===s.length)}}}
function getPin(f){return pinState[f].join('')}
function resetPin(f){pinState[f]=[];updatePinUI(f)}

// ══ SUPABASE ══
const SB_URL='https://icbkaqjefvzufthhgtkv.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljYmthcWplZnZ6dWZ0aGhndGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjQzMjAsImV4cCI6MjA4ODgwMDMyMH0.rwtsq7PEIvWMvOMveG0DxcspkvUE3yL3wJ9QWwLmLfE';
const SBH={apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'};
const sb={
  async get(t,q=''){try{const r=await fetch(`${SB_URL}/rest/v1/${t}?${q}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}});if(!r.ok)return[];return r.json()}catch{return[]}},
  async post(t,b){try{const r=await fetch(`${SB_URL}/rest/v1/${t}`,{method:'POST',headers:SBH,body:JSON.stringify(b)});if(!r.ok){console.error(await r.text());return null}const d=await r.json();return Array.isArray(d)?d[0]:d}catch{return null}},
  async patch(t,id,b){try{await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:'PATCH',headers:SBH,body:JSON.stringify(b)})}catch{}},
  async delete(t,id){try{await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:'DELETE',headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}})}catch{}}
};

// ══ 카테고리 ══
const TC={visual:{label:'시각',color:'#d94f3d'},idea:{label:'아이디어',color:'#b8942a'},ux:{label:'경험',color:'#3f7a58'}};
const RT={contest:{label:'공모전',color:'#d94f3d'},project:{label:'프로젝트',color:'#b8942a'},study:{label:'스터디',color:'#3f7a58'},etc:{label:'기타',color:'#666'}};

// ══ LS ══
const LS={
  save(k,v){try{localStorage.setItem('rv8_'+k,JSON.stringify(v))}catch{}},
  load(k,d){
    try{
      // rv8_ 먼저, 없으면 기존 rv7_ 확인 (hanniicorn 같은 기존 계정 호환)
      const v8=localStorage.getItem('rv8_'+k);
      if(v8) return JSON.parse(v8);
      const v7=localStorage.getItem('rv7_'+k)||localStorage.getItem('rv3_'+k);
      if(v7){ const parsed=JSON.parse(v7); LS.save(k,parsed); return parsed; }
      return d;
    }catch{return d}
  }
};

// ══ 상태 ══
const ADMIN='hanniicorn';
function isAdmin(){return cu&&cu.username===ADMIN}
let cu=LS.load('user',null),hasPosted=LS.load('hp',false),fbCount=LS.load('fbc',0);
let signupRole=null;
function saveL(){LS.save('user',cu);LS.save('hp',hasPosted);LS.save('fbc',fbCount)}

let posts=[],comments={},recruits=[],rComments={};
let curPost=null,curType=null,cf='all',curRoleFilter='all';
let curRecruit=null,crf='all',imgData=null,rType='contest';

function ts(t){if(!t)return'방금';return new Date(t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}

// ══ ROLE 선택 ══
function selectRole(r){
  signupRole=r;
  document.getElementById('role-designer').classList.toggle('designer-on',r==='designer');
  document.getElementById('role-designer').classList.toggle('on',false);
  document.getElementById('role-general').classList.toggle('on',r==='general');
  document.getElementById('role-general').classList.toggle('designer-on',false);
  if(r==='designer'){document.getElementById('role-designer').classList.add('designer-on')}
}

// ══ AUTH ══
function switchAuth(m){
  document.getElementById('login-form').style.display=m==='login'?'flex':'none';
  document.getElementById('signup-form').style.display=m==='signup'?'flex':'none';
  document.getElementById('tab-login').classList.toggle('active',m==='login');
  document.getElementById('tab-signup').classList.toggle('active',m==='signup');
  updatePinUI('login');updatePinUI('signup');
}
async function doLogin(){
  const username=document.getElementById('login-id').value.trim();
  const errEl=document.getElementById('login-err');errEl.textContent='';
  const password=getPin('login');
  if(!username){errEl.textContent='아이디를 입력해요';return}
  if(password.length<4){errEl.textContent='PIN 4자리를 입력해요';return}
  // role 컬럼 없는 기존 계정도 호환
  const rows=await sb.get('profiles',`username=eq.${encodeURIComponent(username)}&select=id,username,password_hash,role`);
  if(!rows.length){errEl.textContent='존재하지 않는 아이디예요';return}
  const user=rows[0];
  const hash=await simpleHash(password);
  if(user.password_hash!==hash){errEl.textContent='비밀번호가 틀렸어요';return}
  // role 없으면 admin은 designer, 나머지는 designer 기본값
  const role = user.role || (user.username===ADMIN ? 'designer' : 'designer');
  cu={id:user.id,username:user.username,role};
  saveL();resetPin('login');enterApp();
}
async function doSignup(){
  const username=document.getElementById('signup-id').value.trim();
  const pw=getPin('signup');
  const errEl=document.getElementById('signup-err');errEl.textContent='';
  if(!username){errEl.textContent='아이디를 입력해요';return}
  if(!/^[a-zA-Z0-9_]+$/.test(username)){errEl.textContent='영문·숫자·_ 만 가능해요';return}
  if(!signupRole) signupRole='designer'; // 선택 안 했으면 기본값
  if(pw.length<4){errEl.textContent='PIN 4자리를 입력해요';return}
  const existing=await sb.get('profiles',`username=eq.${encodeURIComponent(username)}&select=id`);
  if(existing.length){errEl.textContent='이미 사용 중인 아이디예요';return}
  const hash=await simpleHash(pw);
  const id=crypto.randomUUID();
  const newUser=await sb.post('profiles',{id,username,password_hash:hash,role:signupRole});
  if(!newUser){errEl.textContent='가입 실패. 다시 시도해줘요';return}
  cu={id,username,role:signupRole};saveL();resetPin('signup');enterApp();toast(`${username}님 환영해요!`);
}
async function simpleHash(str){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function doLogout(){cu=null;hasPosted=false;fbCount=0;saveL();updateNavAuth();goLanding();toast('로그아웃됐어요')}
function enterApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('entry-gate').style.display='none';
  document.getElementById('general-mode').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('landing').style.display='grid';
  ['tab-feed','tab-recruit','tab-study'].forEach(id=>document.getElementById(id).style.display='none');
  updateNavAuth();gateUpdate();
}
function closeAuthScreen(){document.getElementById('auth-screen').style.display='none';document.getElementById('app').style.display='block'}
function goToAuth(){document.getElementById('app').style.display='none';document.getElementById('auth-screen').style.display='flex';switchAuth('signup')}
function requireLogin(msg){
  if(cu)return true;
  ['post-modal','upload-modal','edit-modal','recruit-modal','recruit-detail-modal'].forEach(id=>document.getElementById(id).classList.remove('open'));
  document.body.style.overflow='';
  goToAuth();toast(msg||'먼저 로그인 해줘요!');return false;
}
function updateNavAuth(){
  const li=!!cu;
  document.getElementById('btn-logout').style.display=li?'':'none';
  document.getElementById('btn-login-nav').style.display=li?'none':'';
  document.getElementById('nav-user').textContent=li?cu.username:'';
  const rb=document.getElementById('nav-role-badge');
  if(li&&cu.role){rb.style.display='';rb.textContent=cu.role==='designer'?'DESIGNER':'GENERAL';rb.className='nav-role-badge '+(cu.role==='designer'?'designer':'general')}
  else rb.style.display='none';
}

// ══ 네비게이션 ══
function goLanding(){
  document.getElementById('landing').style.display='block';
  document.getElementById('tab-feed').style.display='none';
  document.getElementById('tab-recruit').style.display='none';
  document.getElementById('tab-study').style.display='none';
}
function enterFeedback(){
  document.getElementById('landing').style.display='none';
  document.getElementById('tab-feed').style.display='block';
  document.getElementById('tab-recruit').style.display='none';
  document.getElementById('tab-study').style.display='none';
  renderShorts();
}
function enterRecruit(){
  document.getElementById('landing').style.display='none';
  document.getElementById('tab-feed').style.display='none';
  document.getElementById('tab-recruit').style.display='block';
  document.getElementById('tab-study').style.display='none';
  loadRecruits();
}
function enterStudy(){
  document.getElementById('landing').style.display='none';
  document.getElementById('tab-feed').style.display='none';
  document.getElementById('tab-recruit').style.display='none';
  document.getElementById('tab-study').style.display='block';
  initRealtime();
  loadStudyData();
}
function switchTab(tab){if(tab==='feed')enterFeedback();else if(tab==='recruit')enterRecruit()}

// ══ GATE ══
function gateUpdate(){
  const locked=hasPosted&&fbCount<3;
  for(let i=0;i<3;i++)document.getElementById('p'+i).classList.toggle('on',hasPosted&&i<fbCount);
  const badge=document.getElementById('gate-badge');
  if(locked){badge.textContent=fbCount+'/3';badge.style.display='flex'}else badge.style.display='none';
  const lbl=document.getElementById('gate-label');
  const status=document.getElementById('gate-status');
  if(!hasPosted){lbl.textContent='첫 작업은 자유롭게. 이후엔 피드백 3회 필요.';status.textContent=''}
  else if(fbCount>=3){lbl.textContent='피드백 3회 완료. 업로드 가능해요.';status.textContent='업로드 가능'}
  else{lbl.textContent=`업로드까지 피드백 ${3-fbCount}회 더 필요해요.`;status.textContent=`${fbCount}/3`}
}

// ══ 역할 필터 ══
let roleFilter='all';
function setRoleFilter(r,btn){
  roleFilter=r;
  document.querySelectorAll('.frt-btn').forEach(b=>b.className='frt-btn');
  if(r==='all')btn.classList.add('active-all');
  else if(r==='designer')btn.classList.add('active-d');
  else btn.classList.add('active-g');
  renderShorts();
}

// ══ 숏츠 피드 ══
let shortsIndex=0,filteredPosts=[],isDragging=false,startX=0,currentX=0;

function getFilteredPosts(){
  let fp=cf==='all'?posts:posts.filter(p=>p.wanted&&p.wanted.includes(cf));
  if(roleFilter==='designer')fp=fp.filter(p=>p.author_role==='designer');
  else if(roleFilter==='general')fp=fp.filter(p=>p.author_role==='general'||!p.author_role);
  return fp;
}

function renderShorts(){
  filteredPosts=getFilteredPosts();
  document.getElementById('stat-posts').textContent=posts.length;
  document.getElementById('stat-fb').textContent=posts.reduce((a,p)=>a+(p.comment_count||0),0);
  const stack=document.getElementById('card-stack');
  const empty=document.getElementById('empty-feed');
  if(!filteredPosts.length){stack.querySelectorAll('.s-card').forEach(c=>c.remove());empty.style.display='flex';return}
  empty.style.display='none';
  shortsIndex=Math.min(shortsIndex,filteredPosts.length-1);
  renderCardStack();
}

function renderCardStack(){
  const stack=document.getElementById('card-stack');
  stack.querySelectorAll('.s-card').forEach(c=>c.remove());
  const show=[shortsIndex,shortsIndex+1,shortsIndex+2];
  show.reverse().forEach((idx,ri)=>{
    if(idx>=filteredPosts.length)return;
    const p=filteredPosts[idx];
    const card=makeCard(p);
    const cls=['behind2','behind','current'][ri];
    card.classList.add(cls);
    stack.appendChild(card);
  });
  // 드래그 이벤트
  const current=stack.querySelector('.s-card.current');
  if(current)attachDrag(current);
}

function makeCard(p){
  const wanted=p.wanted||[];
  const lines=wanted.map(w=>TC[w]?`<div class="sc-type-seg" style="background:${TC[w].color}"></div>`:'').join('');
  const tags=wanted.map(w=>TC[w]?`<span class="sc-tag" style="border-color:${TC[w].color}55;color:${TC[w].color}">${TC[w].label}</span>`:'').join('');
  const roleLabel=p.author_role==='designer'?'디자이너':'일반인';
  const roleCls=p.author_role==='designer'?'designer':'general';
  const card=document.createElement('div');
  card.className='s-card';
  card.dataset.id=p.id;
  card.innerHTML=`
    <div class="sc-img">
      <img src="${p.img||''}" alt="" draggable="false">
      ${p.version?`<span class="sc-ver">${p.version}</span>`:''}
      <span class="sc-role ${roleCls}">${roleLabel}</span>
      <div class="sc-type-line">${lines}</div>
    </div>
    <div class="sc-body">
      <div class="sc-meta">
        <span class="sc-author">${p.author||'anon'}</span>
        <span class="sc-time">${ts(p.created_at)}</span>
      </div>
      <div class="sc-title">${p.title}</div>
      <div class="sc-desc">${p.description||''}</div>
      <div class="sc-tags">${tags}</div>
      <div class="sc-fb-count">${p.comment_count||0}개의 피드백</div>
    </div>
    <div class="sc-actions">
      <button class="sc-action-btn" onclick="skipCard(event)">건너뛰기</button>
      <button class="sc-action-btn primary" onclick="openPostFromCard(${p.id},event)">피드백 하기</button>
    </div>`;
  return card;
}

function attachDrag(card){
  let sx=0,sy=0,dragging=false;
  const onStart=e=>{
    if(e.target.tagName==='BUTTON')return;
    dragging=true;sx=e.type==='touchstart'?e.touches[0].clientX:e.clientX;
    sy=e.type==='touchstart'?e.touches[0].clientY:e.clientY;
    card.style.transition='none';
  };
  const onMove=e=>{
    if(!dragging)return;
    const cx=e.type==='touchmove'?e.touches[0].clientX:e.clientX;
    const dx=cx-sx;
    card.style.transform=`translateX(${dx}px) rotate(${dx*0.04}deg)`;
    const lh=document.getElementById('swipe-left-hint');
    const rh=document.getElementById('swipe-right-hint');
    if(dx<-30){lh.style.opacity='1';rh.style.opacity='0'}
    else if(dx>30){rh.style.opacity='1';lh.style.opacity='0'}
    else{lh.style.opacity='0';rh.style.opacity='0'}
  };
  const onEnd=e=>{
    if(!dragging)return;dragging=false;
    const cx=e.type==='touchend'?e.changedTouches[0].clientX:e.clientX;
    const dx=cx-sx;
    document.getElementById('swipe-left-hint').style.opacity='0';
    document.getElementById('swipe-right-hint').style.opacity='0';
    card.style.transition='';
    if(dx<-80){swipeLeft(card)}
    else if(dx>80){openPostFromCard(parseInt(card.dataset.id),null)}
    else{card.style.transform=''}
  };
  card.addEventListener('mousedown',onStart);
  card.addEventListener('touchstart',onStart,{passive:true});
  window.addEventListener('mousemove',onMove);
  window.addEventListener('touchmove',onMove,{passive:true});
  window.addEventListener('mouseup',onEnd);
  window.addEventListener('touchend',onEnd);
}

function swipeLeft(card){
  card.classList.add('prev');
  setTimeout(()=>{shortsIndex=Math.min(shortsIndex+1,filteredPosts.length-1);renderCardStack()},350);
}
function skipCard(e){e.stopPropagation();const c=document.getElementById('card-stack').querySelector('.s-card.current');if(c)swipeLeft(c)}
function openPostFromCard(id,e){if(e)e.stopPropagation();openPost(typeof id==='string'?parseInt(id):id)}

// ══ POSTS ══
function filterPosts(type,btn){
  cf=type;
  document.querySelectorAll('#tab-feed .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderShorts();
}
function renderPosts(){renderShorts()} // 호환

async function openPost(id){
  id=typeof id==='string'?parseInt(id):id;
  const p=posts.find(x=>x.id===id);if(!p)return;
  curPost=id;curType=null;
  const isMe=(cu&&p.user_id===cu.id)||isAdmin();
  const wanted=p.wanted||[];
  document.getElementById('m-title-nav').textContent=p.title;
  document.getElementById('m-title').textContent=p.title;
  document.getElementById('m-desc').textContent=p.description||'';
  document.getElementById('m-img').src=p.img||'';
  document.getElementById('m-badges').innerHTML=wanted.map(w=>TC[w]?`<span class="badge" style="border-color:${TC[w].color};color:${TC[w].color}">${TC[w].label} 원해요</span>`:'').join('');
  const vEl=document.getElementById('m-version');
  vEl.textContent=p.version||'';vEl.style.display=p.version?'inline':'none';
  document.getElementById('m-edit-btn').style.display=isMe?'flex':'none';
  document.getElementById('m-delete-btn').style.display=isMe?'flex':'none';
  document.querySelectorAll('.kw-tag').forEach(t=>t.classList.remove('active'));
  document.getElementById('c-list').innerHTML='<div style="padding:24px;font-family:\'Space Mono\',monospace;font-size:.52rem;color:var(--t3);letter-spacing:2px;text-align:center">불러오는 중...</div>';
  const data=await sb.get('comments',`post_id=eq.${id}&order=created_at.asc`);
  comments[id]=Array.isArray(data)?data:[];
  resetTypeChips();
  document.getElementById('c-input').value='';
  document.getElementById('post-modal').classList.add('open');
  document.body.style.overflow='hidden';
  renderComments(id);
}
function closeModal(){document.getElementById('post-modal').classList.remove('open');document.body.style.overflow='';curPost=null;}

function renderComments(pid){
  const list=document.getElementById('c-list');
  const cs=comments[pid]||[];
  if(!cs.length){list.innerHTML='<div style="padding:28px;font-family:\'Space Mono\',monospace;font-size:.5rem;color:var(--t3);letter-spacing:2px;text-align:center;text-transform:uppercase">첫 피드백을 남겨봐요</div>';return}
  list.innerHTML=cs.map(c=>{
    const t=TC[c.type]||TC.visual;
    const isMe=(cu&&c.user_id===cu.id)||isAdmin();
    const del=isMe?`<button class="del-c" onclick="deleteComment(${pid},${c.id},event)">✕</button>`:'';
    const roleLabel=c.author_role==='designer'?'디자이너':'일반인';
    const roleCls=c.author_role==='designer'?'designer':'general';
    return`<div class="comment" style="border-left-color:${t.color}99">
      <div class="comment-hdr">
        <div class="comment-hdr-left">
          <span class="comment-type" style="color:${t.color}">${t.label}</span>
          <span class="comment-auth">${isMe?cu.username+' (나)':(c.author||'anon')}</span>
          <span class="comment-role-badge ${roleCls}">${roleLabel}</span>
        </div>
        <div class="comment-actions">
          <button class="helpful-btn ${c.liked?'on':''}" onclick="helpful(${pid},${c.id},this)">도움됐어요 ${c.helpful||0}</button>
          ${del}
        </div>
      </div>
      <div class="comment-txt">${c.text}</div>
    </div>`;
  }).join('');
}

async function helpful(pid,cid,btn){
  const cs=comments[pid]||[],c=cs.find(x=>x.id===cid);if(!c)return;
  c.liked=!c.liked;c.helpful=(c.helpful||0)+(c.liked?1:-1);
  btn.classList.toggle('on',c.liked);btn.textContent=`도움됐어요 ${c.helpful}`;
  await sb.patch('comments',cid,{helpful:c.helpful});toast(c.liked?'도움됐어요':'취소됐어요');
}
async function deleteComment(pid,cid,e){
  e.stopPropagation();if(!confirm('댓글을 삭제할까요?'))return;
  await sb.delete('comments',cid);
  comments[pid]=(comments[pid]||[]).filter(c=>c.id!==cid);
  const p=posts.find(x=>x.id===pid);
  if(p){p.comment_count=Math.max(0,(p.comment_count||1)-1);await sb.patch('posts',pid,{comment_count:p.comment_count})}
  renderComments(pid);toast('삭제됐어요');
}

function pickType(btn){resetTypeChips();btn.classList.add('selected');curType=btn.dataset.t;const c=TC[curType].color;btn.style.cssText=`background:${c};border-color:${c};color:#000`}
function resetTypeChips(){document.querySelectorAll('.type-chip').forEach(c=>{c.classList.remove('selected');c.style.cssText=''})}

async function sendComment(){
  if(!requireLogin('피드백을 남기려면 로그인 해줘요!'))return;
  const text=document.getElementById('c-input').value.trim();
  if(!text){toast('내용을 입력해요');return}
  if(!curType){toast('피드백 타입을 선택해요');return}
  const p=posts.find(x=>x.id===curPost);
  const newC=await sb.post('comments',{post_id:curPost,type:curType,text,author:cu.username,user_id:cu.id,helpful:0,author_role:cu.role||'general'});
  if(newC){if(!comments[curPost])comments[curPost]=[];comments[curPost].push({...newC,liked:false});p.comment_count=(p.comment_count||0)+1;await sb.patch('posts',curPost,{comment_count:p.comment_count})}
  if(hasPosted&&fbCount<3){fbCount++;gateUpdate();if(fbCount===3)toast('피드백 3회 완료! 이제 업로드 가능해요 🎉');else toast(`피드백 등록 (${fbCount}/3)`)}
  else toast('피드백이 등록됐어요');
  saveL();renderComments(curPost);renderShorts();
  document.getElementById('c-input').value='';curType=null;resetTypeChips();
  document.getElementById('c-list').scrollTop=9999;
}

async function toggleKeyword(btn,word){
  btn.classList.toggle('active');
  const p=posts.find(x=>x.id===curPost);if(!p)return;
  if(!p.keywords)p.keywords={};
  if(!p.keywords[word])p.keywords[word]={count:0,users:[]};
  const entry=p.keywords[word];const idx=entry.users.indexOf(cu?.id);
  if(btn.classList.contains('active')){if(idx<0){entry.users.push(cu?.id);entry.count++}}
  else{if(idx>=0){entry.users.splice(idx,1);entry.count--}}
  await sb.patch('posts',curPost,{keywords:p.keywords});toast('반응 저장됐어요');
}

// ══ 업로드 ══
function openUpload(){
  if(!requireLogin('작업을 올리려면 로그인 해줘요!'))return;
  const locked=hasPosted&&fbCount<3;
  document.getElementById('locked-view').style.display=locked?'block':'none';
  document.getElementById('open-view').style.display=locked?'none':'block';
  if(locked){for(let i=0;i<3;i++)document.getElementById('lp'+i).classList.toggle('on',i<fbCount);document.getElementById('locked-sub').textContent=`${fbCount} / 3`}
  document.getElementById('upload-modal').classList.add('open');document.body.style.overflow='hidden';
}
function closeUpload(){document.getElementById('upload-modal').classList.remove('open');document.body.style.overflow=''}

function onFile(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{imgData=ev.target.result;const prev=document.getElementById('preview-img');prev.src=imgData;prev.style.display='block';document.getElementById('drop-label').style.display='none'};
  r.readAsDataURL(file);
}
function toggleW(btn){
  btn.classList.toggle('on');
  const c=TC[btn.dataset.v]?TC[btn.dataset.v].color:'#888';
  btn.style.cssText=btn.classList.contains('on')?`background:${c};border-color:${c};color:#000`:'';
}

async function doPost(){
  const title=document.getElementById('u-title').value.trim();
  const desc=document.getElementById('u-desc').value.trim();
  const ver=document.getElementById('u-version').value;
  const wanted=[...document.querySelectorAll('#open-view .w-opt.on')].map(b=>b.dataset.v);
  if(!title){toast('제목을 입력해요');return}
  if(!imgData){toast('이미지를 올려요');return}
  if(!wanted.length){toast('피드백 타입을 선택해요');return}
  const btn=document.getElementById('submit-btn');btn.textContent='올리는 중...';btn.style.opacity='.6';
  // 이미지 압축 (용량 초과 방지)
  let finalImg=imgData;
  try{
    if(imgData.length>400000){
      const _img=new Image();_img.src=imgData;
      await new Promise(r=>{_img.onload=r;_img.onerror=r});
      const _c=document.createElement('canvas');
      const _ratio=Math.min(800/_img.width,800/_img.height,1);
      _c.width=Math.round(_img.width*_ratio);_c.height=Math.round(_img.height*_ratio);
      _c.getContext('2d').drawImage(_img,0,0,_c.width,_c.height);
      finalImg=_c.toDataURL('image/jpeg',0.75);
    }
  }catch(_e){finalImg=imgData}
  const newPost=await sb.post('posts',{title,description:desc||'작업을 봐주세요.',img:finalImg,version:ver,wanted,author:cu.username,user_id:cu.id,comment_count:0,keywords:{},author_role:cu.role||'general'});
  btn.textContent='올리기';btn.style.opacity='';
  if(newPost&&newPost.id){posts.unshift(newPost);hasPosted=true;fbCount=0;saveL();gateUpdate();renderShorts();closeUpload();resetUploadForm();toast('작업이 올라갔어요 🔥')}
  else toast('오류가 났어요. 다시 시도해줘요.');
}
function resetUploadForm(){
  document.getElementById('u-title').value='';document.getElementById('u-desc').value='';document.getElementById('u-version').value='v1';
  const prev=document.getElementById('preview-img');prev.src='';prev.style.display='none';
  document.getElementById('drop-label').style.display='';
  document.querySelectorAll('#open-view .w-opt').forEach(b=>{b.classList.remove('on');b.style.cssText=''});imgData=null;
}

// ══ 수정 ══
function openEditModal(){
  const p=posts.find(x=>x.id===curPost);if(!p)return;
  document.getElementById('e-title').value=p.title;
  document.getElementById('e-desc').value=p.description||'';
  document.getElementById('e-version').value=p.version||'v1';
  document.querySelectorAll('#e-wanted-row .w-opt').forEach(btn=>{const on=(p.wanted||[]).includes(btn.dataset.v);btn.classList.toggle('on',on);if(on){const c=TC[btn.dataset.v].color;btn.style.cssText=`background:${c};border-color:${c};color:#000`}else btn.style.cssText=''});
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal(){document.getElementById('edit-modal').classList.remove('open')}
async function doEdit(){
  const title=document.getElementById('e-title').value.trim();
  const desc=document.getElementById('e-desc').value.trim();
  const ver=document.getElementById('e-version').value;
  const wanted=[...document.querySelectorAll('#e-wanted-row .w-opt.on')].map(b=>b.dataset.v);
  if(!title){toast('제목을 입력해요');return}
  await sb.patch('posts',curPost,{title,description:desc,version:ver,wanted});
  const p=posts.find(x=>x.id===curPost);
  if(p){p.title=title;p.description=desc;p.version=ver;p.wanted=wanted}
  closeEditModal();
  document.getElementById('m-title-nav').textContent=title;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-desc').textContent=desc;
  document.getElementById('m-version').textContent=ver;
  renderShorts();toast('수정됐어요');
}

// ══ 삭제 ══
async function deletePost(){
  // curPost를 먼저 로컬 변수에 저장 (confirm 후 초기화 방지)
  const delId = typeof curPost==='string' ? parseInt(curPost) : Number(curPost);
  if(!delId){ toast('삭제할 게시물을 찾을 수 없어요'); return; }
  if(!confirm('정말 삭제할까요? 피드백도 모두 사라져요.')) return;

  // 댓글 먼저 삭제 후 게시물 삭제
  await fetch(`${SB_URL}/rest/v1/comments?post_id=eq.${delId}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const r = await fetch(`${SB_URL}/rest/v1/posts?id=eq.${delId}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });

  if(r.status === 204 || r.ok){
    posts = posts.filter(x => Number(x.id) !== delId);
    closeModal();
    renderShorts();
    toast('삭제됐어요!');
  } else {
    toast('삭제 실패. 다시 시도해줘요.');
  }
}

// ══ 팀모집 ══
async function loadRecruits(){
  document.getElementById('recruit-list').innerHTML='<div class="r-empty">불러오는 중...</div>';
  const data=await sb.get('recruits','order=created_at.desc');
  recruits=Array.isArray(data)?data:[];
  document.getElementById('stat-users').textContent=recruits.length;
  renderRecruits(crf);
}
function renderRecruits(f='all'){
  const filtered=f==='all'?recruits:recruits.filter(r=>r.type===f);
  document.getElementById('recruit-count').textContent=filtered.length;
  const list=document.getElementById('recruit-list');
  if(!filtered.length){list.innerHTML='<div class="r-empty">아직 모집 글이 없어요</div>';return}
  list.innerHTML=filtered.map(r=>{
    const t=RT[r.type]||RT.etc;
    return`<div class="r-card" onclick="openRecruitDetail(${r.id})">
      <span class="r-badge" style="border-color:${t.color};color:${t.color}">${t.label}</span>
      <div class="r-body">
        <div class="r-title">${r.title}</div>
        <div class="r-desc">${r.description||''}</div>
        <div class="r-meta">
          <span class="r-author">${r.author||'anon'}</span>
          <span class="r-time">${ts(r.created_at)}</span>
          ${r.deadline?`<span class="r-deadline">~${r.deadline}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}
function filterRecruit(type,btn){
  crf=type;document.querySelectorAll('#tab-recruit .f-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRecruits(type);
}

let recruitTypeSelected='contest';
function openRecruitUpload(){
  if(!requireLogin('모집 글을 올리려면 로그인 해줘요!'))return;
  document.getElementById('recruit-modal').classList.add('open');document.body.style.overflow='hidden';
}
function closeRecruitUpload(){document.getElementById('recruit-modal').classList.remove('open');document.body.style.overflow=''}
function pickRecruitType(btn){
  document.querySelectorAll('#recruit-modal .w-opt').forEach(b=>{b.classList.remove('on');b.style.cssText=''});
  btn.classList.add('on');recruitTypeSelected=btn.dataset.v;
  const t=RT[recruitTypeSelected];btn.style.cssText=`background:${t.color};border-color:${t.color};color:#fff`;
}
document.addEventListener('DOMContentLoaded',()=>{
  const db=document.querySelector('#recruit-modal .w-opt[data-v="contest"]');
  if(db)pickRecruitType(db);
});
async function doRecruitPost(){
  if(!requireLogin())return;
  const title=document.getElementById('r-title').value.trim();
  const desc=document.getElementById('r-desc').value.trim();
  const deadline=document.getElementById('r-deadline').value;
  if(!title){toast('제목을 입력해요');return}
  const newR=await sb.post('recruits',{title,description:desc,type:recruitTypeSelected,deadline:deadline||null,author:cu.username,user_id:cu.id});
  if(newR&&newR.id){recruits.unshift(newR);renderRecruits(crf);closeRecruitUpload();document.getElementById('r-title').value='';document.getElementById('r-desc').value='';document.getElementById('r-deadline').value='';toast('모집 글이 올라갔어요!')}
  else toast('오류가 났어요.');
}

async function openRecruitDetail(id){
  const r=recruits.find(x=>x.id===id);if(!r)return;curRecruit=id;
  const isMe=(cu&&r.user_id===cu.id)||isAdmin();const t=RT[r.type]||RT.etc;
  document.getElementById('rd-title-nav').textContent=r.title;
  document.getElementById('rd-title').textContent=r.title;
  document.getElementById('rd-desc').textContent=r.description||'';
  document.getElementById('rd-type').textContent=t.label;document.getElementById('rd-type').style.cssText=`border-color:${t.color};color:${t.color}`;
  document.getElementById('rd-author').textContent=r.author||'anon';
  document.getElementById('rd-time').textContent=ts(r.created_at);
  document.getElementById('rd-deadline').textContent=r.deadline?`마감 ${r.deadline}`:'';
  document.getElementById('rd-delete-btn').style.display=isMe?'flex':'none';
  document.getElementById('rd-c-list').innerHTML='<div style="font-family:\'Space Mono\',monospace;font-size:.5rem;color:var(--t3);letter-spacing:2px">불러오는 중...</div>';
  document.getElementById('rd-c-input').value='';
  document.getElementById('recruit-detail-modal').classList.add('open');document.body.style.overflow='hidden';
  const data=await sb.get('recruit_comments',`recruit_id=eq.${id}&order=created_at.asc`);
  rComments[id]=Array.isArray(data)?data:[];renderRComments(id);
}
function closeRecruitDetail(){document.getElementById('recruit-detail-modal').classList.remove('open');document.body.style.overflow=''}
function renderRComments(rid){
  const list=document.getElementById('rd-c-list');const cs=rComments[rid]||[];
  if(!cs.length){list.innerHTML='<div style="font-family:\'Space Mono\',monospace;font-size:.5rem;color:var(--t3);letter-spacing:2px">첫 댓글을 남겨봐요</div>';return}
  list.innerHTML=cs.map(c=>{const isMe=(cu&&c.user_id===cu.id)||isAdmin();const del=isMe?`<button class="del-c" onclick="deleteRComment(${rid},${c.id},event)">✕</button>`:'';return`<div class="rd-comment"><div class="rd-c-hdr"><span class="rd-c-auth">${isMe?cu.username+' (나)':(c.author||'anon')}</span>${del}</div><div class="rd-c-txt">${c.text}</div></div>`}).join('');
}
async function sendRecruitComment(){
  if(!requireLogin('댓글을 남기려면 로그인 해줘요!'))return;
  const text=document.getElementById('rd-c-input').value.trim();
  if(!text){toast('댓글을 입력해요');return}
  const newC=await sb.post('recruit_comments',{recruit_id:curRecruit,text,author:cu.username,user_id:cu.id});
  if(newC){if(!rComments[curRecruit])rComments[curRecruit]=[];rComments[curRecruit].push(newC);renderRComments(curRecruit);document.getElementById('rd-c-input').value='';document.getElementById('rd-c-list').scrollTop=9999;toast('댓글이 등록됐어요')}
}
async function deleteRComment(rid,cid,e){e.stopPropagation();if(!confirm('삭제할까요?'))return;await sb.delete('recruit_comments',cid);rComments[rid]=(rComments[rid]||[]).filter(c=>c.id!==cid);renderRComments(rid);toast('삭제됐어요')}
async function deleteRecruit(){if(!confirm('모집 글을 삭제할까요?'))return;await sb.delete('recruits',curRecruit);recruits=recruits.filter(x=>x.id!==curRecruit);closeRecruitDetail();renderRecruits(crf);toast('삭제됐어요')}

// ══ 스터디 타이머 ══
let timerInterval=null,timerSeconds=0,timerRunning=false;
let todayLogs=LS.load('todayLogs',[]);
let studyGoal=LS.load('studyGoal',3);

function timerStart(){
  if(timerRunning)return;
  timerRunning=true;
  document.getElementById('timer-start-btn').style.display='none';
  document.getElementById('timer-stop-btn').style.display='';
  document.getElementById('timer-display').classList.add('running');
  timerInterval=setInterval(()=>{timerSeconds++;updateTimerDisplay()},1000);
}
function timerStop(){
  if(!timerRunning)return;
  timerRunning=false;clearInterval(timerInterval);
  document.getElementById('timer-start-btn').style.display='';
  document.getElementById('timer-stop-btn').style.display='none';
  document.getElementById('timer-display').classList.remove('running');
  if(timerSeconds>0){
    const log={time:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),seconds:timerSeconds,dur:formatDur(timerSeconds)};
    todayLogs.push(log);LS.save('todayLogs',todayLogs);
    saveStudyRecord();renderTodayLogs();updateGoalProgress();timerSeconds=0;updateTimerDisplay();
    toast(`${log.dur} 기록됐어요!`);
    loadStudyData();
  }
}
function timerReset(){if(timerRunning)timerStop();timerSeconds=0;updateTimerDisplay()}
function updateTimerDisplay(){
  const h=Math.floor(timerSeconds/3600);const m=Math.floor((timerSeconds%3600)/60);const s=timerSeconds%60;
  document.getElementById('timer-display').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function formatDur(sec){const h=Math.floor(sec/3600);const m=Math.floor((sec%3600)/60);const s=sec%60;if(h>0)return`${h}시간 ${m}분`;if(m>0)return`${m}분 ${s}초`;return`${s}초`}
function saveGoal(){studyGoal=parseInt(document.getElementById('goal-input').value)||3;LS.save('studyGoal',studyGoal);updateGoalProgress();toast('목표 저장됐어요')}
function updateGoalProgress(){
  const totalSec=todayLogs.reduce((a,l)=>a+l.seconds,0);
  const goalSec=studyGoal*3600;const pct=Math.min(100,Math.round(totalSec/goalSec*100));
  document.getElementById('goal-bar').style.width=pct+'%';
  const h=Math.floor(totalSec/3600);const m=Math.floor((totalSec%3600)/60);
  document.getElementById('goal-txt').textContent=`오늘 ${h}시간 ${m}분 / 목표 ${studyGoal}시간 (${pct}%)`;
}
function renderTodayLogs(){
  const wrap=document.getElementById('today-logs');
  if(!todayLogs.length){wrap.innerHTML='<div class="no-logs">아직 기록이 없어요</div>';return}
  wrap.innerHTML=[...todayLogs].reverse().map(l=>`<div class="today-log"><span class="today-log-time">${l.time}</span><span>${l.dur}</span><span class="today-log-dur">${l.dur}</span></div>`).join('');
}

async function saveStudyRecord(){
  if(!cu)return;
  const todayStr=new Date().toISOString().split('T')[0];
  const totalSec=todayLogs.reduce((a,l)=>a+l.seconds,0);
  const existing=await sb.get('study_logs',`user_id=eq.${cu.id}&date=eq.${todayStr}&select=id`);
  if(existing.length){await sb.patch('study_logs',existing[0].id,{total_seconds:totalSec,username:cu.username,role:cu.role||'general'})}
  else{await sb.post('study_logs',{user_id:cu.id,username:cu.username,date:todayStr,total_seconds:totalSec,role:cu.role||'general'})}
  // Realtime 브로드캐스트 — 저장할 때마다 채널로 알림 전송
  if(realtimeChannel){
    realtimeChannel.send({type:'broadcast',event:'study_update',payload:{username:cu.username,total_seconds:totalSec,role:cu.role||'general'}});
  }
}


// ══ SUPABASE REALTIME ══
let realtimeChannel = null;

function initRealtime(){
  // 이미 연결됐으면 스킵
  if(realtimeChannel) return;
  // 비로그인 상태에서는 Realtime 안 씀 (렉 방지)
  if(!cu) return;

  // Supabase Realtime 클라이언트 직접 연결
  const wsUrl = `wss://icbkaqjefvzufthhgtkv.supabase.co/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`;
  const socket = new WebSocket(wsUrl);
  let heartbeat;

  socket.onopen = () => {
    // 채널 join
    socket.send(JSON.stringify({
      topic: 'realtime:rawview-study',
      event: 'phx_join',
      payload: { config: { broadcast: { self: false } } },
      ref: '1'
    }));
    // 30초마다 heartbeat
    heartbeat = setInterval(() => {
      socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
    }, 30000);
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      // 다른 사람이 공부 기록 업데이트했을 때
      if(msg.event === 'study_update' && msg.payload){
        const p = msg.payload;
        // 친구 현황 실시간 업데이트
        realtimeUpdateFriend(p);
        // 랭킹도 5초 후 새로고침 (너무 자주 호출 방지)
        clearTimeout(window._rankRefreshTimer);
        window._rankRefreshTimer = setTimeout(()=>{
          if(document.getElementById('tab-study').style.display !== 'none') loadStudyData();
        }, 5000);
      }
    } catch(err){}
  };

  socket.onerror = () => {};
  socket.onclose = () => {
    clearInterval(heartbeat);
    realtimeChannel = null;
    // 스터디 방 열려있을 때만 재연결 (30초 후)
    setTimeout(()=>{
      if(document.getElementById('tab-study')&&document.getElementById('tab-study').style.display!=='none'){
        initRealtime();
      }
    }, 30000);
  };

  // 브로드캐스트 전송용 래퍼
  realtimeChannel = {
    send(payload){
      if(socket.readyState === WebSocket.OPEN){
        socket.send(JSON.stringify({
          topic: 'realtime:rawview-study',
          event: 'broadcast',
          payload,
          ref: null
        }));
      }
    }
  };
}

function realtimeUpdateFriend(data){
  // 스터디 방이 열려있을 때만 DOM 업데이트
  if(document.getElementById('tab-study').style.display === 'none') return;

  const friendList = document.getElementById('friend-list');
  if(!friendList) return;

  // 기존 해당 유저 카드 찾아서 업데이트 or 새로 추가
  const existing = friendList.querySelector(`[data-friend="${data.username}"]`);
  const h = Math.floor(data.total_seconds/3600);
  const m = Math.floor((data.total_seconds%3600)/60);
  const timeStr = h>0 ? `${h}h ${m}m` : `${m}m`;
  const roleLabel = data.role==='designer' ? '디자이너' : '일반인';
  const isMe = cu && data.username === cu.username;

  const cardHtml = `<div class="friend-item" data-friend="${data.username}" style="animation:fadeUp .3s ease">
    <div class="friend-avatar">${data.username.substring(0,2).toUpperCase()}</div>
    <div class="friend-info">
      <div class="friend-name">${data.username}${isMe?' (나)':''}</div>
      <div class="friend-status">${roleLabel} · 오늘 ${timeStr} <span style="color:var(--green);font-size:.4rem;margin-left:4px">● 방금 업데이트</span></div>
    </div>
    <div class="friend-online"></div>
  </div>`;

  if(existing){
    existing.outerHTML = cardHtml;
  } else {
    // 없으면 맨 위에 추가
    const noData = friendList.querySelector('[style*="text-align:center"]');
    if(noData) noData.remove();
    friendList.insertAdjacentHTML('afterbegin', cardHtml);
  }
}

async function loadStudyData(){
  document.getElementById('goal-input').value=studyGoal;
  updateTimerDisplay();updateGoalProgress();renderTodayLogs();

  // 주간 랭킹 (최근 7일)
  const weekAgo=new Date(Date.now()-7*24*3600*1000).toISOString().split('T')[0];
  const logs=await sb.get('study_logs',`date=gte.${weekAgo}&order=total_seconds.desc&select=username,total_seconds,role`);

  // username별 합산
  const map={};
  (Array.isArray(logs)?logs:[]).forEach(l=>{
    if(!map[l.username])map[l.username]={username:l.username,total:0,role:l.role};
    map[l.username].total+=l.total_seconds;
  });
  const ranked=Object.values(map).sort((a,b)=>b.total-a.total).slice(0,10);
  const maxSec=ranked[0]?.total||1;

  const rankList=document.getElementById('rank-list');
  if(!ranked.length){rankList.innerHTML='<div style="font-family:\'Space Mono\',monospace;font-size:.46rem;color:var(--t3);letter-spacing:2px;padding:16px 0;text-align:center">아직 기록이 없어요</div>';return}
  rankList.innerHTML=ranked.map((r,i)=>{
    const pct=Math.round(r.total/maxSec*100);
    const h=Math.floor(r.total/3600);const m=Math.floor((r.total%3600)/60);
    const timeStr=h>0?`${h}h ${m}m`:`${m}m`;
    return`<div class="rank-item">
      <span class="rank-num ${i<3?'top':''}">${i+1}</span>
      <span class="rank-user">${r.username}${cu&&r.username===cu.username?' (나)':''}</span>
      <div class="rank-role-dot ${r.role==='designer'?'designer':'general'}"></div>
      <span class="rank-time">${timeStr}</span>
    </div>
    <div class="rank-bar"><div class="rank-bar-fill" style="width:${pct}%"></div></div>`;
  }).join('');

  // 지금 공부 중 (오늘 기록 있는 사람)
  const today=new Date().toISOString().split('T')[0];
  const todayAll=await sb.get('study_logs',`date=eq.${today}&order=total_seconds.desc&select=username,total_seconds,role`);
  const friendList=document.getElementById('friend-list');
  if(!todayAll.length){friendList.innerHTML='<div style="font-family:\'Space Mono\',monospace;font-size:.46rem;color:var(--t3);letter-spacing:2px;padding:16px 0;text-align:center">아직 없어요</div>';return}
  friendList.innerHTML=(Array.isArray(todayAll)?todayAll:[]).slice(0,8).map(r=>{
    const h=Math.floor(r.total_seconds/3600);const m=Math.floor((r.total_seconds%3600)/60);
    const timeStr=h>0?`${h}h ${m}m`:`${m}m`;
    return`<div class="friend-item">
      <div class="friend-avatar">${r.username.substring(0,2).toUpperCase()}</div>
      <div class="friend-info">
        <div class="friend-name">${r.username}</div>
        <div class="friend-status">${r.role==='designer'?'디자이너':'일반인'} · 오늘 ${timeStr}</div>
      </div>
      <div class="friend-online"></div>
    </div>`;
  }).join('');
}

// ══ 통계 ══
async function updateStats(){
  document.getElementById('stat-posts').textContent=posts.length;
  document.getElementById('stat-fb').textContent=posts.reduce((a,p)=>a+(p.comment_count||0),0);
  // 디자이너/일반인 수 가져오기
  try{
    const profiles=await sb.get('profiles','select=role');
    if(Array.isArray(profiles)){
      const designers=profiles.filter(p=>p.role==='designer'||!p.role).length;
      const generals=profiles.filter(p=>p.role==='general').length;
      const dEl=document.getElementById('stat-designers');
      const gEl=document.getElementById('stat-generals');
      if(dEl) dEl.textContent=designers;
      if(gEl) gEl.textContent=generals;
    }
  }catch{}
}

// ══ TOAST ══
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}

// ══ 이벤트 ══
document.getElementById('post-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
document.getElementById('upload-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeUpload()});
document.getElementById('edit-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditModal()});
document.getElementById('recruit-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeRecruitUpload()});
document.getElementById('recruit-detail-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeRecruitDetail()});
document.getElementById('login-id').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
document.getElementById('signup-id').addEventListener('keydown',e=>{if(e.key==='Enter')doSignup()});



// ══ 일반인 모드 — 댓글 & 트릿 ══
let gmPendingType=null, gmPendingPostId=null, gmSelectedCtags=[];

function gmReact(type){
  if(type==='skip'){gmIndex++;gmRenderStack();return}
  // 반응 기록 후 댓글 팝업
  const p=posts[gmIndex];
  if(!p)return;
  gmPendingType=type;
  gmPendingPostId=p.id;

  // 이모지 플로팅 효과
  const emojis={good:'👍',bad:'👎',fire:'💥'};
  const el=document.createElement('div');
  el.className='gm-float';
  el.textContent=emojis[type]||'👍';
  el.style.cssText=`left:${window.innerWidth/2-20}px;top:${window.innerHeight/2-40}px`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),700);

  // 반응 카운트 업
  if(type==='good') gmNice++;
  else if(type==='bad') gmBad++;
  else if(type==='fire') gmFire++;

  // 카드 스와이프
  const stack=document.getElementById('gm-stack');
  const cur=stack.querySelector('.gm-card.cur');
  if(cur){
    cur.classList.remove('cur');
    cur.classList.add(type==='bad'?'gone-l':'gone-r');
  }
  gmIndex++;

  // 댓글 팝업 표시 (good/fire일 때만, 3번에 1번)
  const showComment=(type==='good'||type==='fire')&&(gmNice+gmFire)%3===0;
  if(showComment){
    setTimeout(()=>gmShowCommentPopup(type, p),200);
  } else {
    setTimeout(()=>{
      gmRenderStack();
      gmCheckTreat();
    }, 360);
  }
}

function gmShowCommentPopup(type, p){
  const titles={good:'👍 좋았던 작업이에요!', fire:'💥 강렬했죠?', bad:'👎 아쉬웠나요?'};
  document.getElementById('gm-comment-reaction-title').textContent=titles[type]||'한마디 남겨봐요';
  document.getElementById('gm-comment-input').value='';
  gmSelectedCtags=[];
  document.querySelectorAll('.gm-ctag').forEach(t=>t.classList.remove('on'));
  document.getElementById('gm-comment-popup').classList.add('open');
}
function gmToggleCtag(btn){
  btn.classList.toggle('on');
  const txt=btn.textContent;
  if(btn.classList.contains('on')) gmSelectedCtags.push(txt);
  else gmSelectedCtags=gmSelectedCtags.filter(t=>t!==txt);
}
function gmCommentSkip(){
  document.getElementById('gm-comment-popup').classList.remove('open');
  gmRenderStack(); gmCheckTreat();
}
async function gmCommentSend(){
  const text=document.getElementById('gm-comment-input').value.trim();
  const tags=gmSelectedCtags;
  document.getElementById('gm-comment-popup').classList.remove('open');
  // 실제 저장 — 태그 + 텍스트 합쳐서
  if(gmPendingPostId&&(text||tags.length)){
    const fullText=[...tags, text].filter(Boolean).join(' · ');
    await sb.post('comments',{
      post_id:gmPendingPostId, type:'visual',
      text:fullText, author:'일반인',
      user_id:'00000000-0000-0000-0000-000000000099',
      helpful:0, author_role:'general'
    });
    // 피드백 카운트 업데이트
    const p=posts.find(x=>x.id===gmPendingPostId);
    if(p){p.comment_count=(p.comment_count||0)+1;await sb.patch('posts',gmPendingPostId,{comment_count:p.comment_count})}
    toast('전달됐어요!');
  }
  gmRenderStack(); gmCheckTreat();
}

function gmCheckTreat(){
  const total=gmNice+gmBad+gmFire;
  if(total===5||total===15||total===30){
    gmShowTreat();
  }
}

function gmShowTreat(){
  const total=gmNice+gmBad+gmFire;
  // 유형 분석
  let emoji,title,desc;
  if(gmFire>=gmNice&&gmFire>=gmBad){emoji='💥';title='당신은 강렬파!';desc='강렬하다는 반응을 많이 눌렀어요. 임팩트 있는 비주얼에 반응하는 눈이 예리하네요.'}
  else if(gmNice>gmBad*2){emoji='✨';title='당신은 감각파!';desc='좋아요를 많이 눌렀어요. 시각적으로 끌리는 작업을 금방 알아보는 눈이 있어요.'}
  else if(gmBad>gmNice){emoji='🎯';title='당신은 날카로운 눈!';desc='별로라는 반응을 많이 눌렀어요. 기준이 높고 디테일을 잘 보는 타입이에요.'}
  else{emoji='🌀';title='당신은 균형파!';desc='다양한 반응을 골고루 눌렀어요. 상황에 따라 다르게 보는 균형 잡힌 시각이 있어요.'}

  document.getElementById('gm-treat-emoji').textContent=emoji;
  document.getElementById('gm-treat-title').textContent=title;
  document.getElementById('gm-treat-desc').textContent=desc+` 지금까지 ${total}개 작업을 봤어요.`;
  document.getElementById('gm-ts-nice').textContent=gmNice;
  document.getElementById('gm-ts-fire').textContent=gmFire;
  document.getElementById('gm-ts-bad').textContent=gmBad;
  document.getElementById('gm-treat-popup').classList.add('open');
}
function gmTreatSignup(){document.getElementById('gm-treat-popup').classList.remove('open');goToAuth()}
function gmTreatContinue(){document.getElementById('gm-treat-popup').classList.remove('open')}

// 드래그 스와이프 → gmReact 직접 호출
function gmSwipe(type){
  if(type==='bad') gmReact('bad');
  else gmReact('good');
}

// ══ 진입 분기 ══
function showEntryGate(){
  document.getElementById('entry-gate').style.display='flex';
  document.getElementById('general-mode').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='none';
}
function enterAsDesigner(){
  document.getElementById('entry-gate').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('landing').style.display='grid';
  ['tab-feed','tab-recruit','tab-study'].forEach(id=>document.getElementById(id).style.display='none');
  updateNavAuth();
}
function enterAsGeneral(){
  document.getElementById('entry-gate').style.display='none';
  document.getElementById('general-mode').style.display='flex';
  document.getElementById('app').style.display='none';
  gmIndex=0; gmNice=0; gmBad=0; gmFire=0;
  gmRenderStack();
}
function backToGate(){showEntryGate()}
function showLoginFromGate(){
  document.getElementById('entry-gate').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  switchAuth('login');
}

// ══ 일반인 스와이프 모드 ══
let gmIndex=0, gmNice=0, gmBad=0, gmFire=0;

function gmRenderStack(){
  const stack=document.getElementById('gm-stack');
  stack.querySelectorAll('.gm-card').forEach(c=>c.remove());
  document.getElementById('gm-empty').style.display='none';
  document.getElementById('gm-label-nope').style.opacity='0';
  document.getElementById('gm-label-nice').style.opacity='0';

  if(gmIndex>=posts.length){
    document.getElementById('gm-empty').style.display='flex';
    document.getElementById('gm-progress').textContent=`${posts.length} / ${posts.length}`;
    return;
  }
  document.getElementById('gm-progress').textContent=`${gmIndex+1} / ${posts.length}`;
  document.getElementById('gm-nice-count').textContent=gmNice;
  document.getElementById('gm-bad-count').textContent=gmBad;
  document.getElementById('gm-fire-count').textContent=gmFire;

  // 카드 3장 미리 렌더
  const toShow=[gmIndex, gmIndex+1, gmIndex+2].filter(i=>i<posts.length);
  [...toShow].reverse().forEach((idx,ri)=>{
    const p=posts[idx];
    const card=document.createElement('div');
    card.className='gm-card';
    card.dataset.idx=idx;
    const TC2={visual:{label:'시각',color:'#d94f3d'},idea:{label:'아이디어',color:'#b8942a'},ux:{label:'경험',color:'#3f7a58'}};
    const tags=(p.wanted||[]).map(w=>TC2[w]?`<span class="gm-card-tag" style="border-color:${TC2[w].color}55;color:${TC2[w].color}">${TC2[w].label}</span>`:'').join('');
    card.innerHTML=`
      ${p.img
        ? `<img class="gm-img" src="${p.img}" alt="" draggable="false">`
        : `<div class="gm-img-placeholder"><span>IMAGE</span></div>`
      }
      <div class="gm-card-info">
        <div class="gm-card-author">${p.author||'anon'}${p.author_role==='designer'?' · 디자이너':' · 일반인'}</div>
        <div class="gm-card-title">${p.title}</div>
        <div class="gm-card-tags">${tags}</div>
      </div>`;
    const cls=['nxt2','nxt','cur'][ri];
    card.classList.add(cls);
    stack.appendChild(card);
  });

  // 드래그 이벤트
  const cur=stack.querySelector('.gm-card.cur');
  if(cur) gmAttachDrag(cur);
}

function gmAttachDrag(card){
  let sx=0, dragging=false;
  const nope=document.getElementById('gm-label-nope');
  const nice=document.getElementById('gm-label-nice');
  const onStart=e=>{
    dragging=true; sx=e.type==='touchstart'?e.touches[0].clientX:e.clientX;
    card.style.transition='none';
  };
  const onMove=e=>{
    if(!dragging)return;
    const cx=e.type==='touchmove'?e.touches[0].clientX:e.clientX;
    const dx=cx-sx;
    card.style.transform=`translateX(${dx}px) rotate(${dx*0.05}deg)`;
    if(dx<-40){nope.style.opacity=Math.min(1,(Math.abs(dx)-40)/60)+'';nice.style.opacity='0'}
    else if(dx>40){nice.style.opacity=Math.min(1,(dx-40)/60)+'';nope.style.opacity='0'}
    else{nope.style.opacity='0';nice.style.opacity='0'}
  };
  const onEnd=e=>{
    if(!dragging)return; dragging=false;
    const cx=e.type==='touchend'?e.changedTouches[0].clientX:e.clientX;
    const dx=cx-sx;
    card.style.transition='';
    nope.style.opacity='0'; nice.style.opacity='0';
    if(dx<-90) gmSwipe('bad');
    else if(dx>90) gmSwipe('good');
    else card.style.transform='';
  };
  card.addEventListener('mousedown',onStart);
  card.addEventListener('touchstart',onStart,{passive:true});
  window.addEventListener('mousemove',onMove);
  window.addEventListener('touchmove',onMove,{passive:true});
  window.addEventListener('mouseup',onEnd);
  window.addEventListener('touchend',onEnd);
}

// gmSwipe/gmReact → 아래 통합버전 사용

// ══ INIT ══
async function init(){
  const data=await sb.get('posts','order=created_at.desc');
  posts=Array.isArray(data)?data:[];
  await updateStats();gateUpdate();
}

// 시작
document.getElementById('auth-screen').style.display='none';
document.getElementById('app').style.display='none';
document.getElementById('general-mode').style.display='none';
['tab-feed','tab-recruit','tab-study'].forEach(id=>document.getElementById(id).style.display='none');
// 이미 로그인된 경우 바로 앱으로
if(cu){
  document.getElementById('entry-gate').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('landing').style.display='grid';
  updateNavAuth();
}else{
  showEntryGate();
}
init();
