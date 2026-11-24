<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import request from './lib/request';
  import type { Media } from './lib/interfaces';
  import MediaItem from './lib/MediaItem.svelte';
  import MediaFormModal from './lib/MediaFormModal.svelte';
  import DeleteConfirmModal from './lib/DeleteConfirmModal.svelte';
  import Toast from './lib/Toast.svelte';
  import { showToast } from './lib/toast';
  // 类型定义

  interface ApiResponse<T> {
    code: number;
    data: T;
    message: string;
  }

  interface PageResponse {
    list: Media[];
    total: number;
    currentPage: number;
    pageSize: number;
  }

  // 状态管理
  let isAuthenticated = $state(false);
  let isInitializing = $state(true);
  let isLoggingOut = $state(false);
  let isLoggingIn = $state(false);
  let loginCode = $state('');
  let error = $state('');

  // 媒体列表状态
  let currentCategory = $state<string>('game');
  let mediaList = $state<Media[]>([]);
  let currentPage = $state<number>(1);
  let pageSize = $state<number>(10);
  let totalItems = $state<number>(0);
  let loading = $state<boolean>(false);

  // 模态框状态
  let showCreateModal = $state<boolean>(false);
  let editingMedia = $state<Media | null>(null);
  let deletingMedia = $state<Media | null>(null);

  // 类别选项
  const categories = [
    { id: 'game', label: '游戏' },
    { id: 'book', label: '书籍' },
    { id: 'movie', label: '电影' },
    { id: 'anime', label: '番剧' },
    { id: 'other', label: '其他' }
  ];

  function clearSession() {
    isAuthenticated = false;
    mediaList = [];
    currentPage = 1;
    totalItems = 0;
    showCreateModal = false;
    editingMedia = null;
    deletingMedia = null;
  }

  async function initializeAuth() {
    try {
      const response = await fetch('/api/auth/verify', { credentials: 'same-origin' });
      if (response.status === 401) return;
      if (!response.ok) throw new Error('无法检查登录状态，请刷新页面重试');
      isAuthenticated = true;
      error = '';
      await fetchMediaList();
    } catch (e) {
      error = e instanceof Error ? e.message : '无法连接服务器';
    } finally {
      isInitializing = false;
    }
  }

  onMount(() => {
    try {
      localStorage.removeItem('auth'); // Remove the old, no longer accepted bearer token.
    } catch {
      // Cookie sessions do not require local storage.
    }
    window.addEventListener('session-expired', clearSession);
    void initializeAuth();
    return () => window.removeEventListener('session-expired', clearSession);
  });

  // 获取媒体列表
  async function fetchMediaList(activity = false) {
    loading = true;
    try {
      const response = await request.get<ApiResponse<PageResponse>>('/media/page', {
        activity,
        params: {
          type: currentCategory,
          currentPage: currentPage,
          pageSize: pageSize
        }
      });
      if (response.data.code === 0) {
        mediaList = response.data.data.list;
        totalItems = response.data.data.total;
      }
    } catch (e: any) {
      error = e.message || 'Failed to fetch media list';
    } finally {
      loading = false;
    }
  }

  async function handleLogin(event: SubmitEvent) {
    event.preventDefault();
    if (isLoggingIn) return;
    isLoggingIn = true;
    error = '';
    try {
      const submission = request.post('/auth/login', { code: loginCode });
      loginCode = '';
      await submission;
      isAuthenticated = true;
      await fetchMediaList();
    } catch (e) {
      error = e instanceof Error ? e.message : '登录失败，请重试';
    } finally {
      loginCode = '';
      isLoggingIn = false;
    }
  }

  async function handleLogout() {
    isLoggingOut = true;
    try {
      const { data: { data } } = await request.post<ApiResponse<{ revoked: boolean }>>('/auth/logout');
      clearSession();
      error = '';
      if (!data.revoked) showToast('已退出本站，但暂未确认 Auth 授权撤销');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '退出失败，请重试');
    } finally {
      isLoggingOut = false;
    }
  }

  // 处理创建新媒体
  async function handleCreate(media: Media) {
    try {
      const response = await request.post<ApiResponse<Media>>('/media/create', {
        ...media,
      });
      
      if (response.data.code === 0) {
        showCreateModal = false;
        await fetchMediaList();
      } else {
        error = response.data.message || 'Failed to create media';
      }
    } catch (e: any) {
      error = e.message || 'Failed to create media';
    }
  }

  // 处理编辑媒体
  async function handleEdit(media: Media) {
    try {
      const response = await request.put<ApiResponse<Media>>(`/media/updateById/${media.id}`, {
        ...media,
      });
      
      if (response.data.code === 0) {
        editingMedia = null;
        await fetchMediaList();
      } else {
        error = response.data.message || 'Failed to update media';
      }
    } catch (e: any) {
      error = e.message || 'Failed to update media';
    }
  }

  // 处理编辑按钮点击
  function handleEditClick(media: Media) {
    editingMedia = media;
  }

  // 处理删除按钮点击
  function handleDeleteClick(media: Media) {
    deletingMedia = media;
  }

  // 处理删除确认
  async function handleDeleteConfirm() {
    if (!deletingMedia?.id) return;
    
    try {
      const response = await request.delete<ApiResponse<null>>(`/media/deleteById/${deletingMedia.id}`);
      
      if (response.data.code === 0) {
        deletingMedia = null;
        await fetchMediaList();
      } else {
        error = response.data.message || 'Failed to delete media';
      }
    } catch (e: any) {
      error = e.message || 'Failed to delete media';
    }
  }

  let totalPages = $derived(Math.ceil(totalItems / pageSize));
  let pageNumbers = $derived.by((): (number | string)[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  });
