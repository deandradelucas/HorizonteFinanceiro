<template>
  <div class="admin-shell">
    <aside class="sidebar admin-sidebar">
      <div class="sidebar-header">
        <i class="fa-solid fa-shield-halved dashboard-logo-icon"></i>
        <h2>Horizonte Financeiro</h2>
      </div>

      <nav class="sidebar-nav">
        <button @click="selectTab('users')" :class="navClass('users')" class="nav-item admin-nav-item">
          <i class="fa-solid fa-users"></i><span>Usuários</span>
        </button>
        <button @click="selectTab('online')" :class="navClass('online')" class="nav-item admin-nav-item">
          <i class="fa-solid fa-signal"></i><span>Online Agora</span>
          <strong v-if="stats.online > 0" class="admin-nav-counter">{{ stats.online }}</strong>
        </button>
        <button @click="selectTab('activity')" :class="navClass('activity')" class="nav-item admin-nav-item">
          <i class="fa-solid fa-list-ul"></i><span>Logs</span>
        </button>
        <button @click="selectTab('permissions')" :class="navClass('permissions')" class="nav-item admin-nav-item">
          <i class="fa-solid fa-key"></i><span>Permissões</span>
        </button>
        <button @click="selectTab('billing')" :class="navClass('billing')" class="nav-item admin-nav-item">
          <i class="fa-solid fa-credit-card"></i><span>Cobrança</span>
        </button>
        <button @click="selectTab('whatsapp')" :class="navClass('whatsapp')" class="nav-item admin-nav-item">
          <i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span>
        </button>
      </nav>

      <div class="sidebar-footer admin-sidebar-footer">
        <div class="admin-ai-panel">
          <div class="admin-ai-head">
            <i class="fa-solid fa-robot"></i>
            <div>
              <strong>AI Executor</strong>
              <p>Comandos rápidos para operação.</p>
            </div>
          </div>

          <form @submit.prevent="executeAICommand" class="admin-ai-form">
            <textarea
              v-model="aiPrompt"
              rows="3"
              placeholder="Bloquear fulano, promover admin..."
              :disabled="isAILoading"
            ></textarea>
            <button type="submit" class="btn-primary admin-ai-submit" :disabled="!aiPrompt.trim() || isAILoading">
              <i v-if="isAILoading" class="fa-solid fa-spinner fa-spin"></i>
              <i v-else class="fa-solid fa-paper-plane"></i>
              Executar
            </button>
          </form>
        </div>

        <a href="/dashboard" class="nav-item logout">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Sair do Admin</span>
        </a>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar admin-topbar">
        <button id="adminMobileMenuBtn" class="mobile-menu-btn">
          <i class="fa-solid fa-bars"></i>
        </button>

        <div class="search-bar admin-search-bar">
          <i class="fa-solid fa-shield-halved"></i>
          <input type="text" :value="pageTitle" readonly>
        </div>

        <div class="user-profile admin-topbar-meta">
          <span class="date-display">{{ currentDate }}</span>
          <span class="admin-chip">Super Admin</span>
          <span class="admin-status">Pagamento: em dia</span>
        </div>
      </header>

      <div class="dashboard-content admin-dashboard-content">
        <div class="page-header">
          <div>
            <h1>{{ pageTitle }}</h1>
            <p class="subtitle" style="margin-bottom: 0;">Operação administrativa central do Horizonte Financeiro.</p>
          </div>
        </div>

        <div class="admin-stat-grid">
          <div class="admin-stat-card">
            <div class="admin-stat-icon bg-blue-100 text-blue-600"><i class="fa-solid fa-users"></i></div>
            <div>
              <h4>Total</h4>
              <p>{{ stats.total }}</p>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon bg-emerald-100 text-emerald-600"><i class="fa-solid fa-signal"></i></div>
            <div>
              <h4>Online</h4>
              <p>{{ stats.online }}</p>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon bg-rose-100 text-rose-600"><i class="fa-solid fa-ban"></i></div>
            <div>
              <h4>Bloqueados</h4>
              <p>{{ stats.blocked }}</p>
            </div>
          </div>

          <div class="admin-stat-card">
            <div class="admin-stat-icon bg-violet-100 text-violet-600"><i class="fa-solid fa-bolt"></i></div>
            <div>
              <h4>Ações hoje</h4>
              <p>{{ stats.actionsToday }}</p>
            </div>
          </div>
        </div>

        <section class="admin-content-panel">
          <keep-alive>
            <component :is="activeComponent" @refreshStats="loadStats"></component>
          </keep-alive>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
const { loadModule } = window['vue3-sfc-loader'];

