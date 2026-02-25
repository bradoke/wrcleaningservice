// ═══════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════
const SUPA_URL = 'https://ekmdsxumterpqjypzuza.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbWRzeHVtdGVycHFqeXB6dXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzMxNDQsImV4cCI6MjA4NzU0OTE0NH0.LNwzl4OKzhK2WEcSgvnnwWMS-kE_IYmpih_8ONs0-MU';
const supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

function sbUpsert(table, data) {
  supa.from(table).upsert(data).then(({error}) => {
    if (error) console.error(`[${table}]`, error.message);
  });
}
function sbDelete(table, id) {
  supa.from(table).delete().eq('id', id).then(({error}) => {
    if (error) console.error(`[${table}] delete`, error.message);
  });
}
function sbUpdate(table, id, fields) {
  supa.from(table).update(fields).eq('id', id).then(({error}) => {
    if (error) console.error(`[${table}] update`, error.message);
  });
}

async function loadAllFromSupabase() {
  const [r1,r2,r3,r4,r5,r6,r7,r8,r9,r10] = await Promise.all([
    supa.from('employees').select('*'),
    supa.from('clients').select('*'),
    supa.from('schedule_entries').select('*'),
    supa.from('work_logs').select('*'),
    supa.from('costs').select('*'),
    supa.from('notifications').select('*').order('created_at',{ascending:false}),
    supa.from('pending_users').select('*'),
    supa.from('frequencies').select('*'),
    supa.from('referrals').select('*'),
    supa.from('users_login').select('*'),
  ]);
  db.employees       = r1.data  || [];
  db.clients         = r2.data  || [];
  db.scheduleEntries = r3.data  || [];
  db.workLogs        = r4.data  || [];
  db.costs           = r5.data  || [];
  db.notifications   = r6.data  || [];
  db.pendingUsers    = r7.data  || [];
  db.frequencies     = r8.data  || [];
  db.referrals       = r9.data  || [];
  Object.keys(USERS).forEach(k => delete USERS[k]);
  (r10.data||[]).forEach(u => {
    USERS[u.email] = {role:u.role,email:u.email,username:u.username,password:u.password,employeeId:u.employee_id};
  });
}

// ═══════════════════════════════════════════════════
// ESTADO
// ═══════════════════════════════════════════════════
const USERS = {};
const db = {
  employees:[], clients:[], scheduleEntries:[],
  workLogs:[], costs:[], notifications:[],
  pendingUsers:[], frequencies:[], referrals:[]
};
let currentUser = null, currentEmpId = null, weekOffset = 0, costsFilter = 'all';
let _chartRC = null, _chartP = null;

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════
const $ = id => document.getElementById(id);
function uid(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }
function fmt(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); }
function fmtDate(d){ if(!d)return''; const [y,m,dd]=(d+'').split('-'); return`${dd}/${m}/${y}`; }
function getClient(id){ return db.clients.find(c=>c.id===id); }
function getEmployee(id){ return db.employees.find(e=>e.id===id); }
function getWeekStart(d){ const day=d.getDay(),diff=d.getDate()-day; return new Date(d.setDate(diff)); }

function toast(msg, type='success'){
  const t=document.createElement('div');
  t.className=`toast toast-${type}`;t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
}
function openModal(id){ $(id)?.classList.remove('hidden'); }
function closeModal(id){ $(id)?.classList.add('hidden'); }

