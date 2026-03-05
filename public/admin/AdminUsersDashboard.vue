<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <!-- Navbar -->
    <header class="bg-slate-900 text-white shadow-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-shield-halved text-primary text-xl"></i>
          <h1 class="font-bold text-lg tracking-wide">Horizonte Financeiro <span class="bg-primary px-2 py-0.5 rounded text-xs ml-2">SUPER ADMIN</span></h1>
        </div>
        
        <div class="flex items-center gap-4">
          <a href="/dashboard" class="text-sm text-slate-300 hover:text-white transition-colors" title="Voltar ao site principal">
            <i class="fa-solid fa-arrow-right-from-bracket rotate-180 mr-1"></i> Sair do Admin
          </a>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6">
      <!-- Sidebar Nav -->
      <aside class="w-64 flex-shrink-0">
        <nav class="space-y-1">
          <button 
            @click="activeTab = 'users'" 
            :class="[activeTab === 'users' ? 'bg-primary text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900']"
            class="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all"
          >
            <i class="fa-solid fa-users w-6"></i> Usuários
          </button>
          
          <button 
            @click="activeTab = 'online'" 
            :class="[activeTab === 'online' ? 'bg-primary text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900']"
            class="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all"
          >
            <i class="fa-solid fa-signal w-6"></i> Online Agora
            <span v-if="stats.online > 0" class="ml-auto bg-green-500 text-white py-0.5 px-2 rounded-full text-xs">{{ stats.online }}</span>
          </button>
          
          <button 
            @click="activeTab = 'activity'" 
            :class="[activeTab === 'activity' ? 'bg-primary text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900']"
            class="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all"
          >
            <i class="fa-solid fa-list-ul w-6"></i> Logs de Atividade
          </button>
          
          <button 
            @click="activeTab = 'permissions'" 
            :class="[activeTab === 'permissions' ? 'bg-primary text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900']"
            class="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all"
          >
            <i class="fa-solid fa-key w-6"></i> Permissões (RBAC)
          </button>
        </nav>
        
        <!-- AI Executor Mini Widget -->
        <div class="mt-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
            <h3 class="text-xs font-bold text-slate-800 uppercase mb-2 flex items-center gap-2">
                <i class="fa-solid fa-robot text-purple-600"></i> AI Executor
            </h3>
            <p class="text-xs text-slate-500 mb-3 leading-tight">Comande o sistema com linguagem natural.</p>
            
            <form @submit.prevent="executeAICommand" class="relative">
                <textarea 
                    v-model="aiPrompt"
                    rows="2" 
                    placeholder="'Bloquear lukas...'" 
                    class="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                    :disabled="isAILoading"
                ></textarea>
                <button 
                    type="submit" 
                    class="absolute bottom-2 right-2 text-white bg-purple-600 hover:bg-purple-700 w-6 h-6 rounded flex items-center justify-center transition disabled:opacity-50"
                    :disabled="!aiPrompt.trim() || isAILoading"
                >
                    <i v-if="isAILoading" class="fa-solid fa-spinner fa-spin text-xs"></i>
                    <i v-else class="fa-solid fa-paper-plane text-xs"></i>
                </button>
            </form>
        </div>
      </aside>

      <!-- Content Area -->
      <section class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
        
        <!-- Dashboard Header Stats (Visible on all tabs) -->
        <div class="bg-slate-50 p-6 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-users"></i>
                </div>
                <div>
                    <h4 class="text-slate-500 text-xs font-semibold uppercase">Total</h4>
                    <p class="text-xl font-bold text-slate-800">{{ stats.total }}</p>
                </div>
            </div>
            
             <div class="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-signal"></i>
                </div>
                <div>
                    <h4 class="text-slate-500 text-xs font-semibold uppercase">Online</h4>
                    <p class="text-xl font-bold text-slate-800">{{ stats.online }}</p>
                </div>
            </div>

            <div class="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-ban"></i>
                </div>
                <div>
                    <h4 class="text-slate-500 text-xs font-semibold uppercase">Bloqueados</h4>
                    <p class="text-xl font-bold text-slate-800">{{ stats.blocked }}</p>
                </div>
            </div>
            
            <div class="p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-bolt"></i>
                </div>
                <div>
                    <h4 class="text-slate-500 text-xs font-semibold uppercase">Ações Hoje</h4>
                    <p class="text-xl font-bold text-slate-800">{{ stats.actionsToday }}</p>
                </div>
            </div>
        </div>

        <!-- Dynamic View -->
        <div class="p-6 flex-1 flex flex-col">
          <keep-alive>
            <component 
                :is="activeComponent" 
                @refreshStats="loadStats"
            ></component>
          </keep-alive>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
// We use vue3-sfc-loader, so we import components dynamically.
const { loadModule } = window['vue3-sfc-loader'];

export default {
  name: 'AdminUsersDashboard',
  components: {
    'user-table': Vue.defineAsyncComponent(() => loadModule('/admin/UserTable.vue', window.vue3Options)),
    'online-users': Vue.defineAsyncComponent(() => loadModule('/admin/OnlineUsers.vue', window.vue3Options)),
    'activity-logs': Vue.defineAsyncComponent(() => loadModule('/admin/ActivityLogs.vue', window.vue3Options)),
    'permissions-manager': Vue.defineAsyncComponent(() => loadModule('/admin/PermissionsManager.vue', window.vue3Options)),
  },
  data() {
    return {
      activeTab: 'users',
      stats: {
        total: 0,
        online: 0,
        blocked: 0,
        actionsToday: 0
      },
      aiPrompt: '',
      isAILoading: false
    }
  },
  computed: {
    activeComponent() {
      switch (this.activeTab) {
        case 'users': return 'user-table';
        case 'online': return 'online-users';
        case 'activity': return 'activity-logs';
        case 'permissions': return 'permissions-manager';
        default: return 'user-table';
      }
    }
  },
  methods: {
    async loadStats() {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch('/api/admin/stats', {
            headers: { 'user-id': userId }
        });
        if(res.ok) {
            const data = await res.json();
            this.stats = data;
        }
      } catch (err) {
        console.error("Admin Stats load error", err);
      }
    },
    
    async executeAICommand() {
        if(!this.aiPrompt.trim()) return;
        this.isAILoading = true;
        
        try {
            const userId = sessionStorage.getItem('userId');
            const res = await fetch('/api/admin/ai-execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'user-id': userId
                },
                body: JSON.stringify({ prompt: this.aiPrompt })
            });
            
            const result = await res.json();
            
            if (res.ok) {
                 Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Ação Executada: ${result.action}`,
                    text: result.message,
                    showConfirmButton: false,
                    timer: 3000
                });
                this.aiPrompt = '';
                this.loadStats();
                // Optionally emit an event to child components to refresh
            } else {
                 Swal.fire('Erro da IA', result.error, 'error');
            }
            
        } catch (e) {
            Swal.fire('Erro', 'Falha de comunicação com o servidor.', 'error');
        } finally {
            this.isAILoading = false;
        }
    }
  },
  mounted() {
    this.loadStats();
    // Expose options globally so child components can load each other if necessary
    if(!window.vue3Options) {
        window.vue3Options = {
            moduleCache: { vue: Vue },
            async getFile(url) {
                const res = await fetch(url);
                if ( !res.ok ) throw Object.assign(new Error(res.statusText + ' ' + url), { res });
                return { getContentData: asBinary => asBinary ? res.arrayBuffer() : res.text() }
            },
           addStyle(textContent) {
                const style = Object.assign(document.createElement('style'), { textContent });
                document.head.appendChild(style);
           }
        }
    }
  }
}
</script>