</script>

<svelte:head>
  <title>My Score</title>
</svelte:head>

<Toast />

{#if isInitializing}
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">加载中...</p>
    </div>
  </div>
{:else if !isAuthenticated}
  <div class="min-h-screen flex items-center justify-center bg-gray-100" transition:fade>
    <div class="w-[480px] space-y-8 p-8 bg-white rounded-lg shadow-lg">
      <div>
        <h2 class="text-center text-3xl font-extrabold text-gray-900">
          我的评分
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          使用 Falsita Auth 验证码或恢复码登录
        </p>
      </div>
      <form class="space-y-4" onsubmit={handleLogin}>
        <label for="auth-code" class="block text-sm font-medium text-gray-700">验证码或恢复码</label>
        <input id="auth-code" type="text" autocomplete="one-time-code" autocapitalize="off" spellcheck={false}
          required maxlength="32" bind:value={loginCode} disabled={isLoggingIn}
          class="block w-full px-3 py-2 border border-gray-300 rounded-md" />
        {#if error}
          <p class="text-red-500 text-sm text-center" role="alert">{error}</p>
        {/if}
        <button type="submit" disabled={isLoggingIn}
          class="w-full py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >{isLoggingIn ? '正在验证…' : '登录'}</button>
      </form>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" transition:fade>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 类别选择栏 -->
      <div class="bg-white/80 backdrop-blur-sm shadow-sm rounded-xl mb-6 border border-gray-200">
        <div class="px-6 py-4">
          <div class="flex justify-between items-center">
            <div class="flex space-x-4">
              {#each categories as category}
                <button
                  class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentCategory === category.id ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                  onclick={() => {
                    currentCategory = category.id;
                    currentPage = 1;
                    fetchMediaList(true);
                  }}
                >
                  {category.label}
                </button>
              {/each}
            </div>
            <button
              class="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm hover:shadow-md"
              onclick={() => showCreateModal = true}
            >
              添加新作品
            </button>
            <button
              type="button"
              class="px-3 py-2 text-sm text-gray-700 hover:text-indigo-600 disabled:opacity-50"
              disabled={isLoggingOut}
              onclick={handleLogout}
            >退出登录</button>
          </div>
        </div>
      </div>

      <!-- 媒体列表 -->
      <div class="bg-white/80 backdrop-blur-sm shadow-sm rounded-xl border border-gray-200">
        <div class="px-6 py-4">
          {#if loading}
            <div class="text-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {#each mediaList as media}
                <MediaItem {media} onEdit={handleEditClick} onDelete={handleDeleteClick} />
              {/each}
            </div>

            <!-- 分页控制 -->
            <div class="mt-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-0">
              <div class="text-sm text-gray-600">
                显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} 条，共 {totalItems} 条
              </div>
              <div class="flex items-center space-x-1">
                <button
                  class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'}"
                  disabled={currentPage === 1}
                  onclick={() => {
                    currentPage = currentPage - 1;
                    fetchMediaList(true);
                  }}
                >
                  上一页
                </button>
                {#each pageNumbers as num, i}
                  {#if num === '...'}
                    <span class="px-2 text-gray-400 select-none">...</span>
                  {:else}
                    <button
                      class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === num ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'}"
                      disabled={typeof num === 'number' ? currentPage === num : false}
                      onclick={() => {
                        if (typeof num === 'number') {
                          currentPage = num;
                          fetchMediaList(true);
                        }
                      }}
                    >
                      {num}
                    </button>
                  {/if}
                {/each}
                <button
                  class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentPage * pageSize >= totalItems ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md'}"
                  disabled={currentPage * pageSize >= totalItems}
                  onclick={() => {
                    currentPage = currentPage + 1;
                    fetchMediaList(true);
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<MediaFormModal
  show={showCreateModal}
  handleClose={() => showCreateModal = false}
  submitMedia={handleCreate}
  mode="add"
  itemType={currentCategory}
  media={null}
/>

<MediaFormModal
  show={editingMedia !== null}
  handleClose={() => editingMedia = null}
  submitMedia={handleEdit}
  mode="edit"
  itemType=""
  media={editingMedia}
/>

<DeleteConfirmModal
  show={deletingMedia !== null}
  media={deletingMedia}
  onConfirm={handleDeleteConfirm}
  onCancel={() => deletingMedia = null}
/>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
