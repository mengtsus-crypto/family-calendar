// ════════════════════════════════════
// ① 在這裡填入你的 Firebase 設定
// ════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc,
         doc, onSnapshot, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBkZLLIcgGIvyrpj8G-YikmTgTtVNMFUkY",
  authDomain:        "family-calendar-cea2e.firebaseapp.com",
  projectId:         "family-calendar-cea2e",
  storageBucket:     "family-calendar-cea2e.firebasestorage.app",
  messagingSenderId: "263774442263",
  appId:             "1:263774442263:web:b1d8880e1a1e35bbc4dd52"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ════════════════════════════════════
// ② 家庭成員設定
// ════════════════════════════════════
const MEMBERS = [
  { id:'dad', name:'爸爸', c:'#378ADD', bg:'#E6F1FB', tx:'#0C447C', grp:null },
  { id:'mom', name:'媽媽', c:'#D4537E', bg:'#FBEAF0', tx:'#72243E', grp:null },
  { id:'mz',  name:'孟孜', c:'#1D9E75', bg:'#E1F5EE', tx:'#085041', grp:'孟孜家' },
  { id:'hw',  name:'竑緯', c:'#1D9E75', bg:'#E1F5EE', tx:'#085041', grp:'孟孜家' },
  { id:'yc',  name:'祐丞', c:'#1D9E75', bg:'#E1F5EE', tx:'#085041', grp:'孟孜家' },
  { id:'ym',  name:'祐名', c:'#1D9E75', bg:'#E1F5EE', tx:'#085041', grp:'孟孜家' },
  { id:'my',  name:'孟妤', c:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', grp:'孟妤家' },
  { id:'mh',  name:'明輝', c:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', grp:'孟妤家' },
  { id:'yl',  name:'宥綝', c:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', grp:'孟妤家' },
  { id:'yi',  name:'宥依', c:'#7F77DD', bg:'#EEEDFE', tx:'#3C3489', grp:'孟妤家' },
];
const GROUPS = { '孟孜家':['mz','hw','yc','ym'], '孟妤家':['my','mh','yl','yi'] };
const MM = {};
MEMBERS.forEach(m => MM[m.id] = m);

// ════════════════════════════════════
// 工具函式
// ════════════════════════════════════
const today = new Date();
const WD = ['日','一','二','三','四','五','六'];
let cur = new Date(today.getFullYear(), today.getMonth(), 1);
let evs = [];
let editingId = null;

const fmt = d => d.getFullYear() + '-' + p2(d.getMonth()+1) + '-' + p2(d.getDate());
const p2  = n => n < 10 ? '0'+n : ''+n;
const TS  = fmt(today);

function resolve(ids) {
  if (!ids?.length) return [];
  const out = [], rem = [...ids];
  Object.entries(GROUPS).forEach(([g, gi]) => {
    if (gi.every(id => rem.includes(id))) {
      const m = MM[gi[0]];
      out.push({ label: g, bg: m.bg, tx: m.tx, c: m.c });
      gi.forEach(id => rem.splice(rem.indexOf(id), 1));
    }
  });
  rem.forEach(id => { const m = MM[id]; if(m) out.push({label:m.name,bg:m.bg,tx:m.tx,c:m.c}); });
  return out;
}

// ════════════════════════════════════
// 登入 / 登出
// ════════════════════════════════════
const provider = new GoogleAuthProvider();
window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (user) {
    renderApp(user);
    listenEvents();
  } else {
    renderLogin();
  }
});

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-screen">
      <div class="login-title">家庭行事曆</div>
      <div class="login-sub">請用 Google 帳號登入，才能查看和新增行程</div>
      <button class="google-btn" onclick="loginWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        用 Google 帳號登入
      </button>
    </div>`;
}

function renderApp(user) {
  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <span class="logo">家庭行事曆</span>
      <div class="topright">
        <button class="view-btn on" id="btn-list" onclick="setView('list')">清單</button>
        <button class="view-btn" id="btn-cal" onclick="setView('cal')">月曆</button>
        <button class="add-btn" onclick="openModal()">＋ 新增</button>
      </div>
    </div>
    <div class="view on" id="view-list"><div id="upcoming-content"></div></div>
    <div class="view" id="view-cal">
      <div class="cal-nav">
        <button class="nav-btn" onclick="chMo(-1)">‹</button>
        <span class="cal-title" id="cal-title"></span>
        <button class="nav-btn" onclick="chMo(1)">›</button>
      </div>
      <div class="wds">
        <div class="wd">日</div><div class="wd">一</div><div class="wd">二</div>
        <div class="wd">三</div><div class="wd">四</div><div class="wd">五</div><div class="wd">六</div>
      </div>
      <div class="dgrid" id="dgrid"></div>
    </div>`;
}

