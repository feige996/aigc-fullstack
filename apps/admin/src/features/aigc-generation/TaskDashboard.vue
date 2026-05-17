<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import type { Asset, GenerationAttempt, Task, TaskStatus } from '../../types'
import type { TagProps } from 'element-plus'

type TagType = NonNullable<TagProps['type']>
type TaskStatusFilter = TaskStatus | 'all'

const props = defineProps<{
  tasks: Task[]
  selectedTask: Task | null
  totalTasks: number
  succeededTasks: number
  failedTasks: number
  runningTasks: number
  pendingTasks: number
  searchQuery: string
  statusFilter: TaskStatusFilter
  page: number
  pageSize: number
  isLoading: boolean
  isRetrying: boolean
  isCanceling: boolean
  canRetry: (task: Task | null) => boolean
  canCancel: (task: Task | null) => boolean
  statusType: (status: TaskStatus) => TagType
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:statusFilter': [value: TaskStatusFilter]
  selectTask: [task: Task]
  retrySelectedTask: []
  cancelSelectedTask: []
  downloadAsset: [asset: Asset]
  updatePage: [page: number]
  updatePageSize: [pageSize: number]
}>()

const taskStatusOptions: TaskStatus[] = [
  'draft',
  'validating',
  'rejected',
  'pending',
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'final_failed',
  'canceled',
  'expired',
]

const timelineAttempts = computed(() => {
  return [...(props.selectedTask?.attempts ?? [])].sort(compareAttempts)
})

function compareAttempts(left: GenerationAttempt, right: GenerationAttempt) {
  if (left.attemptNo !== right.attemptNo) {
    return left.attemptNo - right.attemptNo
  }

  return timeValue(left.createdAt) - timeValue(right.createdAt)
}

function timeValue(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatJson(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }

  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value)
  }
}

function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '-'
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function assetDimensions(asset: Asset) {
  return asset.width && asset.height ? `${asset.width}x${asset.height}` : '-'
}

function formatNullable(value: string | null | undefined) {
  return value || '-'
}

function hasRawError(attempt: GenerationAttempt) {
  return attempt.rawError !== null && attempt.rawError !== undefined
}

function rawErrorText(attempt: GenerationAttempt) {
  return typeof attempt.rawError === 'string'
    ? attempt.rawError
    : formatJson(attempt.rawError)
}

async function copyText(label: string, value: string | null | undefined) {
  if (!value) {
    ElMessage.warning(`${label} is empty`)
    return
  }

  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(`${label} copied`)
  } catch {
    ElMessage.error(`Copy ${label} failed`)
  }
}
</script>

