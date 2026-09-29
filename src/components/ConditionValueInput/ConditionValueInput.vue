<script setup lang="ts">
defineProps<{
  operator: { requiresValue: boolean }
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label v-if="operator.requiresValue" class="condition-value-input">
    <span>Value</span>
    <input
      :value="modelValue"
      type="text"
      aria-label="Condition value"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<style scoped>
.condition-value-input {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
  color: #5b6472;
  font-size: 0.875rem;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid #c5ccd8;
  border-radius: 4px;
  color: inherit;
  font: inherit;
}
</style>
