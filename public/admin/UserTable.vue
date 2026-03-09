<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
      <div class="flex gap-2 w-full sm:w-auto">
        <div class="relative w-full sm:w-72">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="Buscar e-mail, telefone ou ID" 
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
          >
        </div>

        <select v-model="roleFilter" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todas as roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>

        <select v-model="billingFilter" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Toda cobrança</option>
          <option value="active">Ativa</option>
          <option value="pending">Pendente</option>
          <option value="past_due">Em atraso</option>
          <option value="exempt">Isento</option>
        </select>
      </div>

      <button @click="openNewUserModal" class="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-sm">
        <i class="fa-solid fa-plus mr-2"></i> Novo usuário
      </button>
    </div>

    <div class="flex-1 overflow-x-auto rounded-xl border border-slate-200 shadow-sm relative">
      <table class="w-full text-left text-sm text-slate-600">
        <thead class="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
          <tr>
            <th @click="sortBy('email')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">E-mail</th>
            <th @click="sortBy('phone')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">Telefone</th>
            <th @click="sortBy('role')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">Role</th>
            <th @click="sortBy('is_active')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">Status</th>
            <th @click="sortBy('last_login')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">Último login</th>
            <th @click="sortBy('subscription_status')" class="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100">Cobrança</th>
            <th class="px-6 py-4 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-slate-100">
          <tr v-if="loading" class="animate-pulse">
            <td colspan="7" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
              <p>Carregando usuários...</p>
            </td>
          </tr>

          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="7" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-folder-open text-2xl mb-2"></i>
              <p>Nenhum usuário encontrado.</p>
            </td>
          </tr>

          <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded bg-slate-200 text-slate-600 flex justify-center items-center font-bold text-xs">
                  {{ (user.email || '?').charAt(0).toUpperCase() }}
                </div>
                <div>
                  <div class="font-medium text-slate-900">{{ user.email }}</div>
                  <div class="text-xs text-slate-400">ID: {{ user.id }}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-slate-500">{{ user.phone || '—' }}</td>
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
            <td class="px-6 py-4">
              <div class="flex flex-col gap-1">
                <span :class="billingBadgeClass(user)">
                  {{ billingLabel(user) }}
                </span>
                <span class="text-xs text-slate-400">{{ user.subscription_next_due_date ? `Vence ${formatShortDate(user.subscription_next_due_date)}` : 'Sem vencimento' }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button @click="editUser(user)" class="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition" title="Editar usuário">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button @click="toggleBillingExempt(user)" class="p-2 text-slate-400 hover:text-violet-500 hover:bg-violet-50 rounded transition" :title="user.billing_exempt ? 'Remover isenção' : 'Isentar cobrança'">
                  <i class="fa-solid" :class="user.billing_exempt ? 'fa-receipt' : 'fa-crown'"></i>
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
      billingFilter: 'all',
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
        result = result.filter((u) =>
          String(u.email || '').toLowerCase().includes(q) ||
          String(u.phone || '').includes(q) ||
          String(u.id || '').includes(q)
        );
      }

      if (this.roleFilter !== 'all') {
        result = result.filter((u) => u.role === this.roleFilter);
      }

      if (this.billingFilter !== 'all') {
        result = result.filter((u) => {
          if (this.billingFilter === 'exempt') return u.billing_exempt === true;
          return (u.subscription_status || 'inactive') === this.billingFilter;
        });
      }

      return result.slice().sort((a, b) => {
        let valA = a[this.sortKey];
        let valB = b[this.sortKey];

        if (valA == null) valA = '';
        if (valB == null) valB = '';

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
        const userId = sessionStorage.getItem('userId');
        const res = await fetch('/api/admin/users', { headers: { 'user-id': userId } });
        if (res.ok) {
          this.users = await res.json();
        }
      } catch (error) {
        console.error('Erro listando usuários', error);
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
    formatShortDate(dateString) {
      if (!dateString) return '—';
      return new Date(`${dateString}T12:00:00`).toLocaleDateString('pt-BR');
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
    billingLabel(user) {
      if (user.billing_exempt) return 'Isento';
      const status = user.subscription_status || 'inactive';
      const map = {
        active: 'Ativa',
        pending: 'Pendente',
        checkout_pending: 'Checkout',
        past_due: 'Em atraso',
        cancelled: 'Cancelada',
        inactive: 'Inativa'
      };
      return map[status] || status;
    },
    billingBadgeClass(user) {
      const base = 'px-2.5 py-1 text-xs font-semibold rounded-full border ';
      if (user.billing_exempt) return base + 'bg-violet-100 text-violet-700 border-violet-200';
      if (user.subscription_status === 'active') return base + 'bg-emerald-100 text-emerald-700 border-emerald-200';
      if (user.subscription_status === 'pending' || user.subscription_status === 'checkout_pending') return base + 'bg-amber-100 text-amber-700 border-amber-200';
      if (user.subscription_status === 'past_due') return base + 'bg-rose-100 text-rose-700 border-rose-200';
      return base + 'bg-slate-100 text-slate-700 border-slate-200';
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
        const userId = sessionStorage.getItem('userId');
        const endpoint = activate ? `/api/admin/users/${targetId}/unblock` : `/api/admin/users/${targetId}/block`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'user-id': userId }
        });

        if (res.ok) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: activate ? 'Usuário desbloqueado' : 'Usuário bloqueado',
            showConfirmButton: false,
            timer: 3000
          });
          this.fetchUsers();
        }
      } catch (error) {
        Swal.fire('Erro', 'Falha ao alterar status.', 'error');
      }
    },
    async toggleBillingExempt(user) {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch(`/api/admin/users/${user.id}/billing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify({
            billing_exempt: !user.billing_exempt,
            subscription_status: user.billing_exempt ? 'inactive' : 'active',
            subscription_payment_method: user.billing_exempt ? 'pix' : 'free',
            subscription_next_due_date: user.billing_exempt ? null : user.subscription_next_due_date
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao atualizar cobrança.');

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: user.billing_exempt ? 'Isenção removida' : 'Cobrança isentada',
          showConfirmButton: false,
          timer: 2600
        });
        this.fetchUsers();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      }
    }
  },
  mounted() {
    this.fetchUsers();
  }
}
</script>
