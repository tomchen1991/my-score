<script lang="ts">
  import type { Media } from './interfaces';
  let {media, onEdit, onDelete}: {media: Media, onEdit: (media: Media) => void, onDelete: (media: Media) => void} = $props();

  // 星星评分组件
  import { StarRating } from './utils';
</script>

<div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] transition-all duration-200 border border-gray-100/50 overflow-hidden">
  <div class="p-6">
    <div class="flex justify-between items-center mb-1">
      <span>
        <h2 class="text-lg font-semibold text-gray-800 line-clamp-1">
          {media.title}
          {#if media.platform}
            <span class="px-2 py-1 text-gray-600 text-sm bg-gray-50/80 rounded-full">{`(${media.platform})`}</span>
          {/if}
        </h2>
      </span>
      <div class="flex items-center gap-2">
        <button
          onclick={() => onEdit(media)}
          class="text-gray-400 hover:text-indigo-400 transition-colors duration-200"
          aria-label="编辑"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onclick={() => onDelete(media)}
          class="text-gray-400 hover:text-rose-400 transition-colors duration-200"
          aria-label="删除"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
    <div class="space-y-2 text-sm text-gray-600 flex justify-between">
      <p class="flex items-center gap-2">
        <span class="text-gray-500">评分：</span>
        <span class="flex items-center gap-1">{@html StarRating((media.rating ?? 0) / 2)}</span>
      </p>
      <p class="flex items-center gap-2">
        <span class="text-gray-500">日期：</span>
        <span class="text-gray-700">{media.date}</span>
      </p>
    </div>
    {#if media.notes}
      <div class="mt-1 pt-1 border-t border-gray-100/50">
        <p class="text-sm text-gray-600 line-clamp-3">{media.notes}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .delete-button {
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    opacity: 0.5;
  }
  .delete-button:hover {
    opacity: 1;
  }
</style>