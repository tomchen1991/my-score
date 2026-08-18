<script lang="ts">
  import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from 'date-fns';
  import { zhCN } from 'date-fns/locale';
  import { fade, scale } from 'svelte/transition';

  let { value, placeholder = '选择日期', onSelect } = $props();
  let isOpen = $state(false);
  let currentMonth = $state(value ? new Date(value) : new Date());
  let inputElement: HTMLInputElement;

  function handleSelect(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    onSelect(dateStr);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (inputElement && !inputElement.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  function prevMonth() {
    currentMonth = subMonths(currentMonth, 1);
  }

  function nextMonth() {
    currentMonth = addMonths(currentMonth, 1);
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });

  $effect(() => {
    if (value) {
      currentMonth = new Date(value);
    }
  });
</script>

<div class="relative w-full">
  <input
    bind:this={inputElement}
    type="text"
    {placeholder}
    value={value || ''}
    readonly
    onclick={() => isOpen = true}
    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  />
  {#if isOpen}
    <div
      class="absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200"
      transition:scale={{ duration: 200 }}
    >
      <div class="p-2">
        <div class="flex items-center justify-between mb-2">
          <button
            class="p-1 hover:bg-gray-100 rounded-full"
            onclick={(e) => {
              e.stopPropagation();
              prevMonth();
            }}
            aria-label="上一月"
          >
            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <span class="text-sm font-medium">
            {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
          </span>
          <button
            class="p-1 hover:bg-gray-100 rounded-full"
            onclick={(e) => {
              e.stopPropagation();
              nextMonth();
            }}
            aria-label="下一月"
          >
            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        <div class="grid grid-cols-7 gap-1">
          {#each ['日', '一', '二', '三', '四', '五', '六'] as day}
            <div class="text-center text-sm text-gray-500 py-1">{day}</div>
          {/each}
          {#each eachDayOfInterval({
            start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
            end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
          }) as date}
            <button
              class:text-gray-400={!isSameMonth(date, currentMonth)}
              class:bg-blue-500={value && format(new Date(value), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')}
              class:text-white={value && format(new Date(value), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')}
              class:border-2={isToday(date)}
              class:border-blue-500={isToday(date)}
              onclick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleSelect(date);
              }}
            >
              {format(date, 'd')}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div> 