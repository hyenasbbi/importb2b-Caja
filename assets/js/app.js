import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const configured = Boolean(
  cfg.supabaseUrl &&
  cfg.supabaseAnonKey &&
  !cfg.supabaseUrl.includes("YOUR_") &&
  !cfg.supabaseAnonKey.includes("YOUR_")
);

const supabase = configured ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  demo: !configured,
  user: null,
  profile: null,
  movements: [],
  audit: [],
  quote: { buy: null, sell: null, source: "—", updatedAt: null, mode: "live" }
};

const demoMovements = [
  { id:"d1", kind:"income", amount:180000, currency:"ARS", payment_method:"transferencia", category:"VENTA", description:"Venta mercadería", occurred_at:new Date(Date.now()-40*60000).toISOString(), ars_equivalent:180000, quote_ars:null, created_by_name:"Nahuel" },
  { id:"d2", kind:"expense", amount:300, currency:"USDT", payment_method:"usdt", category:"COMPRA DE MERCADERÍA", description:"Pedido proveedor", occurred_at:new Date(Date.now()-5*3600000).toISOString(), ars_equivalent:475440, quote_ars:1584.8, quote_type:"buy", created_by_name:"Socio" },
  { id:"d3", kind:"income", amount:75000, currency:"ARS", payment_method:"efectivo", category:"VENTA", description:"Venta local", occurred_at:new Date(Date.now()-86400000).toISOString(), ars_equivalent:75000, quote_ars:null, created_by_name:"Nahuel" }
];

const demoAudit = [
  { id:"a1", action:"INSERT", created_at:new Date(Date.now()-40*60000).toISOString(), actor_name:"Nahuel", entity_id:"d1", summary:"Creó ingreso · VENTA" },
  { id:"a2", action:"INSERT", created_at:new Date(Date.now()-5*3600000).toISOString(), actor_name:"Socio", entity_id:"d2", summary:"Creó egreso · COMPRA DE MERCADERÍA" }
];

function money(v, decimals=0){
  const n = Number(v || 0);
  return "$ " + n.toLocaleString("es-AR",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function num(v, decimals=2){
  return Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function dateTime(v){
  if(!v) return "—";
  return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
}
function monthStart(){
  const d = new Date(); return new Date(d.getFullYear(),d.getMonth(),1);
}
function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function setConnection(mode, text){
  const pill = $("connectionPill");
  pill.classList.remove("is-online","is-demo");
  if(mode) pill.classList.add(mode);
  pill.querySelector("span:last-child").textContent = text;
}
function defaultDateInput(){
  const d = new Date();
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  $("movementDate").value = d.toISOString().slice(0,16);
}
function currentQuoteFor(kind, requested="auto"){
  if(requested==="buy") return {type:"buy", value:state.quote.buy};
  if(requested==="sell") return {type:"sell", value:state.quote.sell};
  return kind==="expense"
    ? {type:"buy", value:state.quote.buy}
    : {type:"sell", value:state.quote.sell};
}

async function init(){
  bindUI();

  if(!configured){
    state.demo = true;
    $("demoLoginBtn").classList.remove("is-hidden");
    $("loginMessage").textContent = "Beta sin Supabase configurado: podés abrir el modo demo.";
    return;
  }

  const { data:{ session } } = await supabase.auth.getSession();
  if(session?.user){
    await enterApp(session.user);
  }

  supabase.auth.onAuthStateChange(async (_event, session)=>{
    if(session?.user && $("appView").classList.contains("is-hidden")){
      await enterApp(session.user);
    }
  });
}

function bindUI(){
  $("loginForm").addEventListener("submit", login);
  $("demoLoginBtn").addEventListener("click", async ()=>{
    state.demo = true;
    state.user = { id:"demo-user", email:"demo@importb2b.local", user_metadata:{full_name:"IMPORTB2B Demo"} };
    await enterApp(state.user);
  });

  $("logoutBtn").addEventListener("click", logout);
  $("refreshAllBtn").addEventListener("click", refreshAll);
  $("refreshQuoteBtn").addEventListener("click", loadQuote);
  $("refreshQuoteBtnLarge").addEventListener("click", loadQuote);
  $("newMovementTopBtn").addEventListener("click", openMovementModal);
  $("mobileNewBtn").addEventListener("click", openMovementModal);

  $$("[data-close-modal]").forEach(el=>el.addEventListener("click", closeMovementModal));
  $$(".nav-item,.mobile-nav-item").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
  $$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.go)));

  $$("#kindSegment .segment").forEach(btn=>btn.addEventListener("click",()=>{
    $$("#kindSegment .segment").forEach(x=>x.classList.remove("is-active"));
    btn.classList.add("is-active");
    $("movementKind").value = btn.dataset.kind;
    updateUsdtPreview();
  }));

  $("movementCurrency").addEventListener("change", ()=>{
    const isUsdt = $("movementCurrency").value==="USDT";
    $("quoteTypeWrap").classList.toggle("is-hidden",!isUsdt);
    $("usdtPreview").classList.toggle("is-hidden",!isUsdt);
    if(isUsdt) $("movementMethod").value="usdt";
    updateUsdtPreview();
  });
  $("movementAmount").addEventListener("input", updateUsdtPreview);
  $("movementQuoteType").addEventListener("change", updateUsdtPreview);
  $("movementForm").addEventListener("submit", saveMovement);
  $("manualQuoteForm").addEventListener("submit", setManualQuote);

  ["filterKind","filterMethod","filterSearch"].forEach(id=>$(id).addEventListener("input",renderMovements));
  window.addEventListener("keydown",e=>{if(e.key==="Escape") closeMovementModal()});
}

