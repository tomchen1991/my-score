<script lang="ts">
  import type { Media } from './interfaces';
  import { fade, scale } from 'svelte/transition';
  import DatePicker from './DatePicker.svelte';
  import StarRating from './StarRating.svelte';

  let {show, mode, submitMedia, handleClose, media: initialMedia, itemType} = $props();
  let media: Media = $state({
    title: '',
    type: itemType,
    date: '',
    rating: 0,
    platform: '',
    notes: ''
  });
  $effect(() => {
    if (show) {
      if (mode === 'edit' && initialMedia) {
        media = { ...initialMedia };
      } else {
        media = {
          title: '',
          type: itemType,
          date: '',
          rating: 0,
          platform: '',
          notes: ''
        };
      }
    }
  });
  const typeOptions = [
    { value: 'game', label: '游戏' },
    { value: 'book', label: '书籍' },
    { value: 'movie', label: '电影' },
    { value: 'anime', label: '番剧' },
    { value: 'other', label: '其它' },
  ];

  function handleSubmit(e: Event) {
    e.preventDefault();
  }
</script>

{#if show}
  <div 
    class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" 
    transition:fade={{ duration: 200 }}
    onclick={handleClose}
    role="presentation"
  >
    <div 
      class="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 w-full mx-4 max-w-[800px] shadow-2xl"
      transition:scale={{ duration: 200 }}
      onclick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div class="flex justify-between items-center mb-6">
        <h2 id="modal-title" class="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          {mode === 'add' ? '添加新作品' : '编辑作品'}
        </h2>
        <button 
          class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          onclick={handleClose}
          type="button"
          aria-label="关闭"
        >
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="flex justify-between items-center gap-6">
          <label class="font-medium text-gray-700 whitespace-nowrap" for="title">标题</label>
          <input
            id="title"
            type="text"
            bind:value={media.title}
            class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
            placeholder="请输入标题"
            required
            aria-required="true"
          />
        </div>

        <div class="flex justify-between items-center gap-6">
          <label class="font-medium text-gray-700 whitespace-nowrap" for="type">类别</label>
          <select
            id="type"
            bind:value={media.type}
            class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
            required
            aria-required="true"
          >
            {#each typeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex justify-between items-center gap-6">
          <label class="font-medium text-gray-700 whitespace-nowrap" for="date">日期</label>
          <DatePicker
            value={media.date}
            onSelect={(date: string) => media.date = date}
            placeholder="选择日期"
          />
        </div>

        <div class="flex start items-center gap-6">
          <label for="score" class="font-medium text-gray-700 whitespace-nowrap">评分</label>
          <StarRating
            value={media.rating}
            onSelect={(score: number) => media.rating = score}
          />
        </div>
        {#if media.type === 'game' || media.type === 'other'}
          <div class="flex justify-between items-center gap-6">
            <label class="font-medium text-gray-700 whitespace-nowrap" for="platform">{
              media.type === 'game' ? '平台' : '类别'
            }</label>
            <input
              id="platform"
              type="text"
              bind:value={media.platform}
              class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
              placeholder="例如：Steam、Netflix、Kindle等"
              aria-label="输入平台名称"
            />
          </div>
        {/if}
        <div class="flex justify-between items-center gap-6">
          <label class="font-medium text-gray-700 whitespace-nowrap" for="notes">备注</label>
          <textarea
            id="notes"
            bind:value={media.notes}
            class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
            rows="10"
            placeholder="添加一些备注..."
            aria-label="添加备注信息"
          ></textarea>
        </div>
        <div class="text-sm text-left text-gray-500">字数：{media.notes?.length || 0}</div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
            onclick={handleClose}
          >
            取消
          </button>
          <button
            type="button"
            onclick={() => submitMedia(media)}
            class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {mode === 'add' ? '添加' : '保存'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if} 