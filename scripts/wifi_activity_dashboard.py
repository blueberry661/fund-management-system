import collections
import datetime as dt
import tkinter as tk

from wifi_activity_core import ensure_log_dir, escalate_label, read_wifi_snapshot, score_activity, write_log


def zh(text: str) -> str:
    return text.encode("utf-8").decode("unicode_escape")


TITLE = zh("\\u5bb6\\u5ead WiFi \\u6d3b\\u52a8\\u76d1\\u6d4b\\u9762\\u677f")
SUBTITLE = zh("\\u9002\\u7528\\u4e8e\\u666e\\u901a Windows \\u7b14\\u8bb0\\u672c + \\u5bb6\\u7528\\u8def\\u7531\\u5668\\uff0c\\u53ea\\u80fd\\u505a\\u7c97\\u7565\\u6d3b\\u52a8\\u68c0\\u6d4b\\uff0c\\u4e0d\\u80fd\\u8f93\\u51fa\\u771f\\u5b9e\\u4eba\\u4f53\\u9aa8\\u67b6\\u3002")
STATUS_READY = zh("\\u51c6\\u5907\\u4e2d")
POSE_UNAVAILABLE = zh("\\u5f53\\u524d\\u786c\\u4ef6\\u4e0d\\u652f\\u6301\\u771f\\u5b9e\\u4eba\\u4f53\\u59ff\\u6001\\u663e\\u793a")
BASELINE = zh("\\u57fa\\u7ebf")
RX = zh("\\u4e0b\\u884c")
TX = zh("\\u4e0a\\u884c")
NETWORK = zh("\\u7f51\\u7edc")
BAND = zh("\\u9891\\u6bb5")
CHANNEL = zh("\\u4fe1\\u9053")
LATEST = zh("\\u6700\\u65b0\\u65f6\\u95f4")
READ_FAILED = zh("\\u8bfb\\u53d6\\u5931\\u8d25")
READ_WIFI_FAILED = zh("\\u8bfb\\u53d6 WiFi \\u72b6\\u6001\\u5931\\u8d25")


