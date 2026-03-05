<template>
  <div class="flex flex-col h-full w-full">
    <div class="mb-6 flex justify-between items-end">
      <div>
        <h2 class="text-lg font-bold text-slate-800">Usuários Ativos (15 min)</h2>
        <p class="text-sm text-slate-500">Pessoas que interagiram com o sistema recentemente.</p>
      </div>
      <button @click="fetchOnlineUsers" class="text-slate-500 hover:text-primary transition" title="Atualizar">
        <i class="fa-solid fa-rotate-right" :class="{'fa-spin': loading}"></i>
      </button>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-x-auto rounded-xl border border-slate-200 shadow-sm relative">
      <table class="w-full text-left text-sm text-slate-600">
        <thead class="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
          <tr>
            <th class="px-6 py-4 font-semibold">Email</th>
            <th class="px-6 py-4 font-semibold">Role</th>
            <th class="px-6 py-4 font-semibold">Última Atividade</th>
            <th class="px-6 py-4 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-slate-100">
          <tr v-if="loading" class="animate-pulse">
            <td colspan="4" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
              <p>Buscando conexões ativas...</p>
            </td>
          </tr>
          
          <tr v-else-if="onlineUsers.length === 0">
            <td colspan="4" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-bed text-2xl mb-2"></i>
              <p>Nenhum usuário online no momento.</p>
            </td>
          </tr>

          <tr v-for="user in onlineUsers" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <div class="w-8 h-8 rounded bg-slate-200 text-slate-600 flex justify-center items-center font-bold text-xs ring-2 ring-white">
                    {{ user.email.charAt(0).toUpperCase() }}
                  </div>
                  <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div class="font-medium text-slate-900">{{ user.email }}</div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span class="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                 {{ roleLabel(user.role) }}
              </span>
            </td>
            <td class="px-6 py-4 text-slate-500">
               {{ getRelativeTime(user.last_activity) }}
            </td>
            <td class="px-6 py-4 text-right">
              <button @click="forceLogout(user.id)" class="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition" title="Desconectar">
                <i class="fa-solid fa-plug-circle-xmark mr-1"></i> Force Logout
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      onlineUsers: [],
      loading: true
    }
  },
  methods: {
    async fetchOnlineUsers() {
      this.loading = true;
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch('/api/admin/users/online', { headers: { 'user-id': userId }});
        if(res.ok) {
          const data = await res.json();
          this.onlineUsers = data;
        }
      } catch (e) {
        console.error("Erro listando online", e);
      } finally {
        this.loading = false;
        this.$emit('refreshStats');
      }
    },
    async forceLogout(targetId) {
      if(!confirm('Deseja forçar a desconexão deste usuário?')) return;
      
      try {
        const userId = localStorage.getItem('userId');
        const res = await fetch(`/api/admin/users/${targetId}/force-logout`, {
          method: 'POST',
          headers: { 'user-id': userId }
        });
        
        if (res.ok) {
           Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: 'Sessão revogada.', showConfirmButton: false, timer: 3000
          });
          this.fetchOnlineUsers();
        }
      } catch (e) {
         Swal.fire('Erro', 'Falha ao forçar logout.', 'error');
      }
    },
    roleLabel(role) {
      if (role === 'super_admin') return 'Super Admin';
      if (role === 'admin') return 'Admin';
      return 'User';
    },
    getRelativeTime(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now - date) / 60000);
      
      if (diffInMinutes < 1) return 'Agora mesmo';
      return `Há ${diffInMinutes} min`;
    }
  },
  mounted() {
    this.fetchOnlineUsers();
    // Auto refresh every minute
    this.interval = setInterval(this.fetchOnlineUsers, 60000);
  },
  unmounted() {
    clearInterval(this.interval);
  }
}
</script>
