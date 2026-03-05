<template>
  <div class="flex flex-col h-full w-full">
    <!-- Action Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
      <div class="flex gap-2 w-full sm:w-auto">
        <div class="relative w-full sm:w-64">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar email ou id..." 
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          >
        </div>
        
        <select v-model="roleFilter" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>
      
      <button @click="openNewUserModal" class="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-sm">
        <i class="fa-solid fa-plus mr-2"></i> Novo Usuário
      </button>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-x-auto rounded-xl border border-slate-200 shadow-sm relative">
      <table class="w-full text-left text-sm text-slate-600">
        <thead class="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
          <tr>
            <th @click="sortBy('email')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">
              Email <i v-if="sortKey === 'email'" :class="['fa-solid', sortAsc ? 'fa-sort-up' : 'fa-sort-down']"></i>
            </th>
            <th @click="sortBy('role')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">
              Role <i v-if="sortKey === 'role'" :class="['fa-solid', sortAsc ? 'fa-sort-up' : 'fa-sort-down']"></i>
            </th>
            <th @click="sortBy('is_active')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">
              Status <i v-if="sortKey === 'is_active'" :class="['fa-solid', sortAsc ? 'fa-sort-up' : 'fa-sort-down']"></i>
            </th>
            <th @click="sortBy('last_login')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">
              Último Login <i v-if="sortKey === 'last_login'" :class="['fa-solid', sortAsc ? 'fa-sort-up' : 'fa-sort-down']"></i>
            </th>
            <th class="px-6 py-4 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-slate-100">
          <tr v-if="loading" class="animate-pulse">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
              <p>Carregando usuários...</p>
            </td>
          </tr>
          
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-folder-open text-2xl mb-2"></i>
              <p>Nenhum usuário encontrado.</p>
            </td>
          </tr>

          <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-slate-200 text-slate-600 flex justify-center items-center font-bold text-xs">
                  {{ user.email.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div class="font-medium text-slate-900">{{ user.email }}</div>
                  <div class="text-xs text-slate-400">ID: {{ user.id }}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span :class="roleBadgeClass(user.role)">
                {{ roleLabel(user.role) }}
              </span>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <div :class="['w-2 h-2 rounded-full', user.is_active ? 'bg-green-500' : 'bg-red-500']"></div>
                <span>{{ user.is_active ? 'Ativo' : 'Bloqueado' }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-slate-500">
              {{ formatDate(user.last_login) }}
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button @click="editUser(user)" class="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition" title="Editar Permissões/Role">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button v-if="user.is_active" @click="toggleBlock(user.id, false)" class="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded transition" title="Bloquear">
                  <i class="fa-solid fa-ban"></i>
                </button>
                <button v-else @click="toggleBlock(user.id, true)" class="p-2 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded transition" title="Desbloquear">
                  <i class="fa-solid fa-check"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <user-form 
      v-if="showModal" 
      :user="selectedUser" 
      @close="closeModal" 
      @saved="fetchUsers"
    ></user-form>

  </div>
</template>

<script>
const { loadModule } = window['vue3-sfc-loader'];

export default {
  components: {
    'user-form': Vue.defineAsyncComponent(() => loadModule('/admin/UserForm.vue', window.vue3Options)),
  },
  data() {
    return {
      users: [],
      loading: true,
      searchQuery: '',
      roleFilter: 'all',
      sortKey: 'created_at',
      sortAsc: false,
      showModal: false,
      selectedUser: null
    }
  },
  computed: {
    filteredUsers() {
      let result = this.users;
      
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        result = result.filter(u => 
          u.email.toLowerCase().includes(q) || u.id.toString().includes(q)
        );
      }
      
      if (this.roleFilter !== 'all') {
        result = result.filter(u => u.role === this.roleFilter);
      }

      return result.sort((a, b) => {
        let valA = a[this.sortKey];
        let valB = b[this.sortKey];
        
        if(valA == null) valA = '';
        if(valB == null) valB = '';

        if (valA < valB) return this.sortAsc ? -1 : 1;
        if (valA > valB) return this.sortAsc ? 1 : -1;
        return 0;
      });
    }
  },
  methods: {
    async fetchUsers() {
      this.loading = true;
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch('/api/admin/users', { headers: { 'user-id': userId }});
        if(res.ok) {
          const data = await res.json();
          this.users = data;
        }
      } catch (e) {
        console.error("Erro listando usuários", e);
      } finally {
        this.loading = false;
        this.$emit('refreshStats');
      }
    },
    sortBy(key) {
      if (this.sortKey === key) this.sortAsc = !this.sortAsc;
      else {
        this.sortKey = key;
        this.sortAsc = true;
      }
    },
    formatDate(dateString) {
      if (!dateString) return 'Nunca';
      return new Date(dateString).toLocaleDateString('pt-BR', { 
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    },
    roleBadgeClass(role) {
      const base = 'px-2.5 py-1 text-xs font-semibold rounded-full border ';
      if (role === 'super_admin') return base + 'bg-purple-100 text-purple-700 border-purple-200';
      if (role === 'admin') return base + 'bg-amber-100 text-amber-700 border-amber-200';
      return base + 'bg-slate-100 text-slate-700 border-slate-200';
    },
    roleLabel(role) {
      if (role === 'super_admin') return 'Super Admin';
      if (role === 'admin') return 'Admin';
      return 'User';
    },
    openNewUserModal() {
      this.selectedUser = null;
      this.showModal = true;
    },
    editUser(user) {
      this.selectedUser = user;
      this.showModal = true;
    },
    closeModal() {
      this.showModal = false;
      this.selectedUser = null;
    },
    async toggleBlock(targetId, activate) {
      try {
        const userId = localStorage.getItem('userId');
        const endpoint = activate ? `/api/admin/users/${targetId}/unblock` : `/api/admin/users/${targetId}/block`;
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'user-id': userId }
        });
        
        if (res.ok) {
           Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: activate ? 'Usuário Desbloqueado' : 'Usuário Bloqueado', showConfirmButton: false, timer: 3000
          });
          this.fetchUsers();
        }
      } catch (e) {
         Swal.fire('Erro', 'Falha ao alterar status.', 'error');
      }
    }
  },
  mounted() {
    this.fetchUsers();
  }
}
</script>
