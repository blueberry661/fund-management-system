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

    latest = valid_points[-1]
    previous = valid_points[-2] if len(valid_points) > 1 else latest

    latest_ts = int(to_float(latest.get("x"), 0))
    previous_ts = int(to_float(previous.get("x"), 0))

    return {
        "name": parse_js_var(text, "fS_name") or "",
        "latestNav": to_float(latest.get("y"), 0.0),
        "previousNav": to_float(previous.get("y"), 0.0),
        "latestDate": datetime.fromtimestamp(latest_ts / 1000).strftime("%Y-%m-%d") if latest_ts else "",
        "previousDate": datetime.fromtimestamp(previous_ts / 1000).strftime("%Y-%m-%d") if previous_ts else "",
    }


def build_quote(code: str) -> dict[str, object]:
    quote_data = fetch_single_quote(code)
    history_data = fetch_history_snapshot(code)

    nav = to_float(quote_data.get("nav"), to_float(history_data.get("latestNav"), 0.0))
    if nav <= 0:
        nav = to_float(history_data.get("latestNav"), 0.0)

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
        "latestDate": format_mmdd(
            str(quote_data.get("estimateTime", ""))[:10] or str(history_data.get("latestDate", ""))
        ),
        "previousDate": format_mmdd(str(history_data.get("previousDate", ""))),
        "estimateTime": str(quote_data.get("estimateTime", "")),
        "hasEstimate": has_estimate,
    }


def fetch_quotes(codes: list[str]) -> dict[str, dict[str, object]]:
    quotes: dict[str, dict[str, object]] = {}
    errors: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(codes)))) as executor:
        future_map = {executor.submit(build_quote, code): code for code in codes}
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

        return super().do_GET()

    def handle_quotes(self, query: str) -> None:
        params = urllib.parse.parse_qs(query)
        codes = [code.strip() for code in params.get("codes", [""])[0].split(",") if code.strip()]
        if not codes:
            return self.send_json({"quotes": {}, "updated_at": ""})

        try:
            quotes = fetch_quotes(codes)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as exc:
            return self.send_json(
                {"error": "upstream_error", "message": str(exc)},
                status=HTTPStatus.BAD_GATEWAY,
            )

        updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return self.send_json({"quotes": quotes, "updated_at": updated_at})

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
