const STORAGE_KEY = "fund-web-holdings-v1";
const DEFAULT_FUNDS = [
  { code: "002834", name: "华夏新锦绣灵活配置混合C", cost: 3.0508, num: 3081.21 },
  { code: "025422", name: "浦银安盛数字经济混合C", cost: 1.5412, num: 1944.19 },
  { code: "018463", name: "德邦稳盈增长灵活配置混合C", cost: 1.1483, num: 2632.94 },
  { code: "457001", name: "国富亚洲机会股票(QDII)A", cost: 2.143, num: 933.29 },
  { code: "015790", name: "永赢高端装备智选混合C", cost: 1.6372, num: 1241.72 },
  { code: "000217", name: "华安黄金ETF联接C", cost: 4.0769, num: 0.52 },
];

const TEXT = {
  ready: "就绪",
  waiting: "等待你添加持仓",
  refreshing: "刷新中",
  fetching: "正在拉取基金数据...",
  online: "在线",
  refreshed: "数据已刷新",
  error: "异常",
  fetchError: "接口拉取失败，请稍后重试",
  noFunds: "还没有基金持仓，先点“新增持仓”或“图片识别”开始。",
  noData: "暂无持仓数据",
  latestDatePrefix: "最新估值日期：",
  today: "今日",
  fundFallback: "基金",
  sharePrefix: "份额",
  navPrefix: "净值",
  lastRefreshPrefix: "上次刷新：",
  estimateTimePrefix: "估值时间",
  finalNavPrefix: "最新净值",
  previousNavPrefix: "上一交易日净值",
};

const state = {
  funds: [],
  quotes: {},
  hideAmount: false,
  lastUpdated: "",
  sourceMode: "auto",
  statusTimer: null,
  editingIndex: null,
  imageRows: [],
  imageFile: null,
  quickAddQuote: null,
  quickAddLookupCode: "",
  quickAddMode: "amount",
};

const nodes = {
  connectionStatus: document.getElementById("connectionStatus"),
  lastUpdated: document.getElementById("lastUpdated"),
  totalAmount: document.getElementById("totalAmount"),
  dailyProfit: document.getElementById("dailyProfit"),
  dailyRate: document.getElementById("dailyRate"),
  holdingProfit: document.getElementById("holdingProfit"),
  holdingRate: document.getElementById("holdingRate"),
  quoteDateHint: document.getElementById("quoteDateHint"),
  fundTableBody: document.getElementById("fundTableBody"),
  fundCount: document.getElementById("fundCount"),
  headDateToday: document.getElementById("headDateToday"),
  headDateNav: document.getElementById("headDateNav"),
  statusMessage: document.getElementById("statusMessage"),
  editorModal: document.getElementById("editorModal"),
  editorBackdrop: document.getElementById("editorBackdrop"),
  editorRows: document.getElementById("editorRows"),
  closeEditorBtn: document.getElementById("closeEditorBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  toolbarRefreshBtn: document.getElementById("toolbarRefreshBtn"),
  toggleEditorBtn: document.getElementById("toggleEditorBtn"),
  toolbarAddBtn: document.getElementById("toolbarAddBtn"),
  openImageImportBtn: document.getElementById("openImageImportBtn"),
  restoreDefaultsBtn: document.getElementById("restoreDefaultsBtn"),
  addRowBtn: document.getElementById("addRowBtn"),
  saveBtn: document.getElementById("saveBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importInput: document.getElementById("importInput"),
  privacyToggle: document.getElementById("privacyToggle"),
  editorRowTemplate: document.getElementById("editorRowTemplate"),
  addFundModal: document.getElementById("addFundModal"),
  addFundBackdrop: document.getElementById("addFundBackdrop"),
  closeAddFundBtn: document.getElementById("closeAddFundBtn"),
  cancelAddFundBtn: document.getElementById("cancelAddFundBtn"),
  quickAddCode: document.getElementById("quickAddCode"),
  quickAddName: document.getElementById("quickAddName"),
  modeAmountBtn: document.getElementById("modeAmountBtn"),
  modeShareBtn: document.getElementById("modeShareBtn"),
  quickAddAmount: document.getElementById("quickAddAmount"),
  quickAddProfit: document.getElementById("quickAddProfit"),
  quickAddShares: document.getElementById("quickAddShares"),
  quickAddCost: document.getElementById("quickAddCost"),
  quickAddPreview: document.getElementById("quickAddPreview"),
  saveQuickAddBtn: document.getElementById("saveQuickAddBtn"),
  imageImportModal: document.getElementById("imageImportModal"),
  imageImportBackdrop: document.getElementById("imageImportBackdrop"),
  closeImageImportBtn: document.getElementById("closeImageImportBtn"),
  cancelImageImportBtn: document.getElementById("cancelImageImportBtn"),
  imageImportInput: document.getElementById("imageImportInput"),
  uploadDropzone: document.getElementById("uploadDropzone"),
  imageImportFilename: document.getElementById("imageImportFilename"),
  startImageRecognizeBtn: document.getElementById("startImageRecognizeBtn"),
  addImageRowBtn: document.getElementById("addImageRowBtn"),
  clearImageRowsBtn: document.getElementById("clearImageRowsBtn"),
  imageRowsBody: document.getElementById("imageRowsBody"),
  imageRowTemplate: document.getElementById("imageRowTemplate"),
  imageImportStatus: document.getElementById("imageImportStatus"),
  imageImportSummary: document.getElementById("imageImportSummary"),
  confirmImageImportBtn: document.getElementById("confirmImageImportBtn"),
  sourceModeSelect: document.getElementById("sourceModeSelect"),
  sourceModeLabel: document.getElementById("sourceModeLabel"),
};

const SOURCE_MODE_LABELS = {
  auto: "自动优选",
  eastmoney: "东方财富",
  dayfund: "备源",
};

function getSourceModeLabel(mode) {
  return SOURCE_MODE_LABELS[mode] || SOURCE_MODE_LABELS.auto;
}

function syncSourceModeUI() {
  if (nodes.sourceModeSelect) {
    nodes.sourceModeSelect.value = state.sourceMode || "auto";
  }
  if (nodes.sourceModeLabel) {
    nodes.sourceModeLabel.textContent = getSourceModeLabel(state.sourceMode);
  }
}

function setStatusMessage(message, tone = "info") {
  if (!nodes.statusMessage) {
    return;
  }
  nodes.statusMessage.hidden = !message;
  nodes.statusMessage.textContent = message;
  nodes.statusMessage.dataset.tone = tone;
  if (state.statusTimer) {
    clearTimeout(state.statusTimer);
  }
  if (message) {
    state.statusTimer = setTimeout(() => {
      nodes.statusMessage.hidden = true;
      nodes.statusMessage.textContent = "";
      delete nodes.statusMessage.dataset.tone;
    }, 4000);
  }
}

function setInlineStatus(node, message, tone = "info") {
  if (!node) {
    return;
  }
  node.hidden = !message;
  node.textContent = message || "";
  if (message) {
    node.dataset.tone = tone;
  } else {
    delete node.dataset.tone;
  }
}

function loadFunds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT_FUNDS;
    const normalized = normalizeFunds(parsed);
    state.funds = normalized.length ? normalized : normalizeFunds(DEFAULT_FUNDS);
    if (!normalized.length) {
      persistFunds();
    }
  } catch {
    state.funds = normalizeFunds(DEFAULT_FUNDS);
    persistFunds();
  }
}

