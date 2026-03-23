from __future__ import annotations

import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
USER_AGENT = "Mozilla/5.0"
QUOTE_CACHE: dict[str, dict[str, object]] = {}
SOURCE_CONFIG_PATH = ROOT / "data" / "source_config.json"
SOURCE_MODES = {"auto", "eastmoney", "dayfund"}


def to_float(value: str | int | float | None, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def format_mmdd(value: str | None) -> str:
    if not value:
        return ""
    text = str(value)[:10]
    for pattern in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, pattern).strftime("%m-%d")
        except ValueError:
            continue
    return ""


def http_text(url: str, retries: int = 2) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://fund.eastmoney.com/",
        },
    )

    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.read().decode("utf-8-sig", errors="ignore")
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
                continue
            break

    raise urllib.error.URLError(str(last_error or "request failed"))


def ensure_parent_dir(path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def normalize_source_mode(value: str | None) -> str:
    mode = str(value or "auto").strip().lower()
    return mode if mode in SOURCE_MODES else "auto"


def load_source_mode() -> str:
    try:
        payload = json.loads(SOURCE_CONFIG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return "auto"
    return normalize_source_mode(payload.get("mode"))


def save_source_mode(mode: str) -> str:
    normalized = normalize_source_mode(mode)
    ensure_parent_dir(SOURCE_CONFIG_PATH)
    SOURCE_CONFIG_PATH.write_text(
        json.dumps({"mode": normalized}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return normalized


def parse_jsonp_payload(text: str) -> dict[str, object]:
    start = text.find("(")
    end = text.rfind(")")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("invalid jsonp payload")
    return json.loads(text[start + 1 : end])


def parse_js_var(text: str, name: str) -> str | None:
    match = re.search(rf"{re.escape(name)}\s*=\s*\"(.*?)\";", text, re.S)
    return match.group(1) if match else None


def parse_js_array(text: str, name: str) -> list[dict[str, object]] | None:
    match = re.search(rf"{re.escape(name)}\s*=\s*(\[.*?\]);", text, re.S)
    if not match:
        return None
    return json.loads(match.group(1))


def parse_html_id(text: str, element_id: str) -> str:
    match = re.search(rf'id="{re.escape(element_id)}">(.*?)<', text, re.S)
    return match.group(1).strip() if match else ""


def parse_yyyy_mm_dd(value: str | None) -> str:
    if not value:
        return ""
    text = str(value).strip()[:10]
    for pattern in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return ""


def is_newer_date(candidate: str, baseline: str) -> bool:
    candidate_norm = parse_yyyy_mm_dd(candidate)
    baseline_norm = parse_yyyy_mm_dd(baseline)
    if not candidate_norm:
        return False
    if not baseline_norm:
        return True
    return candidate_norm > baseline_norm


def fetch_single_quote(code: str) -> dict[str, object]:
    url = (
        "https://fund.eastmoney.com/data/funddataforgznew.aspx?"
        f"fc={urllib.parse.quote(code)}&t=basewap&cb=query"
    )
    payload = parse_jsonp_payload(http_text(url))

    nav = to_float(payload.get("dwjz"), 0.0)
    estimate = to_float(payload.get("gsz"), nav)
    estimate_rate = to_float(payload.get("gszzl"), 0.0)
    trade_date = str(payload.get("jzrq", "")).strip()
    estimate_time = str(payload.get("gztime", "")).strip()
    has_estimate = bool(estimate_time) and estimate > 0 and (
        estimate_time[:10] > trade_date or abs(estimate - nav) > 1e-8
    )

    return {
        "code": code,
        "name": str(payload.get("name", "")).strip(),
        "nav": nav,
        "estimate": estimate if estimate > 0 else nav,
        "estimateRate": estimate_rate,
        "tradeDate": trade_date,
        "estimateTime": estimate_time,
        "hasEstimate": has_estimate,
    }


def fetch_history_snapshot(code: str) -> dict[str, object]:
    url = f"https://fund.eastmoney.com/pingzhongdata/{urllib.parse.quote(code)}.js?v={int(time.time())}"
    text = http_text(url)
    trend = parse_js_array(text, "Data_netWorthTrend") or []
    valid_points = [
        point
        for point in trend
        if isinstance(point, dict) and point.get("y") not in (None, "")
    ]
    if not valid_points:
        raise urllib.error.URLError("history trend unavailable")

    dated_points = []
    for point in valid_points:
        point_ts = int(to_float(point.get("x"), 0))
        point_date = datetime.fromtimestamp(point_ts / 1000).strftime("%Y-%m-%d") if point_ts else ""
        dated_points.append(
            {
                "date": point_date,
                "nav": to_float(point.get("y"), 0.0),
                "equityReturn": to_float(point.get("equityReturn"), 0.0),
            }
        )

    latest = dated_points[-1]
    previous = dated_points[-2] if len(dated_points) > 1 else latest

    return {
        "name": parse_js_var(text, "fS_name") or "",
        "latestNav": latest["nav"],
        "previousNav": previous["nav"],
        "latestDate": latest["date"],
        "previousDate": previous["date"],
        "latestEquityReturn": latest["equityReturn"],
    }


def fetch_dayfund_snapshot(code: str) -> dict[str, object]:
    url = f"https://www.dayfund.com.cn/fund/{urllib.parse.quote(code)}.html"
    text = http_text(url)
    official_date = parse_yyyy_mm_dd(parse_html_id(text, "the_date"))
    nav = to_float(parse_html_id(text, "this_netvalue"), 0.0)
    previous_nav = to_float(parse_html_id(text, "last_netvalue"), 0.0)
    nav_change_rate = to_float(parse_html_id(text, "add_rate").replace("%", ""), 0.0)
    if not official_date or nav <= 0:
        raise urllib.error.URLError("dayfund official snapshot unavailable")
    return {
        "officialDate": official_date,
        "nav": nav,
        "previousNav": previous_nav,
        "navChangeRate": nav_change_rate,
    }


def apply_official_snapshot(
    history_data: dict[str, object],
    official_date: str,
    nav: float,
    previous_nav: float,
    nav_change_rate: float,
) -> dict[str, object]:
    snapshot = dict(history_data)
    snapshot["latestDate"] = official_date or str(history_data.get("latestDate", ""))
    snapshot["latestNav"] = nav if nav > 0 else to_float(history_data.get("latestNav"), 0.0)
    snapshot["previousNav"] = previous_nav if previous_nav > 0 else to_float(history_data.get("previousNav"), 0.0)
    snapshot["latestEquityReturn"] = nav_change_rate
    return snapshot


def build_quote(code: str, source_mode: str = "auto") -> dict[str, object]:
    source_mode = normalize_source_mode(source_mode)
    quote_data = fetch_single_quote(code)
    history_data = fetch_history_snapshot(code)
    source_used = "eastmoney"
    try:
        dayfund_data = fetch_dayfund_snapshot(code)
    except Exception:  # noqa: BLE001
        dayfund_data = {}

    if source_mode == "dayfund" and dayfund_data:
        history_data = apply_official_snapshot(
            history_data,
            str(dayfund_data.get("officialDate", "")),
            to_float(dayfund_data.get("nav"), 0.0),
            to_float(dayfund_data.get("previousNav"), 0.0),
            to_float(dayfund_data.get("navChangeRate"), to_float(history_data.get("latestEquityReturn"), 0.0)),
        )
        source_used = "dayfund"
    elif (
        source_mode == "auto"
        and dayfund_data
        and is_newer_date(str(dayfund_data.get("officialDate", "")), str(history_data.get("latestDate", "")))
    ):
        history_data = apply_official_snapshot(
            history_data,
            str(dayfund_data.get("officialDate", "")),
            to_float(dayfund_data.get("nav"), 0.0),
            to_float(dayfund_data.get("previousNav"), 0.0),
            to_float(dayfund_data.get("navChangeRate"), to_float(history_data.get("latestEquityReturn"), 0.0)),
        )
        source_used = "dayfund"

    nav = to_float(history_data.get("latestNav"), to_float(quote_data.get("nav"), 0.0))
    if nav <= 0:
        nav = to_float(quote_data.get("nav"), 0.0)

    prev_nav = to_float(history_data.get("previousNav"), 0.0)
    if prev_nav <= 0 and nav > 0:
        estimate_base = to_float(quote_data.get("estimate"), nav)
        estimate_rate = to_float(quote_data.get("estimateRate"), 0.0)
        if estimate_base > 0 and estimate_rate:
            prev_nav = estimate_base / (1 + estimate_rate / 100)
        else:
            prev_nav = nav

    estimate = to_float(quote_data.get("estimate"), nav)
    has_estimate = bool(quote_data.get("hasEstimate")) and estimate > 0
    effective_price = estimate if has_estimate else nav

    nav_change_rate = ((nav - prev_nav) / prev_nav * 100) if prev_nav else 0.0
    effective_rate = (
        to_float(quote_data.get("estimateRate"), nav_change_rate) if has_estimate else nav_change_rate
    )

    return {
        "code": code,
        "name": str(quote_data.get("name") or history_data.get("name") or code),
        "nav": nav,
        "gsz": effective_price,
        "prevNav": prev_nav,
        "dailyRate": effective_rate,
        "navChangeRate": nav_change_rate,
        "estimateRate": to_float(quote_data.get("estimateRate"), nav_change_rate),
        "tradeDate": format_mmdd(str(quote_data.get("tradeDate", ""))),
        "estimateDate": format_mmdd(str(quote_data.get("estimateTime", ""))[:10]),
        "officialDate": format_mmdd(str(history_data.get("latestDate", ""))),
        "latestDate": format_mmdd(
            str(quote_data.get("estimateTime", ""))[:10] or str(history_data.get("latestDate", ""))
        ),
        "previousDate": format_mmdd(str(history_data.get("previousDate", ""))),
        "estimateTime": str(quote_data.get("estimateTime", "")),
        "hasEstimate": has_estimate,
        "sourceMode": source_mode,
        "sourceUsed": source_used,
    }


def fetch_quotes(codes: list[str], source_mode: str | None = None) -> dict[str, dict[str, object]]:
    effective_mode = normalize_source_mode(source_mode or load_source_mode())
    quotes: dict[str, dict[str, object]] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(codes)))) as executor:
        future_map = {executor.submit(build_quote, code, effective_mode): code for code in codes}
        for future in as_completed(future_map):
            code = future_map[future]
            try:
                quote = future.result()
                QUOTE_CACHE[code] = quote
                quotes[code] = quote
            except Exception as exc:  # noqa: BLE001
                cached = QUOTE_CACHE.get(code)
                if cached:
                    fallback = dict(cached)
                    fallback["stale"] = True
                    fallback["error"] = str(exc)
                    quotes[code] = fallback
                else:
                    errors[code] = str(exc)

    if not quotes and errors:
        raise urllib.error.URLError("; ".join(f"{code}: {message}" for code, message in errors.items()))

    return quotes


class FundHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/":
            self.path = "/web/index.html"
            return super().do_GET()

        if parsed.path == "/api/quotes":
            return self.handle_quotes(parsed.query)
        if parsed.path == "/api/source-config":
            return self.handle_source_config_get()

        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/source-config":
            return self.handle_source_config_post()
        return self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def handle_quotes(self, query: str) -> None:
        params = urllib.parse.parse_qs(query)
        codes = [code.strip() for code in params.get("codes", [""])[0].split(",") if code.strip()]
        source_mode = normalize_source_mode(params.get("source", [""])[0])
        if not codes:
            return self.send_json({"quotes": {}, "updated_at": "", "source_mode": source_mode})

        try:
            quotes = fetch_quotes(codes, source_mode)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            return self.send_json(
                {"error": "upstream_error", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )

        updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return self.send_json({"quotes": quotes, "updated_at": updated_at, "source_mode": source_mode})

    def handle_source_config_get(self) -> None:
        return self.send_json({"mode": load_source_mode(), "modes": sorted(SOURCE_MODES)})

    def handle_source_config_post(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self.send_json(
                {"error": "invalid_json", "message": "请求体不是有效 JSON"},
                status=HTTPStatus.BAD_REQUEST,
            )

        requested_mode = str(payload.get("mode", "")).strip().lower()
        if requested_mode not in SOURCE_MODES:
            return self.send_json(
                {"error": "invalid_mode", "message": "不支持的数据源模式"},
                status=HTTPStatus.BAD_REQUEST,
            )

        mode = save_source_mode(requested_mode)
        return self.send_json({"mode": mode, "modes": sorted(SOURCE_MODES)})

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def send_json(self, payload: dict[str, object], status: HTTPStatus = HTTPStatus.OK) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    server = ThreadingHTTPServer((DEFAULT_HOST, DEFAULT_PORT), FundHandler)
    print(f"Fund web server running at http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
