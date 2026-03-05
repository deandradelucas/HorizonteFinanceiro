<template>
  <div class="flex flex-col h-full w-full">
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="text-lg font-bold text-slate-800">Gerenciador de Permissões</h2>
        <p class="text-sm text-slate-500">Controle granular de acesso aos módulos do sistema.</p>
      </div>
      
       <div class="relative w-64">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar usuário..." 
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          >
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
      
      <!-- Users List -->
      <div class="w-full md:w-1/3 flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
        <div class="bg-slate-50 p-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
           Selecione um Usuário
        </div>
        
        <div class="flex-1 overflow-y-auto">
             <div v-if="loadingUsers" class="p-8 text-center text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
            </div>
            <div 
                v-else
                v-for="user in filteredUsers" 
                :key="user.id"
                @click="selectUser(user)"
                :class="['p-4 border-b border-slate-100 cursor-pointer transition-colors', 
                         selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-l-primary' : 'hover:bg-slate-50 border-l-4 border-l-transparent']"
            >
                <div class="font-medium text-slate-800 text-sm">{{ user.email }}</div>
                <div class="flex justify-between items-center mt-1">
                    <span :class="roleBadgeClass(user.role)">{{ user.role }}</span>
                    <span class="text-[10px] text-slate-400">ID: {{ user.id }}</span>
                </div>
            </div>
        </div>
      </div>
      
      <!-- Permissions Editor -->
      <div class="w-full md:w-2/3 flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white relative">
        <div class="bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex justify-between items-center h-[72px]">
           <div v-if="selectedUser">
               <h3 class="font-bold text-slate-800">{{ selectedUser.email }}</h3>
               <p class="text-xs text-slate-500">Configurando permissões em JSON</p>
           </div>
           <div v-else>
               <h3 class="font-bold text-slate-400">Nenhum Usuário</h3>
           </div>
           
           <button 
                v-if="selectedUser"
                @click="savePermissions"
                :disabled="saving"
                class="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
                <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                <i v-else class="fa-solid fa-floppy-disk"></i> Salvar JSON
           </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-0 bg-slate-900 relative">
            <div v-if="!selectedUser" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-white z-10">
                <i class="fa-solid fa-hand-pointer text-4xl mb-4 opacity-50"></i>
                <p>Selecione um usuário na lista ao lado.</p>
            </div>
            
            <div v-if="loadingPermissions" class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10 bg-slate-900/80 backdrop-blur-sm">
                <i class="fa-solid fa-spinner fa-spin text-3xl"></i>
            </div>
            
            <textarea 
                v-if="selectedUser"
                v-model="jsonEditorContent"
                class="w-full h-full p-6 bg-transparent text-green-400 font-mono text-sm leading-relaxed outline-none resize-none"
                spellcheck="false"
            ></textarea>
        </div>
        
        <div class="bg-slate-800 border-t border-slate-700 p-3 shrink-0 text-xs text-slate-400 flex justify-between">
            <span>Editor JSON Bruto.</span>
            <button @click="resetToDefault" v-if="selectedUser" class="hover:text-white transition">Restaurar Padrão</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      users: [],
      selectedUser: null,
      searchQuery: '',
      loadingUsers: true,
      loadingPermissions: false,
      saving: false,
      jsonEditorContent: '{\n  "dashboard": true,\n  "transactions": true,\n  "reports": false,\n  "settings": false\n}',
      defaultSchema: {
          dashboard: true,
          transactions: true,
          goals: true,
          reports: false,
          settings: false
      }
    }
  },
  computed: {
    filteredUsers() {
      if(!this.searchQuery) return this.users;
      const q = this.searchQuery.toLowerCase();
      return this.users.filter(u => u.email.toLowerCase().includes(q));
    }
  },
  methods: {
    async fetchUsers() {
      this.loadingUsers = true;
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch('/api/admin/users', { headers: { 'user-id': userId }});
        if(res.ok) {
          const data = await res.json();
          this.users = data;
        }
      } catch (e) {
        console.error("Erro listando", e);
      } finally {
        this.loadingUsers = false;
      }
    },
    async selectUser(user) {
        this.selectedUser = user;
        this.loadingPermissions = true;
        
        try {
            const userId = localStorage.getItem('userId');
            const res = await fetch(`/api/admin/users/${user.id}/permissions`, { headers: { 'user-id': userId }});
            if(res.ok) {
                const data = await res.json();
                
                // Merge with default schema to ensure keys exist visually
                const merged = { ...this.defaultSchema, ...(data.permissions || {}) };
                this.jsonEditorContent = JSON.stringify(merged, null, 2);
            }
        } catch(e) {
            console.error("Erro permissões", e);
            this.jsonEditorContent = JSON.stringify(this.defaultSchema, null, 2);
        } finally {
            this.loadingPermissions = false;
        }
    },
    async savePermissions() {
        if(!this.selectedUser) return;
        
        let parsedJson;
        try {
            parsedJson = JSON.parse(this.jsonEditorContent);
        } catch(e) {
             Swal.fire({
                title: 'JSON Inválido',
                text: 'Verifique a sintaxe. Deve ser um JSON válido.',
                icon: 'error'
            });
            return;
        }
        
        this.saving = true;
        try {
            const userId = localStorage.getItem('userId');
            const res = await fetch(`/api/admin/users/${this.selectedUser.id}/permissions`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'user-id': userId 
                },
                body: JSON.stringify({ permissions: parsedJson })
            });
            
            if(res.ok) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'Permissões salvas.', showConfirmButton: false, timer: 3000
                });
            } else {
                throw new Error("API falhou");
            }
            
        } catch(e) {
            Swal.fire('Erro', 'Falha ao salvar permissões.', 'error');
        } finally {
            this.saving = false;
        }
    },
    resetToDefault() {
         this.jsonEditorContent = JSON.stringify(this.defaultSchema, null, 2);
    },
    roleBadgeClass(role) {
      if (role === 'super_admin') return 'px-2 pl-0 text-purple-600 font-bold text-xs uppercase cursor-default';
      if (role === 'admin') return 'px-2 pl-0 text-amber-600 font-bold text-xs uppercase cursor-default';
      return 'px-2 pl-0 text-slate-500 font-bold text-xs uppercase cursor-default';
    }
  },
  mounted() {
    this.fetchUsers();
  }
}
</script>
