# Fund Management Dashboard

This project now supports a local web dashboard as the default experience.

## Quick Start

1. Run `start-fund-web.cmd`
2. The local server starts on `http://127.0.0.1:8765/`
3. Your browser opens the dashboard automatically

## Main Scripts

- `start-fund-web.cmd`: starts the local web dashboard
- `stop-fund-web.cmd`: stops the local web server on port `8765`
- `start-fund-extension.cmd`: keeps the old Edge extension mode available
- `打开基金系统.cmd`: Chinese shortcut that forwards to `start-fund-web.cmd`

## Web Dashboard Features

- fund holdings overview
- real-time quote refresh through a local proxy
- daily profit and holding profit summary
- local holdings editor with browser storage
- privacy toggle for hiding money amounts

## Project Structure

- `web/`: local web UI
- `scripts/fund_web_server.py`: local HTTP server and quote proxy
- `src/`: original extension source
- `dist/`: built extension output

## Notes

- The web version is now the recommended way to use the project.
- The extension mode is kept only for compatibility.
