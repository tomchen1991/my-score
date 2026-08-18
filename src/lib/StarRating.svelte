<script lang="ts">
  let { value = 0, maxStars = 10, onSelect } = $props();
  let hoverValue = $state(0);

  function handleStarClick(index: number) {
    onSelect(index + 1);
  }

  function handleStarHover(index: number) {
    hoverValue = index + 1;
  }

  function handleMouseLeave() {
    hoverValue = 0;
  }
</script>

<div class="flex items-center gap-1" onmouseleave={handleMouseLeave} role="presentation">
  {#each Array(maxStars) as _, i}
    <div
      class="text-xl focus:outline-none transition-all duration-200 cursor-pointer hover:scale-110"
      class:text-yellow-400={i < (hoverValue || value)}
      class:text-gray-200={i >= (hoverValue || value)}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleStarClick(i);
      }}
      onmouseenter={() => handleStarHover(i)}
      role="presentation"
    >
      ★
    </div>
  {/each}
  {#if value > 0}
    <span class="ml-2 text-sm font-medium bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{value}分</span>
  {/if}
</div> 