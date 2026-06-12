"""快速测试手机后端批量行情接口"""
import asyncio
import httpx


async def main():
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://localhost:8001/api/v1/stocks/quotes/batch",
            json={"codes": ["600519", "000001", "002594", "300750", "hk00700"]},
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Total: {data['total']}, Succeeded: {data['succeeded']}, Failed: {data['failed']}")
        for r in data["results"]:
            print(f"  {r['stock_code']} {r['stock_name']}: {r['current_price']} ({r['change_percent']}%)")


asyncio.run(main())