async function login(e){
  e.preventDefault();
  $("loginMessage").textContent = "";
  if(!configured){
    $("loginMessage").textContent = "Primero configurá Supabase o utilizá el modo demo.";
    return;
  }
  const email=$("loginEmail").value.trim(), password=$("loginPassword").value;
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){ $("loginMessage").textContent=error.message; return; }
  if(data.user) await enterApp(data.user);
}

async function logout(){
  if(!state.demo && supabase) await supabase.auth.signOut();
  state.user=null;
  $("appView").classList.add("is-hidden");
  $("loginView").classList.remove("is-hidden");
}

async function enterApp(user){
  state.user=user;
  $("loginView").classList.add("is-hidden");
  $("appView").classList.remove("is-hidden");

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario";
  $("userName").textContent=displayName;
  $("userEmail").textContent=user.email || "demo";
  $("userInitial").textContent=displayName.charAt(0).toUpperCase();

  if(state.demo){
    setConnection("is-demo","MODO DEMO");
    state.movements=[...demoMovements];
    state.audit=[...demoAudit];
    state.quote={buy:1584.80,sell:1578.50,source:"DEMO · BINANCE P2P",updatedAt:new Date().toISOString(),mode:"demo"};
    renderAll();
    return;
  }

  setConnection("is-online","ONLINE");
  await refreshAll();
}

async function refreshAll(){
  await Promise.all([loadQuote(),loadMovements(),loadAudit()]);
  renderAll();
}

async function loadQuote(){
  if(state.demo){
    state.quote={...state.quote,updatedAt:new Date().toISOString()};
    renderQuote(); renderDashboard();
    return;
  }
  try{
    const res=await fetch(cfg.quoteEndpoint || "/api/usdt",{headers:{"Accept":"application/json"},cache:"no-store"});
    if(!res.ok) throw new Error("No se pudo consultar Binance");
    const data=await res.json();
    if(!data.buy || !data.sell) throw new Error("Cotización incompleta");
    state.quote={
      buy:Number(data.buy),
      sell:Number(data.sell),
      source:data.source || "BINANCE P2P",
      updatedAt:data.updatedAt || new Date().toISOString(),
      mode:"live"
    };
    await saveQuoteSnapshot();
  }catch(err){
    console.warn(err);
    const latest = await latestQuoteSnapshot();
    if(latest){
      state.quote={
        buy:Number(latest.buy_ars),sell:Number(latest.sell_ars),
        source:(latest.source||"GUARDADA")+" · ÚLTIMA",updatedAt:latest.captured_at,mode:"cached"
      };
    }
  }
  renderQuote(); renderDashboard(); updateUsdtPreview();
}

