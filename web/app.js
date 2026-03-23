const STORAGE_KEY = "fund-web-holdings-v1";
const DEFAULT_FUNDS = [
  { code: "002834", name: "\u534e\u590f\u65b0\u9526\u7ee3\u7075\u6d3b\u914d\u7f6e\u6df7\u5408C", cost: 3.0508, num: 3081.21 },
  { code: "025422", name: "\u6d66\u94f6\u5b89\u76db\u6570\u5b57\u7ecf\u6d4e\u6df7\u5408C", cost: 1.5412, num: 1944.19 },
  { code: "018463", name: "\u5fb7\u90a6\u7a33\u76c8\u589e\u957f\u7075\u6d3b\u914d\u7f6e\u6df7\u5408C", cost: 1.1483, num: 2632.94 },
  { code: "457001", name: "\u56fd\u5bcc\u4e9a\u6d32\u673a\u4f1a\u80a1\u7968(QDII)A", cost: 2.143, num: 933.29 },
  { code: "015790", name: "\u6c38\u8d62\u9ad8\u7aef\u88c5\u5907\u667a\u9009\u6df7\u5408C", cost: 1.6372, num: 1241.72 },
  { code: "000217", name: "\u534e\u5b89\u9ec4\u91d1ETF\u8054\u63a5C", cost: 4.0769, num: 0.52 },
];

const TEXT = {
  ready: "\u5c31\u7eea",
  waiting: "\u7b49\u5f85\u4f60\u6dfb\u52a0\u6301\u4ed3",
  refreshing: "\u5237\u65b0\u4e2d",
  fetching: "\u6b63\u5728\u62c9\u53d6\u57fa\u91d1\u6570\u636e...",
  online: "\u5728\u7ebf",
  refreshed: "\u6570\u636e\u5df2\u5237\u65b0",
  error: "\u5f02\u5e38",
  fetchError: "\u63a5\u53e3\u62c9\u53d6\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
  noFunds: "\u8fd8\u6ca1\u6709\u57fa\u91d1\u6301\u4ed3\uff0c\u5148\u70b9\u201c\u7f16\u8f91\u6301\u4ed3\u201d\u65b0\u589e\u3002",
  noData: "\u6682\u65e0\u6301\u4ed3\u6570\u636e",
  latestDatePrefix: "\u6700\u65b0\u4f30\u503c\u65e5\u671f\uff1a",
  today: "\u4eca\u65e5",
  fundFallback: "\u57fa\u91d1",
  sharePrefix: "\u4efd\u989d",
  navPrefix: "\u51c0\u503c",
  costPrefix: "\u6210\u672c",
  lastRefreshPrefix: "\u4e0a\u6b21\u5237\u65b0\uff1a",
  estimateTimePrefix: "\u4f30\u503c\u65f6\u95f4",
  finalNavPrefix: "\u6700\u65b0\u51c0\u503c",
  previousNavPrefix: "\u4e0a\u4e00\u4ea4\u6613\u65e5\u51c0\u503c",
};

