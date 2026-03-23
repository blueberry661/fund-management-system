import datetime as dt
import pathlib
import re
import statistics
import subprocess


ROOT = pathlib.Path(r"C:\Users\Lang\Desktop\Fund Management System")
LOG_DIR = ROOT / "data" / "wifi-activity-detector"


def zh(text: str) -> str:
    return text.encode("utf-8").decode("unicode_escape")


LABEL_SAMPLING = zh("\\u91c7\\u6837\\u4e2d")
LABEL_ACTIVITY = zh("\\u53ef\\u80fd\\u6709\\u4eba\\u6d3b\\u52a8")
LABEL_SLIGHT = zh("\\u8f7b\\u5fae\\u6ce2\\u52a8")
LABEL_STABLE = zh("\\u5f53\\u524d\\u8f83\\u5e73\\u7a33")
LABEL_ACTIVITY_HIGH = zh("\\u5927\\u6982\\u7387\\u6709\\u4eba\\u6d3b\\u52a8")


def run_netsh() -> str:
    completed = subprocess.run(
        ["netsh", "wlan", "show", "interfaces"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return completed.stdout


def extract(text: str, field: str) -> str:
    match = re.search(rf"^\s*{re.escape(field)}\s*:\s*(.+?)\s*$", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_int(raw: str) -> int:
    match = re.search(r"(\d+)", raw or "")
    return int(match.group(1)) if match else 0


def read_wifi_snapshot() -> dict[str, object]:
    text = run_netsh()
    return {
        "time": dt.datetime.now(),
        "name": extract(text, "Name"),
        "state": extract(text, "State"),
        "ssid": extract(text, "SSID"),
        "band": extract(text, "Band"),
        "channel": extract(text, "Channel"),
        "signal_percent": parse_int(extract(text, "Signal")),
        "rx_rate": parse_int(extract(text, "Receive rate (Mbps)")),
        "tx_rate": parse_int(extract(text, "Transmit rate (Mbps)")),
    }


def score_activity(history: list[dict[str, object]]) -> tuple[float, str]:
    if len(history) < 4:
        return 0.0, LABEL_SAMPLING

    signals = [int(item["signal_percent"]) for item in history]
    rx_rates = [int(item["rx_rate"]) for item in history]
    tx_rates = [int(item["tx_rate"]) for item in history]

    signal_span = max(signals) - min(signals)
    signal_std = statistics.pstdev(signals) if len(signals) > 1 else 0.0
    rx_span = max(rx_rates) - min(rx_rates)
    tx_span = max(tx_rates) - min(tx_rates)

    score = signal_span * 1.8 + signal_std * 2.2 + min(rx_span, 250) * 0.03 + min(tx_span, 250) * 0.03

    if score >= 18:
        return score, LABEL_ACTIVITY
    if score >= 9:
        return score, LABEL_SLIGHT
    return score, LABEL_STABLE


def escalate_label(label: str, alert_streak: int) -> str:
    if label == LABEL_ACTIVITY and alert_streak >= 2:
        return LABEL_ACTIVITY_HIGH
    return label


def ensure_log_dir() -> pathlib.Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return LOG_DIR


def write_log(log_path: pathlib.Path, row: dict[str, object], score: float, label: str) -> None:
    line = (
        f"{row['time'].isoformat(timespec='seconds')},"
        f"{row['signal_percent']},{row['rx_rate']},{row['tx_rate']},"
        f"{score:.1f},{label},{row['ssid']},{row['band']},{row['channel']}\n"
    )
    with log_path.open("a", encoding="utf-8") as file:
        file.write(line)
