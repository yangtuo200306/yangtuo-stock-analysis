# -*- coding: utf-8 -*-
"""
股票 APP 专属后端（BFF）

为手机端提供特异化接口：
  - 批量行情：走共享后端（添加并发+缓存优化）
  - 搜索股票：新浪搜索接口
  - 后续手机端特有功能都在此扩展，不动共享后端。
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(
    title="Stock App Backend (BFF)",
    description="手机端专用后端 — 搜索+行情优化",
    version="0.3.0",
)

# ── 简单内存缓存 ──
_quote_cache: dict[str, tuple[float, dict[str, Any]]] = {}  # code -> (timestamp, data)
_search_cache: dict[str, tuple[float, list[dict[str, str]]]] = {}  # query -> (timestamp, results)
_QUOTE_CACHE_TTL = 60  # 行情缓存有效期（秒）
_SEARCH_CACHE_TTL = 60  # 搜索缓存有效期（秒）

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
    """批量获取行情 — 并发请求 + 缓存优化"""
    if not req.codes:
        return BatchQuoteResponse(results=[], total=0, succeeded=0, failed=0)

    # 过滤缓存命中的数据
    now = time.time()
    cached_results = []
    uncached_codes = []
    
    for code in req.codes:
        code = code.strip()
        if code in _quote_cache:
            ts, data = _quote_cache[code]
            if now - ts < _QUOTE_CACHE_TTL:
                cached_results.append(data)
            else:
                uncached_codes.append(code)
        else:
            uncached_codes.append(code)

    # 新浪行情对 A 股、港股和指数更快，主后端作为补充兜底。
    # 当前手机版暂不支持美股实时行情，避免 AAPL/TSLA 每次刷新都回退共享后端刷屏。
    if uncached_codes:
        supported_codes = [c for c in uncached_codes if not _is_us_stock_code(c)]
        fresh_results = await _fetch_sina_batch(supported_codes) if supported_codes else []
        found_codes = {r["stock_code"].lower() for r in fresh_results}
        missing_codes = [c for c in supported_codes if c.lower() not in found_codes]
        if missing_codes:
            fresh_results.extend(await _fetch_main_backend_batch_concurrent(missing_codes))
        for r in fresh_results:
            _quote_cache[r["stock_code"]] = (now, r)
        cached_results.extend(fresh_results)

    return BatchQuoteResponse(
        results=cached_results,
        total=len(req.codes),
        succeeded=len(cached_results),
        failed=len(req.codes) - len(cached_results),
    )


async def _fetch_sina_batch(codes: list[str]) -> list[dict[str, Any]]:
    """从新浪批量获取行情"""
    sina_codes = [_to_sina_symbol(code) for code in codes]
    url = f"http://hq.sinajs.cn/list={','.join(sina_codes)}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                url,
                headers={
                    "Referer": "https://finance.sina.com.cn",
                    "User-Agent": "Mozilla/5.0",
                },
            )
            response.raise_for_status()
            response.encoding = "gbk"
            return _parse_sina_response(response.text, sina_codes)
    except Exception as e:
        print(f"新浪接口失败: {e}")
        return []


def _parse_sina_response(response_text: str, original_codes: list[str]) -> list[dict[str, Any]]:
    """解析新浪行情响应"""
    results = []
    lines = response_text.strip().split("\n")

    for line in lines:
        if not line:
            continue

        # 格式：var hq_str_sh600519="贵州茅台,1688.00,...";
        match = re.match(r'var hq_str_(\w+)="([^"]+)";', line)
        if not match:
            continue

        sina_code = match.group(1)
        data = match.group(2)
        fields = data.split(",")

        if len(fields) < 6:
            continue

        if sina_code.startswith("hk"):
            stock_name = fields[1] or fields[0] or _get_hk_stock_name(sina_code)
            current_price = _safe_float(fields[6] if len(fields) > 6 else "")
            yesterday_close = _safe_float(fields[3] if len(fields) > 3 else "")
            # 自己计算涨跌幅，避免新浪返回的字段为0
            change = round(current_price - yesterday_close, 2) if yesterday_close else 0
            change_percent = (
                round((current_price - yesterday_close) / yesterday_close * 100, 2)
                if yesterday_close else 0
            )
            open_price = _safe_float(fields[2] if len(fields) > 2 else "")
            high = _safe_float(fields[4] if len(fields) > 4 else "")
            low = _safe_float(fields[5] if len(fields) > 5 else "")
            volume = _safe_int(fields[12] if len(fields) > 12 else "")
            amount = _safe_float(fields[11] if len(fields) > 11 else "")
        else:
            stock_name = fields[0]
            current_price = _safe_float(fields[3] if len(fields) > 3 else "")
            yesterday_close = _safe_float(fields[2] if len(fields) > 2 else "")
            if current_price <= 0 and _is_sina_index_symbol(sina_code):
                current_price = yesterday_close
            change = round(current_price - yesterday_close, 2) if yesterday_close else 0
            change_percent = (
                round((current_price - yesterday_close) / yesterday_close * 100, 2)
                if yesterday_close else 0
            )
            open_price = _safe_float(fields[1] if len(fields) > 1 else "")
            high = _safe_float(fields[4] if len(fields) > 4 else "")
            low = _safe_float(fields[5] if len(fields) > 5 else "")
            volume = _safe_int(fields[8] if len(fields) > 8 else "")
            amount = _safe_float(fields[9] if len(fields) > 9 else "")

        if current_price <= 0 and not _is_sina_index_symbol(sina_code):
            continue
        if current_price <= 0 and yesterday_close <= 0:
            continue

        # 转换回原始代码格式
        original_code = sina_code
        if _is_sina_index_symbol(sina_code):
            original_code = sina_code
        elif sina_code.startswith("sh") or sina_code.startswith("sz"):
            original_code = sina_code[2:]
        elif sina_code.startswith("hk"):
            original_code = "hk" + sina_code[2:]

        results.append({
            "stock_code": original_code,
            "stock_name": stock_name,
            "current_price": current_price,
            "change": change,
            "change_percent": change_percent,
            "open": open_price,
            "high": high,
            "low": low,
            "volume": volume,
            "amount": amount,
        })

    return results


def _to_sina_symbol(code: str) -> str:
    """Convert app stock code to Sina quote symbol."""
    normalized = code.strip().lower()
    if normalized.startswith(("sh", "sz", "hk")):
        return normalized
    if re.match(r"^\d{5}$", normalized):
        return "hk" + normalized
    if re.match(r"^\d{6}$", normalized):
        return ("sh" if normalized.startswith(("5", "6", "9")) else "sz") + normalized
    return normalized


def _is_sina_index_symbol(code: str) -> bool:
    return code.startswith("sh000") or code.startswith("sz399")


def _is_us_stock_code(code: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z]{1,5}", code.strip()))


async def _fetch_main_backend_batch(codes: list[str]) -> list[dict[str, Any]]:
    """从主后端获取行情（并发请求）"""
    if not codes:
        return []
    
    # 使用信号量限制并发数（最多5个并发请求）
    semaphore = asyncio.Semaphore(5)
    
    async def fetch_with_semaphore(client: httpx.AsyncClient, code: str) -> dict[str, Any] | None:
        async with semaphore:
            return await _fetch_single_from_main(client, code)
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = [fetch_with_semaphore(client, code) for code in codes]
        responses = await asyncio.gather(*tasks)
        return [r for r in responses if r]


async def _fetch_main_backend_batch_concurrent(codes: list[str]) -> list[dict[str, Any]]:
    """并发获取行情（供批量接口使用）"""
    return await _fetch_main_backend_batch(codes)


def _normalize_code_for_backend(code: str) -> str:
    """标准化股票代码用于请求后端"""
    code = code.strip().lower()
    # 港股格式转换：hk00700 -> 00700
    if code.startswith("hk") and len(code) == 7:
        return code[2:]  # hk00700 -> 00700
    return code


async def _fetch_single_from_main(client: httpx.AsyncClient, code: str) -> dict[str, Any] | None:
    """从主后端获取单个股票行情"""
    try:
        # 标准化代码格式
        backend_code = _normalize_code_for_backend(code)
        response = await client.get(f"{MAIN_BACKEND_URL}/api/v1/stocks/{backend_code}/quote", timeout=8.0)
        if response.status_code == 200:
            data = response.json()
            # 标准化股票代码，保持与输入一致
            returned_code = data.get("stock_code", code) or code
            # 转换为小写格式便于匹配
            normalized_code = returned_code.lower()
            # 港股特殊处理：00700 -> hk00700
            if re.match(r"^\d{5}$", normalized_code):
                normalized_code = "hk" + normalized_code
            
            return {
                "stock_code": normalized_code,
                "stock_name": data.get("stock_name", ""),
                "current_price": data.get("current_price", 0.0),
                "change": data.get("change", 0.0),
                "change_percent": data.get("change_percent", 0.0),
                "open": data.get("open", 0.0),
                "high": data.get("high", 0.0),
                "low": data.get("low", 0.0),
                "volume": data.get("volume", 0),
                "amount": data.get("amount", 0.0),
            }
    except Exception as e:
        print(f"主后端获取 {code} 失败: {e}")
    return None


# 港股名称映射
_HK_STOCK_NAMES = {
    "hk00700": "腾讯控股",
    "hk00788": "建设银行",
    "hk00939": "工商银行",
    "hk00941": "中国移动",
    "hk00992": "联想集团",
    "hk01088": "中国人寿",
    "hk01171": "兖矿能源",
    "hk01359": "中国信达",
    "hk01658": "邮储银行",
    "hk01810": "小米集团",
    "hk02382": "舜宇光学",
    "hk02628": "中国人保",
    "hk02828": "中国人寿",
    "hk03328": "交通银行",
    "hk03690": "美团",
    "hk03968": "招商银行",
    "hk03988": "中国银行",
    "hk06690": "海尔智家",
    "hk06808": "微创医疗",
    "hk09618": "京东",
    "hk09626": "哔哩哔哩",
    "hk09888": "百度",
    "hk09939": "京东健康",
    "hk09961": "携程",
    "hk09987": "百胜中国",
}


def _get_hk_stock_name(code: str) -> str:
    """获取港股名称"""
    return _HK_STOCK_NAMES.get(code.lower(), "港股")


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


# ── 搜索接口 ──

@app.get("/api/v1/stocks/search")
async def search_stocks(q: str = Query(...)) -> list[dict[str, str]]:
    """搜索股票 — 通过新浪财经搜索接口"""
    if not q or len(q.strip()) < 1:
        return []
    
    query = q.strip()
    cache_key = query.lower()
    now = time.time()
    cached = _search_cache.get(cache_key)
    if cached:
        ts, results = cached
        if now - ts < _SEARCH_CACHE_TTL:
            return results
    
    # 新浪财经搜索接口
    search_url = f"http://suggest3.sinajs.cn/suggest/type=111&key={query}"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(search_url)
            response.raise_for_status()
            content = response.text
            
            # 解析新浪返回格式：var suggestvalue="股票名称,类型,代码,...";
            # 格式示例：var suggestvalue="五粮液,111,sz000858,sz000858,五粮液,,五粮液,99,1,ESG,,";
            if content.startswith("var suggestvalue="):
                # 提取引号内的内容
                start = content.find('"') + 1
                end = content.rfind('"')
                if start > 0 and end > start:
                    data = content[start:end]
                    parts = data.split(",")
                    if len(parts) >= 4:
                        name = parts[0].strip()
                        code = parts[2].strip()
                        if name and code:
                            # 标准化代码格式
                            normalized_code = code
                            if code.startswith("sh") or code.startswith("sz"):
                                normalized_code = code[2:]
                            elif code.startswith("hk"):
                                normalized_code = "hk" + code[2:].zfill(5)
                            results = [{"code": normalized_code, "name": name}]
                            _search_cache[cache_key] = (now, results)
                            return results
            
    except Exception as e:
        print(f"搜索失败: {e}")
    
    # 如果新浪接口失败，返回热门股票匹配
    results = [
        stock for stock in [
            {"code": "600519", "name": "贵州茅台"},
            {"code": "300750", "name": "宁德时代"},
            {"code": "hk00700", "name": "腾讯控股"},
            {"code": "002594", "name": "比亚迪"},
            {"code": "688981", "name": "中芯国际"},
            {"code": "000858", "name": "五粮液"},
            {"code": "AAPL", "name": "苹果"},
            {"code": "GOOGL", "name": "谷歌"},
            {"code": "MSFT", "name": "微软"},
            {"code": "NVDA", "name": "英伟达"},
            {"code": "TSLA", "name": "特斯拉"},
        ] if query.lower() in stock["name"].lower() or query.lower() in stock["code"].lower()
    ]
    _search_cache[cache_key] = (now, results)
    return results


# ── 问股代理接口 ──

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    skills: Optional[List[str]] = None
    mode: str = "fast"
    context: Optional[Dict[str, Any]] = None


@app.post("/api/v1/agent/chat/stream")
async def agent_chat_stream(request: ChatRequest):
    """代理问股流式接口到主后端"""
    print(f"=== 收到流式问股请求 ===")
    body = request.model_dump()
    print(f"请求体: {body}")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{MAIN_BACKEND_URL}/api/v1/agent/chat/stream",
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=60.0,
            ) as response:
                response.raise_for_status()

                async def stream_generator():
                    async for chunk in response.aiter_raw():
                        yield chunk

                return StreamingResponse(stream_generator(), media_type="text/event-stream")
    except Exception as e:
        print(f"流式问股代理失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/agent/chat")
async def agent_chat(request: ChatRequest) -> dict:
    """代理问股接口到主后端"""
    print(f"=== 收到普通问股请求 ===")
    body = request.model_dump()
    print(f"请求体: {body}")
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{MAIN_BACKEND_URL}/api/v1/agent/chat",
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=180.0,
            )
            response.raise_for_status()
            print(f"问股代理成功，响应状态码: {response.status_code}")
            return response.json()
    except Exception as e:
        print(f"问股代理失败: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── 健康检查 ──

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "main_backend": MAIN_BACKEND_URL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
