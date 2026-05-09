# AIGC 资源生命周期与存储规范

## 目标

AIGC 项目会产生大量用户上传素材、模型输入文件、生成结果、预览图、封面、转码文件和失败残留文件。资源生命周期必须清晰，否则容易出现存储膨胀、权限泄露、资源孤儿和删除不一致。

核心原则：

- 数据库存储稳定资源标识，避免直接依赖临时 URL。
- COS/S3/OSS 路径按业务域、用户、任务、资源类型分层。
- 临时资源必须有过期清理机制。
- 删除优先软删除，再异步物理清理。

## 资源类型

推荐资源分类：

```txt
user_upload：用户上传素材
model_input：模型输入临时文件
model_output_raw：模型原始输出
processed_output：后处理结果
preview：预览图或预览视频
cover：封面
watermarked：带水印资源
source：无水印源文件
audit_sample：审核采样文件
temp：临时文件
```

## 资源状态

推荐字段：

```ts
type AssetStatus =
  | 'temporary'
  | 'processing'
  | 'active'
  | 'blocked'
  | 'deleted'
  | 'expired'
  | 'orphaned'
```

状态说明：

| 状态 | 含义 |
| --- | --- |
| `temporary` | 临时资源，允许过期清理 |
| `processing` | 正在处理或审核 |
| `active` | 可正常展示或下载 |
| `blocked` | 审核不通过或风控禁止访问 |
| `deleted` | 用户删除，业务不可见 |
| `expired` | 已过期，不应继续访问 |
| `orphaned` | 无业务归属，待清理 |

## 路径规范

建议路径：

```txt
aigc/{env}/{userId}/{taskId}/input/{assetId}.{ext}
aigc/{env}/{userId}/{taskId}/raw/{attemptId}/{assetId}.{ext}
aigc/{env}/{userId}/{taskId}/output/{assetId}.{ext}
aigc/{env}/{userId}/{taskId}/preview/{assetId}.{ext}
aigc/{env}/{userId}/{taskId}/cover/{assetId}.{ext}
aigc/{env}/temp/{date}/{assetId}.{ext}
```

示例：

```txt
aigc/prod/user_001/task_123/output/asset_789.mp4
aigc/prod/user_001/task_123/cover/asset_789.jpg
```

## 数据字段建议

资源表建议字段：

```txt
id
userId
taskId
attemptId
type
status
bucket
cosPath
previewUrl
mimeType
size
width
height
duration
checksum
watermarkType
expiresAt
deletedAt
createdAt
updatedAt
```

字段使用原则：

- `cosPath` 是稳定资源地址。
- `previewUrl` 只用于前端展示，可过期、可重新签发。
- 下载、转存、后端调用应优先使用 `cosPath`。
- 不要把临时签名 URL 当作长期资源标识。

## 生命周期

用户上传素材：

```txt
temporary -> processing -> active
temporary -> blocked
temporary -> expired
```

模型输出结果：

```txt
temporary -> processing -> active
temporary -> blocked
temporary -> orphaned -> expired
```

用户删除：

```txt
active -> deleted -> expired
```

失败任务残留：

```txt
temporary -> orphaned -> expired
```

## 清理策略

建议定时任务：

- 清理超过 24 小时未绑定任务的临时资源。
- 清理最终失败任务的中间文件。
- 清理已删除超过保留期的物理文件。
- 扫描数据库不存在但存储存在的孤儿文件。
- 扫描数据库存在但存储不存在的异常资源。

## 权限与下载

资源访问建议：

- 私有桶存储。
- 后端生成短期签名 URL。
- 下载接口由 NestJS 鉴权后签发。
- AI-generated 资源下载需要按业务处理水印和权益。
- User-uploaded 资源只允许资源归属用户或授权项目访问。

## 最终建议

资源设计不要只保存 URL。数据库应保存 `cosPath`、资源类型、状态和归属关系，前端展示 URL 由后端按权限生成。
