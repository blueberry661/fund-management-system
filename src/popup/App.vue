<template>
  <div class="page-shell">
    <div class="phone-frame">
      <header class="asset-card">
        <div>
          <div class="label-row">
            <span>账户资产</span>
            <button class="ghost" @click="hideAmount = !hideAmount">{{ hideAmount ? '显' : '隐' }}</button>
          </div>
          <div class="asset">{{ hideAmount ? '******' : formatMoney(summary.amount) }}</div>
        </div>
        <div class="right">
          <div class="label-row">{{ todayLabel }} 当日收益率</div>
          <div class="rate" :class="valueClass(summary.dailyRate)">{{ hideAmount ? '**.**%' : signedPercent(summary.dailyRate) }}</div>
        </div>
      </header>

      <section class="list-card">
        <div class="grid header">
          <div class="fund-col">基金</div>
          <div>当日涨幅<br><small>{{ quoteDateLabel }}</small></div>
          <div>当日收益<br><small>{{ quoteDateLabel }}</small></div>
          <div>持有收益<br><small>{{ quoteDateLabel }}</small></div>
          <div>最新净值<br><small>{{ latestQuoteDateLabel }}</small></div>
          <div>昨日净值<br><small>{{ prevQuoteDateLabel }}</small></div>
        </div>

        <div v-if="loading" class="state">正在拉取实时数据...</div>

        <div v-for="fund in displayFunds" v-else :key="fund.code" class="grid row">
          <div class="fund-col">
            <div class="name">{{ fund.name }}</div>
            <div class="sub">{{ hideAmount ? '******' : ('¥' + formatMoney(fund.amount)) }}</div>
          </div>
          <div>
            <div class="main" :class="valueClass(fund.dailyRate)">{{ signedPercent(fund.dailyRate) }}</div>
            <div class="sub">{{ formatNav(fund.valuationPrice) }}</div>
          </div>
          <div>
            <div class="main" :class="valueClass(fund.dailyProfit)">{{ signedMoney(fund.dailyProfit) }}</div>
            <div class="sub" :class="valueClass(fund.dailyRate)">{{ signedPercent(fund.dailyRate) }}</div>
          </div>
          <div>
            <div class="main" :class="valueClass(fund.holdingProfit)">{{ signedMoney(fund.holdingProfit) }}</div>
            <div class="sub" :class="valueClass(fund.holdingRate)">{{ signedPercent(fund.holdingRate) }}</div>
          </div>
          <div>
            <div class="main">{{ formatNav(fund.valuationPrice) }}</div>
            <div class="sub">{{ formatNav(fund.nav) }}</div>
          </div>
          <div>
            <div class="main">{{ formatNav(fund.prevNav) }}</div>
            <div class="sub">{{ signedPercent(fund.navChangeRate) }}</div>
          </div>
        </div>
      </section>
      <footer class="bottom-bar">
        <button class="bottom-link" @click="handleSyncHoldings">+ 同步持仓</button>
        <button class="bottom-link right" @click="handleBatchAdjust">批量加减仓</button>
      </footer>

      <div v-if="showEditor" class="editor-mask" @click.self="closeEditor">
        <div class="editor-card">
          <div class="editor-head">
            <div class="editor-title">{{ editorMode === "sync" ? "同步持仓" : "批量加减仓" }}</div>
            <button class="editor-close" @click="closeEditor">×</button>
          </div>
          <div class="editor-body">
            <div class="editor-grid editor-grid-head">
              <div>基金代码</div>
              <div>基金名称</div>
              <div>持有份额</div>
              <div>持有成本</div>
              <div>操作</div>
            </div>
            <div v-for="(row, i) in editorRows" :key="i" class="editor-grid">
              <input v-model.trim="row.code" placeholder="6位代码" />
              <input v-model.trim="row.name" placeholder="基金名称" />
              <input v-model.trim="row.num" type="number" step="0.01" min="0" placeholder="份额" />
              <input v-model.trim="row.cost" type="number" step="0.0001" min="0" placeholder="成本" />
              <button class="editor-del" @click="removeEditorRow(i)">删</button>
            </div>
            <div class="editor-actions">
              <button class="editor-btn light" @click="addEditorRow">新增一行</button>
              <button class="editor-btn" @click="saveEditorRows">保存</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const STORAGE_KEY = "yj-web-funds-v8";