<template>
  <section class="metrics">
    <div>
      <span>Total</span>
      <strong>{{ totalTasks }}</strong>
    </div>
    <div>
      <span>Succeeded</span>
      <strong>{{ succeededTasks }}</strong>
    </div>
    <div>
      <span>Failed</span>
      <strong>{{ failedTasks }}</strong>
    </div>
    <div>
      <span>Running</span>
      <strong>{{ runningTasks }}</strong>
    </div>
    <div>
      <span>Pending</span>
      <strong>{{ pendingTasks }}</strong>
    </div>
  </section>

  <section class="content">
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-toolbar">
          <span>Recent Tasks</span>
          <div class="filters">
            <el-input
              :model-value="searchQuery"
              clearable
              placeholder="Search task, user, prompt"
              @update:model-value="$emit('update:searchQuery', String($event))"
            />
            <el-select
              :model-value="statusFilter"
              placeholder="Status"
              @update:model-value="$emit('update:statusFilter', $event as TaskStatusFilter)"
            >
              <el-option label="All Statuses" value="all" />
              <el-option
                v-for="status in taskStatusOptions"
                :key="status"
                :label="status"
                :value="status"
              />
            </el-select>
          </div>
        </div>
      </template>
      <el-table
        v-loading="isLoading"
        :data="tasks"
        height="520"
        highlight-current-row
        empty-text="No matching tasks"
        @row-click="$emit('selectTask', $event)"
      >
        <el-table-column
          prop="taskId"
          label="Task ID"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="model" label="Model" width="160" />
        <el-table-column label="Status" width="140">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">{{
              row.status
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stage" label="Stage" width="160" />
        <el-table-column
          prop="failureCode"
          label="Failure"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column prop="updatedAt" label="Updated" width="220" />
      </el-table>
      <div class="table-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="totalTasks"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="$emit('updatePage', $event)"
          @size-change="$emit('updatePageSize', $event)"
        />
      </div>
    </el-card>

    <el-card shadow="never" class="detail-card">
      <template #header>
        <div class="detail-header">
          <span>Task Detail</span>
          <div class="detail-actions">
            <el-button
              type="warning"
              size="small"
              :disabled="!canRetry(selectedTask)"
              :loading="isRetrying"
              @click="$emit('retrySelectedTask')"
            >
              Retry
            </el-button>
            <el-button
              type="danger"
              size="small"
              :disabled="!canCancel(selectedTask)"
              :loading="isCanceling"
              @click="$emit('cancelSelectedTask')"
            >
              Cancel
            </el-button>
          </div>
        </div>
      </template>
      <el-empty v-if="!selectedTask" description="No task selected" />
      <template v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Task ID">
            <div class="copy-row">
              <span class="truncate-text">{{ selectedTask.taskId }}</span>
              <el-button
                size="small"
                text
                @click="copyText('Task ID', selectedTask.taskId)"
              >
                Copy
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="User">
            <div class="copy-row">
              <span class="truncate-text">{{ selectedTask.userId }}</span>
              <el-button
                size="small"
                text
                @click="copyText('User ID', selectedTask.userId)"
              >
                Copy
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="Current Attempt">
            <div class="copy-row">
              <span class="truncate-text">{{
                selectedTask.currentAttemptId ?? '-'
              }}</span>
              <el-button
                size="small"
                text
                :disabled="!selectedTask.currentAttemptId"
                @click="
                  copyText('Current attempt ID', selectedTask.currentAttemptId)
                "
              >
                Copy
              </el-button>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-tag :type="statusType(selectedTask.status)" effect="plain">
              {{ selectedTask.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Stage">{{
            selectedTask.stage
          }}</el-descriptions-item>
          <el-descriptions-item label="Billing">{{
            selectedTask.billingStatus
          }}</el-descriptions-item>
          <el-descriptions-item label="Prompt">
            {{ selectedTask.inputPayload.prompt }}
          </el-descriptions-item>
        </el-descriptions>

        <el-collapse class="payload-collapse">
          <el-collapse-item title="Input Payload" name="input">
            <pre class="json-block">{{ formatJson(selectedTask.inputPayload) }}</pre>
          </el-collapse-item>
          <el-collapse-item title="Result Payload" name="result">
            <pre class="json-block">{{
              formatJson(selectedTask.resultPayload)
            }}</pre>
          </el-collapse-item>
          <el-collapse-item title="Usage Payload" name="usage">
            <pre class="json-block">{{
              formatJson(selectedTask.usagePayload)
            }}</pre>
          </el-collapse-item>
        </el-collapse>

        <h2>Timeline</h2>
        <el-empty
          v-if="timelineAttempts.length === 0"
          description="No attempts"
          :image-size="80"
        />
        <div v-else class="attempt-timeline">
          <article
            v-for="attempt in timelineAttempts"
            :key="attempt.id"
            class="attempt-event"
          >
            <div class="attempt-event-marker" aria-hidden="true" />
            <div class="attempt-event-body">
              <div class="attempt-event-header">
                <div class="attempt-title">
                  <strong>Attempt {{ attempt.attemptNo }}</strong>
                  <el-tag size="small" effect="plain">
                    {{ attempt.status }}
                  </el-tag>
                </div>
                <div class="attempt-actions">
                  <el-button
                    size="small"
                    text
                    @click="copyText('Attempt ID', attempt.id)"
                  >
                    Copy Attempt ID
                  </el-button>
                  <el-button
                    size="small"
                    text
                    :disabled="!attempt.providerTaskId"
                    @click="
                      copyText('Provider task ID', attempt.providerTaskId)
                    "
                  >
                    Copy Provider Task
                  </el-button>
                </div>
              </div>

              <dl class="attempt-grid">
                <div>
                  <dt>Stage</dt>
                  <dd>{{ formatNullable(attempt.stage) }}</dd>
                </div>
                <div>
                  <dt>Provider</dt>
                  <dd>{{ formatNullable(attempt.provider) }}</dd>
                </div>
                <div>
                  <dt>Provider Task ID</dt>
                  <dd>
                    <span class="break-text">
                      {{ formatNullable(attempt.providerTaskId) }}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Failure Code</dt>
                  <dd>{{ formatNullable(attempt.failureCode) }}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{{ formatNullable(attempt.startedAt) }}</dd>
                </div>
                <div>
                  <dt>Ended</dt>
                  <dd>{{ formatNullable(attempt.endedAt) }}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{{ formatNullable(attempt.updatedAt) }}</dd>
                </div>
              </dl>

              <el-collapse v-if="hasRawError(attempt)" class="raw-error">
                <el-collapse-item title="rawError" :name="attempt.id">
                  <div class="raw-error-toolbar">
                    <el-button
                      size="small"
                      text
                      @click="copyText('rawError', rawErrorText(attempt))"
                    >
                      Copy rawError
                    </el-button>
                  </div>
                  <pre class="json-block raw-error-block">{{
                    rawErrorText(attempt)
                  }}</pre>
                </el-collapse-item>
              </el-collapse>
            </div>
          </article>
        </div>

        <h2>Attempts</h2>
        <el-table :data="selectedTask.attempts ?? []" size="small" border>
          <el-table-column
            prop="id"
            label="Attempt ID"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column prop="attemptNo" label="#" width="56" />
          <el-table-column prop="status" label="Status" width="120" />
          <el-table-column prop="stage" label="Stage" width="150" />
          <el-table-column
            prop="failureCode"
            label="Failure"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="idempotencyKey"
            label="Idempotency Key"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="createdAt"
            label="Created"
            min-width="190"
            show-overflow-tooltip
          />
          <el-table-column
            prop="updatedAt"
            label="Updated"
            min-width="190"
            show-overflow-tooltip
          />
          <el-table-column
            prop="endedAt"
            label="Ended"
            min-width="190"
            show-overflow-tooltip
          />
        </el-table>

        <h2>Outputs</h2>
        <el-table :data="selectedTask.assets ?? []" size="small" border>
          <el-table-column prop="type" label="Type" width="150" />
          <el-table-column prop="status" label="Status" width="100" />
          <el-table-column prop="provider" label="Provider" width="140" />
          <el-table-column
            prop="bucket"
            label="Bucket"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="objectKey"
            label="Object Key"
            min-width="260"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <div class="copy-row">
                <span class="truncate-text">{{ row.objectKey }}</span>
                <el-button
                  size="small"
                  text
                  @click="copyText('Object key', row.objectKey)"
                >
                  Copy
                </el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="mimeType"
            label="MIME"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column label="Bytes" width="120">
            <template #default="{ row }">
              {{ formatBytes(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="Dimensions" width="120">
            <template #default="{ row }">
              {{ assetDimensions(row) }}
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="120" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="$emit('downloadAsset', row)"
                >Download</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>
  </section>
</template>

<style scoped>
.detail-actions {
  display: flex;
  gap: 8px;
}

.copy-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.truncate-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payload-collapse {
  margin-top: 16px;
}

.json-block {
  max-height: 320px;
  max-width: 100%;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: #1f2937;
  font-size: 12px;
  line-height: 1.5;
}

.attempt-timeline {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.attempt-event {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
}

.attempt-event::before {
  position: absolute;
  top: 18px;
  bottom: -18px;
  left: 8px;
  width: 1px;
  background: #d1d5db;
  content: '';
}

.attempt-event:last-child::before {
  display: none;
}

.attempt-event-marker {
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 9px;
  border: 2px solid #409eff;
  border-radius: 999px;
  background: #fff;
}

.attempt-event-body {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.attempt-event-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.attempt-title,
.attempt-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.attempt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 12px 0 0;
}

.attempt-grid div {
  min-width: 0;
}

.attempt-grid dt {
  color: #6b7280;
  font-size: 12px;
}

.attempt-grid dd {
  min-width: 0;
  margin: 3px 0 0;
  color: #1f2937;
  font-size: 13px;
}

.break-text {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.raw-error {
  margin-top: 12px;
}

.raw-error-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.raw-error-block {
  max-height: 240px;
}

@media (max-width: 720px) {
  .attempt-event-header {
    align-items: stretch;
    flex-direction: column;
  }

  .attempt-grid {
    grid-template-columns: 1fr;
  }
}
</style>