export default {
  name: 'AdminUsersDashboard',
  components: {
    'user-table': Vue.defineAsyncComponent(() => loadModule('/admin/UserTable.vue', window.vue3Options)),
    'online-users': Vue.defineAsyncComponent(() => loadModule('/admin/OnlineUsers.vue', window.vue3Options)),
    'activity-logs': Vue.defineAsyncComponent(() => loadModule('/admin/ActivityLogs.vue', window.vue3Options)),
    'permissions-manager': Vue.defineAsyncComponent(() => loadModule('/admin/PermissionsManager.vue', window.vue3Options)),
    'billing-manager': Vue.defineAsyncComponent(() => loadModule('/admin/BillingManager.vue', window.vue3Options)),
    'whatsapp-monitor': Vue.defineAsyncComponent(() => loadModule('/admin/WhatsAppMonitor.vue', window.vue3Options)),
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
      isAILoading: false,
      currentDate: ''
    }
  },
  computed: {
    activeComponent() {
      switch (this.activeTab) {
        case 'users': return 'user-table';
        case 'online': return 'online-users';
        case 'activity': return 'activity-logs';
        case 'permissions': return 'permissions-manager';
        case 'billing': return 'billing-manager';
        case 'whatsapp': return 'whatsapp-monitor';
        default: return 'user-table';
      }
    },
    pageTitle() {
      const map = {
        users: 'Painel Admin',
        online: 'Usuários Online',
        activity: 'Logs de Atividade',
        permissions: 'Permissões e Acessos',
        billing: 'Cobrança e Assinaturas',
        whatsapp: 'Operação WhatsApp'
      };
      return map[this.activeTab] || 'Painel Admin';
    }
  },
  methods: {
    selectTab(tab) {
      this.activeTab = tab;
      const sidebar = document.querySelector('.admin-sidebar');
      if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
      }
    },
    navClass(tab) {
      return this.activeTab === tab ? 'active' : '';
    },
    async loadStats() {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch('/api/admin/stats', {
          headers: { 'user-id': userId }
        });
        if (res.ok) {
          this.stats = await res.json();
        }
      } catch (error) {
        console.error('Admin Stats load error', error);
      }
    },
    async executeAICommand() {
      if (!this.aiPrompt.trim()) return;
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
            title: `Ação executada: ${result.action}`,
            text: result.message,
            showConfirmButton: false,
            timer: 3000
          });
          this.aiPrompt = '';
          this.loadStats();
        } else {
          Swal.fire('Erro da IA', result.error, 'error');
        }
      } catch (error) {
        Swal.fire('Erro', 'Falha de comunicação com o servidor.', 'error');
      } finally {
        this.isAILoading = false;
      }
    },
    initMobileSidebar() {
      const sidebar = document.querySelector('.admin-sidebar');
      const mobileBtn = document.getElementById('adminMobileMenuBtn');
      if (!sidebar || !mobileBtn) return;

      mobileBtn.onclick = () => sidebar.classList.toggle('active');
    }
  },
  mounted() {
    this.loadStats();
    this.initMobileSidebar();

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    let formattedDate = today.toLocaleDateString('pt-BR', options);
    this.currentDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    if (!window.vue3Options) {
      window.vue3Options = {
        moduleCache: { vue: Vue },
        async getFile(url) {
          const res = await fetch(url);
          if (!res.ok) throw Object.assign(new Error(res.statusText + ' ' + url), { res });
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

<style>
.admin-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
  max-width: 100vw;
  overflow: hidden;
}

.admin-sidebar {
  z-index: 1200;
}

.admin-shell .main-content {
  width: calc(100vw - 280px);
  max-width: calc(100vw - 280px);
  overflow-x: hidden;
}

.admin-nav-item {
  width: 100%;
  border: none;
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.admin-nav-counter {
  margin-left: auto;
  background: rgba(20, 201, 123, 0.18);
  color: #14c97b;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
}

.admin-sidebar-footer {
  display: grid;
  gap: 14px;
}

.admin-ai-panel {
  border: 1px solid var(--border-color);
  border-radius: 22px;
  padding: 16px;
  background: var(--card-bg);
}

.admin-ai-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.admin-ai-head i {
  color: #8b5cf6;
  margin-top: 3px;
}

.admin-ai-head strong {
  display: block;
  color: var(--text-main);
}

.admin-ai-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.admin-ai-form {
  display: grid;
  gap: 10px;
}

.admin-ai-form textarea {
  width: 100%;
  min-height: 88px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-main);
  padding: 12px 14px;
  resize: vertical;
  outline: none;
}

.admin-ai-submit {
  width: 100%;
}

.admin-topbar {
  gap: 16px;
}

.admin-search-bar input {
  cursor: default;
}

.admin-topbar-meta {
  gap: 12px;
}

.admin-chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.18);
  color: #60a5fa;
  font-size: 12px;
  font-weight: 700;
}

.admin-dashboard-content {
  display: grid;
  gap: 24px;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.admin-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.admin-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 22px;
  padding: 18px;
}

.admin-stat-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  font-size: 18px;
}

.admin-stat-card h4 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
}

.admin-stat-card p {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-main);
}

.admin-content-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 26px;
  padding: 22px;
  min-height: 520px;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

@media (max-width: 1080px) {
  .admin-shell .main-content {
    width: 100%;
    max-width: 100%;
  }

  .admin-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .admin-stat-grid {
    grid-template-columns: 1fr;
  }

  .admin-content-panel {
    padding: 16px;
    min-height: 420px;
  }

  .admin-chip {
    display: none;
  }
}
</style>