const DEFAULT_FUNDS = [
  { code: "002834", name: "华夏新锦绣灵活配置混合C", cost: 3.0508, num: 3081.21 },
  { code: "025422", name: "浦银安盛数字经济混合C", cost: 1.5412, num: 1944.19 },
  { code: "018463", name: "德邦稳盈增长灵活配置混合C", cost: 1.1483, num: 2632.94 },
  { code: "457001", name: "国富亚洲机会股票(QDII)A", cost: 2.1430, num: 933.29 },
  { code: "015790", name: "永赢高端装备智选混合C", cost: 1.6372, num: 1241.72 },
  { code: "000217", name: "华安黄金ETF联接C", cost: 4.0769, num: 0.52 },
];
const CANONICAL_NAME_CODE_MAP = {
  "华夏新锦绣灵活配置混合C": "002834",
  "浦银安盛数字经济混合C": "025422",
  "德邦稳盈增长灵活配置混合C": "018463",
  "国富亚洲机会股票(QDII)A": "457001",
  "永赢高端装备智选混合C": "015790",
  "华安黄金ETF联接C": "000217",
};

function toNumber(v, d = 0) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function parseJsArrayVar(text, varName) {
  const re = new RegExp(`${varName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`);
  const m = text.match(re);
  if (!m || !m[1]) return null;
  try {
    return JSON.parse(m[1]);
  } catch (_) {
    return null;
  }
}
function formatMonthDay(input) {
  if (!input) return "";
  if (/^\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}
function prevTradingDayLabel(mmdd) {
  const m = String(mmdd || "");
  const match = m.match(/^(\d{2})-(\d{2})$/);
  if (!match) return m;
  const now = new Date();
  const year = now.getFullYear();
  const dt = new Date(year, Number(match[1]) - 1, Number(match[2]));
  if (Number.isNaN(dt.getTime())) return m;
  do {
    dt.setDate(dt.getDate() - 1);
  } while (dt.getDay() === 0 || dt.getDay() === 6);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}
function normalizeFunds(list) {
  const src = Array.isArray(list) ? list : DEFAULT_FUNDS;
  return src.map((x) => ({
    name: String(x.name || "").trim(),
    code: String(CANONICAL_NAME_CODE_MAP[String(x.name || "").trim()] || x.code || "").trim(),
    cost: toNumber(x.cost),
    num: toNumber(x.num),
  })).filter((x) => /^\d{6}$/.test(x.code));
}

export default {
  data() {
    return {
      funds: [],
      quotes: {},
      loading: true,
      hideAmount: false,
      showEditor: false,
      editorMode: "sync",
      editorRows: [],
    };
  },
  computed: {
    todayLabel() {
      const d = new Date();
      return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
    displayFunds() {
      return this.funds.map((f) => this.mergeFund(f));
    },
    summary() {
      const amount = this.displayFunds.reduce((s, x) => s + x.amount, 0);
      const dailyProfit = this.displayFunds.reduce((s, x) => s + x.dailyProfit, 0);
      return { amount, dailyRate: amount ? (dailyProfit * 100) / amount : 0 };
    },
    quoteDateLabel() {
      const dates = this.displayFunds.map((x) => x.tradeDate).filter(Boolean);
      if (dates.length) return dates.sort().slice(-1)[0];
      return this.todayLabel;
    },
    latestQuoteDateLabel() {
      const dates = this.displayFunds.map((x) => x.latestDate).filter(Boolean);
      if (dates.length) return dates.sort().slice(-1)[0];
      return this.quoteDateLabel;
    },
    prevQuoteDateLabel() {
      return prevTradingDayLabel(this.latestQuoteDateLabel || this.quoteDateLabel);
    },
  },
  created() {
    this.loadFunds();
    this.fetchQuotes();
  },
  methods: {
    formatMoney(v) { return toNumber(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    formatNav(v) { const n = toNumber(v, NaN); return Number.isFinite(n) ? n.toFixed(4) : "--"; },
    signedPercent(v) { const n = toNumber(v); return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; },
    signedMoney(v) { const n = toNumber(v); return `${n > 0 ? "+" : ""}${this.formatMoney(n)}`; },
    valueClass(v) { const n = toNumber(v, NaN); if (!Number.isFinite(n) || n === 0) return "flat"; return n > 0 ? "up" : "down"; },
    loadFunds() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.funds = normalizeFunds(raw ? JSON.parse(raw) : DEFAULT_FUNDS);
      } catch (_) {
        this.funds = normalizeFunds(DEFAULT_FUNDS);
      }
    },
    persistFunds() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.funds)); },
    fetchQuotes() {
      if (!this.funds.length) { this.loading = false; return; }
      this.loading = true;
      const codes = this.funds.map((x) => x.code).join(",");
      const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=web_yjb&Fcodes=${codes}`;
      this.$axios.get(url).then(async (res) => {
        const list = Array.isArray(res.data && res.data.Datas) ? res.data.Datas : [];
        const map = {};
        list.forEach((it) => {
          const hasFinalNav = it.PDATE !== "--" && it.GZTIME && it.PDATE === it.GZTIME.substr(0, 10);
          const nav = isNaN(it.NAV) ? 0 : Number(it.NAV);
          const gsz = hasFinalNav ? nav : (isNaN(it.GSZ) ? NaN : Number(it.GSZ));
          const gszzl = isNaN(it.GSZZL) ? NaN : Number(it.GSZZL);
          const navchg = isNaN(it.NAVCHGRT) ? 0 : Number(it.NAVCHGRT);
          map[it.FCODE] = {
            name: it.SHORTNAME,
            nav,
            gsz,
            dailyRate: Number.isFinite(gszzl) ? gszzl : navchg,
            navChangeRate: navchg,
            hasFinalNav,
            tradeDate: it.PDATE ? String(it.PDATE).slice(5) : "",
            latestDate: it.PDATE ? String(it.PDATE).slice(5) : "",
            prevDate: "",
          };
        });

        // 兜底：主接口涨幅为 0 或估值缺失时，用 pingzhongdata 补实时估值/涨幅
        await Promise.all(this.funds.map(async (fund) => {
          const q = map[fund.code];
          const needFallback =
            !q ||
            (!Number.isFinite(toNumber(q.dailyRate, NaN)) || toNumber(q.dailyRate) === 0) ||
            !Number.isFinite(toNumber(q.gsz, NaN)) ||
            !q.prevDate;
          if (!needFallback) return;
          const extra = await this.fetchEstimateFallback(fund.code);
          if (!extra) return;
          map[fund.code] = {
            ...(q || { nav: 0, gsz: NaN, dailyRate: 0, navChangeRate: 0, hasFinalNav: false }),
            ...extra,
          };
        }));

        this.quotes = map;
      }).finally(() => { this.loading = false; });
    },
    async fetchEstimateFallback(code) {
      try {
        const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;
        const res = await this.$axios.get(url, { responseType: "text" });
        const text = String(res.data || "");
        const pickNum = (key) => {
          const m = text.match(new RegExp(`${key}\\s*=\\s*\"?([\\-\\d.]+)\"?`));
          return m ? Number(m[1]) : NaN;
        };
        const gsz = pickNum("gsz");
        const gszzl = pickNum("gszzl");
        const dwjz = pickNum("dwjz");
        const nav = Number.isFinite(dwjz) ? dwjz : NaN;
        let prevNav = NaN;
        let latestDate = "";
        let prevDate = "";
        const trend = parseJsArrayVar(text, "Data_netWorthTrend");
        if (Array.isArray(trend) && trend.length >= 2) {
          const lastPoint = trend[trend.length - 1] || {};
          const prevPoint = trend[trend.length - 2] || {};
          const last = toNumber(lastPoint.y, NaN);
          const prev = toNumber(prevPoint.y, NaN);
          latestDate = formatMonthDay(lastPoint.x);
          prevDate = formatMonthDay(prevPoint.x);
          if (Number.isFinite(last) && Number.isFinite(prev)) {
            if (!Number.isFinite(nav) || !nav) {
              // 主接口无 NAV 时，用趋势最后一点当最新净值
              // eslint-disable-next-line no-param-reassign
              prevNav = prev;
            } else {
              prevNav = prev;
            }
          }
        }
        return {
          nav: Number.isFinite(nav) ? nav : 0,
          gsz: Number.isFinite(gsz) ? gsz : NaN,
          dailyRate: Number.isFinite(gszzl) ? gszzl : 0,
          prevNav: Number.isFinite(prevNav) ? prevNav : NaN,
          hasFinalNav: false,
          tradeDate: "",
          latestDate,
          prevDate,
        };
      } catch (_) {
        return null;
      }
    },
    mergeFund(f) {
      const q = this.quotes[f.code] || {};
      const nav = toNumber(q.nav);
      const valuationPrice = Number.isFinite(toNumber(q.gsz, NaN)) && toNumber(q.gsz, NaN) > 0 ? toNumber(q.gsz) : nav;
      const amount = valuationPrice * f.num;
      let dailyRate = toNumber(q.dailyRate);
      const navChangeRate = toNumber(q.navChangeRate);
      let prevNav = toNumber(q.prevNav, NaN);
      if (!Number.isFinite(prevNav) || prevNav <= 0) {
        prevNav = nav && navChangeRate ? nav / (1 + navChangeRate / 100) : (nav && dailyRate ? nav / (1 + dailyRate / 100) : nav);
      }
      if ((!dailyRate || Math.abs(dailyRate) < 0.000001) && nav && prevNav && prevNav !== 0) {
        dailyRate = ((nav - prevNav) / prevNav) * 100;
      }
      if ((!dailyRate || Math.abs(dailyRate) < 0.000001) && nav && valuationPrice && nav !== 0) {
        dailyRate = ((valuationPrice - nav) / nav) * 100;
      }

      let dailyProfit = 0;
      if (f.num && nav && prevNav && prevNav !== 0) {
        dailyProfit = (nav - prevNav) * f.num;
      } else if (f.num && valuationPrice && nav) {
        dailyProfit = (valuationPrice - nav) * f.num;
      } else if (f.num && nav && dailyRate) {
        dailyProfit = nav * (dailyRate / 100) * f.num;
      }
      const holdingProfit = f.num && f.cost ? (valuationPrice - f.cost) * f.num : 0;
      const holdingRate = f.num && f.cost ? (holdingProfit * 100) / (f.cost * f.num) : 0;
      return {
        ...f,
        // 保持用户持仓里的基金名称，避免接口短名把 C/A 类别冲掉
        name: f.name,
        nav,
        prevNav,
        navChangeRate,
        tradeDate: q.tradeDate || "",
        latestDate: q.latestDate || q.tradeDate || "",
        prevDate: q.prevDate || "",
        valuationPrice,
        amount,
        dailyRate,
        dailyProfit,
        holdingProfit,
        holdingRate,
      };
    },
    handleSyncHoldings() {
      this.editorMode = "sync";
      this.editorRows = [{ code: "", name: "", num: "", cost: "" }];
      this.showEditor = true;
    },
    handleBatchAdjust() {
      this.editorMode = "batch";
      this.editorRows = this.funds.map((x) => ({
        code: x.code,
        name: x.name,
        num: String(x.num),
        cost: String(x.cost),
      }));
      if (!this.editorRows.length) this.editorRows = [{ code: "", name: "", num: "", cost: "" }];
      this.showEditor = true;
    },
    closeEditor() {
      this.showEditor = false;
    },
    addEditorRow() {
      this.editorRows.push({ code: "", name: "", num: "", cost: "" });
    },
    removeEditorRow(i) {
      this.editorRows.splice(i, 1);
      if (!this.editorRows.length) this.addEditorRow();
    },
    saveEditorRows() {
      const rows = this.editorRows
        .map((r) => ({
          code: String(r.code || "").trim(),
          name: String(r.name || "").trim(),
          num: toNumber(r.num),
          cost: toNumber(r.cost),
        }))
        .filter((r) => /^\d{6}$/.test(r.code));
      if (!rows.length) return;

      const nextMap = new Map(this.funds.map((f) => [f.code, { ...f }]));
      rows.forEach((r) => {
        const existing = nextMap.get(r.code);
        if (existing) {
          existing.name = r.name || existing.name;
          existing.num = r.num;
          existing.cost = r.cost;
        } else {
          nextMap.set(r.code, { code: r.code, name: r.name || `基金${r.code}`, num: r.num, cost: r.cost });
        }
      });
      this.funds = normalizeFunds(Array.from(nextMap.values()));
      this.persistFunds();
      this.closeEditor();
      this.fetchQuotes();
    },
  },
};
</script>

