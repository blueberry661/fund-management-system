from __future__ import annotations

import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def to_float(value: str | int | float | None, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def format_mmdd(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.fromisoformat(str(value)[:10])
        return parsed.strftime("%m-%d")
    except ValueError:
        return ""


def fetch_quotes(codes: list[str]) -> dict[str, dict[str, object]]:
    joined = ",".join(codes)
    params = urllib.parse.urlencode(
        {
            "pageIndex": 1,
            "pageSize": 200,
            "plat": "Android",
            "appType": "ttjj",
            "product": "EFund",
            "Version": 1,
            "deviceid": "fund_web_local",
            "Fcodes": joined,
        }
    )
    url = f"https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?{params}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8", errors="ignore"))

    items = payload.get("Datas")
    if not isinstance(items, list):
        raise urllib.error.URLError(payload.get("ErrMsg") or payload.get("ErrorMessage") or "upstream returned no data")

    quotes: dict[str, dict[str, object]] = {}
    for item in items:
        code = str(item.get("FCODE", "")).strip()
        if not code:
            continue

        nav = to_float(item.get("NAV"), 0.0)
        estimate = to_float(item.get("GSZ"), nav)
        daily_rate = to_float(item.get("GSZZL"), to_float(item.get("NAVCHGRT"), 0.0))
        previous_nav = nav / (1 + (daily_rate / 100)) if nav and daily_rate else nav

        quotes[code] = {
            "name": item.get("SHORTNAME", ""),
            "nav": nav,
            "gsz": estimate if estimate > 0 else nav,
            "dailyRate": daily_rate,
            "prevNav": previous_nav,
            "latestDate": format_mmdd(item.get("PDATE")),
        }

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
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            return self.send_json(
                {
                    "error": "upstream_error",
                    "message": str(exc),
                },
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
