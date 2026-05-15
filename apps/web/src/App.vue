<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import GenerationWorkspace from './features/aigc-generation/GenerationWorkspace.vue';
import AccountPanel from './platform/AccountPanel.vue';
import AssetPanel from './platform/AssetPanel.vue';
import AuthPanel from './platform/AuthPanel.vue';
import ProjectPanel from './platform/ProjectPanel.vue';
import { createWebApi } from './api';
import { useApiClient } from './composables/useApiClient';
import type { Asset, Task, Project } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

const authStorageKey = 'aigc.web.auth';
const api = useApiClient(apiBaseUrl, authStorageKey);
const webApi = createWebApi(api, apiBaseUrl);
const phoneNumber = ref('');
const password = ref('');
const displayName = ref('');
const projects = ref<Project[]>([]);
const selectedProjectId = ref('');
const projectName = ref('');
const projectDescription = ref('');
const assets = ref<Asset[]>([]);
const selectedAssetIds = ref<string[]>([]);
const prompt = ref('');
const ratio = ref('1:1');
const activeTaskId = ref('');
const activeTask = ref<Task | null>(null);
const tasks = ref<Task[]>([]);
const isSubmitting = ref(false);
const isCreatingProject = ref(false);
const isUploadingAsset = ref(false);
const isRefreshing = ref(false);
const isCanceling = ref(false);
const isChangingPassword = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const eventSourceStatus = ref<'connecting' | 'open' | 'closed'>('closed');
let eventSource: EventSource | null = null;

const activeTaskStatusLabel = computed(() => activeTask.value?.status ?? 'idle');
const isAuthenticated = api.isAuthenticated;
const currentUser = api.currentUser;
const taskSummary = computed(() => {
  const succeeded = tasks.value.filter((task) => task.status === 'succeeded').length;
  const running = tasks.value.filter((task) => ['queued', 'running', 'retrying'].includes(task.status)).length;

  return {
    total: tasks.value.length,
    succeeded,
    running,
  };
});

function resetMessages() {
  errorMessage.value = '';
  successMessage.value = '';
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function authenticate(mode: 'login' | 'register') {
  resetMessages();

  if (!phoneNumber.value.trim() || !password.value) {
    errorMessage.value = '请输入手机号和密码';
    return;
  }

  if (mode === 'register' && !displayName.value.trim()) {
    errorMessage.value = '请输入显示名称';
    return;
  }

  try {
    await api.authenticate(mode, {
      phoneNumber: phoneNumber.value,
      password: password.value,
      displayName: displayName.value,
    });
    await loadProjects();
    await loadAssets();
    await loadTasks();
    connectEvents();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, `${mode} failed`);
  }
}

async function loadProfile() {
  await api.loadProfile();
}

async function signOut(callServer = true) {
  eventSource?.close();
  eventSource = null;
  eventSourceStatus.value = 'closed';
  activeTaskId.value = '';
  activeTask.value = null;
  tasks.value = [];
  projects.value = [];
  selectedProjectId.value = '';
  assets.value = [];
  selectedAssetIds.value = [];
  await api.signOut(callServer);
}

async function loadProjects() {
  if (!api.accessToken.value) {
    return;
  }

  const items = await webApi.projects.list();
  projects.value = items;

  if (!selectedProjectId.value && items[0]) {
    selectedProjectId.value = items[0].projectId;
  }
}

async function createProject() {
  resetMessages();

  if (!projectName.value.trim()) {
    errorMessage.value = '请输入项目名称';
    return;
  }

  isCreatingProject.value = true;

  try {
    const project = await webApi.projects.create({
      name: projectName.value.trim(),
      description: projectDescription.value.trim(),
    });
    projects.value = [project, ...projects.value];
    selectedProjectId.value = project.projectId;
    projectName.value = '';
    projectDescription.value = '';
    successMessage.value = '项目已创建。';
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Create project failed');
  } finally {
    isCreatingProject.value = false;
  }
}

async function loadAssets() {
  if (!api.accessToken.value) {
    return;
  }

  assets.value = await webApi.assets.list();
}

