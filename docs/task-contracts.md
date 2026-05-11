# Task 契约设计

## 目标

Task 是平台层的通用异步执行记录。它不应该绑定到 AIGC、小说、文档、合同等具体业务。

当前仓库仍保留 `GenerationTask` 作为 AIGC 生成链路的实现，不在本阶段改数据库，也不强制改运行时消息。

本阶段只定义通用词汇：

```txt
domain
type
capability
```

这些词汇先进入 `packages/shared-contracts`，作为后续新业务模块的约定。

## 三个核心概念

### domain

`domain` 表示任务属于哪个业务域。

示例：

```txt
default
aigc_generation
novel_analysis
document_analysis
```

如果未来只有一个业务，可以长期使用 `default`。

如果未来同时存在多个业务，可以按业务模块拆分：

```txt
aigc_generation
novel_analysis
document_analysis
```

### type

`type` 表示具体任务类型。

示例：

```txt
text_to_image
novel_profile_analysis
document_summary
document_risk_analysis
```

`type` 不负责表达业务归属，也不负责表达 provider 如何执行。

### capability

`capability` 表示执行任务需要的能力。

示例：

```txt
image_generation
text_analysis
document_parsing
relationship_extraction
```

Provider 层按 capability 选择具体能力提供方。

## 三者关系

```txt
domain      业务归属
type        具体任务类型
capability  执行能力
```

示例：AIGC 图片生成

```json
{
  "domain": "aigc_generation",
  "type": "text_to_image",
  "capability": "image_generation"
}
```

示例：小说分析

```json
{
  "domain": "novel_analysis",
  "type": "novel_profile_analysis",
  "capability": "text_analysis"
}
```

示例：文档摘要

```json
{
  "domain": "document_analysis",
  "type": "document_summary",
  "capability": "text_analysis"
}
```

## 为什么不只用 type

只用 `type` 会让任务类型变成大杂烩：

```txt
text_to_image
novel_profile_analysis
document_summary
relationship_graph_extract
contract_risk_analysis
```

系统很难判断：

- 哪些任务属于同一个业务模块。
- 哪些任务应该出现在同一个菜单下。
- 哪些任务可以共用同一种 provider 能力。
- 哪些任务应该进入同一个统计报表。

因此 `domain` 和 `capability` 是对 `type` 的补充，不是替代。

## 当前落地范围

当前只做：

- 在 `shared-contracts` 中新增常量和类型。
- 文档明确语义。

当前不做：

- 不改 `generation_tasks` 表。
- 不新增通用 `tasks` 表。
- 不强制修改 `GenerationRequestMessage`。
- 不改现有浏览器验证链路。

## 后续触发条件

当满足以下任一条件时，再把这些字段加入运行时：

- 新增第二个业务模块。
- 同一业务开始需要多种 provider capability。
- Admin 需要按业务域统计任务。
- Web 需要在同一个 Project 下展示多个业务入口。

## shared-contracts

当前约定定义在：

```txt
packages/shared-contracts/src/index.ts
```

包含：

```txt
taskDomains
taskTypes
providerCapabilities
```