async function saveQuoteSnapshot(){
  if(state.demo || !supabase || !state.quote.buy || !state.quote.sell) return;
  await supabase.from("quote_snapshots").insert({
    buy_ars:state.quote.buy,
    sell_ars:state.quote.sell,
    source:state.quote.source || "BINANCE P2P",
    captured_at:state.quote.updatedAt || new Date().toISOString()
  });
}
async function latestQuoteSnapshot(){
  if(!supabase) return null;
  const {data}=await supabase.from("quote_snapshots").select("*").order("captured_at",{ascending:false}).limit(1).maybeSingle();
  return data || null;
}

async function loadMovements(){
  if(state.demo) return;
  const {data,error}=await supabase
    .from("movements")
    .select("id,kind,amount,currency,payment_method,category,description,occurred_at,quote_type,quote_ars,ars_equivalent,created_at,created_by,profiles:created_by(full_name)")
    .order("occurred_at",{ascending:false})
    .limit(1000);
  if(error){ console.error(error); return; }
  state.movements=(data||[]).map(m=>({...m,created_by_name:m.profiles?.full_name||"Usuario"}));
}

async function loadAudit(){
  if(state.demo) return;
  const {data,error}=await supabase
    .from("audit_log")
    .select("id,action,entity_id,created_at,actor_id,old_data,new_data,profiles:actor_id(full_name)")
    .order("created_at",{ascending:false})
    .limit(200);
  if(error){ console.error(error); return; }
  state.audit=(data||[]).map(a=>{
    const d=a.new_data||a.old_data||{};
    return {
      ...a,
      actor_name:a.profiles?.full_name||"Usuario",
      summary:`${a.action==="INSERT"?"Creó":a.action==="UPDATE"?"Modificó":"Eliminó"} ${d.kind==="income"?"ingreso":"egreso"} · ${d.category||"MOVIMIENTO"}`
    };
  });
}

function renderAll(){
  renderQuote(); renderDashboard(); renderMovements(); renderAudit();
}

function renderQuote(){
  const b=state.quote.buy, s=state.quote.sell;
  const btxt=b?money(b,2):"$ —", stxt=s?money(s,2):"$ —";
  ["buyQuote","buyQuoteLarge"].forEach(id=>$(id).textContent=btxt);
  ["sellQuote","sellQuoteLarge"].forEach(id=>$(id).textContent=stxt);
  const time=state.quote.updatedAt ? `Actualizado ${dateTime(state.quote.updatedAt)}` : "Sin actualizar";
  $("quoteUpdated").textContent=time;
  $("quoteUpdatedLarge").textContent=time;
  $("quoteSourceBadge").textContent=(state.quote.source||"SIN DATOS").toUpperCase();
}