async function uploadAsset(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  resetMessages();
  isUploadingAsset.value = true;

  try {
    const uploadInfo = await webApi.assets.createUpload({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      projectId: selectedProjectId.value || undefined,
    });
    const putResponse = await fetch(uploadInfo.upload.url, {
      method: uploadInfo.upload.method,
      headers: uploadInfo.upload.headers,
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error(`Upload failed: ${putResponse.status}`);
    }

    const asset = await webApi.assets.confirmUpload(
      uploadInfo.asset.assetId,
      file.size,
    );
    assets.value = [asset, ...assets.value.filter((item) => item.assetId !== asset.assetId)];
    selectedAssetIds.value = Array.from(new Set([asset.assetId, ...selectedAssetIds.value]));
    successMessage.value = 'Asset uploaded.';
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Upload asset failed');
  } finally {
    input.value = '';
    isUploadingAsset.value = false;
  }
}

async function downloadAsset(asset: Asset) {
  resetMessages();

  try {
    const result = await webApi.assets.createDownload(asset.assetId);
    window.open(result.url, '_blank', 'noopener');
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Create download failed');
  }
}

async function createTask() {
  resetMessages();

  if (!prompt.value.trim()) {
    errorMessage.value = '请输入生成提示词';
    return;
  }

  isSubmitting.value = true;

  try {
    const result = await webApi.generationTasks.create({
      projectId: selectedProjectId.value || undefined,
      type: 'text_to_image',
      model: 'mock-image-v1',
      prompt: prompt.value.trim(),
      ratio: ratio.value,
      referenceAssetIds: selectedAssetIds.value,
    });
    activeTaskId.value = result.taskId;
    await refreshActiveTask();
    await loadTasks();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Create task failed');
  } finally {
    isSubmitting.value = false;
  }
}

async function refreshActiveTask() {
  if (!activeTaskId.value) {
    return;
  }

  resetMessages();
  isRefreshing.value = true;

  try {
    activeTask.value = await webApi.generationTasks.get(activeTaskId.value);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Fetch task failed');
  } finally {
    isRefreshing.value = false;
  }
}

async function cancelActiveTask() {
  if (!activeTaskId.value) {
    return;
  }

  if (!window.confirm('确认取消当前任务？')) {
    return;
  }

  resetMessages();
  isCanceling.value = true;

  try {
    await webApi.generationTasks.cancel(activeTaskId.value);
    await refreshActiveTask();
    await loadTasks();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Cancel task failed');
  } finally {
    isCanceling.value = false;
  }
}

async function changePassword() {
  resetMessages();

  if (!currentPassword.value || newPassword.value.length < 8) {
    errorMessage.value = '请输入当前密码，新密码至少 8 位';
    return;
  }

  isChangingPassword.value = true;

  try {
    await webApi.auth.changePassword(
      currentPassword.value,
      newPassword.value,
    );

    currentPassword.value = '';
    newPassword.value = '';
    successMessage.value = '密码已修改，请重新登录。';
    await signOut(false);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, 'Change password failed');
  } finally {
    isChangingPassword.value = false;
  }
}

async function loadTasks() {
  if (!api.accessToken.value) {
    return;
  }

  tasks.value = await webApi.generationTasks.list();
}

function selectTask(task: Task) {
  activeTaskId.value = task.taskId;
  activeTask.value = task;
}

function connectEvents() {
  if (!api.accessToken.value) {
    return;
  }

  eventSource?.close();
  eventSourceStatus.value = 'connecting';
  eventSource = new EventSource(
    webApi.generationTasks.eventsUrl(api.accessToken.value),
  );

  eventSource.onopen = () => {
    eventSourceStatus.value = 'open';
  };

  eventSource.onerror = () => {
    eventSourceStatus.value = 'closed';
  };

  for (const eventName of ['task.queued', 'task.succeeded', 'task.failed', 'task.canceled']) {
    eventSource.addEventListener(eventName, (event) => {
      const payload = JSON.parse(event.data) as { taskId: string };

      if (payload.taskId === activeTaskId.value) {
        void refreshActiveTask();
      }

      void loadTasks();
    });
  }
}

onMounted(async () => {
  await loadProfile();
  await loadProjects();
  await loadAssets();
  await loadTasks();
  connectEvents();
});

onBeforeUnmount(() => {
  eventSource?.close();
});
</script>

<template>
  <main class="page">
    <section class="workspace">
      <header class="header">
        <div>
          <p class="eyebrow">智枢工作台</p>
          <h1>生成任务工作区</h1>
        </div>
        <div class="header-actions">
          <div class="status" :data-status="activeTaskStatusLabel">
            {{ activeTaskStatusLabel }}
          </div>
          <button v-if="isAuthenticated" type="button" @click="signOut()">退出</button>
        </div>
      </header>

      <AuthPanel
        v-if="!isAuthenticated"
        v-model:phone-number="phoneNumber"
        v-model:password="password"
        v-model:display-name="displayName"
        :error-message="errorMessage"
        :success-message="successMessage"
        @login="authenticate('login')"
        @register="authenticate('register')"
      />

      <template v-else>
        <div class="workspace-summary">
          <div>
            <span>当前用户</span>
            <strong>{{ currentUser?.phoneNumber }}</strong>
          </div>
          <div>
            <span>实时连接</span>
            <strong>{{ eventSourceStatus }}</strong>
          </div>
          <div>
            <span>任务总数</span>
            <strong>{{ taskSummary.total }}</strong>
          </div>
          <div>
            <span>执行中</span>
            <strong>{{ taskSummary.running }}</strong>
          </div>
          <div>
            <span>已成功</span>
            <strong>{{ taskSummary.succeeded }}</strong>
          </div>
        </div>

        <AccountPanel
          v-model:current-password="currentPassword"
          v-model:new-password="newPassword"
          :is-changing-password="isChangingPassword"
          :success-message="successMessage"
          @change-password="changePassword"
        />

        <ProjectPanel
          v-model:selected-project-id="selectedProjectId"
          v-model:project-name="projectName"
          v-model:project-description="projectDescription"
          :projects="projects"
          :is-creating-project="isCreatingProject"
          @create-project="createProject"
        />

        <AssetPanel
          v-model:selected-asset-ids="selectedAssetIds"
          :assets="assets"
          :is-uploading-asset="isUploadingAsset"
          @upload-asset="uploadAsset"
        />

        <GenerationWorkspace
          v-model:prompt="prompt"
          v-model:ratio="ratio"
          :is-submitting="isSubmitting"
          :active-task-id="activeTaskId"
          :active-task="activeTask"
          :tasks="tasks"
          :is-refreshing="isRefreshing"
          :is-canceling="isCanceling"
          :error-message="errorMessage"
          @create-task="createTask"
          @refresh-active-task="refreshActiveTask"
          @cancel-active-task="cancelActiveTask"
          @select-task="selectTask"
          @download-asset="downloadAsset"
        />
      </template>
    </section>
  </main>
