<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { Media } from './interfaces';

  let {show, media, onConfirm, onCancel} = $props();
</script>

{#if show}
  <div 
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
    transition:fade={{ duration: 200 }}
    onclick={onCancel}
    role="presentation"
  >
    <div 
      class="bg-white rounded-lg p-6 w-full mx-4 max-w-md"
      transition:scale={{ duration: 200 }}
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">确认删除</h3>
        <p class="mt-2 text-sm text-gray-500">
          确定要删除 "{media?.title}" 吗？此操作无法撤销。
        </p>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          onclick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          onclick={onConfirm}
        >
          删除
        </button>
      </div>
    </div>
  </div>
{/if} 