const state = {
  funds: [],
  quotes: {},
  hideAmount: false,
  lastUpdated: "",
  statusTimer: null,
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
  statusMessage: document.getElementById("statusMessage"),
  editorPanel: document.getElementById("editorPanel"),
  editorRows: document.getElementById("editorRows"),
  refreshBtn: document.getElementById("refreshBtn"),
  toggleEditorBtn: document.getElementById("toggleEditorBtn"),
  addRowBtn: document.getElementById("addRowBtn"),
  saveBtn: document.getElementById("saveBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importInput: document.getElementById("importInput"),
  privacyToggle: document.getElementById("privacyToggle"),
  editorRowTemplate: document.getElementById("editorRowTemplate"),
};

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

function loadFunds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : DEFAULT_FUNDS;
    state.funds = normalizeFunds(parsed);
  } catch {
    state.funds = normalizeFunds(DEFAULT_FUNDS);
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
  const parsed = Number(value);
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
  const hasEstimate = Boolean(quote.hasEstimate) && Number.isFinite(estimate) && estimate > 0;
  const valuationPrice = hasEstimate ? estimate : nav;
  const amount = valuationPrice * fund.num;
  const dailyRate = toNumber(quote.dailyRate);
  const previousNav = toNumber(quote.prevNav, nav);
  const dailyProfit = fund.num && previousNav ? (valuationPrice - previousNav) * fund.num : 0;
  const holdingProfit = fund.num && fund.cost ? (valuationPrice - fund.cost) * fund.num : 0;
  const holdingRate = fund.num && fund.cost ? (holdingProfit / (fund.cost * fund.num)) * 100 : 0;
  const previousAmount = previousNav * fund.num;
  const costAmount = fund.cost * fund.num;

  return {
    ...fund,
    nav,
    previousNav,
    valuationPrice,
    amount,
    dailyRate,
    dailyProfit,
    holdingProfit,
    holdingRate,
    previousAmount,
    costAmount,
    hasEstimate,
    estimateTime: quote.estimateTime || "",
    tradeDate: quote.tradeDate || "",
    previousDate: quote.previousDate || "",
    latestDate: quote.latestDate || "",
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

function renderTable() {
  const mergedFunds = state.funds.map(mergeFund);

  if (!mergedFunds.length) {
    nodes.fundTableBody.innerHTML = `<tr><td colspan="7" class="empty-row">${TEXT.noFunds}</td></tr>`;
    nodes.quoteDateHint.textContent = TEXT.noData;
    updateSummary([]);
    return;
  }

  const latestDate = mergedFunds.map((item) => item.latestDate).filter(Boolean).sort().slice(-1)[0] || TEXT.today;
  const estimateTime = mergedFunds.map((item) => item.estimateTime).filter(Boolean).sort().slice(-1)[0] || "";
  nodes.quoteDateHint.textContent = estimateTime
    ? `${TEXT.latestDatePrefix}${latestDate} · ${TEXT.estimateTimePrefix} ${estimateTime.slice(11, 16)}`
    : `${TEXT.latestDatePrefix}${latestDate}`;

  nodes.fundTableBody.innerHTML = mergedFunds.map((item) => `
    <tr>
      <td>
        <span class="fund-name">${escapeHtml(item.name || `${TEXT.fundFallback} ${item.code}`)}</span>
        <span class="subtext">${TEXT.sharePrefix} ${item.num.toFixed(2)}</span>
      </td>
      <td class="mono">${item.code}</td>
      <td>
        <span>${formatNav(item.valuationPrice)}</span>
        <span class="subtext">${item.hasEstimate ? `${TEXT.finalNavPrefix} ${formatNav(item.nav)}` : `${TEXT.navPrefix} ${formatNav(item.nav)}`}</span>
      </td>
      <td class="${classForValue(item.dailyRate)}">${formatPercent(item.dailyRate)}</td>
      <td class="${classForValue(item.dailyProfit)}">${formatSignedMoney(item.dailyProfit)}</td>
      <td class="${classForValue(item.holdingProfit)}">
        ${formatSignedMoney(item.holdingProfit)}
        <span class="subtext ${classForValue(item.holdingRate)}">${formatPercent(item.holdingRate)}</span>
      </td>
      <td>
        <span>${formatMoney(item.amount)}</span>
        <span class="subtext">${TEXT.previousNavPrefix} ${formatNav(item.previousNav)}</span>
      </td>
    </tr>
  `).join("");

  updateSummary(mergedFunds);
}

function renderEditor() {
  nodes.editorRows.innerHTML = "";
  const rows = state.funds.length ? state.funds : [{ code: "", name: "", num: 0, cost: 0 }];
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

function downloadHoldings() {
  const blob = new Blob([JSON.stringify(state.funds, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fund-holdings.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatusMessage("\u6301\u4ed3\u5df2\u5bfc\u51fa", "success");
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
    setStatusMessage("\u6301\u4ed3\u5df2\u5bfc\u5165\u5e76\u5237\u65b0", "success");
  } catch {
    setStatusMessage("\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u9009\u62e9\u6b63\u786e\u7684 JSON \u6301\u4ed3\u6587\u4ef6", "error");
  } finally {
    nodes.importInput.value = "";
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
    const response = await fetch(`/api/quotes?codes=${encodeURIComponent(codes)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.quotes = payload.quotes || {};
    state.lastUpdated = payload.updated_at || "";
    nodes.connectionStatus.textContent = TEXT.online;
    nodes.lastUpdated.textContent = state.lastUpdated
      ? `${TEXT.lastRefreshPrefix}${state.lastUpdated}`
      : TEXT.refreshed;
    renderTable();
    const hasStale = Object.values(state.quotes).some((quote) => quote && quote.stale);
    if (hasStale) {
      setStatusMessage("\u90e8\u5206\u57fa\u91d1\u6682\u65f6\u4f7f\u7528\u4e0a\u6b21\u6210\u529f\u6570\u636e", "error");
    }
  } catch (error) {
    console.error(error);
    nodes.connectionStatus.textContent = TEXT.error;
    nodes.lastUpdated.textContent = TEXT.fetchError;
    setStatusMessage("\u90e8\u5206\u6216\u5168\u90e8\u57fa\u91d1\u6570\u636e\u5237\u65b0\u5931\u8d25", "error");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bindEvents() {
  nodes.refreshBtn.addEventListener("click", refreshQuotes);
  nodes.toggleEditorBtn.addEventListener("click", () => {
    const shouldShow = nodes.editorPanel.hidden;
    nodes.editorPanel.hidden = !shouldShow;
    nodes.toggleEditorBtn.textContent = shouldShow ? "\u6536\u8d77\u7f16\u8f91" : "\u7f16\u8f91\u6301\u4ed3";
    if (shouldShow) {
      renderEditor();
    }
  });
  nodes.addRowBtn.addEventListener("click", () => appendEditorRow());
  nodes.saveBtn.addEventListener("click", async () => {
    const normalized = normalizeFunds(collectEditorRows());
    if (!normalized.length) {
      appendEditorRow();
      setStatusMessage("\u8bf7\u81f3\u5c11\u4fdd\u7559\u4e00\u6761\u6709\u6548\u7684 6 \u4f4d\u57fa\u91d1\u4ee3\u7801", "error");
      return;
    }
    state.funds = normalized;
    persistFunds();
    renderEditor();
    renderTable();
    await refreshQuotes();
    setStatusMessage("\u6301\u4ed3\u5df2\u4fdd\u5b58", "success");
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
}

async function main() {
  loadFunds();
  bindEvents();
  renderTable();
  await refreshQuotes();
}

main();
