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
  settlements: [],
  receivables: [],
  audit: [],
  editingMovement: null,
  quote: { buy: null, sell: null, source: "—", updatedAt: null, mode: "live" }
};

const demoMovements = [
  { id:"d1", kind:"income", amount:150000, currency:"ARS", payment_method:"transferencia", category:"VENTA", description:"Movimiento demo", occurred_at:new Date().toISOString(), ars_equivalent:150000, quote_ars:null, cash_holder:null, source_type:null, created_by_name:"Nahuel" }
];

function money(value, decimals=0){
  const n = Number(value || 0);
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
}

function num(value, decimals=2){
  return Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits:decimals, maximumFractionDigits:decimals });
}

function dateTime(value){
  if(!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit"
  }).format(new Date(value));
}

function dateOnly(value){
  if(!value) return "Sin fecha";
  const d = new Date(`${String(value).slice(0,10)}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" }).format(d);
}

function monthStart(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function setConnection(mode, text){
  const pill = $("connectionPill");
  pill.classList.remove("is-online", "is-demo");
  if(mode) pill.classList.add(mode);
  pill.querySelector("span:last-child").textContent = text;
}

function currentQuoteFor(kind, requested="auto"){
  if(requested === "original" && state.editingMovement?.quote_ars){
    return { type:state.editingMovement.quote_type || (kind === "expense" ? "buy" : "sell"), value:Number(state.editingMovement.quote_ars) };
  }
  if(requested === "buy") return { type:"buy", value:state.quote.buy };
  if(requested === "sell") return { type:"sell", value:state.quote.sell };
  return kind === "expense"
    ? { type:"buy", value:state.quote.buy }
    : { type:"sell", value:state.quote.sell };
}

function providerLabel(value){
  return ({ go_cuotas:"GO CUOTAS", tarjeta_credito:"TARJETA DE CRÉDITO", otro:"OTRO" })[value] || String(value || "OTRO").toUpperCase();
}

function statusLabel(value){
  return ({ pending:"PENDIENTE", settled:"LIQUIDADO", cancelled:"CANCELADO", partial:"PAGO PARCIAL", paid:"PAGADO" })[value] || String(value || "").toUpperCase();
}

function holderLabel(value){
  return ({ nahuel:"Nahuel", esteban:"Esteban" })[value] || "Sin asignar";
}

function modalId(name){
  return ({
    movement:"movementModal",
    settlement:"settlementModal",
    settleFunds:"settleFundsModal",
    receivable:"receivableModal",
    receivablePayment:"receivablePaymentModal",
    internalTransfer:"internalTransferModal"
  })[name];
}

function closeNamedModal(name){
  const id = modalId(name);
  if(id) $(id).classList.add("is-hidden");
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
  if(session?.user) await enterApp(session.user);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if(session?.user && $("appView").classList.contains("is-hidden")){
      await enterApp(session.user);
    }
  });
}

function bindUI(){
  $("loginForm").addEventListener("submit", login);
  $("demoLoginBtn").addEventListener("click", async () => {
    state.demo = true;
    state.user = { id:"demo-user", email:"demo@importb2b.local", user_metadata:{ full_name:"IMPORTB2B Demo" } };
    await enterApp(state.user);
  });

  $("logoutBtn").addEventListener("click", logout);
  $("refreshAllBtn").addEventListener("click", refreshAll);
  $("refreshQuoteBtn").addEventListener("click", loadQuote);
  $("refreshQuoteBtnLarge").addEventListener("click", loadQuote);

  ["newMovementTopBtn", "newMovementViewBtn", "mobileNewBtn"].forEach(id => $(id)?.addEventListener("click", () => openMovementModal()));
  $("newSettlementBtn").addEventListener("click", () => openSettlementModal());
  $("newReceivableBtn").addEventListener("click", () => openReceivableModal());
  $("newInternalTransferBtn").addEventListener("click", openInternalTransferModal);

  $$("[data-close]").forEach(el => el.addEventListener("click", () => closeNamedModal(el.dataset.close)));
  $$(".nav-item,.mobile-nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  $$("[data-go]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.go)));

  [
    ["transferBreakdownToggle","transferBreakdown"],
    ["cashBreakdownToggle","cashBreakdown"],
    ["usdtBreakdownToggle","usdtBreakdown"]
  ].forEach(([buttonId,panelId]) => {
    $(buttonId).addEventListener("click", () => {
      const panel = $(panelId);
      const opening = panel.classList.contains("is-hidden");
      ["transferBreakdown","cashBreakdown","usdtBreakdown"].forEach(id => {
        if(id !== panelId) $(id).classList.add("is-hidden");
      });
      ["transferBreakdownToggle","cashBreakdownToggle","usdtBreakdownToggle"].forEach(id => {
        if(id !== buttonId) $(id).setAttribute("aria-expanded","false");
      });
      panel.classList.toggle("is-hidden", !opening);
      $(buttonId).setAttribute("aria-expanded", String(opening));
    });
  });

  $$("#kindSegment .segment").forEach(btn => btn.addEventListener("click", () => {
    $$("#kindSegment .segment").forEach(x => x.classList.remove("is-active"));
    btn.classList.add("is-active");
    $("movementKind").value = btn.dataset.kind;
    updateUsdtPreview();
  }));

  $("movementCurrency").addEventListener("change", syncMovementConditionalFields);
  $("movementMethod").addEventListener("change", syncMovementConditionalFields);
  $("movementAmount").addEventListener("input", updateUsdtPreview);
  $("movementQuoteType").addEventListener("change", updateUsdtPreview);
  $("movementForm").addEventListener("submit", saveMovement);

  $("manualQuoteForm").addEventListener("submit", setManualQuote);

  $("settlementGross").addEventListener("input", updateSettlementNetPreview);
  $("settlementFees").addEventListener("input", updateSettlementNetPreview);
  $("settlementForm").addEventListener("submit", saveSettlement);
  $("settleDestinationMethod").addEventListener("change", syncSettleHolderLabel);
  $("settleFundsForm").addEventListener("submit", settleFunds);

  $("receivableForm").addEventListener("submit", saveReceivable);
  $("receivablePaymentMethod").addEventListener("change", syncReceivablePaymentHolderLabel);
  $("receivablePaymentForm").addEventListener("submit", recordReceivablePayment);

  $("internalCurrency").addEventListener("change", syncInternalTransferCurrency);
  $("internalFromMethod").addEventListener("change", validateInternalTransferSides);
  $("internalToMethod").addEventListener("change", validateInternalTransferSides);
  $("internalFromHolder").addEventListener("change", validateInternalTransferSides);
  $("internalToHolder").addEventListener("change", validateInternalTransferSides);
  $("internalTransferForm").addEventListener("submit", saveInternalTransfer);

  ["filterKind","filterMethod","filterSearch"].forEach(id => $(id).addEventListener("input", renderMovements));

  document.addEventListener("click", handleActionClick);
  window.addEventListener("keydown", e => {
    if(e.key === "Escape"){
      ["movement","settlement","settleFunds","receivable","receivablePayment","internalTransfer"].forEach(closeNamedModal);
    }
  });
}

async function handleActionClick(event){
  const movementEdit = event.target.closest("[data-edit-movement]");
  if(movementEdit){
    const movement = state.movements.find(m => m.id === movementEdit.dataset.editMovement);
    if(movement) openMovementModal(movement);
    return;
  }

  const movementDelete = event.target.closest("[data-delete-movement]");
  if(movementDelete){
    const movement = state.movements.find(m => m.id === movementDelete.dataset.deleteMovement);
    if(movement) await deleteMovement(movement);
    return;
  }

  const settlementEdit = event.target.closest("[data-edit-settlement]");
  if(settlementEdit){
    const item = state.settlements.find(x => x.id === settlementEdit.dataset.editSettlement);
    if(item) openSettlementModal(item);
    return;
  }

  const settlementSettle = event.target.closest("[data-settle-settlement]");
  if(settlementSettle){
    const item = state.settlements.find(x => x.id === settlementSettle.dataset.settleSettlement);
    if(item) openSettleFundsModal(item);
    return;
  }

  const receivableEdit = event.target.closest("[data-edit-receivable]");
  if(receivableEdit){
    const item = state.receivables.find(x => x.id === receivableEdit.dataset.editReceivable);
    if(item) openReceivableModal(item);
    return;
  }

  const receivablePay = event.target.closest("[data-pay-receivable]");
  if(receivablePay){
    const item = state.receivables.find(x => x.id === receivablePay.dataset.payReceivable);
    if(item) openReceivablePaymentModal(item);
  }
}

async function login(event){
  event.preventDefault();
  $("loginMessage").textContent = "";

  if(!configured){
    $("loginMessage").textContent = "Primero configurá Supabase o utilizá el modo demo.";
    return;
  }

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if(error){
    $("loginMessage").textContent = error.message;
    return;
  }
  if(data.user) await enterApp(data.user);
}

async function logout(){
  if(!state.demo && supabase) await supabase.auth.signOut();
  state.user = null;
  $("appView").classList.add("is-hidden");
  $("loginView").classList.remove("is-hidden");
}

async function enterApp(user){
  state.user = user;
  $("loginView").classList.add("is-hidden");
  $("appView").classList.remove("is-hidden");

  let displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario";

  if(!state.demo){
    const { data } = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
    if(data){
      state.profile = data;
      displayName = data.full_name || displayName;
    }
  }

  $("userName").textContent = displayName;
  $("userEmail").textContent = user.email || "demo";
  $("userInitial").textContent = displayName.charAt(0).toUpperCase();

  if(state.demo){
    setConnection("is-demo", "MODO DEMO");
    state.movements = [...demoMovements];
    state.settlements = [];
    state.receivables = [];
    state.audit = [];
    state.quote = { buy:1585, sell:1579, source:"DEMO · BINANCE P2P", updatedAt:new Date().toISOString(), mode:"demo" };
    renderAll();
    return;
  }

  setConnection("is-online", "ONLINE");
  await refreshAll();
}

async function refreshAll(){
  await Promise.all([
    loadQuote(),
    loadMovements(),
    loadSettlements(),
    loadReceivables(),
    loadAudit()
  ]);
  renderAll();
}

async function loadQuote(){
  if(state.demo){
    state.quote = { ...state.quote, updatedAt:new Date().toISOString() };
    renderQuote();
    renderDashboard();
    return;
  }

  try{
    const res = await fetch(cfg.quoteEndpoint || "/api/usdt", {
      headers:{ "Accept":"application/json" },
      cache:"no-store"
    });
    if(!res.ok) throw new Error("No se pudo consultar Binance");

    const data = await res.json();
    if(!data.buy || !data.sell) throw new Error("Cotización incompleta");

    state.quote = {
      buy:Number(data.buy),
      sell:Number(data.sell),
      source:data.source || "BINANCE P2P",
      updatedAt:data.updatedAt || new Date().toISOString(),
      mode:"live"
    };

    await saveQuoteSnapshotIfChanged();
  }catch(error){
    console.warn(error);
    const latest = await latestQuoteSnapshot();
    if(latest){
      state.quote = {
        buy:Number(latest.buy_ars),
        sell:Number(latest.sell_ars),
        source:(latest.source || "GUARDADA") + " · ÚLTIMA",
        updatedAt:latest.captured_at,
        mode:"cached"
      };
    }
  }

  renderQuote();
  renderDashboard();
  updateUsdtPreview();
}

async function saveQuoteSnapshotIfChanged(){
  if(state.demo || !supabase || !state.quote.buy || !state.quote.sell) return;

  const latest = await latestQuoteSnapshot();
  if(latest){
    const sameBuy = Math.abs(Number(latest.buy_ars) - Number(state.quote.buy)) < 0.005;
    const sameSell = Math.abs(Number(latest.sell_ars) - Number(state.quote.sell)) < 0.005;
    if(sameBuy && sameSell) return;
  }

  await supabase.from("quote_snapshots").insert({
    buy_ars:state.quote.buy,
    sell_ars:state.quote.sell,
    source:state.quote.source || "BINANCE P2P",
    captured_at:state.quote.updatedAt || new Date().toISOString(),
    created_by:state.user.id
  });
}

async function latestQuoteSnapshot(){
  if(!supabase) return null;
  const { data } = await supabase.from("quote_snapshots")
    .select("*")
    .order("captured_at", { ascending:false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function loadMovements(){
  if(state.demo) return;
  const { data, error } = await supabase
    .from("movements")
    .select(`id,kind,amount,currency,payment_method,category,description,occurred_at,quote_type,quote_ars,ars_equivalent,created_at,updated_at,created_by,cash_holder,transfer_holder,usdt_holder,edited_at,edited_by,source_type,source_id,creator:profiles!movements_created_by_fkey(full_name),editor:profiles!movements_edited_by_fkey(full_name)`)
    .order("occurred_at", { ascending:false })
    .limit(1500);

  if(error){
    console.error("loadMovements", error);
    return;
  }

  state.movements = (data || []).map(m => ({
    ...m,
    created_by_name:m.creator?.full_name || "Usuario",
    edited_by_name:m.editor?.full_name || null
  }));
}

async function loadSettlements(){
  if(state.demo) return;
  const { data, error } = await supabase
    .from("settlements")
    .select(`id,provider,description,gross_amount,fees_amount,net_amount,expected_at,status,settled_at,destination_method,destination_cash_holder,movement_id,created_by,created_at,updated_at,creator:profiles!settlements_created_by_fkey(full_name)`)
    .order("created_at", { ascending:false });

  if(error){
    console.error("loadSettlements", error);
    return;
  }
  state.settlements = data || [];
}

async function loadReceivables(){
  if(state.demo) return;
  const { data, error } = await supabase
    .from("receivables")
    .select(`id,client_name,client_phone,description,total_amount,paid_amount,pending_amount,due_at,status,created_by,created_at,updated_at,creator:profiles!receivables_created_by_fkey(full_name)`)
    .order("created_at", { ascending:false });

  if(error){
    console.error("loadReceivables", error);
    return;
  }
  state.receivables = data || [];
}

async function loadAudit(){
  if(state.demo) return;
  const { data, error } = await supabase
    .from("audit_log")
    .select("id,entity_type,action,entity_id,created_at,actor_id,old_data,new_data,profiles:actor_id(full_name)")
    .order("created_at", { ascending:false })
    .limit(300);

  if(error){
    console.error("loadAudit", error);
    return;
  }

  state.audit = (data || []).map(a => ({
    ...a,
    actor_name:a.profiles?.full_name || "Sistema",
    summary:auditSummary(a)
  }));
}

function auditSummary(a){
  const d = a.new_data || a.old_data || {};
  const verb = a.action === "INSERT" ? "Creó" : a.action === "UPDATE" ? "Modificó" : "Eliminó";

  if(a.entity_type === "movement" || a.entity_type === "movements"){
    return `${verb} ${d.kind === "income" ? "ingreso" : "egreso"} · ${d.category || "MOVIMIENTO"}`;
  }
  if(a.entity_type === "settlements") return `${verb} liquidación · ${providerLabel(d.provider)}`;
  if(a.entity_type === "receivables") return `${verb} cuenta por cobrar · ${d.client_name || "CLIENTE"}`;
  if(a.entity_type === "receivable_payments") return `${verb} cobro · ${money(d.amount || 0)}`;
  if(a.entity_type === "internal_transfers") return `${verb} transferencia interna · ${d.currency || "ARS"} ${num(d.amount || 0)}`;
  return `${verb} registro · ${String(a.entity_type || "FINANZAS").toUpperCase()}`;
}

function renderAll(){
  renderQuote();
  renderDashboard();
  renderMovements();
  renderSettlements();
  renderReceivables();
  renderAudit();
}

function renderQuote(){
  const buy = state.quote.buy;
  const sell = state.quote.sell;
  const buyText = buy ? money(buy, 2) : "$ —";
  const sellText = sell ? money(sell, 2) : "$ —";

  ["buyQuote","buyQuoteLarge"].forEach(id => $(id).textContent = buyText);
  ["sellQuote","sellQuoteLarge"].forEach(id => $(id).textContent = sellText);

  const time = state.quote.updatedAt ? `Actualizado ${dateTime(state.quote.updatedAt)}` : "Sin actualizar";
  $("quoteUpdated").textContent = time;
  $("quoteUpdatedLarge").textContent = time;
  $("quoteSourceBadge").textContent = (state.quote.source || "SIN DATOS").toUpperCase();
}

function renderDashboard(){
  let transfer = 0;
  let transferNahuel = 0;
  let transferEsteban = 0;
  let transferUnassigned = 0;

  let cash = 0;
  let cashNahuel = 0;
  let cashEsteban = 0;
  let cashUnassigned = 0;

  let usdt = 0;
  let usdtNahuel = 0;
  let usdtEsteban = 0;
  let usdtUnassigned = 0;

  for(const m of state.movements){
    const sign = m.kind === "income" ? 1 : -1;

    if(m.currency === "ARS" && m.payment_method === "transferencia"){
      const amount = sign * Number(m.amount);
      transfer += amount;
      if(m.transfer_holder === "nahuel") transferNahuel += amount;
      else if(m.transfer_holder === "esteban") transferEsteban += amount;
      else transferUnassigned += amount;
    }

    if(m.currency === "ARS" && m.payment_method === "efectivo"){
      const amount = sign * Number(m.amount);
      cash += amount;
      if(m.cash_holder === "nahuel") cashNahuel += amount;
      else if(m.cash_holder === "esteban") cashEsteban += amount;
      else cashUnassigned += amount;
    }

    if(m.currency === "USDT"){
      const amount = sign * Number(m.amount);
      usdt += amount;
      if(m.usdt_holder === "nahuel") usdtNahuel += amount;
      else if(m.usdt_holder === "esteban") usdtEsteban += amount;
      else usdtUnassigned += amount;
    }
  }

  const sellQuote = Number(state.quote.sell || 0);
  const usdtArs = usdt * sellQuote;
  const availableTotal = transfer + cash + usdtArs;

  $("transferBalance").textContent = money(transfer);
  $("transferNahuel").textContent = money(transferNahuel);
  $("transferEsteban").textContent = money(transferEsteban);
  $("transferUnassigned").textContent = money(transferUnassigned);
  $("transferUnassignedWrap").classList.toggle("is-hidden", Math.abs(transferUnassigned) < 0.005);

  $("cashBalance").textContent = money(cash);
  $("cashNahuel").textContent = money(cashNahuel);
  $("cashEsteban").textContent = money(cashEsteban);
  $("cashUnassigned").textContent = money(cashUnassigned);
  $("cashUnassignedWrap").classList.toggle("is-hidden", Math.abs(cashUnassigned) < 0.005);

  $("usdtBalance").textContent = `${num(usdt)} USDT`;
  $("usdtNahuel").textContent = `${num(usdtNahuel)} USDT`;
  $("usdtEsteban").textContent = `${num(usdtEsteban)} USDT`;
  $("usdtUnassigned").textContent = `${num(usdtUnassigned)} USDT`;
  $("usdtNahuelArs").textContent = `≈ ${money(usdtNahuel * sellQuote)}`;
  $("usdtEstebanArs").textContent = `≈ ${money(usdtEsteban * sellQuote)}`;
  $("usdtUnassignedArs").textContent = `≈ ${money(usdtUnassigned * sellQuote)}`;
  $("usdtUnassignedWrap").classList.toggle("is-hidden", Math.abs(usdtUnassigned) < 0.00005);

  $("totalBalanceArs").textContent = money(availableTotal);

  const start = monthStart();
  const nonOperatingCategories = new Set([
    "CAPITAL INICIAL",
    "AJUSTE DE CAJA / RECUENTO"
  ]);
  const month = state.movements.filter(m =>
    new Date(m.occurred_at) >= start &&
    m.source_type !== "internal_transfer" &&
    !nonOperatingCategories.has(String(m.category || "").toUpperCase())
  );
  const incomes = month.filter(m => m.kind === "income");
  const expenses = month.filter(m => m.kind === "expense");
  const incomeArs = incomes.reduce((sum,m) => sum + Number(m.ars_equivalent ?? (m.currency === "ARS" ? m.amount : 0)), 0);
  const expenseArs = expenses.reduce((sum,m) => sum + Number(m.ars_equivalent ?? (m.currency === "ARS" ? m.amount : 0)), 0);

  $("monthIncome").textContent = "+" + money(incomeArs);
  $("monthExpense").textContent = "-" + money(expenseArs);
  $("monthResult").textContent = (incomeArs - expenseArs >= 0 ? "+" : "-") + money(Math.abs(incomeArs - expenseArs));
  $("monthResult").className = incomeArs - expenseArs >= 0 ? "positive" : "negative";
  $("monthIncomeCount").textContent = `${incomes.length} movimiento${incomes.length === 1 ? "" : "s"}`;
  $("monthExpenseCount").textContent = `${expenses.length} movimiento${expenses.length === 1 ? "" : "s"}`;

  const pendingSettlements = state.settlements.filter(x => x.status === "pending");
  const pendingSettlementAmount = pendingSettlements.reduce((sum,x) => sum + Number(x.net_amount || 0), 0);
  $("pendingSettlementAmount").textContent = money(pendingSettlementAmount);
  $("pendingSettlementCount").textContent = `${pendingSettlements.length} operación${pendingSettlements.length === 1 ? "" : "es"} pendiente${pendingSettlements.length === 1 ? "" : "s"}`;

  const openReceivables = state.receivables.filter(x => ["pending","partial"].includes(x.status));
  const pendingReceivableAmount = openReceivables.reduce((sum,x) => sum + Number(x.pending_amount || 0), 0);
  $("pendingReceivableAmount").textContent = money(pendingReceivableAmount);
  $("pendingReceivableCount").textContent = `${openReceivables.length} cliente${openReceivables.length === 1 ? "" : "s"} con saldo`;

  renderMovementList($("recentMovements"), state.movements.slice(0,6), false);
}

function filteredMovements(){
  const kind = $("filterKind").value;
  const method = $("filterMethod").value;
  const q = $("filterSearch").value.trim().toLowerCase();

  return state.movements.filter(m =>
    (!kind || m.kind === kind) &&
    (!method || m.payment_method === method) &&
    (!q || `${m.category} ${m.description || ""} ${m.created_by_name || ""} ${m.cash_holder || ""} ${m.transfer_holder || ""} ${m.usdt_holder || ""}`.toLowerCase().includes(q))
  );
}

function renderMovements(){
  renderMovementList($("allMovements"), filteredMovements(), true);
}

function renderMovementList(container, items, showActions){
  if(!items.length){
    container.innerHTML = '<div class="empty-state">NO HAY MOVIMIENTOS PARA MOSTRAR</div>';
    return;
  }

  container.innerHTML = items.map(m => {
    const isIncome = m.kind === "income";
    const amountText = m.currency === "USDT"
      ? `${isIncome ? "+" : "-"}${num(m.amount)} USDT`
      : `${isIncome ? "+" : "-"}${money(m.amount)}`;

    const quote = m.quote_ars ? `${m.quote_type === "buy" ? "Compra" : "Venta"} ${money(m.quote_ars,2)}` : "—";
    const holderValue = m.currency === "USDT"
      ? m.usdt_holder
      : m.payment_method === "efectivo"
        ? m.cash_holder
        : m.payment_method === "transferencia"
          ? m.transfer_holder
          : null;
    const holder = holderValue ? ` · ${holderLabel(holderValue)}` : " · Sin asignar";
    const edited = m.edited_at ? ` · Editado ${dateTime(m.edited_at)}` : "";
    const generated = Boolean(m.source_type && m.source_type !== "manual");
    const action = showActions
      ? generated
        ? '<span class="auto-tag">AUTOMÁTICO</span>'
        : `<button class="mini-btn" type="button" data-edit-movement="${m.id}">EDITAR</button><button class="mini-btn mini-btn--danger" type="button" data-delete-movement="${m.id}">ELIMINAR</button>`
      : "";

    return `<div class="movement-row ${showActions ? "movement-row--actions" : ""}">
      <div class="movement-sign ${m.kind}">${isIncome ? "↑" : "↓"}</div>
      <div class="movement-main">
        <strong>${escapeHtml(m.category || "MOVIMIENTO")}</strong>
        <span>${escapeHtml(m.description || "Sin descripción")} · ${escapeHtml(m.created_by_name || "Usuario")}${holder}${edited}</span>
      </div>
      <div class="movement-meta">
        <strong>${String(m.payment_method || "").toUpperCase()}</strong>
        <span>${dateTime(m.occurred_at)}</span>
      </div>
      <div class="movement-quote">${quote}</div>
      <div class="movement-amount ${m.kind}">${amountText}</div>
      ${showActions ? `<div class="movement-actions">${action}</div>` : ""}
    </div>`;
  }).join("");
}

function renderSettlements(){
  const pending = state.settlements.filter(x => x.status === "pending");
  const total = pending.reduce((sum,x) => sum + Number(x.net_amount || 0), 0);
  $("settlementsTotal").textContent = money(total);
  $("settlementsCount").textContent = `${pending.length} operación${pending.length === 1 ? "" : "es"}`;

  const el = $("settlementList");
  if(!state.settlements.length){
    el.innerHTML = '<div class="empty-state">NO HAY DINERO A LIQUIDAR REGISTRADO</div>';
    return;
  }

  el.innerHTML = state.settlements.map(x => {
    const pendingStatus = x.status === "pending";
    return `<div class="finance-row">
      <div class="finance-primary">
        <div class="finance-title-line"><strong>${providerLabel(x.provider)}</strong><span class="status-badge status-${x.status}">${statusLabel(x.status)}</span></div>
        <span>${escapeHtml(x.description || "Sin descripción")} · Creado ${dateTime(x.created_at)}</span>
      </div>
      <div class="finance-cell"><span>BRUTO</span><strong>${money(x.gross_amount)}</strong></div>
      <div class="finance-cell"><span>COMISIONES</span><strong>${money(x.fees_amount)}</strong></div>
      <div class="finance-cell finance-cell--main"><span>NETO</span><strong>${money(x.net_amount)}</strong></div>
      <div class="finance-cell"><span>ACREDITACIÓN</span><strong>${x.expected_at ? dateOnly(x.expected_at) : "Sin fecha"}</strong></div>
      <div class="finance-actions">
        ${pendingStatus ? `<button class="mini-btn" type="button" data-edit-settlement="${x.id}">EDITAR</button><button class="mini-btn mini-btn--primary" type="button" data-settle-settlement="${x.id}">LIQUIDAR</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

function renderReceivables(){
  const open = state.receivables.filter(x => ["pending","partial"].includes(x.status));
  const total = open.reduce((sum,x) => sum + Number(x.pending_amount || 0), 0);
  $("receivablesTotal").textContent = money(total);
  $("receivablesCount").textContent = `${open.length} cliente${open.length === 1 ? "" : "s"} con saldo`;

  const el = $("receivableList");
  if(!state.receivables.length){
    el.innerHTML = '<div class="empty-state">NO HAY CLIENTES DEUDORES REGISTRADOS</div>';
    return;
  }

  el.innerHTML = state.receivables.map(x => {
    const isOpen = ["pending","partial"].includes(x.status);
    const overdue = x.due_at && isOpen && new Date(`${x.due_at}T23:59:59`) < new Date();
    return `<div class="finance-row finance-row--receivable">
      <div class="finance-primary">
        <div class="finance-title-line"><strong>${escapeHtml(x.client_name)}</strong><span class="status-badge status-${x.status}">${statusLabel(x.status)}</span></div>
        <span>${escapeHtml(x.description || "Sin descripción")}${x.client_phone ? ` · ${escapeHtml(x.client_phone)}` : ""}</span>
      </div>
      <div class="finance-cell"><span>TOTAL</span><strong>${money(x.total_amount)}</strong></div>
      <div class="finance-cell"><span>PAGADO</span><strong>${money(x.paid_amount)}</strong></div>
      <div class="finance-cell finance-cell--main"><span>PENDIENTE</span><strong>${money(x.pending_amount)}</strong></div>
      <div class="finance-cell ${overdue ? "finance-cell--overdue" : ""}"><span>VENCIMIENTO</span><strong>${x.due_at ? dateOnly(x.due_at) : "Sin fecha"}</strong></div>
      <div class="finance-actions">
        ${isOpen ? `<button class="mini-btn" type="button" data-edit-receivable="${x.id}">EDITAR</button><button class="mini-btn mini-btn--primary" type="button" data-pay-receivable="${x.id}">COBRAR</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

function renderAudit(){
  const el = $("auditList");
  if(!state.audit.length){
    el.innerHTML = '<div class="empty-state">TODAVÍA NO HAY EVENTOS DE AUDITORÍA</div>';
    return;
  }

  el.innerHTML = state.audit.map(a => `
    <div class="audit-item">
      <div class="audit-action">${escapeHtml(a.action || "EVENTO")}</div>
      <div class="audit-copy"><strong>${escapeHtml(a.summary || "Registro")}</strong><span>${escapeHtml(a.actor_name || "Sistema")}</span></div>
      <div class="audit-time">${dateTime(a.created_at)}</div>
    </div>`).join("");
}

function switchView(view){
  $$(".page-view").forEach(v => v.classList.add("is-hidden"));
  const target = $(`view-${view}`);
  if(!target) return;
  target.classList.remove("is-hidden");

  $$(".nav-item,.mobile-nav-item").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));

  const labels = {
    dashboard:["IMPORTB2B · CAJA","DASHBOARD"],
    movements:["IMPORTB2B · CAJA","MOVIMIENTOS"],
    usdt:["BINANCE P2P","USDT / ARS"],
    settlements:["IMPORTB2B · PENDIENTES","DINERO A LIQUIDAR"],
    receivables:["IMPORTB2B · CLIENTES","DINERO A COBRAR"],
    audit:["SEGURIDAD INTERNA","AUDITORÍA"]
  };

  $("pageEyebrow").textContent = labels[view]?.[0] || "IMPORTB2B";
  $("pageTitle").textContent = labels[view]?.[1] || view.toUpperCase();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function openMovementModal(movement=null){
  state.editingMovement = movement;
  $("movementForm").reset();
  $("movementMessage").textContent = "";
  $("movementId").value = movement?.id || "";
  $("movementModalTitle").textContent = movement ? "EDITAR MOVIMIENTO" : "NUEVO MOVIMIENTO";
  $("movementSubmitBtn").textContent = movement ? "GUARDAR CAMBIOS" : "GUARDAR MOVIMIENTO";

  const generated = Boolean(movement?.source_type && movement.source_type !== "manual");
  if(generated){
    alert("Este movimiento fue generado automáticamente por una liquidación, un cobro o una transferencia interna. Debe gestionarse desde su módulo de origen.");
    state.editingMovement = null;
    return;
  }

  const kind = movement?.kind || "income";
  $("movementKind").value = kind;
  $$("#kindSegment .segment").forEach(x => x.classList.toggle("is-active", x.dataset.kind === kind));

  $("movementAmount").value = movement ? Number(movement.amount) : "";
  $("movementCurrency").value = movement?.currency || "ARS";
  $("movementMethod").value = movement?.payment_method || "transferencia";
  $("movementCategory").value = movement?.category || "VENTA";
  $("movementDescription").value = movement?.description || "";
  const movementHolder = movement?.currency === "USDT"
    ? movement?.usdt_holder
    : movement?.payment_method === "efectivo"
      ? movement?.cash_holder
      : movement?.transfer_holder;
  $("movementHolder").value = movementHolder || "nahuel";

  const originalOption = $("originalQuoteOption");
  originalOption.hidden = !Boolean(movement?.quote_ars);
  originalOption.classList.toggle("is-hidden", !Boolean(movement?.quote_ars));
  $("movementQuoteType").value = movement?.quote_ars ? "original" : "auto";

  syncMovementConditionalFields();
  $("movementModal").classList.remove("is-hidden");
}

function syncMovementConditionalFields(){
  const currency = $("movementCurrency").value;
  const isUsdt = currency === "USDT";

  if(isUsdt){
    $("movementMethod").value = "usdt";
    $("movementMethod").disabled = true;
    $("movementHolderLabel").textContent = "¿Quién tiene los USDT?";
  }else{
    $("movementMethod").disabled = false;
    if($("movementMethod").value === "usdt") $("movementMethod").value = "transferencia";
    $("movementHolderLabel").textContent = $("movementMethod").value === "efectivo"
      ? "¿Quién tiene el efectivo?"
      : "¿De quién es la cuenta?";
  }

  $("movementHolderWrap").classList.remove("is-hidden");
  $("quoteTypeWrap").classList.toggle("is-hidden", !isUsdt);
  $("usdtPreview").classList.toggle("is-hidden", !isUsdt);

  updateUsdtPreview();
}

function updateUsdtPreview(){
  if($("movementCurrency").value !== "USDT") return;
  const amount = Number($("movementAmount").value || 0);
  const q = currentQuoteFor($("movementKind").value, $("movementQuoteType").value);
  $("previewQuote").textContent = q.value ? money(q.value,2) : "$ —";
  $("previewEquivalent").textContent = q.value ? money(amount * q.value,2) : "$ —";
}

async function saveMovement(event){
  event.preventDefault();
  $("movementMessage").textContent = "";

  const id = $("movementId").value || null;
  const kind = $("movementKind").value;
  const amount = Number($("movementAmount").value);
  const currency = $("movementCurrency").value;
  let payment_method = $("movementMethod").value;
  const category = $("movementCategory").value;
  const description = $("movementDescription").value.trim();
  const holder = $("movementHolder").value;
  let cash_holder = null;
  let transfer_holder = null;
  let usdt_holder = null;

  if(currency === "ARS" && payment_method === "efectivo") cash_holder = holder;
  if(currency === "ARS" && payment_method === "transferencia") transfer_holder = holder;

  let quote_type = null;
  let quote_ars = null;
  let ars_equivalent = amount;

  if(currency === "USDT"){
    payment_method = "usdt";
    usdt_holder = holder;
    const q = currentQuoteFor(kind, $("movementQuoteType").value);
    if(!q.value){
      $("movementMessage").textContent = "No hay cotización USDT disponible. Actualizá Binance o cargá una manual.";
      return;
    }
    quote_type = q.type;
    quote_ars = Number(q.value);
    ars_equivalent = amount * quote_ars;
  }

  const row = {
    kind, amount, currency, payment_method, category, description,
    quote_type, quote_ars, ars_equivalent,
    cash_holder, transfer_holder, usdt_holder,
    source_type:id ? (state.editingMovement?.source_type || "manual") : "manual"
  };

  if(state.demo){
    if(id){
      const i = state.movements.findIndex(x => x.id === id);
      state.movements[i] = { ...state.movements[i], ...row, edited_at:new Date().toISOString(), edited_by_name:"Demo" };
    }else{
      state.movements.unshift({ ...row, id:crypto.randomUUID(), occurred_at:new Date().toISOString(), created_at:new Date().toISOString(), created_by_name:"Demo" });
    }
    closeNamedModal("movement");
    renderAll();
    return;
  }

  let result;
  if(id){
    result = await supabase.from("movements").update(row).eq("id", id);
  }else{
    result = await supabase.from("movements").insert({ ...row, created_by:state.user.id });
  }

  if(result.error){
    $("movementMessage").textContent = result.error.message;
    return;
  }

  closeNamedModal("movement");
  state.editingMovement = null;
  await Promise.all([loadMovements(), loadAudit()]);
  renderAll();
}

async function deleteMovement(movement){
  const generated = Boolean(movement?.source_type && movement.source_type !== "manual");
  if(generated){
    alert("Este movimiento fue generado automáticamente y no puede eliminarse desde Movimientos. Gestioná el registro desde su módulo de origen.");
    return;
  }

  const amountText = movement.currency === "USDT"
    ? `${num(movement.amount)} USDT`
    : money(movement.amount);

  const confirmed = window.confirm(
    `¿Eliminar definitivamente este movimiento?\n\n${movement.category || "MOVIMIENTO"} · ${amountText}\n\nSe quitará de la caja y de los saldos. La eliminación seguirá registrada en Auditoría.`
  );
  if(!confirmed) return;

  if(state.demo){
    state.movements = state.movements.filter(x => x.id !== movement.id);
    renderAll();
    return;
  }

  const { error } = await supabase.from("movements").delete().eq("id", movement.id);
  if(error){
    alert(`No se pudo eliminar: ${error.message}`);
    return;
  }

  await Promise.all([loadMovements(), loadAudit()]);
  renderAll();
}

async function setManualQuote(event){
  event.preventDefault();
  const buy = Number($("manualBuy").value);
  const sell = Number($("manualSell").value);
  if(!buy || !sell) return;

  state.quote = { buy, sell, source:"MANUAL", updatedAt:new Date().toISOString(), mode:"manual" };
  if(!state.demo) await saveQuoteSnapshotIfChanged();
  renderQuote();
  renderDashboard();
  updateUsdtPreview();
}

function openSettlementModal(item=null){
  $("settlementForm").reset();
  $("settlementMessage").textContent = "";
  $("settlementId").value = item?.id || "";
  $("settlementModalTitle").textContent = item ? "EDITAR LIQUIDACIÓN" : "NUEVA LIQUIDACIÓN";
  $("settlementProvider").value = item?.provider || "go_cuotas";
  $("settlementGross").value = item ? Number(item.gross_amount) : "";
  $("settlementFees").value = item ? Number(item.fees_amount) : 0;
  $("settlementExpected").value = item?.expected_at ? String(item.expected_at).slice(0,10) : "";
  $("settlementDescription").value = item?.description || "";
  updateSettlementNetPreview();
  $("settlementModal").classList.remove("is-hidden");
}

function updateSettlementNetPreview(){
  const gross = Number($("settlementGross").value || 0);
  const fees = Number($("settlementFees").value || 0);
  $("settlementNetPreview").querySelector("strong").textContent = money(Math.max(0, gross - fees));
}

async function saveSettlement(event){
  event.preventDefault();
  $("settlementMessage").textContent = "";

  const id = $("settlementId").value || null;
  const gross = Number($("settlementGross").value);
  const fees = Number($("settlementFees").value || 0);

  if(fees > gross){
    $("settlementMessage").textContent = "Las comisiones no pueden superar el importe bruto.";
    return;
  }

  const row = {
    provider:$("settlementProvider").value,
    description:$("settlementDescription").value.trim(),
    gross_amount:gross,
    fees_amount:fees,
    expected_at:$("settlementExpected").value || null
  };

  if(state.demo){
    closeNamedModal("settlement");
    return;
  }

  let result;
  if(id) result = await supabase.from("settlements").update(row).eq("id", id).eq("status","pending");
  else result = await supabase.from("settlements").insert({ ...row, created_by:state.user.id });

  if(result.error){
    $("settlementMessage").textContent = result.error.message;
    return;
  }

  closeNamedModal("settlement");
  await Promise.all([loadSettlements(), loadAudit()]);
  renderAll();
}

function openSettleFundsModal(item){
  $("settleFundsForm").reset();
  $("settleFundsMessage").textContent = "";
  $("settleFundsId").value = item.id;
  $("settleFundsSummary").querySelector("strong").textContent = money(item.net_amount);
  $("settleDestinationMethod").value = "transferencia";
  $("settleHolder").value = "nahuel";
  syncSettleHolderLabel();
  $("settleFundsModal").classList.remove("is-hidden");
}

function syncSettleHolderLabel(){
  $("settleHolderLabel").textContent = $("settleDestinationMethod").value === "efectivo"
    ? "¿Quién recibió el efectivo?"
    : "¿De quién es la cuenta?";
}

async function settleFunds(event){
  event.preventDefault();
  $("settleFundsMessage").textContent = "";

  if(state.demo){
    closeNamedModal("settleFunds");
    return;
  }

  const method = $("settleDestinationMethod").value;
  const holder = $("settleHolder").value;
  const { error } = await supabase.rpc("settle_pending_funds_v2", {
    p_settlement_id:$("settleFundsId").value,
    p_destination_method:method,
    p_holder:holder
  });

  if(error){
    $("settleFundsMessage").textContent = error.message;
    return;
  }

  closeNamedModal("settleFunds");
  await Promise.all([loadSettlements(), loadMovements(), loadAudit()]);
  renderAll();
}

function openReceivableModal(item=null){
  $("receivableForm").reset();
  $("receivableMessage").textContent = "";
  $("receivableId").value = item?.id || "";
  $("receivableModalTitle").textContent = item ? "EDITAR DEUDOR" : "NUEVO DEUDOR";
  $("receivableClient").value = item?.client_name || "";
  $("receivablePhone").value = item?.client_phone || "";
  $("receivableTotal").value = item ? Number(item.total_amount) : "";
  $("receivableDue").value = item?.due_at ? String(item.due_at).slice(0,10) : "";
  $("receivableDescription").value = item?.description || "";
  $("receivableModal").classList.remove("is-hidden");
}

async function saveReceivable(event){
  event.preventDefault();
  $("receivableMessage").textContent = "";

  const id = $("receivableId").value || null;
  const total = Number($("receivableTotal").value);
  const current = id ? state.receivables.find(x => x.id === id) : null;

  if(current && total < Number(current.paid_amount || 0)){
    $("receivableMessage").textContent = `El total no puede ser menor a lo ya cobrado (${money(current.paid_amount)}).`;
    return;
  }

  const row = {
    client_name:$("receivableClient").value.trim(),
    client_phone:$("receivablePhone").value.trim() || null,
    description:$("receivableDescription").value.trim(),
    total_amount:total,
    due_at:$("receivableDue").value || null
  };

  if(state.demo){
    closeNamedModal("receivable");
    return;
  }

  let result;
  if(id) result = await supabase.from("receivables").update(row).eq("id", id);
  else result = await supabase.from("receivables").insert({ ...row, paid_amount:0, status:"pending", created_by:state.user.id });

  if(result.error){
    $("receivableMessage").textContent = result.error.message;
    return;
  }

  closeNamedModal("receivable");
  await Promise.all([loadReceivables(), loadAudit()]);
  renderAll();
}

function openReceivablePaymentModal(item){
  $("receivablePaymentForm").reset();
  $("receivablePaymentMessage").textContent = "";
  $("receivablePaymentId").value = item.id;
  $("receivablePaymentSummary").querySelector("strong").textContent = money(item.pending_amount);
  $("receivablePaymentAmount").max = Number(item.pending_amount);
  $("receivablePaymentAmount").value = Number(item.pending_amount);
  $("receivablePaymentMethod").value = "transferencia";
  $("receivablePaymentHolder").value = "nahuel";
  syncReceivablePaymentHolderLabel();
  $("receivablePaymentModal").classList.remove("is-hidden");
}

function syncReceivablePaymentHolderLabel(){
  $("receivablePaymentHolderLabel").textContent = $("receivablePaymentMethod").value === "efectivo"
    ? "¿Quién recibió el efectivo?"
    : "¿De quién es la cuenta?";
}

async function recordReceivablePayment(event){
  event.preventDefault();
  $("receivablePaymentMessage").textContent = "";

  if(state.demo){
    closeNamedModal("receivablePayment");
    return;
  }

  const method = $("receivablePaymentMethod").value;
  const holder = $("receivablePaymentHolder").value;
  const { error } = await supabase.rpc("record_receivable_payment_v2", {
    p_receivable_id:$("receivablePaymentId").value,
    p_amount:Number($("receivablePaymentAmount").value),
    p_payment_method:method,
    p_holder:holder
  });

  if(error){
    $("receivablePaymentMessage").textContent = error.message;
    return;
  }

  closeNamedModal("receivablePayment");
  await Promise.all([loadReceivables(), loadMovements(), loadAudit()]);
  renderAll();
}

function openInternalTransferModal(){
  $("internalTransferForm").reset();
  $("internalTransferMessage").textContent = "";
  $("internalCurrency").value = "ARS";
  $("internalFromMethod").value = "transferencia";
  $("internalFromHolder").value = "nahuel";
  $("internalToMethod").value = "transferencia";
  $("internalToHolder").value = "esteban";
  syncInternalTransferCurrency();
  $("internalTransferModal").classList.remove("is-hidden");
}

function syncInternalTransferCurrency(){
  const isUsdt = $("internalCurrency").value === "USDT";
  ["internalFromMethod","internalToMethod"].forEach(id => {
    const select = $(id);
    if(isUsdt){
      select.innerHTML = '<option value="usdt">USDT</option>';
      select.value = "usdt";
      select.disabled = true;
    }else{
      select.innerHTML = '<option value="transferencia">TRANSFERENCIA</option><option value="efectivo">EFECTIVO</option>';
      select.disabled = false;
    }
  });
  $("internalQuoteNote").classList.toggle("is-hidden", !isUsdt);
  validateInternalTransferSides();
}

function validateInternalTransferSides(){
  const same = $("internalFromMethod").value === $("internalToMethod").value &&
               $("internalFromHolder").value === $("internalToHolder").value;
  $("internalTransferMessage").textContent = same
    ? "El origen y el destino deben ser diferentes."
    : "";
}

async function saveInternalTransfer(event){
  event.preventDefault();
  $("internalTransferMessage").textContent = "";

  const currency = $("internalCurrency").value;
  const amount = Number($("internalAmount").value);
  const fromMethod = $("internalFromMethod").value;
  const fromHolder = $("internalFromHolder").value;
  const toMethod = $("internalToMethod").value;
  const toHolder = $("internalToHolder").value;

  if(fromMethod === toMethod && fromHolder === toHolder){
    $("internalTransferMessage").textContent = "El origen y el destino deben ser diferentes.";
    return;
  }

  if(currency === "USDT" && !state.quote.sell){
    $("internalTransferMessage").textContent = "No hay cotización USDT disponible. Actualizá Binance primero.";
    return;
  }

  if(state.demo){
    closeNamedModal("internalTransfer");
    return;
  }

  const { error } = await supabase.rpc("record_internal_transfer", {
    p_currency:currency,
    p_amount:amount,
    p_from_method:fromMethod,
    p_from_holder:fromHolder,
    p_to_method:toMethod,
    p_to_holder:toHolder,
    p_quote_ars:currency === "USDT" ? Number(state.quote.sell) : null,
    p_description:$("internalDescription").value.trim() || null
  });

  if(error){
    $("internalTransferMessage").textContent = error.message;
    return;
  }

  closeNamedModal("internalTransfer");
  await Promise.all([loadMovements(), loadAudit()]);
  renderAll();
}

init();
