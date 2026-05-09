# SerialLLMplugin v1.5

发布日期：2026-05-09

## 版本定位
v1.5 是面向 STM32 + VS Code 工作流的 **MVP1 稳定化版本**。该版本聚焦“串口桥”核心能力：由扩展独占串口、统一输出给人类与智能体、保留可复现日志，并通过本地 HTTP/WebSocket 暴露实时与最近数据。

## 已实现功能

### 1) VS Code 侧桥接能力
- 提供命令注册与桥接生命周期管理（启动/停止/状态）。
- 提供底部面板 `MCU Debug > Serial` 作为默认串口观察入口。
- 保留 `MCU Serial Bridge: Open Panel` 兼容命令以聚焦同一视图。

### 2) 串口会话与命令收发
- 支持串口枚举、打开/关闭串口。
- 支持原始数据读取与文本命令发送。
- 串口异常、断连和解析失败均以“可恢复事件”记录，不导致整体桥接崩溃。

### 3) 本地 API（127.0.0.1）
- HTTP 接口：
  - `GET /session`
  - `GET /ports`
  - `GET /latest`
  - `GET /logs`
  - `POST /serial/open`
  - `POST /serial/close`
  - `POST /serial/send`
- WebSocket 接口：`/stream`
- 目标：为 Codex/Agent 提供统一、可脚本化的数据入口，避免直接占用串口。

### 4) 日志与可复现性
每次会话写入独立目录，包含：
- `session.json`
- `raw.log`
- `parsed.jsonl`
- `events.jsonl`
- `commands.jsonl`

并采用有界内存缓冲与流式写盘，兼顾实时性与长时间稳定性。

### 5) 协议支持（MVP1）
- `raw-text`
- `json-line`

### 6) 配置与任务集成基础（MVP3 Foundation）
- 支持读取以下配置文件之一：
  - `.vscode/mcu-serial-bridge.yaml`
  - `.vscode/stm32-serial-bridge.yaml`
  - `.vscode/stm32-serial-assistant.yaml`
- 支持通过“已配置任务标签”调用现有 VS Code 构建/烧录任务（不覆盖用户原任务文件）。

### 7) 测试与文档
- 增补 API 文档、手工测试计划、MVP1.5 发布检查清单。
- 增补 PowerShell 冒烟脚本用于 `latest` 与命令注入快速验证。

## 本版本明确不包含
- 波形绘图/示波功能（uPlot）
- VOFA FireWater 解析
- 复杂仪表盘 UI
- Cortex-Debug 会话生命周期托管
- pyOCD 探针生命周期托管

## 升级建议
- 对接 STM32 项目时，优先先配置 `.vscode/mcu-serial-bridge.yaml`。
- 保持现有 CMake preset 与 pyOCD + DAPLink 流程不变，仅将串口入口统一到 MCU Serial Bridge。

