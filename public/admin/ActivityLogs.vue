<template>
  <div class="flex flex-col h-full w-full">
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="text-lg font-bold text-slate-800">Trilha de Auditoria</h2>
        <p class="text-sm text-slate-500">Histórico de ações realizadas no sistema.</p>
      </div>
      
      <div class="flex gap-2 relative w-64">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar por usuário ou ação..." 
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          >
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-y-auto rounded-xl border border-slate-200 shadow-sm relative pr-2">
      <div v-if="loading" class="flex flex-col items-center justify-center p-12 text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-3xl mb-4"></i>
        <p>Carregando logs...</p>
      </div>
      
      <div v-else-if="filteredLogs.length === 0" class="flex flex-col items-center justify-center p-12 text-slate-400">
        <i class="fa-solid fa-clipboard-list text-4xl mb-4 opacity-50"></i>
        <p>Nenhum registro encontrado.</p>
      </div>
          
      <div v-else class="space-y-4">
        <!-- Log Item -->
        <div v-for="log in filteredLogs" :key="log.id" class="flex gap-4 p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors shadow-sm">
            
            <div class="mt-1">
                <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex justify-center items-center shadow-inner">
                    <i :class="getIconForAction(log.action)"></i>
                </div>
            </div>
            
            <div class="flex-1">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-bold text-slate-800 text-sm">
                        {{ log.action }}
                    </h4>
                    <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {{ formatDate(log.created_at) }}
                    </span>
                </div>
                
                <p class="text-sm text-slate-600 mb-2">
                    {{ log.description || 'Sem detalhes adicionais.' }}
                </p>
                
                <div class="flex items-center gap-2 mt-auto">
                    <div class="w-5 h-5 rounded-full bg-slate-200 flex justify-center items-center text-[10px] font-bold text-slate-600">
                         {{ (log.user_email || '?').charAt(0).toUpperCase() }}
                    </div>
                    <span class="text-xs font-medium text-slate-500">
                        {{ log.user_email }} <span class="text-slate-300 font-normal">({{ log.user_id }})</span>
                    </span>
                </div>
            </div>
            
        </div>
      </div>
    </div>
    
  </div>
</template>

<script>
export default {
  data() {
    return {
      logs: [],
      loading: true,
      searchQuery: ''
    }
  },
  computed: {
    filteredLogs() {
      if(!this.searchQuery) return this.logs;
      
      const q = this.searchQuery.toLowerCase();
      return this.logs.filter(log => 
          log.action.toLowerCase().includes(q) || 
          (log.user_email && log.user_email.toLowerCase().includes(q)) ||
          (log.description && log.description.toLowerCase().includes(q))
      );
    }
  },
  methods: {
    async fetchLogs() {
      this.loading = true;
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch('/api/admin/logs', { headers: { 'user-id': userId }});
        if(res.ok) {
          const data = await res.json();
          this.logs = data;
        }
      } catch (e) {
        console.error("Erro listando logs", e);
      } finally {
        this.loading = false;
      }
    },
    formatDate(dateString) {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    },
    getIconForAction(action) {
        const a = action.toLowerCase();
        if(a.includes('ai') || a.includes('ia')) return 'fa-solid fa-robot text-purple-600';
        if(a.includes('block') || a.includes('bloqueio')) return 'fa-solid fa-ban text-red-600';
        if(a.includes('unblock') || a.includes('desbloqueio')) return 'fa-solid fa-check text-green-600';
        if(a.includes('role') || a.includes('permiss')) return 'fa-solid fa-key text-amber-600';
        if(a.includes('creat') || a.includes('cri')) return 'fa-solid fa-user-plus text-blue-600';
        if(a.includes('logout') || a.includes('sessão')) return 'fa-solid fa-plug-circle-xmark text-orange-600';
        return 'fa-solid fa-bolt text-slate-600';
    }
  },
  mounted() {
    this.fetchLogs();
  }
}
</script>