class ActivityDashboard:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title(TITLE)
        self.root.geometry("1100x760")
        self.root.configure(bg="#f4efe5")

        self.interval_ms = 2000
        self.history = collections.deque(maxlen=40)
        self.score_history = collections.deque(maxlen=40)
        self.stable_baseline = None
        self.alert_streak = 0
        self.log_path = self._init_log()

        self.status_var = tk.StringVar(value=STATUS_READY)
        self.score_var = tk.StringVar(value="-")
        self.signal_var = tk.StringVar(value="-")
        self.rate_var = tk.StringVar(value="-")
        self.network_var = tk.StringVar(value="-")
        self.pose_var = tk.StringVar(value=POSE_UNAVAILABLE)
        self.log_var = tk.StringVar(value=zh("\\u65e5\\u5fd7\\u6587\\u4ef6") + f": {self.log_path}")

        self._build_ui()
        self.root.after(300, self.refresh)

    def _init_log(self):
        log_dir = ensure_log_dir()
        log_path = log_dir / f"activity-gui-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
        with log_path.open("w", encoding="utf-8") as file:
            file.write("time,signal_percent,rx_rate,tx_rate,score,label,ssid,band,channel\n")
        return log_path

    def _card(self, parent: tk.Widget, title: str, variable: tk.StringVar, accent: str) -> tk.Frame:
        frame = tk.Frame(parent, bg="#fffaf2", bd=1, relief="solid")
        tk.Label(frame, text=title, font=("Microsoft YaHei", 12, "bold"), bg="#fffaf2", fg="#3f4c46").pack(
            anchor="w", padx=14, pady=(12, 6)
        )
        tk.Label(frame, textvariable=variable, font=("Microsoft YaHei", 18, "bold"), bg="#fffaf2", fg=accent).pack(
            anchor="w", padx=14, pady=(0, 12)
        )
        return frame

    def _build_ui(self) -> None:
        tk.Label(self.root, text=TITLE, font=("Microsoft YaHei", 24, "bold"), bg="#f4efe5", fg="#17352f").pack(
            pady=(18, 8)
        )
        tk.Label(self.root, text=SUBTITLE, font=("Microsoft YaHei", 10), bg="#f4efe5", fg="#5c675f").pack()

        top = tk.Frame(self.root, bg="#f4efe5")
        top.pack(fill="x", padx=20, pady=14)

        self._card(top, zh("\\u5f53\\u524d\\u5224\\u65ad"), self.status_var, "#0f766e").pack(side="left", fill="both", expand=True, padx=8)
        self._card(top, zh("\\u6d3b\\u52a8\\u8bc4\\u5206"), self.score_var, "#b45309").pack(side="left", fill="both", expand=True, padx=8)
        self._card(top, zh("WiFi \\u4fe1\\u53f7"), self.signal_var, "#1d4ed8").pack(side="left", fill="both", expand=True, padx=8)
        self._card(top, zh("\\u6536\\u53d1\\u901f\\u7387"), self.rate_var, "#7c3aed").pack(side="left", fill="both", expand=True, padx=8)

        middle = tk.Frame(self.root, bg="#f4efe5")
        middle.pack(fill="both", expand=True, padx=20, pady=6)

        left = tk.Frame(middle, bg="#fffaf2", bd=1, relief="solid")
        left.pack(side="left", fill="both", expand=True, padx=(0, 10))
        tk.Label(left, text=zh("\\u5b9e\\u65f6\\u6d3b\\u52a8\\u66f2\\u7ebf"), font=("Microsoft YaHei", 16, "bold"), bg="#fffaf2", fg="#17352f").pack(
            anchor="w", padx=16, pady=(16, 8)
        )
        self.canvas = tk.Canvas(left, width=700, height=360, bg="#fffdf8", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True, padx=16, pady=(0, 16))

        right = tk.Frame(middle, bg="#fffaf2", bd=1, relief="solid", width=280)
        right.pack(side="left", fill="y")
        right.pack_propagate(False)

        tk.Label(right, text=zh("\\u4e2d\\u6587\\u8bf4\\u660e"), font=("Microsoft YaHei", 16, "bold"), bg="#fffaf2", fg="#17352f").pack(
            anchor="w", padx=16, pady=(16, 8)
        )
        info = zh(
            "\\u770b\\u54ea\\u91cc:\\n"
            "1. \\u5f53\\u524d\\u5224\\u65ad\\n"
            "2. \\u6d3b\\u52a8\\u8bc4\\u5206\\n"
            "3. \\u66f2\\u7ebf\\u662f\\u5426\\u7a81\\u7136\\u62ac\\u5347\\n\\n"
            "\\u5efa\\u8bae\\u6d4b\\u8bd5:\\n"
            "1. \\u5148\\u9759\\u6b62 20-30 \\u79d2\\n"
            "2. \\u518d\\u8ba9\\u4eba\\u5728\\u623f\\u95f4\\u91cc\\u8d70\\u52a8\\n"
            "3. \\u89c2\\u5bdf\\u72b6\\u6001\\u662f\\u5426\\u53d8\\u6210\\u201c\\u53ef\\u80fd\\u6709\\u4eba\\u6d3b\\u52a8\\u201d\\n\\n"
            "\\u59ff\\u6001\\u663e\\u793a:\\n"
            "\\u5f53\\u524d\\u786c\\u4ef6\\u65e0\\u6cd5\\u8f93\\u51fa\\u771f\\u5b9e\\u4eba\\u4f53\\u59ff\\u6001\\u9aa8\\u67b6\\u3002"
        )
        tk.Label(right, text=info, justify="left", font=("Microsoft YaHei", 11), bg="#fffaf2", fg="#4e5d57").pack(
            anchor="w", padx=16, pady=(0, 14)
        )

        pose_frame = tk.Frame(right, bg="#f0ebe1", bd=1, relief="solid")
        pose_frame.pack(fill="x", padx=16, pady=(0, 10))
        tk.Label(pose_frame, text=zh("\\u4eba\\u4f53\\u59ff\\u6001\\u533a\\u57df"), font=("Microsoft YaHei", 12, "bold"), bg="#f0ebe1", fg="#6b4f2c").pack(
            pady=(12, 6)
        )
        tk.Label(
            pose_frame,
            textvariable=self.pose_var,
            wraplength=220,
            justify="center",
            font=("Microsoft YaHei", 10),
            bg="#f0ebe1",
            fg="#6b4f2c",
        ).pack(padx=10, pady=(0, 12))

        bottom = tk.Frame(self.root, bg="#f4efe5")
        bottom.pack(fill="x", padx=20, pady=(0, 18))
        tk.Label(bottom, textvariable=self.network_var, font=("Microsoft YaHei", 11), bg="#f4efe5", fg="#374151").pack(anchor="w")
        tk.Label(bottom, textvariable=self.log_var, font=("Microsoft YaHei", 10), bg="#f4efe5", fg="#6b7280").pack(anchor="w", pady=(4, 0))

    def refresh(self) -> None:
        try:
            row = read_wifi_snapshot()
            self.history.append(row)
            if self.stable_baseline is None:
                self.stable_baseline = int(row["signal_percent"])

            score, label = score_activity(list(self.history))
            self.score_history.append(score)

            if label == zh("\\u53ef\\u80fd\\u6709\\u4eba\\u6d3b\\u52a8"):
                self.alert_streak += 1
            else:
                self.alert_streak = max(0, self.alert_streak - 1)
            label = escalate_label(label, self.alert_streak)

            signal_percent = int(row["signal_percent"])
            if abs(signal_percent - self.stable_baseline) <= 2:
                self.stable_baseline = round((self.stable_baseline * 4 + signal_percent) / 5)

            self.status_var.set(label)
            self.score_var.set(f"{score:.1f}")
            self.signal_var.set(f"{signal_percent}% / {BASELINE} {self.stable_baseline}%")
            self.rate_var.set(
                f"{RX} {int(row['rx_rate'])} | {TX} {int(row['tx_rate'])}"
            )
            self.network_var.set(
                f"{NETWORK}: {row['ssid']} | {BAND}: {row['band']} | "
                f"{CHANNEL}: {row['channel']} | {LATEST}: {row['time'].strftime('%H:%M:%S')}"
            )

            write_log(self.log_path, row, score, label)
            self.draw_graph()
        except Exception as exc:
            self.status_var.set(READ_FAILED)
            self.network_var.set(f"{READ_WIFI_FAILED}: {exc}")
        finally:
            self.root.after(self.interval_ms, self.refresh)

    def draw_graph(self) -> None:
        self.canvas.delete("all")
        width = max(self.canvas.winfo_width(), 700)
        height = max(self.canvas.winfo_height(), 360)
        left, right, top, bottom = 50, width - 20, 20, height - 35

        self.canvas.create_rectangle(left, top, right, bottom, outline="#d7d2c7")
        for idx in range(6):
            y = top + (bottom - top) * idx / 5
            self.canvas.create_line(left, y, right, y, fill="#ece7de")
            value = 30 - idx * 6
            self.canvas.create_text(28, y, text=str(value), fill="#8a867f", font=("Microsoft YaHei", 9))

        scores = list(self.score_history)
        if len(scores) < 2:
            return

        max_score = 30.0
        points = []
        for idx, score in enumerate(scores):
            x = left + (right - left) * idx / (len(scores) - 1)
            y = bottom - min(score, max_score) / max_score * (bottom - top)
            points.extend([x, y])

        self.canvas.create_line(*points, fill="#0f766e", width=3, smooth=True)
        for idx, score in enumerate(scores):
            x = left + (right - left) * idx / (len(scores) - 1)
            y = bottom - min(score, max_score) / max_score * (bottom - top)
            self.canvas.create_oval(x - 3, y - 3, x + 3, y + 3, fill="#c2410c", outline="")

        self.canvas.create_text(left, bottom + 18, text=zh("\\u8fc7\\u53bb\\u4e00\\u6bb5\\u65f6\\u95f4"), anchor="w", fill="#6b7280", font=("Microsoft YaHei", 9))
        self.canvas.create_text(right, bottom + 18, text=zh("\\u73b0\\u5728"), anchor="e", fill="#6b7280", font=("Microsoft YaHei", 9))

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    ActivityDashboard().run()
