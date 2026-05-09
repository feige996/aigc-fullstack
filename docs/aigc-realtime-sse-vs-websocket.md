# AIGC 实时推送选型：SSE 与 WebSocket

## 结论

AIGC 生图、生视频任务状态推送默认使用 SSE。

推荐分工：

- HTTP：提交任务、取消任务、重试任务、查询任务详情。
- SSE：任务排队、生成中、进度、完成、失败、额度变化等服务端推送。
- WebSocket：仅在后续出现多人协作、实时画布、双向控制等强实时交互时引入。

## 为什么选择 SSE

AIGC 任务状态通常是服务端单向推送给前端：

```txt
queued -> running -> progress -> succeeded
queued -> running -> failed
```

前端不需要在同一条实时连接里高频发送消息。提交、取消、重试这些动作可以继续走普通 HTTP API。

因此 SSE 的模型更贴合当前业务。

## SSE 适合的场景

- 任务状态推送。
- 生成进度推送。
- 完成、失败通知。
- 积分、额度变化通知。
- 系统通知。
- 低频但需要及时到达的服务端事件。

推荐接口：

```txt
GET /api/generation/tasks/events
```

推荐事件：

```txt
task.queued
task.running
task.progress
task.succeeded
task.failed
task.canceled
quota.updated
```

示例：

```txt
event: task.progress
data: {"taskId":"task_123","status":"running","progress":40}

event: task.succeeded
data: {"taskId":"task_123","status":"succeeded","outputs":[...]}
```

## WebSocket 适合的场景

WebSocket 更适合双向实时通信：

- 多人协作编辑。
- 实时画布。
- 实时聊天。
- 客户端持续发送操作事件。
- 生成过程中的双向控制。
- 一个连接承载复杂会话协议。

如果只是任务状态通知，WebSocket 会增加连接管理、心跳、重连、鉴权、协议设计和网关配置复杂度。

## 对比

| 维度 | SSE | WebSocket |
| --- | --- | --- |
| 通信方向 | 服务端到客户端单向推送 | 客户端与服务端双向通信 |
| 协议基础 | HTTP | WebSocket |
| 浏览器支持 | 原生 `EventSource` | 原生 `WebSocket` |
| 自动重连 | 原生支持 | 需要自行实现 |
| 自定义请求头 | 原生 `EventSource` 不方便 | 建连时可通过协议或参数处理 |
| 适合任务状态 | 很适合 | 可以，但偏重 |
| 适合实时协作 | 不适合 | 很适合 |
| 服务端复杂度 | 较低 | 较高 |
| 网关代理适配 | 较简单 | 需要额外关注升级连接 |

## 鉴权建议

SSE 使用浏览器原生 `EventSource` 时，不方便设置 `Authorization` 请求头。

推荐方式：

- 优先使用 Cookie 鉴权。
- 如果系统使用 Bearer Token，先通过 HTTP 获取短期 SSE ticket。
- 使用 `/events?ticket=xxx` 建连。
- ticket 短有效期、一次性或可撤销。
- 不要把长期访问 Token 放到 URL 参数中。

## 推荐落地方式

```txt
Frontend
  |
  | POST /api/generation/tasks
  v
NestJS 创建任务
  |
  | RabbitMQ
  v
FastAPI Worker 执行任务
  |
  | result event / callback
  v
NestJS 更新任务状态
  |
  | SSE
  v
Frontend 更新 UI
```

## 最终选择

当前 AIGC 项目使用 SSE。

保留 WebSocket 作为后续扩展选项，仅在出现实时协作、实时画布或复杂双向控制场景时引入。
