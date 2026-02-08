<script setup lang="ts">
const props = defineProps<{
  globalError: string
  fatalErrors: string[]
  warnings: string[]
  documentationUrl: string
}>()

const hasMessages = computed(() =>
  Boolean(props.globalError)
  || props.fatalErrors.length > 0
  || props.warnings.length > 0
)
</script>

<template>
  <UAlert
    v-if="globalError"
    color="error"
    variant="subtle"
    :title="globalError"
  />

  <UAlert
    v-for="(message, index) in fatalErrors"
    :key="`startup-fatal-${index}`"
    color="error"
    variant="subtle"
    :title="message"
  />

  <UAlert
    v-for="(message, index) in warnings"
    :key="`startup-warning-${index}`"
    color="warning"
    variant="subtle"
    :title="message"
  />

  <p
    v-if="hasMessages"
    class="text-xs text-muted"
  >
    Documentation:
    <ULink
      :to="documentationUrl"
      target="_blank"
      class="ml-1 text-primary underline"
    >
      GitHub
    </ULink>
  </p>
</template>
