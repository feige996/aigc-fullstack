<script setup lang="ts">
import type { Asset, Task, TaskStatus } from '../../types'

defineProps<{
  tasks: Task[]
  selectedTask: Task | null
  totalTasks: number
  succeededTasks: number
  failedTasks: number
  isLoading: boolean
  isRetrying: boolean
  isCanceling: boolean
  canRetry: (task: Task | null) => boolean
  canCancel: (task: Task | null) => boolean
  statusType: (status: TaskStatus) => string
}>()

defineEmits<{
  selectTask: [task: Task]
  retrySelectedTask: []
  cancelSelectedTask: []
  downloadAsset: [asset: Asset]
}>()
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
  </section>

  <section class="content">
    <el-card shadow="never" class="table-card">
      <template #header>Recent Tasks</template>
      <el-table
        v-loading="isLoading"
        :data="tasks"
        height="520"
        highlight-current-row
        @row-click="$emit('selectTask', $event)"
      >
        <el-table-column prop="taskId" label="Task ID" min-width="220" show-overflow-tooltip />
        <el-table-column prop="model" label="Model" width="160" />
        <el-table-column label="Status" width="140">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stage" label="Stage" width="160" />
        <el-table-column prop="failureCode" label="Failure" width="180" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="Updated" width="220" />
      </el-table>
    </el-card>

    <el-card shadow="never" class="detail-card">
      <template #header>
        <div class="detail-header">
          <span>Task Detail</span>
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
      </template>
      <el-empty v-if="!selectedTask" description="No task selected" />
      <template v-else>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Task ID">{{ selectedTask.taskId }}</el-descriptions-item>
          <el-descriptions-item label="User">{{ selectedTask.userId }}</el-descriptions-item>
          <el-descriptions-item label="Status">
            <el-tag :type="statusType(selectedTask.status)" effect="plain">
              {{ selectedTask.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Stage">{{ selectedTask.stage }}</el-descriptions-item>
          <el-descriptions-item label="Billing">{{ selectedTask.billingStatus }}</el-descriptions-item>
          <el-descriptions-item label="Usage">
            <pre>{{ JSON.stringify(selectedTask.usagePayload ?? null, null, 2) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="Prompt">
            {{ selectedTask.inputPayload.prompt }}
          </el-descriptions-item>
        </el-descriptions>

        <h2>Attempts</h2>
        <el-table :data="selectedTask.attempts ?? []" size="small" border>
          <el-table-column prop="attemptNo" label="#" width="56" />
          <el-table-column prop="status" label="Status" width="120" />
          <el-table-column prop="stage" label="Stage" width="150" />
          <el-table-column prop="failureCode" label="Failure" min-width="160" />
        </el-table>

        <h2>Outputs</h2>
        <el-table :data="selectedTask.assets ?? []" size="small" border>
          <el-table-column prop="type" label="Type" width="150" />
          <el-table-column prop="status" label="Status" width="100" />
          <el-table-column prop="provider" label="Provider" width="140" />
          <el-table-column prop="objectKey" label="Object Key" min-width="220" show-overflow-tooltip />
          <el-table-column label="Size" width="110">
            <template #default="{ row }">
              {{ row.width && row.height ? `${row.width}x${row.height}` : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="Actions" width="120" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="$emit('downloadAsset', row)">Download</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>
  </section>
</template>
