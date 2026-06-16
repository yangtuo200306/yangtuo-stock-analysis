# Stock Analysis Demo App

一个基于 **Expo + React Native Web** 的移动端股票分析 Demo，可对接后端 API 实现行情查询、LLM 分析报告等功能。

## 功能

| 页面 | 功能 |
|------|------|
| **自选** | 展示自选股实时行情（现价、涨跌幅），红涨绿跌，下拉刷新，点击跳转分析 |
| **分析** | 输入股票代码，提交分析任务，轮询等待 LLM 生成报告，展示完整分析结果 |
| **历史** | 查看历史分析记录列表，点击查看详情 |
| **设置** | 配置后端 API 地址，保存到本地存储 |

## 技术栈

- **框架**：Expo 52 + React Native Web
- **语言**：TypeScript
- **导航**：React Navigation（Bottom Tabs + Native Stack）
- **网络**：axios + AsyncStorage（地址持久化）
- **构建**：Expo Metro Bundler

## 快速开始

```bash
# 安装依赖
npm ci

# 启动 Web 开发模式
npx expo start --web

# 手机预览（同局域网）
npx expo start
# → 用 Expo Go 扫码，或在手机浏览器打开 http://<电脑IP>:8081
```

## 项目结构

```
stock-app/
├── App.tsx                  # 入口：导航配置
├── app.json                 # Expo 配置
├── tsconfig.json            # TypeScript 配置
├── package.json             # 依赖管理
├── .gitignore
└── src/
    ├── api/
    │   └── client.ts        # API 封装（axios 实例 + 地址管理）
    └── screens/
        ├── WatchlistScreen.tsx       # 自选 Tab
        ├── AnalysisInputScreen.tsx    # 分析输入 Tab
        ├── AnalysisScreen.tsx         # 分析详情页
        ├── HistoryScreen.tsx          # 历史 Tab
        └── SettingsScreen.tsx         # 设置 Tab
```

## 后端对接

App 需要通过 **设置页** 配置后端 API 地址。建议后端：

- 监听 `0.0.0.0` 以便手机访问
- 配置 CORS 允许前端来源
- 开放防火墙端口（Windows 需 `netsh advfirewall` 规则）

### 支持的 API 接口

| 端点 | 用途 |
|------|------|
| `GET /api/v1/stocks/watchlist` | 自选股列表 |
| `GET /api/v1/stocks/{code}/quote` | 单只股票实时行情 |
| `POST /api/v1/analysis/analyze` | 提交分析任务 |
| `GET /api/v1/analysis/status/{task_id}` | 轮询分析进度 |
| `GET /api/v1/history?limit=50&page=1` | 历史分析记录 |
| `GET /api/v1/history/{id}` | 单条分析详情 |

## 当前状态

- [x] 4 个 Tab 页面布局与导航
- [x] 自选股行情展示（腾讯财经数据源）
- [x] LLM 分析报告（通过硅基流动调用 DeepSeek）
- [x] 历史记录列表与详情
- [x] 后端地址可配置
- [x] Web 模式浏览器 + 手机浏览器均可访问
- [x] 跨设备联调（CORS + 防火墙配置完整）

---

## 下一步规划

### 阶段一：体验优化

- [ ] 分析页分阶段状态提示（"获取行情中…" / "AI 分析中…" / "生成报告中…"）
- [ ] 分析页添加取消按钮
- [ ] 设置页添加「测试连接」按钮
- [ ] 错误提示具体化（网络错误、超时、后端异常区分展示）
- [ ] 加载骨架屏替代纯 spinner

### 阶段二：功能增强

- [ ] 自选股可添加/删除（调用后端管理接口）
- [ ] 自选股点击代码自动填充到分析输入框
- [ ] 分析历史支持筛选（按股票代码搜索）
- [ ] 支持美股/港股代码格式

### 阶段三：工程化

- [ ] 构建 Android APK（`eas build`）
- [ ] 构建 iOS IPA
- [ ] 配置环境变量（区分开发/生产后端地址）
- [ ] 添加基础单元测试
- [ ] CI 接入（lint + type-check + build）

### 阶段四（可选）

- [ ] 深色模式
- [ ] 国际化（中英文切换）
- [ ] 离线缓存最近一次分析结果