// ════════════════════════════════════
// Firestore 即時監聽
// ════════════════════════════════════
function listenEvents() {
  const q = query(collection(db, 'events'), orderBy('date'));
  onSnapshot(q, snap => {
    evs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUpcoming();
    if (document.getElementById('view-cal')?.classList.contains('on')) renderCal();
  });
}

// ════════════════════════════════════
// 畫面渲染
// ════════════════════════════════════
function renderUpcoming() {
  const el = document.getElementById('upcoming-content');
  if (!el) return;
  const up = evs.filter(e => e.date >= TS)
    .sort((a,b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
  if (!up.length) { el.innerHTML = '<div class="empty">目前沒有即將到來的行程 🎉</div>'; return; }
  const byD = {}, order = [];
  up.forEach(e => { if (!byD[e.date]) { byD[e.date]=[]; order.push(e.date); } byD[e.date].push(e); });
  let html = '';
  order.forEach(ds => {
    const diff = Math.round((new Date(ds) - new Date(TS)) / 86400000);
    const badge = diff===0?'今天':diff===1?'明天':diff===2?'後天':diff+'天後';
    const d = new Date(ds);
    html += `<div class="date-group"><div class="date-hd">
      <span class="date-main">${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）</span>
      <span class="date-badge${diff<=2?' near':''}">${badge}</span></div>`;
    byD[ds].forEach(e => {
      const tags = resolve(e.ids||[]);
      const thtml = tags.map(t => `<span class="tag" style="background:${t.bg};color:${t.tx}">${t.label}</span>`).join('');
      // 備註：有備註才顯示
      const noteHtml = e.note ? `<div class="ev-note">${e.note}</div>` : '';
      html += `<div class="ev-row" onclick="openEdit('${e.id}')">
        <div class="ev-time">${e.time}</div>
        <div class="ev-body">
          <div class="ev-name">${e.name}</div>
          <div class="ev-tags">${thtml}</div>
          ${noteHtml}
        </div></div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html;
}

function renderCal() {
  const y = cur.getFullYear(), mo = cur.getMonth();
  const el = document.getElementById('cal-title');
  if (el) el.textContent = y+'年'+(mo+1)+'月';
  const first=new Date(y,mo,1).getDay(), last=new Date(y,mo+1,0).getDate(), pl=new Date(y,mo,0).getDate();
  let html='';
  for(let i=0;i<first;i++) html+=dc(pl-first+1+i, fmt(new Date(y,mo-1,pl-first+1+i)), true);
  for(let d=1;d<=last;d++) html+=dc(d, fmt(new Date(y,mo,d)), false);
  const rem=(7-((first+last)%7))%7;
  for(let d=1;d<=rem;d++) html+=dc(d, fmt(new Date(y,mo+1,d)), true);
  const dg = document.getElementById('dgrid');
  if (dg) dg.innerHTML = html;
}

function dc(d, ds, other) {
  const isT = ds===TS;
  const dayEvs = evs.filter(e => e.date===ds);
  const ehtml = dayEvs.slice(0,2).map(e => {
    const tg = resolve(e.ids||[])[0];
    return `<div class="dev" style="background:${tg?.bg||'#eee'};color:${tg?.tx||'#555'}">${e.name}</div>`;
  }).join('');
  return `<div class="dc${other?' other':''}${isT?' today':''}"><div class="dn">${d}</div>${ehtml}</div>`;
}

// ════════════════════════════════════
// 切換視圖
// ════════════════════════════════════
window.setView = v => {
  ['list','cal'].forEach(k => {
    document.getElementById('view-'+k)?.classList.toggle('on', k===v);
    document.getElementById('btn-'+k)?.classList.toggle('on', k===v);
  });
  if (v==='cal') renderCal();
};
window.chMo = n => { cur = new Date(cur.getFullYear(), cur.getMonth()+n, 1); renderCal(); };

// ════════════════════════════════════
// 新增 / 編輯 Modal
// ════════════════════════════════════
function buildMembers() {
  let html = '<span class="grp-label">個人</span>';
  ['dad','mom'].forEach(id => html += mchk(id));
  Object.keys(GROUPS).forEach(g => {
    html += `<span class="grp-label">${g}</span>`;
    GROUPS[g].forEach(id => html += mchk(id));
  });
  document.getElementById('member-wrap').innerHTML = html;
  MEMBERS.forEach(m => {
    const c = document.getElementById('c_'+m.id), l = document.getElementById('l_'+m.id);
    if(!c||!l) return;
    c.addEventListener('change', () => {
      l.style.cssText = c.checked ? `background:${m.c};border-color:${m.c};color:#fff` : '';
      updatePreview();
    });
  });
}

const mchk = id => {
  const m = MM[id];
  return `<span><input class="mchk" type="checkbox" id="c_${id}" value="${id}">
    <label class="mlbl" id="l_${id}" for="c_${id}">${m.name}</label></span>`;
};

function updatePreview() {
  const ids = [...document.querySelectorAll('.mchk:checked')].map(c => c.value);
  document.getElementById('preview-row').innerHTML =
    resolve(ids).map(t => `<span class="ptag" style="background:${t.bg};color:${t.tx}">${t.label}</span>`).join('');
}

window.openModal = () => {
  editingId = null;
  document.getElementById('modal-title').textContent = '新增行程';
  document.getElementById('f-name').value = '';
  document.getElementById('f-date').value = TS;
  document.getElementById('f-time').value = '10:00';
  document.getElementById('f-note').value = '';      // 清空備註
  document.getElementById('btn-delete').style.display = 'none';
  document.getElementById('preview-row').innerHTML = '';
  buildMembers();
  document.getElementById('overlay').classList.add('on');
};

window.openEdit = id => {
  const e = evs.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  document.getElementById('modal-title').textContent = '編輯行程';
  document.getElementById('f-name').value = e.name;
  document.getElementById('f-date').value = e.date;
  document.getElementById('f-time').value = e.time;
  document.getElementById('f-note').value = e.note || '';  // 帶入備註
  document.getElementById('btn-delete').style.display = '';
  document.getElementById('preview-row').innerHTML = '';
  buildMembers();
  (e.ids||[]).forEach(id => {
    const c=document.getElementById('c_'+id), l=document.getElementById('l_'+id), m=MM[id];
    if(c&&l&&m){ c.checked=true; l.style.cssText=`background:${m.c};border-color:${m.c};color:#fff`; }
  });
  updatePreview();
  document.getElementById('overlay').classList.add('on');
};

window.closeModal = () => document.getElementById('overlay').classList.remove('on');

window.saveEv = async () => {
  const name = document.getElementById('f-name').value.trim();
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  const note = document.getElementById('f-note').value.trim();   // 讀取備註
  const ids  = [...document.querySelectorAll('.mchk:checked')].map(c => c.value);
  if (!name || !date) return;
  const data = { name, date, time, note, ids };
  if (editingId) {
    await updateDoc(doc(db,'events',editingId), data);
  } else {
    await addDoc(collection(db,'events'), data);
  }
  closeModal();
};

window.deleteEv = async () => {
  if (!editingId) return;
  if (!confirm('確定要刪除這個行程嗎？')) return;
  await deleteDoc(doc(db,'events',editingId));
  closeModal();
};
