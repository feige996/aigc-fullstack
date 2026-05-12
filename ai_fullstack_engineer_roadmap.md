# JS 工程师走向 AI 应用/全栈 AI 工程师路线

## 定位

AI 应用工程师/全栈 AI 工程师不是以训练大模型为主，而是把大模型能力接入真实业务系统，做成可上线、可监控、可控成本、可持续迭代的产品功能。

对 JS 工程师来说，主栈可以继续放在 TypeScript/Node.js，同时补齐 Python 基础和 AI 工程能力。目标不是转成纯算法工程师，而是能独立完成 AI 产品从前端、后端、任务系统到 LLM 调用和效果评估的完整链路。

这条路线的核心不是追逐某个框架，而是建立一套能在真实业务里工作的能力：模型调用可替换、结果质量可评估、数据权限可控制、任务执行可恢复、成本和效果可持续优化。

## 目标能力

最终应能独立完成这些系统：

- 文档问答/企业知识库
- 小说、合同、简历、财报等长文档分析
- AI 客服/Copilot
- Text-to-SQL 数据问答
- 带工具调用的 Agent
- 后台批处理 AI Worker
- 可观测、可评估、可回滚的 AI 功能
- 多租户、权限隔离、可审计的企业 AI 应用

## 推荐主技术栈

JS 工程师优先走这条主线：

```text
TypeScript
Next.js / React
Node.js / NestJS / Fastify
PostgreSQL + pgvector
Redis + BullMQ
MinIO / S3
OpenAI-compatible API
Docker
```

主栈里建议从一开始就保留一层模型适配接口，不要把业务代码直接绑死在某个模型厂商上。常见需要抽象的能力包括：

```text
chat/completion
embedding
rerank
structured output
tool calling
token/cost usage
```

辅助栈建议：

```text
Python
FastAPI
LangGraph
LangChain 基础
pandas 基础
```

## 学习路线

### 第一阶段：LLM API 基础

先把模型调用吃透，不急着上复杂框架。

需要掌握：

- Chat API
- Streaming/SSE
- JSON schema/structured output
- tool calling/function calling
- prompt 版本管理
- token、上下文窗口、成本计算
- retry、timeout、rate limit
- 模型供应商适配层
- 调用日志、错误分类、用量统计

建议项目：

```text
AI 聊天接口
+ 流式输出
+ 工具调用
+ 结构化 JSON 输出
+ 记录 prompt/model 版本和 token 成本
```

### 第二阶段：RAG 文档问答

RAG 是 AI 应用最常见的落地场景。

需要掌握：

- 文档解析：pdf、docx、txt
- chunk 切分
- embedding
- 向量数据库：pgvector / Qdrant / Milvus / Pinecone
- hybrid search：关键词 + 向量
- rerank
- 引用来源返回
- 检索质量评估
- 文档级权限过滤
- prompt injection 基础防护
- RAG 评估集：命中率、引用准确率、幻觉率

建议项目：

```text
企业知识库 RAG
+ 上传 PDF/docx
+ 自动切分、embedding
+ 问答返回引用来源
+ 权限控制
+ 构建 20-50 条问答评估集
```

### 第三阶段：Node Worker + 队列

AI 长任务不能直接放在 HTTP 请求里跑，需要后台任务系统。

需要掌握：

- Node API + Worker 分进程
- BullMQ / RabbitMQ
- 任务状态：pending、running、failed、completed
- 进度回传
- 幂等、重试、死信队列
- 长任务日志
- 任务取消、恢复和超时控制
- 分步骤状态机
- 大文件处理和对象存储

建议项目：

```text
长文档自动分析系统
+ 上传小说/合同/财报
+ 后台队列分析
+ 输出摘要、结构化字段、推荐问题
+ 前端展示进度
+ 失败后可重试，关键步骤可追踪
```

### 第四阶段：Python 基础

不需要一开始变成 Python 专家，但至少要能读懂和改动常见 AI 项目。

需要掌握：

- Python 基础语法
- FastAPI
- requests/httpx
- 文件处理、JSON/CSV 处理
- 基础 pandas
- 能跑通 LangChain/LangGraph 示例

目标是能看懂 Python AI 服务，能改 prompt、模型调用、数据处理脚本，能和算法或 AI 工程团队协作。

