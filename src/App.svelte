<script lang="ts">
  import { fade } from 'svelte/transition';
  import request from './lib/request';
  import type { Media } from './lib/interfaces';
  import MediaItem from './lib/MediaItem.svelte';
  import MediaFormModal from './lib/MediaFormModal.svelte';
  import DeleteConfirmModal from './lib/DeleteConfirmModal.svelte';
  import Toast from './lib/Toast.svelte';
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
  let isInitializing = $state(true); // 新增：初始化状态
  let username = $state('');
  let password = $state('');
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

  // 与线上一致：库里存的是 btoa 后的密码
  function encodePassword(message: string): string {
    return btoa(message);
  }

  // 初始化函数：检查认证状态
  async function initializeAuth() {
    const authString = localStorage.getItem('auth');
    if (authString) {
      try {
        const authData = JSON.parse(authString);
        if (new Date().getTime() > authData.expiry) {
          localStorage.removeItem('auth');
          isInitializing = false;
          return;
        }

        // 使用新的验证接口检查登录状态
        const response = await request.get<ApiResponse<{username: string}>>('/auth/verify');
        
        if (response.data.code === 0) {
          isAuthenticated = true;
          error = '';
          // 获取初始数据
          await fetchMediaList();
        } else {
          // 如果认证失败，清除存储的认证信息
          localStorage.removeItem('auth');
        }
      } catch (e: any) {
        // 如果请求失败，清除存储的认证信息
        localStorage.removeItem('auth');
        error = e.message || 'Connection error';
      }
    }
    isInitializing = false; // 初始化完成
  }

  // 页面加载时初始化认证状态
  initializeAuth();

  // 获取媒体列表
  async function fetchMediaList() {
    loading = true;
    try {
      const response = await request.get<ApiResponse<PageResponse>>('/media/page', {
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

  // 登录处理
  async function handleLogin(e: Event) {
    e.preventDefault();
    try {
      // 对密码进行简单编码
      const encodedPassword = encodePassword(password);

      // 使用验证接口验证登录
      const response = await request.post<ApiResponse<{token: string}>>('/user/login', {
        username,
        password: encodedPassword
      });
      
      if (response.data.code === 200) {
        const expiry = new Date().getTime() + 2 * 60 * 60 * 1000; // 2 hours
        const authData = { token: response.data.data.token, expiry };
        localStorage.setItem('auth', JSON.stringify(authData));
        isAuthenticated = true;
        error = '';
        // 获取初始数据
        await fetchMediaList();
      } else {
        error = response.data.message || 'Invalid username or password';
        localStorage.removeItem('auth');
      }
    } catch (e: any) {
      error = e.message || 'Connection error';
      localStorage.removeItem('auth');
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
          登录你的账号
        </p>
        <p class="mt-1 text-center text-xs text-gray-400">
          已迁移到 Cloudflare Workers
        </p>
      </div>
      <form class="mt-8 space-y-6" onsubmit={handleLogin}>
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">用户名</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="请输入用户名"
              bind:value={username}
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="请输入密码"
              bind:value={password}
            />
          </div>
        </div>

        {#if error}
          <div class="text-red-500 text-sm text-center">
            {error}
          </div>
        {/if}

        <div>
          <button
            type="submit"
            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            登录
          </button>
        </div>
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
                    fetchMediaList();
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
                    fetchMediaList();
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
                          fetchMediaList();
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
                    fetchMediaList();
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