function renderDashboard(){
  let transfer=0,cash=0,usdt=0;
  for(const m of state.movements){
    const sign=m.kind==="income"?1:-1;
    if(m.currency==="ARS" && m.payment_method==="transferencia") transfer += sign*Number(m.amount);
    if(m.currency==="ARS" && m.payment_method==="efectivo") cash += sign*Number(m.amount);
    if(m.currency==="USDT") usdt += sign*Number(m.amount);
  }
  const usdtArs=usdt*Number(state.quote.sell||0);
  const total=transfer+cash+usdtArs;
  $("transferBalance").textContent=money(transfer);
  $("cashBalance").textContent=money(cash);
  $("usdtBalance").textContent=`${num(usdt)} USDT`;
  $("totalBalanceArs").textContent=money(total);

  const start=monthStart();
  const month=state.movements.filter(m=>new Date(m.occurred_at)>=start);
  const incomes=month.filter(m=>m.kind==="income");
  const expenses=month.filter(m=>m.kind==="expense");
  const inc=incomes.reduce((a,m)=>a+Number(m.ars_equivalent ?? (m.currency==="ARS"?m.amount:0)),0);
  const exp=expenses.reduce((a,m)=>a+Number(m.ars_equivalent ?? (m.currency==="ARS"?m.amount:0)),0);
  $("monthIncome").textContent="+"+money(inc);
  $("monthExpense").textContent="-"+money(exp);
  $("monthResult").textContent=(inc-exp>=0?"+":"-")+money(Math.abs(inc-exp));
  $("monthResult").className=(inc-exp>=0?"positive":"negative");
  $("monthIncomeCount").textContent=`${incomes.length} movimiento${incomes.length===1?"":"s"}`;
  $("monthExpenseCount").textContent=`${expenses.length} movimiento${expenses.length===1?"":"s"}`;

  renderMovementList($("recentMovements"),state.movements.slice(0,6));
}

function filteredMovements(){
  const kind=$("filterKind").value, method=$("filterMethod").value, q=$("filterSearch").value.trim().toLowerCase();
  return state.movements.filter(m=>
    (!kind||m.kind===kind)&&
    (!method||m.payment_method===method)&&
    (!q||`${m.category} ${m.description||""} ${m.created_by_name||""}`.toLowerCase().includes(q))
  );
}
function renderMovements(){
  renderMovementList($("allMovements"),filteredMovements());
}
function renderMovementList(container,items){
  if(!items.length){
    container.innerHTML='<div class="empty-state">NO HAY MOVIMIENTOS PARA MOSTRAR</div>'; return;
  }
  container.innerHTML=items.map(m=>{
    const isIncome=m.kind==="income";
    const amountText=m.currency==="USDT"
      ? `${isIncome?"+":"-"}${num(m.amount)} USDT`
      : `${isIncome?"+":"-"}${money(m.amount)}`;
    const q=m.quote_ars ? `${m.quote_type==="buy"?"Compra":"Venta"} ${money(m.quote_ars,2)}` : "—";
    return `<div class="movement-row">
      <div class="movement-sign ${m.kind}">${isIncome?"↑":"↓"}</div>
      <div class="movement-main">
        <strong>${escapeHtml(m.category||"MOVIMIENTO")}</strong>
        <span>${escapeHtml(m.description||"Sin descripción")} · ${escapeHtml(m.created_by_name||"Usuario")}</span>
      </div>
      <div class="movement-meta">
        <strong>${String(m.payment_method||"").toUpperCase()}</strong>
        <span>${dateTime(m.occurred_at)}</span>
      </div>
      <div class="movement-quote">${q}</div>
      <div class="movement-amount ${m.kind}">${amountText}</div>
    </div>`;
  }).join("");
}

function renderAudit(){
  const el=$("auditList");
  if(!state.audit.length){ el.innerHTML='<div class="empty-state">TODAVÍA NO HAY EVENTOS DE AUDITORÍA</div>'; return; }
  el.innerHTML=state.audit.map(a=>`
    <div class="audit-item">
      <div class="audit-action">${escapeHtml(a.action||"EVENTO")}</div>
      <div class="audit-copy">
        <strong>${escapeHtml(a.summary||"Movimiento")}</strong>
        <span>${escapeHtml(a.actor_name||"Usuario")}</span>
      </div>
      <div class="audit-time">${dateTime(a.created_at)}</div>
    </div>`).join("");
}