</template>

<style>
.page {
  min-height: 100vh;
  padding: 32px 20px 48px;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  color: #17202a;
  background: #f5f7fb;
}

.workspace {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #5b6472;
  font-size: 14px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 32px;
  line-height: 1.1;
}

h2 {
  font-size: 18px;
}

.status {
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid #d7dce4;
  border-radius: 8px;
  text-align: center;
  background: #fff;
  font-weight: 700;
}

.workspace-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.workspace-summary div {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
  background: #fff;
}

.workspace-summary span {
  color: #687386;
  font-size: 13px;
}

.workspace-summary strong {
  overflow: hidden;
  color: #17202a;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status[data-status='succeeded'] {
  color: #0f766e;
}

.status[data-status='failed'],
.status[data-status='final_failed'] {
  color: #b42318;
}

.panel {
  padding: 20px;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
  background: #fff;
}

label {
  display: grid;
  gap: 8px;
  color: #3f4754;
  font-size: 14px;
  font-weight: 600;
}

textarea,
input,
select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cfd6e0;
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
}

textarea:focus,
input:focus,
select:focus {
  border-color: #2563eb;
  outline: 2px solid #bfdbfe;
}

textarea {
  resize: vertical;
}

.controls,
.result-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.controls label {
  width: 160px;
}

.auth-panel {
  display: grid;
  gap: 12px;
  width: min(460px, 100%);
}

.account-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
}

.project-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
}

.asset-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  align-items: end;
  gap: 12px;
}

.asset-panel h2 {
  grid-column: 1 / -1;
}

.asset-summary {
  display: grid;
  gap: 4px;
  min-width: 96px;
  color: #3f4754;
}

.asset-summary strong {
  color: #17202a;
  font-size: 24px;
}

.project-panel h2 {
  grid-column: 1 / -1;
}

.account-panel h2,
.account-panel p {
  grid-column: 1 / -1;
}

button {
  min-height: 40px;
  border: 1px solid #17202a;
  border-radius: 8px;
  padding: 0 14px;
  background: #17202a;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.secondary-button {
  background: #fff;
  color: #17202a;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.result button {
  background: #fff;
  color: #17202a;
}

dl {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

dl div {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
}

dt {
  color: #687386;
}

dd {
  margin: 0;
  word-break: break-all;
}

.error {
  margin-top: 12px;
  color: #b42318;
}

.success {
  margin-top: 12px;
  color: #0f7b4f;
}

.muted {
  margin-top: 12px;
  color: #687386;
}

.task-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.task-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  border-color: #dfe4ec;
  background: #fff;
  color: #17202a;
  text-align: left;
}

.task-row:hover {
  border-color: #9aa7b7;
}

.task-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-assets {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.output-assets h3 {
  margin: 0;
  font-size: 16px;
}

.output-list {
  display: grid;
  gap: 8px;
}

.output-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
  border: 1px solid #dfe4ec;
  border-radius: 8px;
}

.output-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.output-row span {
  overflow: hidden;
  color: #687386;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-row small {
  color: #687386;
}

.output-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 10px;
}

.output-actions button {
  min-height: 32px;
  padding: 0 10px;
  background: #fff;
  color: #17202a;
}

@media (max-width: 640px) {
  .header,
  .header-actions,
  .controls,
  .result-header {
    align-items: stretch;
    flex-direction: column;
  }

  .controls label,
  .status {
    width: 100%;
  }

  .workspace-summary {
    grid-template-columns: 1fr;
  }

  .account-panel,
  .project-panel,
  .asset-panel {
    grid-template-columns: 1fr;
  }

  .asset-summary {
    min-width: 0;
  }

  dl div {
    grid-template-columns: 1fr;
  }

  .output-row {
    grid-template-columns: 1fr;
  }

  .output-actions {
    justify-content: start;
  }
}

@media (min-width: 900px) {
  .auth-panel {
    margin-top: 24px;
  }
}

@media (max-width: 900px) {
  .workspace-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-panel,
  .asset-panel {
    grid-template-columns: 1fr;
  }
}
</style>
