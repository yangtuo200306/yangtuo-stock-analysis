"""
股票 APP 专属后端（BFF）

为手机端提供特异化接口：
  - 批量行情：A 股/港股直连新浪批量接口（1次HTTP），不支持的（美股等）降级到共享后端。
  - 后续手机端特有功能都在此扩展，不动共享后端。
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Stock App Backend (BFF)",
    description="手机端专用后端 — 批量行情直连新浪，不支持的降级到共享后端",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 主后端地址（可通过环境变量覆盖，降级用）
MAIN_BACKEND_URL = os.getenv("MAIN_BACKEND_URL", "http://localhost:8000")


# ── 数据结构 ──

class BatchQuoteRequest(BaseModel):
    codes: list[str]


class BatchQuoteResponse(BaseModel):
    results: list[dict[str, Any]]
    total: int
    succeeded: int
    failed: int


# ── 核心接口：批量行情 ──

@app.post("/api/v1/stocks/quotes/batch", response_model=BatchQuoteResponse)
async def batch_quotes(req: BatchQuoteRequest) -> BatchQuoteResponse:
    """批量获取行情 — A/港股走新浪批量，剩下的走共享后端降级"""
    start = time.time()

    if not req.codes:
        return BatchQuoteResponse(results=[], total=0, succeeded=0, failed=0)

    # 1) 按是否新浪支持分组
    sina_symbols: dict[str, str] = {}       # code → symbol
    fallback_codes: list[str] = []

    for code in req.codes:
        symbol = _to_sina_symbol(code)
        if symbol:
            sina_symbols[code] = symbol
        else:
            fallback_codes.append(code)

    results: list[dict[str, Any]] = []

    # 2) 新浪批量拉取
    if sina_symbols:
        try:
            symbols_str = ",".join(sina_symbols.values())
            url = f"http://hq.sinajs.cn/list={symbols_str}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={
                    "Referer": "http://finance.sina.com.cn",
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                })

            if resp.status_code == 200:
                sina_results = _parse_sina_response(resp.text, sina_symbols)
                results.extend(sina_results)
            else:
                # 新浪失败，全部降级
                fallback_codes.extend(sina_symbols.keys())
        except Exception:
            fallback_codes.extend(sina_symbols.keys())

    # 3) 降级：不支持的代码走共享后端
    if fallback_codes:
        async with httpx.AsyncClient(timeout=30.0) as client:
            tasks = [
                client.get(f"{MAIN_BACKEND_URL}/api/v1/stocks/{code}/quote")
                for code in fallback_codes
            ]
            fb_responses = await asyncio.gather(*tasks, return_exceptions=True)

        for fb_resp in fb_responses:
            if not isinstance(fb_resp, Exception) and fb_resp.status_code == 200:
                results.append(fb_resp.json())

    elapsed = time.time() - start
    succeeded = len(results)
    print(
        f"[batch] {len(req.codes)} 只, 成功 {succeeded}, "
        f"耗时 {elapsed:.1f}s (新浪 {len(sina_symbols)}, 降级 {len(fallback_codes)})"
    )

    return BatchQuoteResponse(
        results=results,
        total=len(req.codes),
        succeeded=succeeded,
        failed=len(req.codes) - succeeded,
    )


# ── 工具函数 ──

def _to_sina_symbol(code: str) -> str | None:
    """转换股票代码为新浪格式，不支持的返回 None"""
    c = code.strip().upper()

    # 港股: hk00700 → hk00700
    if c.startswith("HK"):
        return f"hk{c[2:]}"

    # A 股: 6xx → sh6xx; 0xx/3xx/2xx → sz0xx
    if c[0] == "6":
        return f"sh{c}"
    if c[0] in ("0", "2", "3"):
        return f"sz{c}"

    # 美股及其他：不支持
    return None


def _parse_sina_response(
    text: str,
    code_to_symbol: dict[str, str],
) -> list[dict[str, Any]]:
    """解析新浪批量行情返回的 JS 变量文本 → StockQuote 字典列表"""
    reverse_map = {v: k for k, v in code_to_symbol.items()}
    results: list[dict[str, Any]] = []

    for line in text.strip().split("\n"):
        line = line.strip()
        if not line or not line.startswith("var hq_str_"):
            continue

        m = re.match(r'var hq_str_(\w+)="(.*)"', line)
        if not m:
            continue

        symbol = m.group(1)
        payload = m.group(2)
        if not payload or payload.count(",") < 10:
            continue

        fields = payload.split(",")
        code = reverse_map.get(symbol, "")
        try:
            name = fields[0]
            yesterday_close = _safe_float(fields[2])
            current_price = _safe_float(fields[3])

            results.append({
                "stock_code": code,
                "stock_name": name,
                "current_price": current_price,
                "change": round(current_price - yesterday_close, 2) if yesterday_close else 0,
                "change_percent": (
                    round((current_price - yesterday_close) / yesterday_close * 100, 2)
                    if yesterday_close else 0
                ),
                "open": _safe_float(fields[1]),
                "high": _safe_float(fields[4]),
                "low": _safe_float(fields[5]),
                "volume": _safe_int(fields[8]),
                "amount": _safe_float(fields[9]),
            })
        except (ValueError, IndexError):
            continue

    return results


def _safe_float(v: str) -> float:
    """安全转换 float，空值返回 0"""
    try:
        return float(v) if v else 0.0
    except ValueError:
        return 0.0


def _safe_int(v: str) -> int:
    try:
        return int(v) if v else 0
    except ValueError:
        return 0


# ── 健康检查 ──

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "main_backend": MAIN_BACKEND_URL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)