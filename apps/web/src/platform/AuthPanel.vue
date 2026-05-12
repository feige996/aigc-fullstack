<script setup lang="ts">
defineProps<{
  phoneNumber: string
  password: string
  displayName: string
  errorMessage: string
  successMessage: string
}>()

defineEmits<{
  'update:phoneNumber': [value: string]
  'update:password': [value: string]
  'update:displayName': [value: string]
  login: []
  register: []
}>()
</script>

<template>
  <section class="panel auth-panel">
    <label>
      Phone
      <input
        :value="phoneNumber"
        type="tel"
        @input="$emit('update:phoneNumber', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      Password
      <input
        :value="password"
        type="password"
        @input="$emit('update:password', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      Display Name
      <input
        :value="displayName"
        type="text"
        @input="$emit('update:displayName', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="controls">
      <button type="button" @click="$emit('login')">Login</button>
      <button type="button" @click="$emit('register')">Register</button>
    </div>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success">{{ successMessage }}</p>
  </section>
</template>
