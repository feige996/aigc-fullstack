<template>
  <el-config-provider>
    <el-container class="layout">
      <el-aside width="232px" class="aside">AIGC Admin</el-aside>
      <el-container>
        <el-header class="header">Operations Console</el-header>
        <el-main>
          <el-card shadow="never">
            <template #header>Dashboard</template>
            <p>Admin app skeleton.</p>
          </el-card>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f6f7f9;
}

.aside {
  padding: 20px;
  color: #fff;
  background: #1f2937;
  font-weight: 600;
}

.header {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
}
</style>
