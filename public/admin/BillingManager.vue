<template>
  <div class="flex flex-col h-full w-full gap-4 overflow-hidden">
    <div class="grid grid-cols-2 xl:grid-cols-5 gap-3">
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Ativas</p>
        <p class="text-xl font-bold text-emerald-600 mt-1">{{ summary.active }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Pendentes</p>
        <p class="text-xl font-bold text-amber-600 mt-1">{{ summary.pending }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Em atraso</p>
        <p class="text-xl font-bold text-rose-600 mt-1">{{ summary.pastDue }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Vencendo em 7 dias</p>
        <p class="text-xl font-bold text-sky-600 mt-1">{{ summary.dueSoon }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm col-span-2 xl:col-span-1">
        <p class="text-xs font-semibold uppercase text-slate-500">Isentos</p>
        <p class="text-xl font-bold text-violet-600 mt-1">{{ summary.exempt }}</p>
      </div>
    </div>

    <div class="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3">
      <div class="flex flex-col lg:flex-row gap-3 w-full xl:w-auto">
        <div class="relative w-full lg:w-72">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar e-mail, telefone ou vencimento"
            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
          >
        </div>
        <select v-model="statusFilter" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="all">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="pending">Pendentes</option>
          <option value="past_due">Em atraso</option>
          <option value="due_soon">Vencendo em 7 dias</option>
          <option value="exempt">Isentos</option>
        </select>
      </div>

      <button @click="fetchUsers" class="btn-secondary" style="width:auto;">
        <i class="fa-solid fa-rotate mr-2"></i> Atualizar cobrança
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 shadow-sm relative">
      <table class="w-full text-left text-sm text-slate-600">
        <thead class="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
          <tr>
            <th class="px-6 py-4 font-semibold">Usuário</th>
            <th class="px-6 py-4 font-semibold">Status</th>
            <th class="px-6 py-4 font-semibold">Vencimento</th>
            <th class="px-6 py-4 font-semibold">Pagamento</th>
            <th class="px-6 py-4 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
              <p>Carregando cobrança...</p>
            </td>
          </tr>

          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="5" class="px-6 py-12 text-center text-slate-400">
              <i class="fa-solid fa-receipt text-2xl mb-2"></i>
              <p>Nenhum usuário encontrado nesse filtro.</p>
            </td>
          </tr>

          <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ user.email }}</div>
              <div class="text-xs text-slate-400">{{ user.phone || 'Sem telefone' }}</div>
            </td>
            <td class="px-6 py-4">
              <span :class="billingBadgeClass(user)">{{ billingLabel(user) }}</span>
            </td>
            <td class="px-6 py-4 text-slate-500">{{ formatDate(user.subscription_next_due_date) }}</td>
            <td class="px-6 py-4 text-slate-500">{{ paymentMethodLabel(user.subscription_payment_method) }}</td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-2 flex-wrap">
                <button @click="toggleExempt(user)" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition">
                  {{ user.billing_exempt ? 'Remover isenção' : 'Isentar' }}
                </button>
                <button @click="markPastDue(user)" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition">
                  Em atraso
                </button>
                <button @click="markActive(user)" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition">
                  Ativar
                </button>
              </div>
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
      users: [],
      loading: true,
      searchQuery: '',
      statusFilter: 'all'
    }
  },
  computed: {
    summary() {
      const active = this.users.filter((user) => user.subscription_status === 'active' && !user.billing_exempt).length;
      const pending = this.users.filter((user) => ['pending', 'checkout_pending'].includes(user.subscription_status)).length;
      const pastDue = this.users.filter((user) => user.subscription_status === 'past_due').length;
      const exempt = this.users.filter((user) => user.billing_exempt).length;
      const dueSoon = this.users.filter((user) => this.isDueSoon(user.subscription_next_due_date) && !user.billing_exempt).length;
      return { active, pending, pastDue, exempt, dueSoon };
    },
    filteredUsers() {
      const q = this.searchQuery.trim().toLowerCase();
      return this.users.filter((user) => {
        const matchesQuery = !q || [
          user.email,
          user.phone,
          user.subscription_next_due_date,
          this.billingLabel(user)
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));

        if (!matchesQuery) return false;
        if (this.statusFilter === 'all') return true;
        if (this.statusFilter === 'exempt') return user.billing_exempt === true;
        if (this.statusFilter === 'due_soon') return this.isDueSoon(user.subscription_next_due_date) && !user.billing_exempt;
        if (this.statusFilter === 'pending') return ['pending', 'checkout_pending'].includes(user.subscription_status);
        return user.subscription_status === this.statusFilter;
      }).sort((a, b) => String(a.subscription_next_due_date || '9999-99-99').localeCompare(String(b.subscription_next_due_date || '9999-99-99')));
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
        console.error('Erro ao carregar cobrança', error);
      } finally {
        this.loading = false;
        this.$emit('refreshStats');
      }
    },
    billingLabel(user) {
      if (user.billing_exempt) return 'Isento';
      const map = {
        active: 'Ativa',
        pending: 'Pendente',
        checkout_pending: 'Checkout',
        past_due: 'Em atraso',
        cancelled: 'Cancelada',
        inactive: 'Inativa'
      };
      return map[user.subscription_status] || 'Inativa';
    },
    billingBadgeClass(user) {
      const base = 'px-2.5 py-1 text-xs font-semibold rounded-full border ';
      if (user.billing_exempt) return base + 'bg-violet-100 text-violet-700 border-violet-200';
      if (user.subscription_status === 'active') return base + 'bg-emerald-100 text-emerald-700 border-emerald-200';
      if (['pending', 'checkout_pending'].includes(user.subscription_status)) return base + 'bg-amber-100 text-amber-700 border-amber-200';
      if (user.subscription_status === 'past_due') return base + 'bg-rose-100 text-rose-700 border-rose-200';
      return base + 'bg-slate-100 text-slate-700 border-slate-200';
    },
    paymentMethodLabel(method) {
      const map = { pix: 'Pix', credit_card: 'Cartão', free: 'Grátis' };
      return map[method] || '—';
    },
    formatDate(value) {
      if (!value) return '—';
      return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
    },
    isDueSoon(value) {
      if (!value) return false;
      const current = new Date();
      const target = new Date(`${value}T12:00:00`);
      const diff = Math.ceil((target - current) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    },
    async updateBilling(user, patch, successTitle) {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch(`/api/admin/users/${user.id}/billing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify(patch)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao atualizar cobrança.');

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: successTitle,
          showConfirmButton: false,
          timer: 2400
        });
        this.fetchUsers();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      }
    },
    toggleExempt(user) {
      this.updateBilling(user, {
        billing_exempt: !user.billing_exempt,
        subscription_status: user.billing_exempt ? 'inactive' : 'active',
        subscription_payment_method: user.billing_exempt ? 'pix' : 'free',
        subscription_next_due_date: user.billing_exempt ? user.subscription_next_due_date : null
      }, user.billing_exempt ? 'Isenção removida' : 'Usuário isentado');
    },
    markPastDue(user) {
      this.updateBilling(user, {
        billing_exempt: false,
        subscription_status: 'past_due',
        subscription_payment_method: user.subscription_payment_method || 'pix',
        subscription_next_due_date: user.subscription_next_due_date
      }, 'Cobrança marcada como em atraso');
    },
    markActive(user) {
      const nextDue = user.subscription_next_due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      this.updateBilling(user, {
        billing_exempt: false,
        subscription_status: 'active',
        subscription_payment_method: user.subscription_payment_method || 'pix',
        subscription_next_due_date: nextDue
      }, 'Cobrança ativada');
    }
  },
  mounted() {
    this.fetchUsers();
  }
}
</script>