### 第五阶段：Agent / Workflow

Agent 不等于让模型无限自由发挥，生产里更常见的是可控 workflow。

需要掌握：

- router
- planner
- tool caller
- reflection / retry
- human-in-the-loop
- memory
- multi-step workflow
- eval-driven agent
- 状态机和确定性步骤
- 工具参数校验
- 工具权限控制
- 工具结果校验
- 失败降级和人工确认

框架建议：

- LangGraph：重点学习
- LangChain：了解核心概念即可
- LangChain.js / LlamaIndex.TS：按项目需要使用

生产里的 Agent 更应该理解为“由模型参与决策的可控 workflow”，而不是让模型无限自由发挥。关键能力是限制工具范围、记录每一步状态、验证工具结果，并在高风险操作前要求人工确认。

### 第六阶段：生产化能力

这部分决定是不是能真正上线。

需要掌握：

- Docker
- CI/CD
- PostgreSQL
- Redis
- S3/MinIO
- 日志、trace、metrics
- 权限、租户隔离
- secrets 管理
- 成本统计
- prompt/model 版本追踪
- 测试和评估集
- prompt injection 防护
- 敏感信息脱敏
- 审计日志
- 灰度发布和回滚
- 模型、embedding、rerank 可替换

尤其要重视 eval。AI 功能不能只靠“看起来能跑”，需要持续回答这些问题：

- 检索有没有命中正确文档？
- 回答有没有引用可靠来源？
- prompt 改动后效果是变好还是变差？
- 模型切换后质量和成本如何变化？
- 是否出现幻觉、越权访问或敏感信息泄露？

## 6 个月节奏

```text
第 1 月：LLM API + streaming + structured output + 成本和限流
第 2 月：RAG 基础 + 向量库 + 文档问答 + 权限过滤 + 基础 eval
第 3 月：Node Worker + 队列 + 长任务系统 + 状态机和重试
第 4 月：Python/FastAPI + LangGraph 基础
第 5 月：Agent workflow + tool calling + 人工确认 + eval
第 6 月：部署、监控、成本、版本追踪、作品集打磨
```

## 作品集建议

比证书更有用的是 3 个完整项目。

### 1. 企业知识库 RAG

功能点：

- 上传 PDF/docx/txt
- 文档解析、切分、embedding
- 向量检索 + 关键词检索
- 问答返回引用来源
- 用户权限控制
- 基础评估集和检索命中率统计
- prompt injection 防护和越权访问测试

### 2. 长文档分析 Worker

功能点：

- 上传小说/合同/财报
- 创建分析任务
- Worker 后台消费任务
- 输出摘要、章节/段落分析、结构化字段、推荐问题
- 前端展示进度和失败原因
- 支持任务取消、失败重试和步骤级日志
- 记录每次模型调用成本

### 3. Agent 工具调用系统

功能点：

- 用户自然语言提问
- Agent 可调用数据库、搜索、业务 API
- 有工具执行日志
- 有失败恢复
- 关键操作需要人工确认
- 工具参数和返回结果有校验
- 高风险工具有权限控制和审计日志

## 是否需要学 Python + LangChain

建议学 Python，但不要把 LangChain 当核心竞争力。

Python 的价值：

- AI、数据处理、模型生态事实标准
- 能读懂和改动大量现有 AI 项目
- 方便处理脚本、数据、实验和 FastAPI 服务

LangChain 的价值：

- 理解 PromptTemplate、Chain、Tool、Retriever、Agent 等常见模式
- 读懂存量项目
- 快速做原型

但生产系统里很多团队会把 LangChain 的重抽象替换成轻量自研封装：

```text
renderPrompt()
callLLM()
parseOutput()
retrieveDocs()
runWorkflow()
evaluateResult()
trackUsage()
```

因此，LangChain 学到能看懂、能改、能判断是否该用即可。更重要的是掌握 AI 应用工程的底层能力。

## 结论

JS 工程师的最佳路径不是“转 Python LangChain 工程师”，而是：

```text
用 TypeScript 做产品主线
用 Python 补 AI 生态能力
用 RAG / Agent / Worker 解决真实业务问题
```

这样就业面更宽：既能投全栈岗位，也能投 AI 应用工程、AI 产品工程、Agent 工程、企业智能化开发岗位。
