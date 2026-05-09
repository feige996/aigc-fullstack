<template>
  <main class="shell">
    <section>
      <p class="eyebrow">AIGC Web</p>
      <h1>Generation Workspace</h1>
      <p>User-facing generation app skeleton.</p>
    </section>
  </main>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #17202a;
  background: #f7f8fa;
}

section {
  width: min(640px, calc(100vw - 32px));
}

.eyebrow {
  margin: 0 0 8px;
  color: #5b6472;
  font-size: 14px;
}

h1 {
  margin: 0 0 12px;
  font-size: 40px;
  line-height: 1.1;
}

p {
  margin: 0;
  color: #4b5563;
}
</style>