function persistFunds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.funds));
}

function normalizeFunds(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      code: String(item.code || "").trim(),
      name: String(item.name || "").trim(),
      num: toNumber(item.num),
      cost: toNumber(item.cost),
    }))
    .filter((item) => /^\d{6}$/.test(item.code));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  if (state.hideAmount) {
    return "******";
  }
  return toNumber(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  const num = toNumber(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function formatSignedMoney(value) {
  const num = toNumber(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${formatMoney(num)}`;
}

function formatNav(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(4) : "--";
}

function classForValue(value) {
  const num = toNumber(value, NaN);
  if (!Number.isFinite(num) || num === 0) {
    return "flat";
  }
  return num > 0 ? "up" : "down";
}

function mergeFund(fund) {
  const quote = state.quotes[fund.code] || {};
  const nav = toNumber(quote.nav);
  const estimate = toNumber(quote.gsz, NaN);
  const rawHasEstimate = Boolean(quote.hasEstimate) && Number.isFinite(estimate) && estimate > 0;
  const previousNav = toNumber(quote.prevNav, nav);
  const estimateDate = quote.estimateDate || "";
  const officialDate = quote.officialDate || quote.tradeDate || "";
  const settled = Boolean(officialDate && estimateDate && officialDate >= estimateDate) || (!rawHasEstimate && !!officialDate);
  const hasEstimate = rawHasEstimate && !settled;
  const valuationPrice = hasEstimate ? estimate : nav;
  const amount = valuationPrice * fund.num;
  const dailyRate = hasEstimate ? toNumber(quote.dailyRate) : toNumber(quote.navChangeRate);
  const dailyBaseNav = hasEstimate ? nav : previousNav;
  const dailyProfit = fund.num && dailyBaseNav ? (valuationPrice - dailyBaseNav) * fund.num : 0;
  const holdingProfit = fund.num && fund.cost ? (valuationPrice - fund.cost) * fund.num : 0;
  const holdingRate = fund.num && fund.cost ? (holdingProfit / (fund.cost * fund.num)) * 100 : 0;
  const previousAmount = previousNav * fund.num;
  const costAmount = fund.cost * fund.num;
  const navRate = nav && previousNav ? ((nav - previousNav) / previousNav) * 100 : 0;

  return {
    ...fund,
    nav,
    previousNav,
    valuationPrice,
    amount,
    dailyRate,
    dailyProfit,
    dailyBaseNav,
    holdingProfit,
    holdingRate,
    previousAmount,
    costAmount,
    navRate,
    hasEstimate,
    settled,
    estimateTime: quote.estimateTime || "",
    tradeDate: quote.tradeDate || "",
    previousDate: quote.previousDate || "",
    latestDate: quote.latestDate || "",
    estimateDate,
    officialDate,
    stale: Boolean(quote.stale),
  };
}

function setValueClass(node, value) {
  node.className = classForValue(value);
}

function updateSummary(mergedFunds) {
  const totalAmount = mergedFunds.reduce((sum, item) => sum + item.amount, 0);
  const dailyProfit = mergedFunds.reduce((sum, item) => sum + item.dailyProfit, 0);
  const holdingProfit = mergedFunds.reduce((sum, item) => sum + item.holdingProfit, 0);
  const totalPreviousAmount = mergedFunds.reduce((sum, item) => sum + item.previousAmount, 0);
  const totalCostAmount = mergedFunds.reduce((sum, item) => sum + item.costAmount, 0);
  const dailyRate = totalPreviousAmount ? (dailyProfit / totalPreviousAmount) * 100 : 0;
  const holdingRate = totalCostAmount ? (holdingProfit / totalCostAmount) * 100 : 0;

  nodes.totalAmount.textContent = formatMoney(totalAmount);
  nodes.dailyProfit.textContent = formatSignedMoney(dailyProfit);
  setValueClass(nodes.dailyProfit, dailyProfit);
  nodes.dailyRate.textContent = formatPercent(dailyRate);
  setValueClass(nodes.dailyRate, dailyRate);
  nodes.holdingProfit.textContent = formatSignedMoney(holdingProfit);
  setValueClass(nodes.holdingProfit, holdingProfit);
  nodes.holdingRate.textContent = formatPercent(holdingRate);
  setValueClass(nodes.holdingRate, holdingRate);
}

function getStatusMeta(item) {
  if (item.stale) {
    return { label: "缓存中", cls: "stale", note: "使用上次成功数据", showMetrics: false };
  }
  const estimateDate = item.estimateDate || item.latestDate || "";
  const officialDate = item.officialDate || item.tradeDate || "";
  const settled = Boolean(officialDate && estimateDate && officialDate >= estimateDate);
  if (settled || (!item.hasEstimate && officialDate)) {
    return {
      label: "已更新",
      cls: "current",
      note: officialDate ? `${officialDate} 已结转` : "已纳入当前收益",
      showMetrics: true,
    };
  }
  if (item.hasEstimate) {
    return {
      label: "待更新",
      cls: "pending",
      note: "待官方净值",
      showMetrics: false,
    };
  }
  return { label: "待确认", cls: "pending", note: "等待基金公司披露净值", showMetrics: false };
}

function renderTable() {
  const mergedFunds = state.funds.map(mergeFund);
  nodes.fundCount.textContent = String(mergedFunds.length);

  if (!mergedFunds.length) {
    nodes.fundTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">${TEXT.noFunds}</td></tr>`;
    nodes.quoteDateHint.textContent = TEXT.noData;
    nodes.headDateToday.textContent = "--";
    nodes.headDateNav.textContent = "--";
    updateSummary([]);
    return;
  }

  const latestDate = mergedFunds.map((item) => item.latestDate).filter(Boolean).sort().slice(-1)[0] || TEXT.today;
  const estimateTime = mergedFunds.map((item) => item.estimateTime).filter(Boolean).sort().slice(-1)[0] || "";
  nodes.quoteDateHint.textContent = estimateTime
    ? `${TEXT.latestDatePrefix}${latestDate} · ${TEXT.estimateTimePrefix} ${estimateTime.slice(11, 16)}`
    : `${TEXT.latestDatePrefix}${latestDate}`;
  nodes.headDateToday.textContent = latestDate;
  nodes.headDateNav.textContent = "按实际净值日";

  nodes.fundTableBody.innerHTML = mergedFunds.map((item, index) => {
    const status = getStatusMeta(item);
    const settledRate = item.navRate;
    const settledNav = item.nav;
    return `
      <tr>
        <td>
          <span class="fund-name">${escapeHtml(item.name || `${TEXT.fundFallback} ${item.code}`)}</span>
          <span class="fund-amount">${formatMoney(item.amount)}</span>
          <span class="fund-subtext">${TEXT.sharePrefix} ${item.num.toFixed(2)}</span>
        </td>
        <td>
          <span class="metric-main ${classForValue(item.dailyProfit)}">${formatSignedMoney(item.dailyProfit)}</span>
          <span class="metric-sub ${classForValue(item.dailyRate)}">${formatPercent(item.dailyRate)}</span>
          <span class="fund-subtext">基准净值 ${formatNav(item.dailyBaseNav)}</span>
        </td>
        <td>
          <span class="metric-main ${classForValue(item.navRate)}">${formatPercent(item.navRate)}</span>
          <span class="metric-sub flat">${item.tradeDate || item.previousDate || "--"}</span>
        </td>
        <td>
          <span class="metric-main ${classForValue(item.holdingProfit)}">${formatSignedMoney(item.holdingProfit)}</span>
          <span class="metric-sub ${classForValue(item.holdingRate)}">${formatPercent(item.holdingRate)}</span>
        </td>
        <td>
          <span class="tag-main">${formatNav(item.valuationPrice)}</span>
          <span class="fund-subtext">${item.hasEstimate ? `${TEXT.finalNavPrefix} ${formatNav(item.nav)}` : `${TEXT.navPrefix} ${formatNav(item.nav)}`}</span>
          <span class="fund-subtext">${TEXT.previousNavPrefix} ${formatNav(item.previousNav)}</span>
        </td>
        <td>
          <span class="status-pill ${status.cls}">${status.label}</span>
          ${status.showMetrics
            ? `<span class="metric-sub ${classForValue(settledRate)}">${formatPercent(settledRate)}</span>
               <span class="fund-subtext">${formatNav(settledNav)}</span>`
            : `<span class="fund-subtext mono">${item.code}</span>
               <span class="fund-subtext">${status.note}</span>`}
        </td>
        <td class="actions-cell">
          <button class="icon-btn" type="button" data-action="edit" data-index="${index}" aria-label="编辑这条持仓">✎</button>
          <button class="icon-btn danger" type="button" data-action="remove-fund" data-index="${index}" aria-label="删除这条持仓">🗑</button>
        </td>
      </tr>
    `;
  }).join("");

  updateSummary(mergedFunds);
}

function renderEditor() {
  nodes.editorRows.innerHTML = "";
  const rows = state.editingIndex !== null
    ? [state.funds[state.editingIndex] || { code: "", name: "", num: 0, cost: 0 }]
    : (state.funds.length ? state.funds : [{ code: "", name: "", num: 0, cost: 0 }]);
  rows.forEach((item) => appendEditorRow(item));
}

function appendEditorRow(item = { code: "", name: "", num: 0, cost: 0 }) {
  const fragment = nodes.editorRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".editor-row");
  row.querySelector('[data-field="code"]').value = item.code || "";
  row.querySelector('[data-field="name"]').value = item.name || "";
  row.querySelector('[data-field="num"]').value = item.num || "";
  row.querySelector('[data-field="cost"]').value = item.cost || "";
  row.querySelector('[data-action="remove"]').addEventListener("click", () => {
    row.remove();
    if (!nodes.editorRows.children.length) {
      appendEditorRow();
    }
  });
  nodes.editorRows.appendChild(fragment);
}

function collectEditorRows() {
  return Array.from(nodes.editorRows.querySelectorAll(".editor-row"))
    .map((row) => ({
      code: row.querySelector('[data-field="code"]').value.trim(),
      name: row.querySelector('[data-field="name"]').value.trim(),
      num: toNumber(row.querySelector('[data-field="num"]').value),
      cost: toNumber(row.querySelector('[data-field="cost"]').value),
    }))
    .filter((item) => /^\d{6}$/.test(item.code));
}

function openEditor(editingIndex = null) {
  state.editingIndex = Number.isInteger(editingIndex) ? editingIndex : null;
  renderEditor();
  nodes.editorModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeEditor() {
  state.editingIndex = null;
  nodes.editorModal.hidden = true;
  document.body.style.overflow = "";
}

function openAddFundModal() {
  state.quickAddQuote = null;
  state.quickAddLookupCode = "";
  state.quickAddMode = "amount";
  nodes.quickAddCode.value = "";
  nodes.quickAddName.value = "";
  nodes.quickAddAmount.value = "";
  nodes.quickAddProfit.value = "";
  nodes.quickAddShares.value = "";
  nodes.quickAddCost.value = "";
  updateQuickAddModeUI();
  nodes.quickAddPreview.textContent = "输入基金代码后，会自动校验名称和最新估值，并实时预览份额和成本。";
  nodes.addFundModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAddFundModal() {
  nodes.addFundModal.hidden = true;
  document.body.style.overflow = "";
}

function openImageImportModal() {
  nodes.imageImportModal.hidden = false;
  document.body.style.overflow = "hidden";
  setInlineStatus(nodes.imageImportStatus, "", "info");
  renderImageRows();
}

function closeImageImportModal() {
  nodes.imageImportModal.hidden = true;
  document.body.style.overflow = "";
}

function setImageFile(file) {
  state.imageFile = file || null;
  nodes.imageImportFilename.textContent = file ? `已选择：${file.name}` : "支持 JPG / PNG / WEBP";
}

function getImageRowValidation(rowData) {
  if (!/^\d{6}$/.test(rowData.code)) {
    return { level: "error", label: "代码有误" };
  }
  if (!(toNumber(rowData.amount) > 0)) {
    return { level: "error", label: "金额缺失" };
  }
  if (!rowData.name) {
    return { level: "warn", label: "待补名称" };
  }
  if (rowData.nameMismatch) {
    return { level: "warn", label: "名称待确认" };
  }
  return { level: "ok", label: "可以导入" };
}

function updateImageImportSummary() {
  const rows = state.imageRows;
  if (!rows.length) {
    nodes.imageImportSummary.textContent = "导入前会在这里显示新增、更新和待修复的统计。";
    return;
  }
  const summary = rows.reduce((acc, row) => {
    const validation = getImageRowValidation(row);
    if (validation.level === "error") {
      acc.invalid += 1;
    } else if (validation.level === "warn") {
      acc.warn += 1;
    } else {
      acc.valid += 1;
    }
    if (state.funds.some((item) => item.code === row.code)) {
      acc.updates += 1;
    } else if (/^\d{6}$/.test(row.code)) {
      acc.creates += 1;
    }
    return acc;
  }, { valid: 0, warn: 0, invalid: 0, creates: 0, updates: 0 });
  nodes.imageImportSummary.textContent =
    `本次共 ${rows.length} 条识别结果，可直接导入 ${summary.valid} 条，待确认 ${summary.warn} 条，需修复 ${summary.invalid} 条；其中新增 ${summary.creates} 条，更新 ${summary.updates} 条。`;
}

function renderImageRows() {
  const rows = state.imageRows;
  if (!rows.length) {
    nodes.imageRowsBody.innerHTML = '<tr><td colspan="6" class="empty-row">暂无识别结果</td></tr>';
    updateImageImportSummary();
    return;
  }

  nodes.imageRowsBody.innerHTML = "";
  rows.forEach((rowData, index) => {
    const fragment = nodes.imageRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".ocr-row");
    const validation = getImageRowValidation(rowData);
    row.dataset.index = String(index);
    row.dataset.valid = validation.level === "ok" ? "true" : "false";
    row.dataset.nameMismatch = String(Boolean(rowData.nameMismatch));
    row.querySelector('[data-field="code"]').value = rowData.code || "";
    row.querySelector('[data-field="name"]').value = rowData.name || "";
    row.querySelector('[data-field="amount"]').value = rowData.amount ?? "";
    row.querySelector('[data-field="profit"]').value = rowData.profit ?? "";
    const status = row.querySelector('[data-field="status"]');
    status.textContent = validation.label;
    status.className = `ocr-status ${validation.level}`;
    nodes.imageRowsBody.appendChild(fragment);
  });
  updateImageImportSummary();
}

function syncImageRowsFromDom() {
  state.imageRows = Array.from(nodes.imageRowsBody.querySelectorAll(".ocr-row")).map((row) => {
    const nextRow = {
      code: row.querySelector('[data-field="code"]').value.trim(),
      name: row.querySelector('[data-field="name"]').value.trim(),
      amount: toNumber(row.querySelector('[data-field="amount"]').value),
      profit: toNumber(row.querySelector('[data-field="profit"]').value),
      nameMismatch: row.dataset.nameMismatch === "true",
    };
    return nextRow;
  });
}

function updateSingleImageRow(rowElement) {
  const rowData = {
    code: rowElement.querySelector('[data-field="code"]').value.trim(),
    name: rowElement.querySelector('[data-field="name"]').value.trim(),
    amount: toNumber(rowElement.querySelector('[data-field="amount"]').value),
    profit: toNumber(rowElement.querySelector('[data-field="profit"]').value),
    nameMismatch: rowElement.dataset.nameMismatch === "true",
  };
  const validation = getImageRowValidation(rowData);
  rowElement.dataset.valid = validation.level === "ok" ? "true" : "false";
  const status = rowElement.querySelector('[data-field="status"]');
  status.textContent = validation.label;
  status.className = `ocr-status ${validation.level}`;
}

function appendImageRow(item = { code: "", name: "", amount: 0, profit: 0 }) {
  syncImageRowsFromDom();
  state.imageRows.push(item);
  renderImageRows();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadHoldings() {
  const blob = new Blob([JSON.stringify(state.funds, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fund-holdings.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatusMessage("持仓已导出", "success");
}

async function importHoldings(file) {
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeFunds(parsed);
    if (!normalized.length) {
      throw new Error("empty");
    }
    state.funds = normalized;
    persistFunds();
    renderEditor();
    renderTable();
    await refreshQuotes();
    setStatusMessage("持仓已导入并刷新", "success");
  } catch {
    setStatusMessage("导入失败，请选择正确的 JSON 持仓文件", "error");
  } finally {
    nodes.importInput.value = "";
  }
}

async function restoreDefaultFunds() {
  state.funds = normalizeFunds(DEFAULT_FUNDS);
  persistFunds();
  renderEditor();
  renderTable();
  await refreshQuotes();
  setStatusMessage("已恢复默认持仓", "success");
}

async function loadSourceMode() {
  try {
    const response = await fetch("/api/source-config");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.sourceMode = payload.mode || "auto";
    syncSourceModeUI();
  } catch (error) {
    console.error(error);
    state.sourceMode = "auto";
    syncSourceModeUI();
    setStatusMessage("数据源配置读取失败，已回退到自动优选", "error");
  }
}

async function saveSourceMode(mode) {
  const response = await fetch("/api/source-config", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  state.sourceMode = payload.mode || "auto";
  syncSourceModeUI();
  return state.sourceMode;
}

async function fetchQuotesMap(codes) {
  const uniqueCodes = [...new Set(codes.filter((code) => /^\d{6}$/.test(code)))];
  if (!uniqueCodes.length) {
    return {};
  }
  const query = new URLSearchParams({
    codes: uniqueCodes.join(","),
    source: state.sourceMode || "auto",
  });
  const response = await fetch(`/api/quotes?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.source_mode) {
    state.sourceMode = payload.source_mode;
    syncSourceModeUI();
  }
  return payload.quotes || {};
}

async function fetchQuoteForCode(code) {
  const quotes = await fetchQuotesMap([code]);
  const quote = quotes[code];
  if (!quote) {
    throw new Error("未找到该基金代码对应的行情数据");
  }
  return quote;
}

function buildHoldingFromAmountProfit(base, quote) {
  const valuationPrice = toNumber(quote.gsz, toNumber(quote.nav));
  const amount = toNumber(base.amount);
  const profit = toNumber(base.profit);
  if (!(/^\d{6}$/.test(base.code))) {
    throw new Error("基金代码必须是 6 位数字");
  }
  if (!(valuationPrice > 0)) {
    throw new Error(`基金 ${base.code} 当前估值不可用`);
  }
  if (!(amount > 0)) {
    throw new Error(`基金 ${base.code} 的持仓金额必须大于 0`);
  }
  const num = amount / valuationPrice;
  const costAmount = amount - profit;
  const cost = num > 0 ? costAmount / num : 0;
  return {
    code: base.code,
    name: String(base.name || quote.name || "").trim(),
    num,
    cost,
  };
}

function buildHoldingFromSharesCost(base, quote) {
  const num = toNumber(base.num);
  const cost = toNumber(base.cost);
  if (!/^\d{6}$/.test(base.code)) {
    throw new Error("基金代码必须是 6 位数字");
  }
  if (!(num > 0)) {
    throw new Error(`基金 ${base.code} 的持有份额必须大于 0`);
  }
  if (!(cost >= 0)) {
    throw new Error(`基金 ${base.code} 的持仓成本不能为负数`);
  }
  return {
    code: base.code,
    name: String(base.name || quote.name || "").trim(),
    num,
    cost,
  };
}

function updateQuickAddModeUI() {
  const isAmount = state.quickAddMode === "amount";
  nodes.modeAmountBtn.classList.toggle("is-active", isAmount);
  nodes.modeShareBtn.classList.toggle("is-active", !isAmount);
  document.querySelectorAll(".quick-mode-amount").forEach((node) => {
    node.hidden = !isAmount;
  });
  document.querySelectorAll(".quick-mode-share").forEach((node) => {
    node.hidden = isAmount;
  });
}

function getQuickAddInput() {
  return {
    code: nodes.quickAddCode.value.trim(),
    name: nodes.quickAddName.value.trim(),
    amount: toNumber(nodes.quickAddAmount.value),
    profit: toNumber(nodes.quickAddProfit.value),
    num: toNumber(nodes.quickAddShares.value),
    cost: toNumber(nodes.quickAddCost.value),
  };
}

function updateQuickAddPreview() {
  const input = getQuickAddInput();
  if (!/^\d{6}$/.test(input.code)) {
    nodes.quickAddPreview.textContent = "输入 6 位基金代码后，会自动校验基金名称并试算份额、成本。";
    return;
  }

  const quote = state.quickAddQuote;
  if (!quote || state.quickAddLookupCode !== input.code) {
    nodes.quickAddPreview.textContent = "代码已输入，失焦后会自动查询基金名称和最新估值。";
    return;
  }

  try {
    const fund = state.quickAddMode === "amount"
      ? buildHoldingFromAmountProfit(input, quote)
      : buildHoldingFromSharesCost(input, quote);
    const valuationPrice = toNumber(quote.gsz, toNumber(quote.nav));
    const estimatedAmount = fund.num * valuationPrice;
    const estimatedProfit = estimatedAmount - fund.num * fund.cost;
    nodes.quickAddPreview.textContent =
      `基金：${fund.name || input.code} · 当前估值 ${formatNav(valuationPrice)} · 预计份额 ${fund.num.toFixed(2)} · 推算成本 ${formatNav(fund.cost)} · 当前市值 ${estimatedAmount.toFixed(2)} · 持有收益 ${estimatedProfit.toFixed(2)}`;
  } catch (error) {
    nodes.quickAddPreview.textContent = error instanceof Error ? error.message : "试算失败";
  }
}

async function hydrateQuickAddCode() {
  const code = nodes.quickAddCode.value.trim();
  state.quickAddLookupCode = code;
  state.quickAddQuote = null;
  if (!/^\d{6}$/.test(code)) {
    updateQuickAddPreview();
    return;
  }
  try {
    nodes.quickAddPreview.textContent = "正在查询基金名称和最新估值...";
    const quote = await fetchQuoteForCode(code);
    if (state.quickAddLookupCode !== code) {
      return;
    }
    state.quickAddQuote = quote;
    if (!nodes.quickAddName.value.trim()) {
      nodes.quickAddName.value = quote.name || "";
    }
    updateQuickAddPreview();
  } catch (error) {
    if (state.quickAddLookupCode === code) {
      nodes.quickAddPreview.textContent = error instanceof Error ? error.message : "基金代码校验失败";
    }
  }
}

function upsertFund(nextFund) {
  const index = state.funds.findIndex((item) => item.code === nextFund.code);
  if (index >= 0) {
    state.funds.splice(index, 1, nextFund);
  } else {
    state.funds.push(nextFund);
  }
}

async function saveQuickAdd() {
  const input = getQuickAddInput();
  const code = input.code;
  if (!/^\d{6}$/.test(code)) {
    nodes.quickAddPreview.textContent = "请先输入正确的 6 位基金代码。";
    return;
  }
  try {
    nodes.saveQuickAddBtn.disabled = true;
    nodes.quickAddPreview.textContent = "正在校验基金代码并换算持仓...";
    const quote = await fetchQuoteForCode(code);
    const fund = state.quickAddMode === "amount"
      ? buildHoldingFromAmountProfit(input, quote)
      : buildHoldingFromSharesCost(input, quote);
    upsertFund(fund);
    persistFunds();
    renderTable();
    await refreshQuotes();
    closeAddFundModal();
    setStatusMessage(`已保存 ${fund.name || code}`, "success");
  } catch (error) {
    nodes.quickAddPreview.textContent = error instanceof Error ? error.message : "新增持仓失败";
  } finally {
    nodes.saveQuickAddBtn.disabled = false;
  }
}

function extractName(text) {
  return text
    .replace(/\b\d{6}\b/g, " ")
    .replace(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?%?/g, " ")
    .replace(/[0-9]{2}[:-][0-9]{2}/g, " ")
    .replace(/上一交易日净值|最新净值|持仓金额|持有收益|更新持仓|晚间统一结转|已更新|待更新|缓存中/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyCandidates(text) {
  const matches = text.match(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  return matches
    .map((item) => item.replaceAll(",", ""))
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function groupWordsByRow(words, tolerance = 18) {
  const rows = [];
  words
    .filter((word) => String(word.text || "").trim())
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .forEach((word) => {
      const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
      const row = rows.find((item) => Math.abs(item.centerY - centerY) <= tolerance);
      if (row) {
        row.words.push(word);
        row.centerY = (row.centerY + centerY) / 2;
      } else {
        rows.push({ centerY, words: [word] });
      }
    });

  return rows.map((row) => ({
    ...row,
    words: row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0),
  }));
}

function parseRowsFromWords(words, imageWidth) {
  const rows = groupWordsByRow(words, 20);
  const result = [];

  for (const row of rows) {
    const lineText = row.words.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim();
    const codeMatch = lineText.match(/\b\d{6}\b/);
    if (!codeMatch) {
      continue;
    }

    const columns = Array.from({ length: 7 }, () => []);
    for (const word of row.words) {
      const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
      const ratio = centerX / imageWidth;
      let index = 6;
      if (ratio < 0.28) index = 0;
      else if (ratio < 0.39) index = 1;
      else if (ratio < 0.50) index = 2;
      else if (ratio < 0.62) index = 3;
      else if (ratio < 0.77) index = 4;
      else if (ratio < 0.92) index = 5;
      columns[index].push(word.text);
    }

    const firstColumnText = columns[0].join(" ");
    const holdProfitText = columns[3].join(" ") || lineText;
    const name = extractName(firstColumnText) || extractName(lineText);
    const amount = parseMoneyCandidates(firstColumnText).find((value) => value > 1 && Math.abs(value) < 100000000);
    const profit = parseMoneyCandidates(holdProfitText).find((value) => Math.abs(value) > 0.01 && Math.abs(value) < 100000000);

    result.push({
      code: codeMatch[0],
      name,
      amount: amount ?? 0,
      profit: profit ?? 0,
    });
  }

  return dedupeRows(result);
}

function dedupeRows(rows) {
  const map = new Map();
  rows.forEach((item) => {
    if (!/^\d{6}$/.test(item.code)) {
      return;
    }
    if (!map.has(item.code)) {
      map.set(item.code, item);
      return;
    }
    const current = map.get(item.code);
    if ((!current.amount || !current.profit) && (item.amount || item.profit)) {
      map.set(item.code, item);
    }
  });
  return [...map.values()];
}

async function enrichImageRowsWithQuotes() {
  const codes = state.imageRows.map((item) => item.code).filter((code) => /^\d{6}$/.test(code));
  if (!codes.length) {
    renderImageRows();
    return;
  }
  const quotes = await fetchQuotesMap(codes);
  state.imageRows = state.imageRows.map((row) => {
    const quote = quotes[row.code];
    if (!quote) {
      return { ...row, nameMismatch: false };
    }
    const normalizedInput = String(row.name || "").replace(/\s+/g, "").trim();
    const normalizedQuote = String(quote.name || "").replace(/\s+/g, "").trim();
    return {
      ...row,
      name: row.name || quote.name || "",
      nameMismatch: Boolean(normalizedInput && normalizedQuote && normalizedInput !== normalizedQuote),
    };
  });
  renderImageRows();
}

async function startImageRecognize() {
  if (!state.imageFile) {
    setInlineStatus(nodes.imageImportStatus, "请先选择一张持仓截图。", "error");
    return;
  }
  if (!window.Tesseract) {
    setInlineStatus(nodes.imageImportStatus, "当前浏览器没有成功加载 OCR 组件，请稍后刷新重试。", "error");
    return;
  }

  try {
    nodes.startImageRecognizeBtn.disabled = true;
    setInlineStatus(nodes.imageImportStatus, "正在识别图片内容，首次识别会稍慢一些...", "info");
    const result = await window.Tesseract.recognize(state.imageFile, "chi_sim+eng", {
      logger(message) {
        if (message.status === "recognizing text") {
          const progress = Math.round((message.progress || 0) * 100);
          setInlineStatus(nodes.imageImportStatus, `正在识别图片内容... ${progress}%`, "info");
        }
      },
    });
    const parsedRows = parseRowsFromWords(result.data.words || [], result.data.width || 1);
    state.imageRows = parsedRows.length ? parsedRows : [{ code: "", name: "", amount: 0, profit: 0 }];
    await enrichImageRowsWithQuotes();
    setInlineStatus(nodes.imageImportStatus, parsedRows.length ? `识别完成，共提取 ${parsedRows.length} 条记录，已自动补基金名称，请确认后导入。` : "没有识别到有效持仓，请手动补录后导入。", parsedRows.length ? "success" : "error");
  } catch (error) {
    console.error(error);
    setInlineStatus(nodes.imageImportStatus, "图片识别失败，请换一张更清晰的截图或手动补录。", "error");
  } finally {
    nodes.startImageRecognizeBtn.disabled = false;
  }
}

async function confirmImageImport() {
  syncImageRowsFromDom();
  const validRows = state.imageRows.filter((item) => /^\d{6}$/.test(item.code) && item.amount > 0);
  if (!validRows.length) {
    setInlineStatus(nodes.imageImportStatus, "请至少保留一条带基金代码和持仓金额的记录。", "error");
    return;
  }

  try {
    nodes.confirmImageImportBtn.disabled = true;
    setInlineStatus(nodes.imageImportStatus, "正在校验基金并导入持仓...", "info");
    const quotes = await fetchQuotesMap(validRows.map((item) => item.code));
    let createdCount = 0;
    let updatedCount = 0;
    validRows.forEach((row) => {
      const quote = quotes[row.code];
      if (!quote) {
        throw new Error(`基金 ${row.code} 暂时无法获取行情`);
      }
      const exists = state.funds.some((item) => item.code === row.code);
      upsertFund(buildHoldingFromAmountProfit(row, quote));
      if (exists) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    });
    persistFunds();
    renderTable();
    await refreshQuotes();
    closeImageImportModal();
    setStatusMessage(`已导入 ${validRows.length} 条持仓，新增 ${createdCount} 条，更新 ${updatedCount} 条`, "success");
  } catch (error) {
    setInlineStatus(nodes.imageImportStatus, error instanceof Error ? error.message : "导入失败", "error");
  } finally {
    nodes.confirmImageImportBtn.disabled = false;
  }
}

async function hydrateSingleImageRow(rowElement) {
  const codeInput = rowElement.querySelector('[data-field="code"]');
  const nameInput = rowElement.querySelector('[data-field="name"]');
  const code = codeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    updateSingleImageRow(rowElement);
    syncImageRowsFromDom();
    updateImageImportSummary();
    return;
  }
  try {
    const quote = await fetchQuoteForCode(code);
    const currentName = nameInput.value.trim();
    if (!currentName) {
      nameInput.value = quote.name || "";
    }
    const normalizedCurrent = currentName.replace(/\s+/g, "");
    const normalizedQuote = String(quote.name || "").replace(/\s+/g, "");
    rowElement.dataset.nameMismatch = String(Boolean(normalizedCurrent && normalizedQuote && normalizedCurrent !== normalizedQuote));
    updateSingleImageRow(rowElement);
    syncImageRowsFromDom();
    const rowIndex = Number(rowElement.dataset.index);
    if (Number.isInteger(rowIndex) && state.imageRows[rowIndex]) {
      state.imageRows[rowIndex].nameMismatch = Boolean(normalizedCurrent && normalizedQuote && normalizedCurrent !== normalizedQuote);
      if (!currentName) {
        state.imageRows[rowIndex].name = quote.name || "";
      }
    }
    renderImageRows();
  } catch {
    updateSingleImageRow(rowElement);
    syncImageRowsFromDom();
    updateImageImportSummary();
  }
}

async function refreshQuotes() {
  if (!state.funds.length) {
    renderTable();
    nodes.connectionStatus.textContent = TEXT.ready;
    nodes.lastUpdated.textContent = TEXT.waiting;
    return;
  }

  const codes = state.funds.map((item) => item.code).join(",");
  nodes.connectionStatus.textContent = TEXT.refreshing;
  nodes.lastUpdated.textContent = TEXT.fetching;

  try {
    const query = new URLSearchParams({
      codes,
      source: state.sourceMode || "auto",
    });
    const response = await fetch(`/api/quotes?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.quotes = payload.quotes || {};
    state.lastUpdated = payload.updated_at || "";
    state.sourceMode = payload.source_mode || state.sourceMode || "auto";
    syncSourceModeUI();
    nodes.connectionStatus.textContent = TEXT.online;
    nodes.lastUpdated.textContent = state.lastUpdated ? `${TEXT.lastRefreshPrefix}${state.lastUpdated}` : TEXT.refreshed;
    renderTable();
    const hasStale = Object.values(state.quotes).some((quote) => quote && quote.stale);
    if (hasStale) {
      setStatusMessage("部分基金暂时使用上次成功数据", "error");
    }
  } catch (error) {
    console.error(error);
    nodes.connectionStatus.textContent = TEXT.error;
    nodes.lastUpdated.textContent = TEXT.fetchError;
    setStatusMessage("部分或全部基金数据刷新失败", "error");
  }
}

function bindEvents() {
  nodes.refreshBtn.addEventListener("click", refreshQuotes);
  nodes.toolbarRefreshBtn.addEventListener("click", refreshQuotes);
  nodes.sourceModeSelect.addEventListener("change", async (event) => {
    const nextMode = event.target.value;
    try {
      nodes.sourceModeSelect.disabled = true;
      await saveSourceMode(nextMode);
      setStatusMessage(`已切换到${getSourceModeLabel(state.sourceMode)}`, "success");
      await refreshQuotes();
    } catch (error) {
      console.error(error);
      syncSourceModeUI();
      setStatusMessage("切换数据源失败，请稍后重试", "error");
    } finally {
      nodes.sourceModeSelect.disabled = false;
    }
  });
  nodes.toggleEditorBtn.addEventListener("click", () => openEditor());
  nodes.toolbarAddBtn.addEventListener("click", openAddFundModal);
  nodes.openImageImportBtn.addEventListener("click", openImageImportModal);
  nodes.closeEditorBtn.addEventListener("click", closeEditor);
  nodes.editorBackdrop.addEventListener("click", closeEditor);
  nodes.addRowBtn.addEventListener("click", () => appendEditorRow());
  nodes.restoreDefaultsBtn.addEventListener("click", restoreDefaultFunds);
  nodes.saveBtn.addEventListener("click", async () => {
    const normalized = normalizeFunds(collectEditorRows());
    if (!normalized.length) {
      appendEditorRow();
      setStatusMessage("请至少保留一条有效的 6 位基金代码", "error");
      return;
    }
    if (state.editingIndex !== null) {
      const next = [...state.funds];
      next.splice(state.editingIndex, 1, normalized[0]);
      state.funds = normalizeFunds(next);
    } else {
      state.funds = normalized;
    }
    persistFunds();
    renderEditor();
    renderTable();
    await refreshQuotes();
    closeEditor();
    setStatusMessage("持仓已保存", "success");
  });
  nodes.exportBtn.addEventListener("click", downloadHoldings);
  nodes.importBtn.addEventListener("click", () => nodes.importInput.click());
  nodes.importInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    importHoldings(file);
  });
  nodes.privacyToggle.addEventListener("change", (event) => {
    state.hideAmount = event.target.checked;
    renderTable();
  });
  nodes.fundTableBody.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) {
      return;
    }
    const action = trigger.dataset.action;
    const index = Number(trigger.dataset.index);
    if (!Number.isInteger(index) || index < 0) {
      return;
    }
    if (action === "edit") {
      openEditor(index);
      return;
    }
    if (action === "remove-fund") {
      state.funds.splice(index, 1);
      persistFunds();
      renderTable();
      await refreshQuotes();
      setStatusMessage("该持仓已删除", "success");
    }
  });
  nodes.addFundBackdrop.addEventListener("click", closeAddFundModal);
  nodes.closeAddFundBtn.addEventListener("click", closeAddFundModal);
  nodes.cancelAddFundBtn.addEventListener("click", closeAddFundModal);
  nodes.saveQuickAddBtn.addEventListener("click", saveQuickAdd);
  nodes.modeAmountBtn.addEventListener("click", () => {
    state.quickAddMode = "amount";
    updateQuickAddModeUI();
    updateQuickAddPreview();
  });
  nodes.modeShareBtn.addEventListener("click", () => {
    state.quickAddMode = "share";
    updateQuickAddModeUI();
    updateQuickAddPreview();
  });
  nodes.quickAddCode.addEventListener("input", () => {
    state.quickAddLookupCode = nodes.quickAddCode.value.trim();
    state.quickAddQuote = null;
    updateQuickAddPreview();
  });
  nodes.quickAddCode.addEventListener("blur", hydrateQuickAddCode);
  nodes.quickAddName.addEventListener("input", updateQuickAddPreview);
  nodes.quickAddAmount.addEventListener("input", updateQuickAddPreview);
  nodes.quickAddProfit.addEventListener("input", updateQuickAddPreview);
  nodes.quickAddShares.addEventListener("input", updateQuickAddPreview);
  nodes.quickAddCost.addEventListener("input", updateQuickAddPreview);
  nodes.imageImportBackdrop.addEventListener("click", closeImageImportModal);
  nodes.closeImageImportBtn.addEventListener("click", closeImageImportModal);
  nodes.cancelImageImportBtn.addEventListener("click", closeImageImportModal);
  nodes.imageImportInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    setImageFile(file);
  });
  ["dragenter", "dragover"].forEach((type) => {
    nodes.uploadDropzone.addEventListener(type, (event) => {
      event.preventDefault();
      nodes.uploadDropzone.dataset.drag = "true";
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    nodes.uploadDropzone.addEventListener(type, (event) => {
      event.preventDefault();
      delete nodes.uploadDropzone.dataset.drag;
    });
  });
  nodes.uploadDropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      setImageFile(file);
    }
  });
  nodes.startImageRecognizeBtn.addEventListener("click", startImageRecognize);
  nodes.addImageRowBtn.addEventListener("click", () => appendImageRow());
  nodes.clearImageRowsBtn.addEventListener("click", () => {
    state.imageRows = [];
    renderImageRows();
    setInlineStatus(nodes.imageImportStatus, "", "info");
  });
  nodes.confirmImageImportBtn.addEventListener("click", confirmImageImport);
  nodes.imageRowsBody.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-action="remove-image-row"]');
    if (!trigger) {
      return;
    }
    const row = trigger.closest(".ocr-row");
    if (!row) {
      return;
    }
    const index = Number(row.dataset.index);
    syncImageRowsFromDom();
    state.imageRows.splice(index, 1);
    renderImageRows();
  });
  nodes.imageRowsBody.addEventListener("input", (event) => {
    if (event.target.matches("input")) {
      const row = event.target.closest(".ocr-row");
      if (row) {
        if (event.target.matches('[data-field="name"]')) {
          row.dataset.nameMismatch = "false";
        }
        updateSingleImageRow(row);
      }
      syncImageRowsFromDom();
      updateImageImportSummary();
    }
  });
  nodes.imageRowsBody.addEventListener("focusout", (event) => {
    if (event.target.matches('[data-field="code"], [data-field="name"]')) {
      const row = event.target.closest(".ocr-row");
      if (row) {
        hydrateSingleImageRow(row);
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!nodes.editorModal.hidden) closeEditor();
      if (!nodes.addFundModal.hidden) closeAddFundModal();
      if (!nodes.imageImportModal.hidden) closeImageImportModal();
    }
  });
}

async function main() {
  loadFunds();
  await loadSourceMode();
  bindEvents();
  syncSourceModeUI();
  renderTable();
  renderImageRows();
  await refreshQuotes();
}

main();