function toggleFieldPass(fieldId, btn){
  const inp=document.getElementById(fieldId);if(!inp)return;
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  const svg=btn.querySelector('svg');if(!svg)return;
  svg.innerHTML=show
    ?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    :'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// ═══════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════
async function doLogin(){
  const emailEl=$('login-email'),passEl=$('login-pass');
  const email=(emailEl.value||'').trim().toLowerCase(),pass=passEl.value;
  if(!email||!pass){toast('Preencha email e senha','error');return;}
  const btn=$('btn-login');
  btn.disabled=true;btn.textContent='Entrando...';
  try{
    const {data}=await supa.from('users_login').select('*').eq('email',email).eq('password',pass).maybeSingle();
    if(!data){toast('Email ou senha incorretos','error');return;}
    $('loading-overlay').classList.remove('hidden');
    await loadAllFromSupabase();
    $('loading-overlay').classList.add('hidden');
    currentUser={role:data.role,email:data.email,username:data.username,employeeId:data.employee_id};
    $('login-page').classList.add('hidden');
    if(data.role==='adm'){
      $('app-page').classList.remove('hidden');
      $('header-username').textContent=data.username;
      $('header-email').textContent=data.email;
      $('profile-name').textContent=data.username;
      $('profile-email-disp').textContent=data.email;
      $('profile-avatar').textContent=data.username.charAt(0).toUpperCase();
      initApp();
    } else {
      $('emp-app-page').classList.remove('hidden');
      $('emp-header-username').textContent=data.username;
      $('emp-header-email').textContent=data.email;
      $('emp-profile-name').textContent=data.username;
      $('emp-profile-email').textContent=data.email;
      initEmpApp(data.employee_id);
    }
  }catch(err){
    $('loading-overlay').classList.add('hidden');
    console.error(err);toast('Erro de conexão com o servidor','error');
  }finally{
    btn.disabled=false;btn.textContent='Entrar';
  }
}

function doLogout(){
  currentUser=null;currentEmpId=null;
  $('app-page').classList.add('hidden');
  $('emp-app-page').classList.add('hidden');
  $('login-page').classList.remove('hidden');
  $('login-email').value='';$('login-pass').value='';
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function navigate(tab){
  document.querySelectorAll('#sidebar .nav-item').forEach(b=>{b.classList.remove('active');b.removeAttribute('aria-current')});
  const nb=document.querySelector(`#sidebar [data-tab="${tab}"]`);
  if(nb){nb.classList.add('active');nb.setAttribute('aria-current','page');}
  document.querySelectorAll('#admin-tabs .tab-content').forEach(t=>t.classList.remove('active'));
  $('tab-'+tab)?.classList.add('active');
  const renders={
    dashboard:renderDashboard, schedule:renderSchedule, checklist:renderChecklist,
    clients:renderClients, employees:renderEmployees, costs:renderCosts,
    notifications:renderNotifications, frequencies:renderFrequencies, referrals:renderReferrals
  };
  if(renders[tab])renders[tab]();
}

function empNavigate(tab){
  document.querySelectorAll('.emp-tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`.emp-tab-btn[data-etab="${tab}"]`)?.classList.add('active');
  document.querySelectorAll('#emp-app-page .tab-content').forEach(t=>t.classList.remove('active'));
  $('tab-'+tab)?.classList.add('active');
  const renders={'emp-ganhos':renderEmpGanhos,'emp-agenda':renderEmpAgenda,'emp-clientes':renderEmpClients,'emp-indique':renderEmpReferrals};
  if(renders[tab])renders[tab]();
}

function renderTab(tab){ navigate(tab); }

function initApp(){ populateSelects();updateNotifBadge();renderDashboard(); }

function initEmpApp(empId){
  currentEmpId=empId;
  const myClients=db.clients.filter(c=>(c.client_employees||[]).some(ce=>ce.employee_id===empId));
  const noteEl=$('note-client-sel');
  if(noteEl)noteEl.innerHTML=myClients.length?myClients.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''):'<option value="">Nenhum cliente</option>';
  setEmpPeriod('mes',null);
  renderEmpAgenda();renderEmpClients();renderEmpReferrals();
  const empObj=db.employees.find(e=>e.id===empId);
  if(empObj&&$('emp-header-sub'))$('emp-header-sub').textContent=empObj.name;
}

function populateSelects(){
  const clientOpts='<option value="">Selecione...</option>'+db.clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  $('sch-client').innerHTML=clientOpts;
  $('cl-client').innerHTML=clientOpts;
  const empOpts='<option value="">Selecione...</option>'+db.employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  $('sch-emp').innerHTML=empOpts;
  const freqOpts='<option value="">Selecione...</option>'+db.frequencies.map(f=>`<option value="${f.name}">${f.name}</option>`).join('');
  $('client-freq').innerHTML=freqOpts;
}

function updateNotifBadge(){
  const cnt=db.notifications.filter(n=>n.status==='pending').length;
  const badge=$('notif-badge');
  const countBadge=$('notif-count-badge');
  if(badge){badge.textContent=cnt;cnt>0?badge.classList.remove('hidden'):badge.classList.add('hidden');}
  if(countBadge)countBadge.textContent=cnt>0?`${cnt} pendente${cnt>1?'s':''}`:'' ;
}

// ═══════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════
function renderDashboard(){
  const today=new Date().toISOString().split('T')[0];
  const ym=today.substr(0,7);
  const start=$('dash-start')?.value||ym+'-01';
  const end=$('dash-end')?.value||today;
  const confirmed=db.workLogs.filter(l=>l.work_date>=start&&l.work_date<=end&&l.status==='Confirmado');
  const totalRev=confirmed.reduce((s,l)=>s+l.revenue,0);
  const totalPay=confirmed.reduce((s,l)=>s+(l.work_log_employees||[]).reduce((a,e)=>a+e.payment_amount,0),0);
  const totalCosts=db.costs.reduce((s,c)=>s+c.amount,0);
  const profit=totalRev-totalPay-totalCosts;
  if($('dash-revenue'))$('dash-revenue').textContent=fmt(totalRev);
  if($('dash-labor'))$('dash-labor').textContent=fmt(totalPay);
  if($('dash-costs'))$('dash-costs').textContent=fmt(totalCosts);
  if($('dash-profit'))$('dash-profit').textContent=fmt(profit);
  const pending=db.scheduleEntries.filter(s=>s.status==='pendente').length;
  const secondary=document.getElementById('dash-secondary');
  if(secondary){
    secondary.innerHTML=`
      <div class="stat-card"><div class="stat-label">📅 Agenda Pendente</div><div class="stat-value">${pending}</div></div>
      <div class="stat-card"><div class="stat-label">👥 Clientes</div><div class="stat-value">${db.clients.length}</div></div>
      <div class="stat-card"><div class="stat-label">💼 Funcionários</div><div class="stat-value">${db.employees.length}</div></div>`;
  }
  const clientMap={};
  confirmed.forEach(l=>{
    const c=getClient(l.client_id);if(!c)return;
    if(!clientMap[c.id])clientMap[c.id]={name:c.name,frequency:c.frequency,price:c.price,laborCost:0,profit:0};
    clientMap[c.id].laborCost+=(l.work_log_employees||[]).reduce((s,e)=>s+e.payment_amount,0);
  });
  const ranking=Object.values(clientMap).map(c=>({...c,profit:c.price-c.laborCost})).sort((a,b)=>b.profit-a.profit);
  if($('ranking-body'))$('ranking-body').innerHTML=ranking.map((c,i)=>
    `<tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td><span class="badge badge-gray">${c.frequency}</span></td>
    <td style="text-align:right">${fmt(c.price)}</td><td style="text-align:right">${fmt(c.laborCost)}</td>
    <td style="text-align:right;font-weight:700;color:var(--secondary)">${fmt(c.profit)}</td></tr>`).join('');
  renderCharts(confirmed);
}

function renderCharts(confirmed){
  if(typeof Chart==='undefined')return;
  const cm={};
  confirmed.forEach(l=>{const c=getClient(l.client_id);if(!c)return;if(!cm[c.name])cm[c.name]={rev:0,pay:0};cm[c.name].rev+=l.revenue;cm[c.name].pay+=(l.work_log_employees||[]).reduce((s,e)=>s+e.payment_amount,0);});
  const labels=Object.keys(cm);
  const ctx1=document.getElementById('chart-revenue-cost');
  if(ctx1){if(_chartRC)_chartRC.destroy();
    _chartRC=new Chart(ctx1,{type:'bar',data:{labels,datasets:[
      {label:'Receita',data:labels.map(k=>cm[k].rev),backgroundColor:'rgba(37,99,235,.82)',borderRadius:5},
      {label:'Custo M.O.',data:labels.map(k=>cm[k].pay),backgroundColor:'rgba(239,68,68,.78)',borderRadius:5}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{ticks:{callback:v=>'R$'+v}}}}});}
  const bd={};
  [...confirmed].sort((a,b)=>a.work_date.localeCompare(b.work_date)).forEach(l=>{
    const pay=(l.work_log_employees||[]).reduce((s,e)=>s+e.payment_amount,0);
    bd[l.work_date]=(bd[l.work_date]||0)+(l.revenue-pay);
  });
  const ctx2=document.getElementById('chart-profit');
  if(ctx2){if(_chartP)_chartP.destroy();
    _chartP=new Chart(ctx2,{type:'line',data:{labels:Object.keys(bd).map(d=>fmtDate(d)),datasets:[
      {label:'Lucro',data:Object.values(bd),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.12)',fill:true,tension:.4,pointRadius:4}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{ticks:{callback:v=>'R$'+v}}}}});}
}

function exportRankingCSV(){
  const start=$('dash-start')?.value||'',end=$('dash-end')?.value||'';
  const confirmed=db.workLogs.filter(l=>l.work_date>=start&&l.work_date<=end&&l.status==='Confirmado');
  const cm={};
  confirmed.forEach(l=>{const c=getClient(l.client_id);if(!c)return;if(!cm[c.id])cm[c.id]={name:c.name,freq:c.frequency,rev:0,pay:0};cm[c.id].rev+=l.revenue;cm[c.id].pay+=(l.work_log_employees||[]).reduce((s,e)=>s+e.payment_amount,0);});
  const rows=[['#','Cliente','Frequência','Receita','Custo M.O.','Lucro']];
  Object.values(cm).sort((a,b)=>(b.rev-b.pay)-(a.rev-a.pay)).forEach((c,i)=>rows.push([i+1,c.name,c.freq,c.rev.toFixed(2),c.pay.toFixed(2),(c.rev-c.pay).toFixed(2)]));
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'}));a.download=`ranking-${start}-${end}.csv`;a.click();
}

// ═══════════════════════════════════════════════════
// AGENDA / SCHEDULE
// ═══════════════════════════════════════════════════
function renderSchedule(){
  const base=getWeekStart(new Date());base.setDate(base.getDate()+weekOffset*7);
  const days=[];for(let i=0;i<7;i++){const d=new Date(base);d.setDate(base.getDate()+i);days.push(d)}
  const s0=days[0].toISOString().split('T')[0],s6=days[6].toISOString().split('T')[0],today=new Date().toISOString().split('T')[0];
  $('week-label').textContent=`${days[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – ${days[6].toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`;
  const dn=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  $('week-grid').innerHTML=days.map((d,i)=>{
    const ds=d.toISOString().split('T')[0];
    const entries=db.scheduleEntries.filter(e=>e.work_date===ds);
    return`<div class="day-col ${ds===today?'today':''}">
      <div class="day-label">${dn[i]}</div><div class="day-num">${d.getDate()}</div>
      ${entries.map(e=>{const cl=getClient(e.client_id);return`<div class="schedule-item ${e.status}">
        <div style="font-weight:600;font-size:11px">${cl?cl.name:'?'}</div>
        <span class="badge ${e.status==='confirmado'?'badge-secondary':e.status==='cancelado'?'badge-destructive':'badge-warning'}" style="font-size:9px">${e.status}</span>
        <button class="sch-edit-btn" data-edit-schedule="${e.id}">✏️</button>
      </div>`;}).join('')}
    </div>`;}).join('');
  const we=db.scheduleEntries.filter(e=>e.work_date>=s0&&e.work_date<=s6).sort((a,b)=>a.work_date.localeCompare(b.work_date));
  const badge=document.getElementById('schedule-count-badge');
  if(badge)badge.textContent=we.length?we.length+' agendamento'+(we.length>1?'s':''):'';
  $('schedule-list').innerHTML=we.length===0?'<div class="empty"><div class="icon">📅</div>Nenhum agendamento esta semana</div>'
    :we.map(e=>{const cl=getClient(e.client_id);const emps=(e.employee_ids||[]).map(id=>getEmployee(id)?.name||id).join(', ');
      return`<div class="log-row"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1"><div class="log-date">${fmtDate(e.work_date)}</div><div class="log-client">${cl?cl.name:'?'}</div>
          <div class="log-employees">👤 ${emps||'Nenhuma'}</div>
          ${e.notes?`<div style="font-size:12px;color:var(--text-muted);font-style:italic">"${e.notes}"</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="badge ${e.status==='confirmado'?'badge-secondary':e.status==='cancelado'?'badge-destructive':'badge-warning'}">${e.status}</span>
          <button class="btn btn-ghost btn-icon btn-sm" data-edit-schedule="${e.id}" title="Editar">✏️</button>
          <button class="btn btn-danger btn-icon btn-sm" data-del-schedule="${e.id}" title="Excluir">🗑</button>
        </div>
      </div></div>`;}).join('');
}

function editSchedule(id){
  const e=db.scheduleEntries.find(x=>x.id===id);if(!e)return;
  if($('sch-modal-title'))$('sch-modal-title').textContent='✏️ Editar Agendamento';
  if($('sch-edit-id'))$('sch-edit-id').value=e.id;
  $('sch-date').value=e.work_date;$('sch-status').value=e.status;$('sch-notes').value=e.notes||'';
  populateSelects();
  setTimeout(()=>{$('sch-client').value=e.client_id;$('sch-emp').value=(e.employee_ids||[])[0]||'';},0);
  openModal('schedule-modal');
}

function saveSchedule(){
  const editId=$('sch-edit-id')?.value||'';
  const date=$('sch-date').value,clientId=$('sch-client').value,empId=$('sch-emp').value,status=$('sch-status').value,notes=($('sch-notes').value||'').trim();
  if(!date||!clientId){toast('Preencha data e cliente','error');return;}
  let entryId=editId;
  if(editId){
    const entry=db.scheduleEntries.find(x=>x.id===editId);
    if(entry){entry.work_date=date;entry.client_id=clientId;if(empId)entry.employee_ids=[empId];entry.status=status;entry.notes=notes;}
    toast('Agendamento atualizado!','success');
  } else {
    entryId=uid();
    db.scheduleEntries.push({id:entryId,work_date:date,client_id:clientId,employee_ids:empId?[empId]:[],status,notes});
    toast('Agendamento criado!','success');
  }
  const entry=db.scheduleEntries.find(x=>x.id===entryId);
  if(entry)sbUpsert('schedule_entries',entry);
  if($('sch-edit-id'))$('sch-edit-id').value='';
  if($('sch-modal-title'))$('sch-modal-title').textContent='📅 Novo Agendamento';
  closeModal('schedule-modal');renderSchedule();
}

// ═══════════════════════════════════════════════════
// CHECKLIST / PAGAMENTOS
// ═══════════════════════════════════════════════════
function renderChecklist(){
  const list=db.workLogs.sort((a,b)=>b.work_date.localeCompare(a.work_date));
  $('checklist-list').innerHTML=list.length===0?'<div class="empty"><div class="icon">💵</div>Nenhum registro</div>'
    :list.map(l=>{const cl=getClient(l.client_id);const emps=(l.work_log_employees||[]).map(e=>{const emp=getEmployee(e.employee_id);return`${emp?emp.name:e.employee_id}: ${fmt(e.payment_amount)}`;}).join(' | ');
      return`<div class="log-row">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div class="log-date">${fmtDate(l.work_date)}</div>
            <div class="log-client">${cl?cl.name:'?'}</div>
            <div class="log-employees" style="font-size:12px;color:var(--text-muted)">${emps}</div>
            ${l.cancellation_reason?`<div style="font-size:11px;color:var(--destructive)">Motivo: ${l.cancellation_reason}</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap">
            <span class="badge ${l.status==='Confirmado'?'badge-secondary':l.status==='Cancelado'?'badge-destructive':'badge-warning'}">${l.status}</span>
            <span style="font-weight:700;color:var(--secondary)">${fmt(l.revenue)}</span>
            <button class="btn btn-ghost btn-icon btn-sm" data-edit-log="${l.id}" title="Editar">✏️</button>
            <button class="btn btn-danger btn-icon btn-sm" data-del-log="${l.id}" title="Apagar">🗑</button>
          </div>
        </div>
      </div>`;}).join('');
}

function openAddWorkLog(){
  $('cl-edit-id').value='';$('checklist-modal-title').textContent='💵 Novo Registro de Trabalho';
  $('cl-date').value='';$('cl-status').value='Confirmado';$('cl-reason').value='';$('cl-revenue').value='';
  populateSelects();
  $('cl-emp-rows').innerHTML='';addEmpRow();
  openModal('checklist-modal');
}

function editWorkLog(id){
  const l=db.workLogs.find(x=>x.id===id);if(!l)return;
  $('cl-edit-id').value=l.id;$('checklist-modal-title').textContent='✏️ Editar Registro';
  $('cl-date').value=l.work_date;$('cl-status').value=l.status;$('cl-reason').value=l.cancellation_reason||'';$('cl-revenue').value=l.revenue;
  populateSelects();setTimeout(()=>$('cl-client').value=l.client_id,0);
  $('cl-emp-rows').innerHTML='';
  (l.work_log_employees||[]).forEach(e=>addEmpRow(e.employee_id,e.payment_amount));
  if(!(l.work_log_employees||[]).length)addEmpRow();
  openModal('checklist-modal');
}

function addEmpRow(empId='',pay=''){
  const div=document.createElement('div');div.style.cssText='display:flex;gap:6px;margin-bottom:6px';
  div.innerHTML=`<select class="form-control emp-row-emp" style="flex:1">${db.employees.map(e=>`<option value="${e.id}" ${e.id===empId?'selected':''}>${e.name}</option>`).join('')}</select>
    <input type="number" class="form-control emp-row-pay" placeholder="R$" value="${pay}" style="width:100px"/>
    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  $('cl-emp-rows').appendChild(div);
}

function saveWorkLog(){
  const editId=$('cl-edit-id').value,clientId=$('cl-client').value,date=$('cl-date').value,status=$('cl-status').value,reason=$('cl-reason').value,revenue=parseFloat($('cl-revenue').value)||0;
  if(!clientId||!date){toast('Preencha cliente e data','error');return;}
  const emps=[...document.querySelectorAll('#cl-emp-rows > div')].map(div=>({employee_id:div.querySelector('.emp-row-emp').value,payment_amount:parseFloat(div.querySelector('.emp-row-pay').value)||0}));
  let logId=editId;
  if(editId){
    const l=db.workLogs.find(w=>w.id===editId);
    if(l){l.client_id=clientId;l.work_date=date;l.status=status;l.cancellation_reason=reason;l.revenue=status==='Confirmado'?revenue:0;l.work_log_employees=emps;}
  } else {
    logId=uid();
    db.workLogs.push({id:logId,work_date:date,client_id:clientId,revenue:status==='Confirmado'?revenue:0,status,cancellation_reason:reason,work_log_employees:emps,notes:''});
  }
  const wl=db.workLogs.find(l=>l.id===logId);
  if(wl)sbUpsert('work_logs',wl);
  closeModal('checklist-modal');toast('Registro salvo!','success');renderChecklist();renderDashboard();
}

// ═══════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════
function renderClients(){
  $('clients-table-body').innerHTML=db.clients.map(c=>{
    const emps=(c.client_employees||[]).map(ce=>{const e=getEmployee(ce.employee_id);return e?e.name:'?';}).join(', ');
    return`<tr><td><strong>${c.name}</strong></td><td>${c.frequency||'—'}</td><td style="text-align:right">${fmt(c.price)}</td><td style="font-size:12px">${emps}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-icon btn-sm" data-edit-client="${c.id}">✏️</button><button class="btn btn-danger btn-icon btn-sm" data-del-client="${c.id}">🗑</button></div></td></tr>`;
  }).join('');
}

function addClientEmpRow(empId='',pay=''){
  const div=document.createElement('div');div.style.cssText='display:flex;gap:6px;margin-bottom:6px';
  div.innerHTML=`<select class="form-control cemp-row-emp" style="flex:1">${db.employees.map(e=>`<option value="${e.id}" ${e.id===empId?'selected':''}>${e.name}</option>`).join('')}</select>
    <input type="number" class="form-control cemp-row-pay" placeholder="Pagamento" value="${pay}" style="width:110px"/>
    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">✕</button>`;
  $('client-emp-rows').appendChild(div);
}

function openAddClient(){
  $('client-edit-id').value='';$('client-name').value='';$('client-price').value='';$('client-transport').checked=false;$('client-notes').value='';
  populateSelects();setTimeout(()=>$('client-freq').value='',0);
  $('client-emp-rows').innerHTML='';addClientEmpRow();
  openModal('client-modal');
}

function editClient(id){
  const c=db.clients.find(x=>x.id===id);if(!c)return;
  $('client-edit-id').value=c.id;$('client-name').value=c.name;$('client-price').value=c.price;$('client-transport').checked=!!c.no_transport_cost;$('client-notes').value=c.notes||'';
  populateSelects();setTimeout(()=>$('client-freq').value=c.frequency,0);
  $('client-emp-rows').innerHTML='';
  (c.client_employees||[]).forEach(e=>addClientEmpRow(e.employee_id,e.payment_amount));
  if(!(c.client_employees||[]).length)addClientEmpRow();
  openModal('client-modal');
}

function saveClient(){
  const id=$('client-edit-id').value,name=$('client-name').value.trim(),freq=$('client-freq').value,price=parseFloat($('client-price').value)||0,noT=$('client-transport').checked;
  if(!name||!freq){toast('Preencha nome e frequência','error');return;}
  const emps=[...document.querySelectorAll('#client-emp-rows > div')].map(div=>({employee_id:div.querySelector('.cemp-row-emp').value,payment_amount:parseFloat(div.querySelector('.cemp-row-pay').value)||0}));
  const notes=$('client-notes').value.trim();
  let clientId=id;
  if(id){const c=db.clients.find(x=>x.id===id);if(c){c.name=name;c.frequency=freq;c.price=price;c.no_transport_cost=noT;c.client_employees=emps;c.notes=notes;}}
  else{clientId=uid();db.clients.push({id:clientId,name,frequency:freq,price,no_transport_cost:noT,client_employees:emps,notes});}
  const cl=db.clients.find(x=>x.id===clientId);if(cl)sbUpsert('clients',cl);
  closeModal('client-modal');toast('Cliente salvo!','success');renderClients();populateSelects();
}

// ═══════════════════════════════════════════════════
// FUNCIONÁRIOS
// ═══════════════════════════════════════════════════
function renderEmployees(){
  $('emp-table-body').innerHTML=db.employees.map(e=>{
    const u=Object.values(USERS).find(u=>u.email===e.email);
    const badge=u?(u.role==='adm'?'<span class="role-badge-adm">Admin</span>':'<span class="role-badge-col">Colaborador</span>'):'<span class="no-login-badge">Sem login</span>';
    return`<tr><td><strong>${e.name}</strong></td><td style="font-size:12px">${e.email||''}</td><td>${badge}</td><td>${fmtDate(e.created_at)}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-icon btn-sm" data-edit-emp="${e.id}" title="Editar">✏️</button><button class="btn btn-danger btn-icon btn-sm" data-del-emp="${e.id}" title="Remover">🗑</button></div></td></tr>`;
  }).join('');
  const pending=db.pendingUsers;
  $('pending-list').innerHTML=pending.length===0?'<div class="empty"><div class="icon">📩</div>Nenhum cadastro pendente</div>'
    :pending.map(u=>`<div class="log-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px">
      <span>📧 ${u.email}</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" data-approve-user="${u.id}" data-email="${u.email}">✅ Aprovar</button>
        <button class="btn btn-danger btn-sm" data-reject-user="${u.id}">❌ Rejeitar</button>
      </div>
    </div>`).join('');
}

function saveEmployee(){
  const name=$('emp-name').value.trim(),email=$('emp-email').value.trim().toLowerCase(),pass=$('emp-pass').value,role=$('emp-role').value;
  if(!name||!email){toast('Preencha nome e email','error');return;}
  if(!pass||pass.length<6){toast('Senha mínimo 6 caracteres','error');return;}
  if(USERS[email]){toast('Email já cadastrado','error');return;}
  const newId=uid(),today=new Date().toISOString().split('T')[0];
  const rec={id:newId,name,email,created_at:today};
  db.employees.push(rec);USERS[email]={role,email,username:name,password:pass,employeeId:newId};
  closeModal('emp-modal');$('emp-name').value='';$('emp-email').value='';$('emp-pass').value='';$('emp-role').value='colaborador';
  toast(`"${name}" criado com acesso!`,'success');renderEmployees();populateSelects();
  sbUpsert('employees',rec);
  sbUpsert('users_login',{id:'ul_'+newId,email,role,username:name,password:pass,employee_id:newId});
}

function openEditEmpModal(empId){
  const emp=db.employees.find(e=>e.id===empId);if(!emp)return;
  const u=Object.values(USERS).find(u=>u.email===emp.email);
  $('edit-emp-id').value=emp.id;$('edit-emp-name').value=emp.name;$('edit-emp-email').value=emp.email;$('edit-emp-pass').value='';
  $('edit-emp-role').value=u?u.role:'colaborador';
  openModal('edit-emp-modal');
}

function saveEditEmployee(){
  const empId=$('edit-emp-id').value;
  const name=$('edit-emp-name').value.trim(),newEmail=$('edit-emp-email').value.trim().toLowerCase(),newPass=$('edit-emp-pass').value,newRole=$('edit-emp-role').value;
  if(!name||!newEmail){toast('Nome e email obrigatórios','error');return;}
  if(newPass&&newPass.length<6){toast('Senha mínimo 6 caracteres','error');return;}
  const emp=db.employees.find(e=>e.id===empId);if(!emp)return;
  const conflict=Object.values(USERS).find(u=>u.email===newEmail&&u.email!==emp.email);
  if(conflict){toast('Email já em uso','error');return;}
  const oldKey=Object.keys(USERS).find(k=>USERS[k].email===emp.email);
  const oldPass=oldKey?USERS[oldKey].password:'123456';
  if(oldKey)delete USERS[oldKey];
  emp.name=name;emp.email=newEmail;
  USERS[newEmail]={role:newRole,email:newEmail,username:name,password:newPass||oldPass,employeeId:empId};
  sbUpsert('employees',{id:empId,name,email:newEmail,created_at:emp.created_at});
  sbUpsert('users_login',{id:'ul_'+empId,email:newEmail,role:newRole,username:name,password:newPass||oldPass,employee_id:empId});
  closeModal('edit-emp-modal');toast(`"${name}" atualizado!`,'success');renderEmployees();populateSelects();
}

function approveUser(){
  const id=$('approve-user-id').value,name=$('approve-name').value.trim(),pass=$('approve-pass').value||'123456',role=$('approve-role').value||'colaborador';
  if(!name){toast('Informe o nome','error');return;}
  const u=db.pendingUsers.find(p=>p.id===id);
  if(u){
    const newId=uid(),today=new Date().toISOString().split('T')[0];
    const rec={id:newId,name,email:u.email,created_at:today};
    db.employees.push(rec);db.pendingUsers=db.pendingUsers.filter(p=>p.id!==id);
    USERS[u.email]={role,email:u.email,username:name,password:pass,employeeId:newId};
    sbUpsert('employees',rec);sbUpsert('users_login',{id:'ul_'+newId,email:u.email,role,username:name,password:pass,employee_id:newId});sbDelete('pending_users',id);
    toast(`"${name}" aprovado com login!`,'success');
  }
  closeModal('approve-modal');renderEmployees();
}

// ═══════════════════════════════════════════════════
// CUSTOS
// ═══════════════════════════════════════════════════
function renderCosts(){
  const rec=db.costs.filter(c=>c.cost_type==='recorrente').reduce((s,c)=>s+c.amount,0);
  const uniq=db.costs.filter(c=>c.cost_type==='unico').reduce((s,c)=>s+c.amount,0);
  if($('cost-recurrent'))$('cost-recurrent').textContent=fmt(rec);
  if($('cost-unique'))$('cost-unique').textContent=fmt(uniq);
  const list=costsFilter==='all'?db.costs:db.costs.filter(c=>c.cost_type===costsFilter);
  $('costs-list').innerHTML=list.length===0?'<div class="empty"><div class="icon">🧾</div>Nenhum custo encontrado</div>'
    :list.map(c=>`<div class="log-row">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div><div class="log-date">${fmtDate(c.created_at||c.date)}</div>
          <div style="font-weight:600">${c.description}</div>
          <span class="badge badge-gray">${c.category||'—'}</span>
          <span class="badge ${c.cost_type==='recorrente'?'badge-warning':'badge-secondary'}" style="margin-left:4px">${c.cost_type==='recorrente'?'Recorrente':'Único'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;color:var(--destructive)">${fmt(c.amount)}</span>
          <button class="btn btn-danger btn-icon btn-sm" data-del-cost="${c.id}">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function saveCost(){
  const cat=$('cost-cat').value,desc=$('cost-desc').value.trim(),amount=parseFloat($('cost-amount').value)||0,type=$('cost-type').value;
  if(!desc||amount<=0){toast('Preencha todos os campos','error');return;}
  const rec={id:uid(),category:cat,description:desc,amount,cost_type:type,created_at:new Date().toISOString().split('T')[0]};
  db.costs.push(rec);closeModal('cost-modal');toast('Custo adicionado!','success');renderCosts();
  sbUpsert('costs',rec);
}

// ═══════════════════════════════════════════════════
// NOTIFICAÇÕES
// ═══════════════════════════════════════════════════
function renderNotifications(){
  updateNotifBadge();
  $('notifications-list').innerHTML=db.notifications.length===0?'<div class="empty"><div class="icon">🔔</div>Nenhuma notificação</div>'
    :db.notifications.map(n=>{const cl=getClient(n.client_id);const emp=getEmployee(n.employee_id);
      return`<div class="notif-item ${n.status}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div>
            <div style="font-weight:600;margin-bottom:4px">${n.note}</div>
            <div style="font-size:12px;color:var(--text-muted)">
              ${cl?`📍 ${cl.name}`:''} ${emp?`👤 ${emp.name}`:''} • ${new Date(n.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${n.status==='pending'?`<button class="btn btn-outline btn-sm" data-notif-read="${n.id}">✓ Lida</button>`:''}
            <button class="btn btn-danger btn-sm" data-notif-del="${n.id}">🗑 Excluir</button>
          </div>
        </div>
      </div>`;}).join('');
}

// ═══════════════════════════════════════════════════
// FREQUÊNCIAS
// ═══════════════════════════════════════════════════
function renderFrequencies(){
  $('freq-list').innerHTML=db.frequencies.length===0?'<div class="empty"><div class="icon">📆</div>Nenhuma frequência</div>'
    :db.frequencies.map(f=>`<div class="log-row" style="display:flex;align-items:center;justify-content:space-between;padding:10px">
      <span style="font-weight:600">${f.name}</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" data-edit-freq="${f.id}">✏️ Editar</button>
        <button class="btn btn-danger btn-icon btn-sm" data-del-freq="${f.id}">🗑</button>
      </div>
    </div>`).join('');
}

function saveFreq(){
  const id=$('freq-edit-id').value,name=$('freq-name').value.trim();
  if(!name){toast('Digite o nome','error');return;}
  let freqId=id;
  if(id){const f=db.frequencies.find(f=>f.id===id);if(f)f.name=name;toast('Frequência atualizada!','success');}
  else{freqId=uid();db.frequencies.push({id:freqId,name});toast('Frequência adicionada!','success');}
  sbUpsert('frequencies',{id:freqId,name});
  closeModal('freq-modal');$('freq-edit-id').value='';$('freq-name').value='';renderFrequencies();populateSelects();
}

// ═══════════════════════════════════════════════════
// INDICAÇÕES
// ═══════════════════════════════════════════════════
function renderReferrals(){
  const pending=db.referrals.filter(r=>r.status==='pending');
  const approved=db.referrals.filter(r=>r.status==='approved');
  const rejected=db.referrals.filter(r=>r.status==='rejected');
  if($('referral-stats'))$('referral-stats').innerHTML=`
    <div class="stat-card" style="border-left:4px solid var(--warning)"><div class="stat-label">⏳ Pendentes</div><div class="stat-value">${pending.length}</div></div>
    <div class="stat-card" style="border-left:4px solid var(--secondary)"><div class="stat-label">✅ Aprovadas</div><div class="stat-value">${approved.length}</div></div>
    <div class="stat-card" style="border-left:4px solid var(--destructive)"><div class="stat-label">❌ Rejeitadas</div><div class="stat-value">${rejected.length}</div></div>`;
  $('referrals-list').innerHTML=db.referrals.length===0?'<div class="empty"><div class="icon">🎁</div>Nenhuma indicação</div>'
    :db.referrals.map(r=>{const emp=getEmployee(r.referrer_employee_id);
      return`<div class="log-row">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><div style="font-weight:600">${r.client_name}</div>
            <div style="font-size:12px;color:var(--text-muted)">👤 ${emp?emp.name:'?'} • ${fmtDate(r.created_at)}</div>
            ${r.bonus>0?`<div style="font-size:12px;color:var(--secondary);font-weight:600">Bônus: ${fmt(r.bonus)}</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge ${r.status==='approved'?'badge-secondary':r.status==='rejected'?'badge-destructive':'badge-warning'}">${r.status==='approved'?'Aprovada':r.status==='rejected'?'Rejeitada':'Pendente'}</span>
            ${r.status==='pending'?`<button class="btn btn-outline btn-sm" data-approve-ref="${r.id}">✅ Aprovar</button><button class="btn btn-danger btn-sm" data-reject-ref="${r.id}">❌</button>`:''}
            <button class="btn btn-danger btn-icon btn-sm" data-del-ref="${r.id}">🗑</button>
          </div>
        </div>
      </div>`;}).join('');
}

// ═══════════════════════════════════════════════════
// VISÃO DO FUNCIONÁRIO
// ═══════════════════════════════════════════════════
let empPeriodStart='', empPeriodEnd='';

function setEmpPeriod(period, custom){
  const today=new Date().toISOString().split('T')[0];
  const ym=today.substr(0,7);
  if(period==='mes'){empPeriodStart=ym+'-01';empPeriodEnd=today;}
  else if(period==='semana'){const ws=getWeekStart(new Date()).toISOString().split('T')[0];empPeriodStart=ws;empPeriodEnd=today;}
  else if(custom){empPeriodStart=custom.start;empPeriodEnd=custom.end;}
  renderEmpGanhos();
}

function renderEmpGanhos(){
  if(!currentEmpId)return;
  const logs=db.workLogs.filter(l=>l.work_date>=empPeriodStart&&l.work_date<=empPeriodEnd&&l.status==='Confirmado');
  const myLogs=logs.filter(l=>(l.work_log_employees||[]).some(e=>e.employee_id===currentEmpId));
  const total=myLogs.reduce((s,l)=>{const e=(l.work_log_employees||[]).find(e=>e.employee_id===currentEmpId);return s+(e?e.payment_amount:0);},0);
  if($('emp-total-ganhos'))$('emp-total-ganhos').textContent=fmt(total);
  if($('emp-ganhos-list'))$('emp-ganhos-list').innerHTML=myLogs.length===0?'<div class="empty"><div class="icon">💰</div>Nenhum ganho no período</div>'
    :myLogs.map(l=>{const cl=getClient(l.client_id);const emp=(l.work_log_employees||[]).find(e=>e.employee_id===currentEmpId);
      return`<div class="log-row"><div style="display:flex;align-items:center;justify-content:space-between">
        <div><div class="log-date">${fmtDate(l.work_date)}</div><div class="log-client">${cl?cl.name:'?'}</div></div>
        <span style="font-weight:700;color:var(--secondary)">${fmt(emp?emp.payment_amount:0)}</span>
      </div></div>`;}).join('');
}

function renderEmpAgenda(){
  if(!currentEmpId)return;
  const today=new Date().toISOString().split('T')[0];
  const upcoming=db.scheduleEntries.filter(e=>e.work_date>=today&&(e.employee_ids||[]).includes(currentEmpId)).sort((a,b)=>a.work_date.localeCompare(b.work_date)).slice(0,10);
  if($('emp-agenda-list'))$('emp-agenda-list').innerHTML=upcoming.length===0?'<div class="empty"><div class="icon">📅</div>Nenhum agendamento</div>'
    :upcoming.map(e=>{const cl=getClient(e.client_id);
      return`<div class="log-row"><div style="display:flex;align-items:center;justify-content:space-between">
        <div><div class="log-date">${fmtDate(e.work_date)}</div><div class="log-client">${cl?cl.name:'?'}</div></div>
        <span class="badge ${e.status==='confirmado'?'badge-secondary':'badge-warning'}">${e.status}</span>
      </div></div>`;}).join('');
}

function renderEmpClients(){
  if(!currentEmpId)return;
  const myClients=db.clients.filter(c=>(c.client_employees||[]).some(ce=>ce.employee_id===currentEmpId));
  if($('emp-clients-list'))$('emp-clients-list').innerHTML=myClients.length===0?'<div class="empty"><div class="icon">👥</div>Nenhum cliente</div>'
    :myClients.map(c=>{const ce=(c.client_employees||[]).find(e=>e.employee_id===currentEmpId);
      return`<div class="log-row"><div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-weight:600">${c.name}</div><div style="font-size:12px;color:var(--text-muted)">${c.frequency||'—'}</div></div>
        <span style="font-weight:700;color:var(--secondary)">${fmt(ce?ce.payment_amount:0)}/vez</span>
      </div></div>`;}).join('');
}

function renderEmpReferrals(){
  if(!currentEmpId)return;
  const mine=db.referrals.filter(r=>r.referrer_employee_id===currentEmpId);
  if($('emp-referrals-list'))$('emp-referrals-list').innerHTML=mine.length===0?'<div class="empty"><div class="icon">🎁</div>Nenhuma indicação</div>'
    :mine.map(r=>`<div class="log-row"><div style="display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-weight:600">${r.client_name}</div><div style="font-size:12px;color:var(--text-muted)">${fmtDate(r.created_at)}</div></div>
      <div><span class="badge ${r.status==='approved'?'badge-secondary':r.status==='rejected'?'badge-destructive':'badge-warning'}">${r.status==='approved'?'Aprovada':r.status==='rejected'?'Rejeitada':'Pendente'}</span>
        ${r.bonus>0?`<span style="font-size:12px;color:var(--secondary);margin-left:6px">${fmt(r.bonus)}</span>`:''}
      </div>
    </div></div>`).join('');
}

// ═══════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Login
  $('btn-login').addEventListener('click', () => doLogin());
  $('login-pass')?.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

  // Sidebar
  document.querySelectorAll('#sidebar .nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });

  // Mobile menu
  $('mobile-menu-btn')?.addEventListener('click', () => {
    $('sidebar')?.classList.toggle('open');
  });

  // Employee tabs (collaborator view)
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => empNavigate(btn.dataset.etab));
  });

  // Logout
  $('btn-logout')?.addEventListener('click', doLogout);
  $('btn-emp-logout')?.addEventListener('click', doLogout);

  // Dashboard filters
  $('dash-apply')?.addEventListener('click', renderDashboard);
  $('btn-export-csv')?.addEventListener('click', exportRankingCSV);
  $('btn-print-dash')?.addEventListener('click', () => window.print());

  // Schedule
  $('prev-week')?.addEventListener('click', () => { weekOffset--; renderSchedule(); });
  $('next-week')?.addEventListener('click', () => { weekOffset++; renderSchedule(); });
  $('btn-add-schedule')?.addEventListener('click', () => {
    if($('sch-edit-id'))$('sch-edit-id').value='';
    if($('sch-modal-title'))$('sch-modal-title').textContent='📅 Novo Agendamento';
    $('sch-date').value='';$('sch-notes').value='';$('sch-status').value='pendente';
    populateSelects();openModal('schedule-modal');
  });
  $('btn-save-schedule')?.addEventListener('click', saveSchedule);
  $('btn-cancel-schedule')?.addEventListener('click', () => closeModal('schedule-modal'));

  // Checklist
  $('btn-add-log')?.addEventListener('click', openAddWorkLog);
  $('btn-add-emp-row')?.addEventListener('click', () => addEmpRow());
  $('btn-save-log')?.addEventListener('click', saveWorkLog);
  $('btn-cancel-log')?.addEventListener('click', () => closeModal('checklist-modal'));

  // Clients
  $('btn-add-client')?.addEventListener('click', openAddClient);
  $('btn-add-client-emp')?.addEventListener('click', () => addClientEmpRow());
  $('btn-save-client')?.addEventListener('click', saveClient);
  $('btn-cancel-client')?.addEventListener('click', () => closeModal('client-modal'));

  // Employees
  $('btn-add-emp')?.addEventListener('click', () => openModal('emp-modal'));
  $('btn-save-emp')?.addEventListener('click', saveEmployee);
  $('btn-cancel-emp')?.addEventListener('click', () => closeModal('emp-modal'));
  $('btn-save-edit-emp')?.addEventListener('click', saveEditEmployee);
  $('btn-cancel-edit-emp')?.addEventListener('click', () => closeModal('edit-emp-modal'));
  $('btn-approve-user')?.addEventListener('click', approveUser);
  $('btn-cancel-approve')?.addEventListener('click', () => closeModal('approve-modal'));

  // Costs
  $('btn-add-cost')?.addEventListener('click', () => openModal('cost-modal'));
  $('btn-save-cost')?.addEventListener('click', saveCost);
  $('btn-cancel-cost')?.addEventListener('click', () => closeModal('cost-modal'));
  document.querySelectorAll('.cost-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => { costsFilter=btn.dataset.filter; document.querySelectorAll('.cost-filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderCosts(); });
  });

  // Frequencies
  $('btn-add-freq')?.addEventListener('click', () => { $('freq-edit-id').value='';$('freq-name').value=''; openModal('freq-modal'); });
  $('btn-save-freq')?.addEventListener('click', saveFreq);
  $('btn-cancel-freq')?.addEventListener('click', () => closeModal('freq-modal'));

  // Notifications bulk
  $('btn-mark-all-read')?.addEventListener('click', () => {
    db.notifications.forEach(n => { n.status='read'; sbUpdate('notifications',n.id,{status:'read'}); });
    toast('Todas marcadas como lidas','success'); updateNotifBadge(); renderNotifications();
  });
  $('btn-del-read-notifs')?.addEventListener('click', () => {
    const ids=db.notifications.filter(n=>n.status==='read').map(n=>n.id);
    if(!ids.length){toast('Nenhuma lida para excluir','error');return;}
    if(!confirm(`Excluir ${ids.length} lida(s)?`))return;
    ids.forEach(id=>sbDelete('notifications',id));
    db.notifications=db.notifications.filter(n=>n.status!=='read');
    toast(`${ids.length} excluída(s)`,'success'); updateNotifBadge(); renderNotifications();
  });
  $('btn-del-all-notifs')?.addEventListener('click', () => {
    if(!db.notifications.length){toast('Nenhuma notificação','error');return;}
    if(!confirm(`Excluir todas as ${db.notifications.length}?`))return;
    db.notifications.forEach(n=>sbDelete('notifications',n.id)); db.notifications=[];
    toast('Todas excluídas','success'); updateNotifBadge(); renderNotifications();
  });

  // Referrals
  $('btn-approve-ref')?.addEventListener('click', () => {
    const id=$('ref-edit-id').value,bonus=parseFloat($('ref-bonus').value)||0;
    if(bonus<=0){toast('Informe um valor de bônus','error');return;}
    const r=db.referrals.find(r=>r.id===id);
    if(r){r.status='approved';r.bonus=bonus;sbUpsert('referrals',r);}
    closeModal('ref-modal'); toast('Indicação aprovada!','success'); renderReferrals();
  });
  $('btn-cancel-ref')?.addEventListener('click', () => closeModal('ref-modal'));

  // Emp note (from collaborator view)
  $('btn-save-note')?.addEventListener('click', () => {
    const clientId=$('note-client-sel')?.value,note=($('note-text')?.value||'').trim();
    if(!note){toast('Escreva uma nota','error');return;}
    const rec={id:uid(),client_id:clientId,employee_id:currentEmpId,note,status:'pending',created_at:new Date().toISOString()};
    db.notifications.unshift(rec);
    sbUpsert('notifications',rec);
    if($('note-text'))$('note-text').value='';
    closeModal('emp-note-modal');toast('Nota enviada!','success');
  });
  $('btn-cancel-note')?.addEventListener('click', () => closeModal('emp-note-modal'));
  $('btn-add-note')?.addEventListener('click', () => openModal('emp-note-modal'));

  // Emp referral submit
  $('btn-save-emp-ref')?.addEventListener('click', () => {
    const clientName=($('emp-ref-client')?.value||'').trim();
    if(!clientName){toast('Informe o nome do cliente','error');return;}
    const rec={id:uid(),referrer_employee_id:currentEmpId,client_name:clientName,bonus:0,status:'pending',created_at:new Date().toISOString().split('T')[0]};
    db.referrals.push(rec);sbUpsert('referrals',rec);
    if($('emp-ref-client'))$('emp-ref-client').value='';
    closeModal('emp-ref-modal');toast('Indicação enviada!','success');renderEmpReferrals();
  });
  $('btn-cancel-emp-ref')?.addEventListener('click', () => closeModal('emp-ref-modal'));
  $('btn-add-emp-ref')?.addEventListener('click', () => openModal('emp-ref-modal'));

  // Period buttons (emp view)
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');setEmpPeriod(btn.dataset.period,null);
    });
  });

  // ── GLOBAL CLICK DELEGATION ──
  document.addEventListener('click', e => {
    const t = e.target;
    // Edit schedule (grid card or list button)
    const editSchEl = t.closest('[data-edit-schedule]');
    if(editSchEl){ editSchedule(editSchEl.dataset.editSchedule); return; }
    // Edit work log
    const editLogId = t.dataset.editLog; if(editLogId){ editWorkLog(editLogId); return; }
    // Edit client
    const editClientId = t.dataset.editClient; if(editClientId){ editClient(editClientId); return; }
    // Edit employee
    const editEmpId = t.closest('[data-edit-emp]')?.dataset.editEmp; if(editEmpId){ openEditEmpModal(editEmpId); return; }
    // Edit frequency
    const editFreqId = t.dataset.editFreq;
    if(editFreqId){ $('freq-edit-id').value=editFreqId; const f=db.frequencies.find(f=>f.id===editFreqId); if(f)$('freq-name').value=f.name; openModal('freq-modal'); return; }
    // Approve referral
    const approveRefId = t.dataset.approveRef;
    if(approveRefId){ $('ref-edit-id').value=approveRefId; $('ref-bonus').value=''; openModal('ref-modal'); return; }
    // Reject referral
    const rejectRefId = t.dataset.rejectRef;
    if(rejectRefId){ if(!confirm('Rejeitar indicação?'))return; const r=db.referrals.find(r=>r.id===rejectRefId); if(r){r.status='rejected';sbUpsert('referrals',r);} toast('Indicação rejeitada','success'); renderReferrals(); return; }
    // Approve pending user
    const approveUserId = t.dataset.approveUser;
    if(approveUserId){ $('approve-user-id').value=approveUserId; $('approve-name').value=''; $('approve-pass').value='123456'; openModal('approve-modal'); return; }
    // Notif read
    const notifReadId = t.dataset.notifRead;
    if(notifReadId){ const n=db.notifications.find(n=>n.id===notifReadId); if(n){n.status='read';sbUpdate('notifications',n.id,{status:'read'});} updateNotifBadge(); renderNotifications(); return; }
    // DEL EMPLOYEE
    const delEmpId = t.dataset.delEmp;
    if(delEmpId){ const em=db.employees.find(x=>x.id===delEmpId); if(!confirm(`Remover "${em?.name||'funcionário'}"?`))return; if(em){const uk=Object.keys(USERS).find(k=>USERS[k].email===em.email);if(uk)delete USERS[uk];sbDelete('users_login','ul_'+delEmpId);} sbDelete('employees',delEmpId); db.employees=db.employees.filter(x=>x.id!==delEmpId); toast('Funcionário removido','success'); renderEmployees(); return; }
    // DEL CLIENT
    const delClientId = t.dataset.delClient;
    if(delClientId){ if(!confirm('Remover cliente?'))return; sbDelete('clients',delClientId); db.clients=db.clients.filter(c=>c.id!==delClientId); toast('Cliente removido','success'); renderClients(); return; }
    // DEL SCHEDULE
    const delSchId = t.dataset.delSchedule;
    if(delSchId){ if(!confirm('Remover agendamento?'))return; sbDelete('schedule_entries',delSchId); db.scheduleEntries=db.scheduleEntries.filter(s=>s.id!==delSchId); toast('Agendamento removido','success'); renderSchedule(); return; }
    // DEL LOG
    const delLogId = t.dataset.delLog;
    if(delLogId){ if(!confirm('Remover registro?'))return; sbDelete('work_logs',delLogId); db.workLogs=db.workLogs.filter(l=>l.id!==delLogId); toast('Registro removido','success'); renderChecklist(); renderDashboard(); return; }
    // DEL COST
    const delCostId = t.dataset.delCost;
    if(delCostId){ if(!confirm('Remover custo?'))return; sbDelete('costs',delCostId); db.costs=db.costs.filter(c=>c.id!==delCostId); toast('Custo removido','success'); renderCosts(); return; }
    // DEL FREQ
    const delFreqId = t.dataset.delFreq;
    if(delFreqId){ if(!confirm('Remover frequência?'))return; sbDelete('frequencies',delFreqId); db.frequencies=db.frequencies.filter(f=>f.id!==delFreqId); toast('Frequência removida','success'); renderFrequencies(); return; }
    // DEL REF
    const delRefId = t.dataset.delRef;
    if(delRefId){ if(!confirm('Remover indicação?'))return; sbDelete('referrals',delRefId); db.referrals=db.referrals.filter(r=>r.id!==delRefId); toast('Indicação removida','success'); renderReferrals(); return; }
    // DEL NOTIF
    const delNotifId = t.dataset.notifDel;
    if(delNotifId){ if(!confirm('Excluir notificação?'))return; sbDelete('notifications',delNotifId); db.notifications=db.notifications.filter(n=>n.id!==delNotifId); updateNotifBadge(); renderNotifications(); return; }
    // REJECT PENDING USER
    const rejectUserId = t.dataset.rejectUser;
    if(rejectUserId){ if(!confirm('Rejeitar usuário?'))return; sbDelete('pending_users',rejectUserId); db.pendingUsers=db.pendingUsers.filter(p=>p.id!==rejectUserId); toast('Usuário rejeitado','success'); renderEmployees(); return; }
  });

}); // end DOMContentLoaded
