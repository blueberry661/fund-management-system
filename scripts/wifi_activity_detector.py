import collections
import datetime as dt
import sys
import time

from wifi_activity_core import ensure_log_dir, escalate_label, read_wifi_snapshot, score_activity, write_log


def zh(text: str) -> str:
    return text.encode("utf-8").decode("unicode_escape")


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


TITLE = zh("WiFi \\u5bb6\\u4e2d\\u6d3b\\u52a8\\u7c97\\u7565\\u68c0\\u6d4b\\u5668")
CURRENT_NETWORK = zh("\\u5f53\\u524d\\u7f51\\u7edc")
INTERFACE_NAME = zh("\\u63a5\\u53e3\\u540d\\u79f0")
CURRENT_BAND = zh("\\u5f53\\u524d\\u9891\\u6bb5")
CHANNEL = zh("\\u4fe1\\u9053")
INTERVAL = zh("\\u91c7\\u6837\\u95f4\\u9694")
WINDOW = zh("\\u89c2\\u5bdf\\u7a97\\u53e3")
SECONDS = zh("\\u79d2")
TIMES = zh("\\u6b21")
NOTICE = zh("\\u8bf4\\u660e: \\u8fd9\\u662f\\u7c97\\u7565\\u68c0\\u6d4b\\uff0c\\u53ea\\u6839\\u636e WiFi \\u6ce2\\u52a8\\u4f30\\u8ba1\\u662f\\u5426\\u6709\\u4eba\\u8d70\\u52a8\\uff0c\\u4e0d\\u662f\\u7cbe\\u51c6\\u4eba\\u4f53\\u8bc6\\u522b\\u3002")
LOG_FILE = zh("\\u65e5\\u5fd7\\u6587\\u4ef6")
PRESS_CTRL = zh("\\u6309 Ctrl + C \\u7ed3\\u675f\\u3002")
READ_FAIL = zh("\\u8bfb\\u53d6 WiFi \\u72b6\\u6001\\u5931\\u8d25")
NOT_CONNECTED = zh("\\u5f53\\u524d WiFi \\u672a\\u8fde\\u63a5\\uff0c\\u65e0\\u6cd5\\u505a\\u6d3b\\u52a8\\u68c0\\u6d4b\\u3002")
SIGNAL = zh("\\u4fe1\\u53f7")
BASELINE = zh("\\u57fa\\u7ebf")
FLUCTUATION = zh("\\u6ce2\\u52a8")
RX = zh("\\u4e0b\\u884c")
TX = zh("\\u4e0a\\u884c")
SCORE = zh("\\u8bc4\\u5206")
FINISHED = zh("\\u68c0\\u6d4b\\u7ed3\\u675f\\u3002")
SAVED = zh("\\u8bb0\\u5f55\\u5df2\\u4fdd\\u5b58\\u5230")


def print_header(first: dict[str, object], interval_seconds: float, window_size: int) -> None:
    print(TITLE, flush=True)
    print("=" * 22, flush=True)
    print(f"{CURRENT_NETWORK}: {first['ssid']}", flush=True)
    print(f"{INTERFACE_NAME}: {first['name']}", flush=True)
    print(f"{CURRENT_BAND}: {first['band']} | {CHANNEL}: {first['channel']}", flush=True)
    print(f"{INTERVAL}: {interval_seconds} {SECONDS} | {WINDOW}: {window_size} {TIMES}", flush=True)
    print(NOTICE, flush=True)
    print("", flush=True)


def main() -> int:
    try:
        first = read_wifi_snapshot()
    except Exception as exc:
        print(f"{READ_FAIL}: {exc}")
        return 1

    if str(first["state"]).lower() != "connected":
        print(NOT_CONNECTED)
        return 1

    interval_seconds = 2.0
    window_size = 8
    history: collections.deque[dict[str, object]] = collections.deque(maxlen=window_size)

    log_dir = ensure_log_dir()
    log_path = log_dir / f"activity-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    with log_path.open("w", encoding="utf-8") as file:
        file.write("time,signal_percent,rx_rate,tx_rate,score,label,ssid,band,channel\n")

    print_header(first, interval_seconds, window_size)
    print(f"{LOG_FILE}: {log_path}", flush=True)
    print(PRESS_CTRL + "\n", flush=True)

    stable_baseline = int(first["signal_percent"])
    alert_streak = 0

    try:
        while True:
            row = read_wifi_snapshot()
            history.append(row)
            score, label = score_activity(list(history))

            signal_percent = int(row["signal_percent"])
            if label == zh("\\u53ef\\u80fd\\u6709\\u4eba\\u6d3b\\u52a8"):
                alert_streak += 1
            else:
                alert_streak = max(0, alert_streak - 1)
            label = escalate_label(label, alert_streak)

            if abs(signal_percent - stable_baseline) <= 2:
                stable_baseline = round((stable_baseline * 4 + signal_percent) / 5)

            delta = signal_percent - stable_baseline
            print(
                f"[{row['time'].strftime('%H:%M:%S')}] "
                f"{SIGNAL} {signal_percent:>3}% "
                f"({BASELINE} {stable_baseline:>3}%, {FLUCTUATION} {delta:+d}) | "
                f"{RX} {int(row['rx_rate']):>4} Mbps | "
                f"{TX} {int(row['tx_rate']):>4} Mbps | "
                f"{SCORE} {score:>5.1f} | {label}",
                flush=True,
            )
            write_log(log_path, row, score, label)
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print("\n" + FINISHED, flush=True)
        print(f"{SAVED}: {log_path}", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
