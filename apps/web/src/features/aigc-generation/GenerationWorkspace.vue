<script setup lang="ts">
import type { Asset, Task } from '../../types'

defineProps<{
  prompt: string
  ratio: string
  isSubmitting: boolean
  activeTaskId: string
  activeTask: Task | null
  tasks: Task[]
  isRefreshing: boolean
  isCanceling: boolean
  errorMessage: string
}>()

defineEmits<{
  'update:prompt': [value: string]
  'update:ratio': [value: string]
  createTask: []
  refreshActiveTask: []
  cancelActiveTask: []
  selectTask: [task: Task]
  downloadAsset: [asset: Asset]
}>()
</script>

<template>
  <section class="panel">
    <label for="prompt">生成提示词</label>
    <textarea
      id="prompt"
      :value="prompt"
      rows="5"
      placeholder="描述你想生成的画面，例如：一张干净的陶瓷杯产品摄影，柔和自然光，白色背景"
      @input="$emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
    />

    <div class="controls">
      <label>
        画幅比例
        <select
          :value="ratio"
          @change="$emit('update:ratio', ($event.target as HTMLSelectElement).value)"
        >
          <option value="1:1">1:1</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
        </select>
      </label>

      <button type="button" :disabled="isSubmitting" @click="$emit('createTask')">
        {{ isSubmitting ? '提交中...' : '提交任务' }}
      </button>
    </div>
  </section>

  <section class="panel result">
    <div class="result-header">
      <h2>当前任务</h2>
      <button type="button" :disabled="!activeTaskId || isRefreshing" @click="$emit('refreshActiveTask')">
        {{ isRefreshing ? '刷新中...' : '刷新' }}
      </button>
      <button type="button" :disabled="!activeTaskId || isCanceling" @click="$emit('cancelActiveTask')">
        {{ isCanceling ? '取消中...' : '取消' }}
      </button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <template v-if="activeTask">
      <dl>
        <div>
          <dt>任务 ID</dt>
          <dd>{{ activeTask.taskId }}</dd>
        </div>
        <div>
          <dt>项目 ID</dt>
          <dd>{{ activeTask.projectId ?? '未绑定' }}</dd>
        </div>
        <div>
          <dt>素材</dt>
          <dd>{{ activeTask.inputPayload.referenceAssetIds?.join(', ') || '无' }}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ activeTask.status }}</dd>
        </div>
        <div>
          <dt>阶段</dt>
          <dd>{{ activeTask.stage }}</dd>
        </div>
        <div>
          <dt>模型</dt>
          <dd>{{ activeTask.model }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ activeTask.updatedAt }}</dd>
        </div>
      </dl>
      <div class="output-assets">
        <h3>生成结果</h3>
        <div v-if="activeTask.assets?.length" class="output-list">
          <article v-for="asset in activeTask.assets" :key="asset.assetId" class="output-row">
            <div>
              <strong>{{ asset.type }} / {{ asset.status }}</strong>
              <span>{{ asset.objectKey }}</span>
            </div>
            <div class="output-actions">
              <small>
                {{ asset.mimeType }}
                <template v-if="asset.width && asset.height"> / {{ asset.width }}x{{ asset.height }}</template>
              </small>
              <button type="button" @click="$emit('downloadAsset', asset)">下载</button>
            </div>
          </article>
        </div>
        <p v-else class="muted">暂无生成结果。</p>
      </div>
    </template>
    <p v-else class="muted">暂无当前任务。</p>
  </section>

  <section class="panel">
    <h2>最近任务</h2>
    <div class="task-list">
      <button
        v-for="task in tasks"
        :key="task.taskId"
        type="button"
        class="task-row"
        @click="$emit('selectTask', task)"
      >
        <span>{{ task.inputPayload.prompt }}</span>
        <strong>{{ task.status }} / {{ task.projectId ?? '未绑定项目' }}</strong>
      </button>
    </div>
  </section>
</template>
