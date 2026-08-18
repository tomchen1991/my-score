<script lang="ts">
  import { toast } from './toast';
</script>

{#if $toast.visible}
  <div class="fixed top-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50 transition-all">
    { $toast.message }
  </div>
{/if} 