function switchView(view){
  $$(".page-view").forEach(v=>v.classList.add("is-hidden"));
  $(`view-${view}`).classList.remove("is-hidden");
  $$(".nav-item,.mobile-nav-item").forEach(b=>b.classList.toggle("is-active",b.dataset.view===view));
  const labels={
    dashboard:["IMPORTB2B · CAJA","DASHBOARD"],
    movements:["IMPORTB2B · CAJA","MOVIMIENTOS"],
    usdt:["BINANCE P2P","USDT / ARS"],
    audit:["SEGURIDAD INTERNA","AUDITORÍA"]
  };
  $("pageEyebrow").textContent=labels[view][0];
  $("pageTitle").textContent=labels[view][1];
  window.scrollTo({top:0,behavior:"smooth"});
}

function openMovementModal(){
  defaultDateInput();
  $("movementForm").reset();
  $("movementKind").value="income";
  $$("#kindSegment .segment").forEach(x=>x.classList.toggle("is-active",x.dataset.kind==="income"));
  $("movementCurrency").value="ARS";
  $("movementMethod").value="transferencia";
  $("movementCategory").value="VENTA";
  $("movementMessage").textContent="";
  $("quoteTypeWrap").classList.add("is-hidden");
  $("usdtPreview").classList.add("is-hidden");
  $("movementModal").classList.remove("is-hidden");
}
function closeMovementModal(){ $("movementModal").classList.add("is-hidden"); }

function updateUsdtPreview(){
  if($("movementCurrency").value!=="USDT") return;
  const amount=Number($("movementAmount").value||0);
  const q=currentQuoteFor($("movementKind").value,$("movementQuoteType").value);
  $("previewQuote").textContent=q.value?money(q.value,2):"$ —";
  $("previewEquivalent").textContent=q.value?money(amount*q.value,2):"$ —";
}

async function saveMovement(e){
  e.preventDefault();
  const kind=$("movementKind").value;
  const amount=Number($("movementAmount").value);
  const currency=$("movementCurrency").value;
  let payment_method=$("movementMethod").value;
  const category=$("movementCategory").value;
  const description=$("movementDescription").value.trim();
  const occurred_at=new Date($("movementDate").value).toISOString();

  let quote_type=null,quote_ars=null,ars_equivalent=amount;
  if(currency==="USDT"){
    const q=currentQuoteFor(kind,$("movementQuoteType").value);
    if(!q.value){
      $("movementMessage").textContent="No hay cotización USDT disponible. Actualizá Binance o cargá una manual.";
      return;
    }
    quote_type=q.type; quote_ars=Number(q.value); ars_equivalent=amount*quote_ars;
    payment_method = "usdt";
  }

  const row={kind,amount,currency,payment_method,category,description,occurred_at,quote_type,quote_ars,ars_equivalent};

  if(state.demo){
    const name=state.user?.user_metadata?.full_name||"Demo";
    state.movements.unshift({...row,id:crypto.randomUUID(),created_by_name:name,created_at:new Date().toISOString()});
    state.audit.unshift({id:crypto.randomUUID(),action:"INSERT",created_at:new Date().toISOString(),actor_name:name,summary:`Creó ${kind==="income"?"ingreso":"egreso"} · ${category}`});
    closeMovementModal(); renderAll(); return;
  }

  const {error}=await supabase.from("movements").insert({...row,created_by:state.user.id});
  if(error){ $("movementMessage").textContent=error.message; return; }
  closeMovementModal();
  await Promise.all([loadMovements(),loadAudit()]);
  renderAll();
}

async function setManualQuote(e){
  e.preventDefault();
  const buy=Number($("manualBuy").value), sell=Number($("manualSell").value);
  if(!buy||!sell) return;
  state.quote={buy,sell,source:"MANUAL",updatedAt:new Date().toISOString(),mode:"manual"};
  if(!state.demo) await saveQuoteSnapshot();
  renderQuote();renderDashboard();updateUsdtPreview();
}

init();