<style scoped>
.page-shell { min-height: 100vh; padding: 18px; background: linear-gradient(180deg,#f5f7fd,#edf2f8); font-family: "PingFang SC","Microsoft YaHei",sans-serif; }
.phone-frame { width: min(100%, 1180px); margin: 0 auto; }
.asset-card,.list-card { background: #fff; border-radius: 16px; box-shadow: 0 10px 24px rgba(0,0,0,.06); }
.asset-card { padding: 16px; display: flex; justify-content: space-between; }
.label-row { color: #8a94b1; font-size: 13px; display: flex; gap: 8px; align-items: center; }
.ghost { border: none; background: #eff3ff; color: #6070a1; border-radius: 999px; padding: 4px 10px; }
.asset,.rate { margin-top: 8px; font-size: 34px; font-weight: 700; line-height: 1; }
.right { text-align: right; }
.list-card { margin-top: 12px; overflow: hidden; }
.bottom-bar {
  margin-top: 0;
  padding: 14px 8px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bottom-link {
  border: none;
  background: transparent;
  color: #9aa3bb;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.bottom-link.right { text-align: right; }
.editor-mask {
  position: fixed;
  inset: 0;
  background: rgba(16, 24, 40, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.editor-card {
  width: min(100%, 980px);
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}
.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #ecf0f7;
}
.editor-title { font-size: 16px; font-weight: 700; color: #22315c; }
.editor-close { border: none; background: transparent; font-size: 22px; color: #8b95b2; cursor: pointer; }
.editor-body { padding: 12px; }
.editor-grid {
  display: grid;
  grid-template-columns: 120px 1fr 120px 120px 60px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.editor-grid input {
  height: 34px;
  border: 1px solid #dbe2f1;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
}
.editor-grid-head { color: #8d97b2; font-size: 12px; margin-bottom: 6px; }
.editor-del {
  border: none;
  height: 34px;
  border-radius: 8px;
  background: #fff1f2;
  color: #d04d59;
  cursor: pointer;
}
.editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.editor-btn {
  border: none;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  background: #3563ff;
  color: #fff;
  cursor: pointer;
}
.editor-btn.light { background: #eef2ff; color: #4561c8; }
.grid { display: grid; grid-template-columns: 280px repeat(5, 1fr); align-items: center; }
.header { padding: 12px 14px; border-bottom: 1px solid #edf1f7; font-weight: 700; color: #5a678f; }
.header small { color: #93a0c2; font-weight: 600; }
.row { padding: 14px; border-bottom: 1px solid #eff2f8; }
.row:last-child { border-bottom: none; }
.fund-col { padding-right: 12px; }
.name { font-size: 22px; font-weight: 700; color: #1f2d5a; line-height: 1.18; }
.sub { margin-top: 6px; color: #8592b5; font-size: 13px; }
.main { font-size: 28px; font-weight: 700; color: #1f2d5a; line-height: 1; }
.state { padding: 28px; color: #8b97b7; text-align: center; }
.up { color: #e84f5f; }
.down { color: #13b26b; }
.flat { color: #1f2d5a; }
@media (max-width: 860px) {
  .grid { grid-template-columns: 180px repeat(5, 120px); min-width: 780px; }
  .list-card { overflow-x: auto; }
  .asset,.rate { font-size: 32px; }
  .name { font-size: 18px; }
  .main { font-size: 20px; }
  .bottom-link { font-size: 16px; }
  .editor-grid { grid-template-columns: 1fr 1fr; }
  .editor-grid-head { display: none; }
}
</style>
