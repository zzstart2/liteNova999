<script setup lang="ts">
import type { AuthType } from '../../types/api-docs';
defineProps<{ auth: AuthType }>();
</script>

<template>
  <div class="auth-section">
    <h3 class="auth-section__title">Authentication</h3>
    <div class="auth-card">
      <template v-if="auth === 'bearer'">
        <div class="auth-method">🔒 Bearer Token</div>
        <p class="auth-desc">Include your API key in the <code>Authorization</code> header:</p>
        <code class="auth-example">Authorization: Bearer sk-lite-your-key-here</code>
      </template>
      <template v-else-if="auth === 'api-key'">
        <div class="auth-method">🔑 API Key</div>
        <p class="auth-desc">Include your API key in the <code>X-API-Key</code> header:</p>
        <code class="auth-example">X-API-Key: sk-lite-your-key-here</code>
      </template>
      <template v-else>
        <div class="auth-method">🔓 No Authentication Required</div>
        <p class="auth-desc">This endpoint does not require authentication.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-section { margin-bottom: 32px; }
.auth-section__title { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: var(--brand-text-primary, #111827); }
.auth-card {
  padding: 16px; background: var(--brand-surface, #f9fafb);
  border: 1px solid var(--brand-border, #e5e7eb); border-radius: var(--brand-radius, 8px);
}
.auth-method { font-size: 14px; font-weight: 600; color: var(--brand-text-primary, #111827); margin-bottom: 8px; }
.auth-desc { margin: 0 0 8px; font-size: 13px; color: var(--brand-text-secondary, #6b7280); }
.auth-desc code { padding: 1px 5px; background: #e5e7eb; border-radius: 3px; font-size: 12px; }
.auth-example {
  display: block; padding: 8px 12px; font-family: 'SF Mono', monospace; font-size: 12px;
  background: #1e1e2e; color: #cdd6f4; border-radius: 6px;
}
</style>
