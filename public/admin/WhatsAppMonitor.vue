<template>
  <div class="flex flex-col h-full w-full gap-6">
    <div class="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800">Operação WhatsApp</h2>
            <p class="text-sm text-slate-500">Acompanhe mensagens recebidas, interpretações, confirmações e correções.</p>
          </div>
          <button @click="fetchMessages" class="px-4 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            <i class="fa-solid fa-rotate mr-2"></i> Atualizar
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3 mt-5">
          <input v-model="filters.search" type="text" placeholder="Buscar texto ou telefone" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <select v-model="filters.status" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos os status</option>
            <option value="processed">Processadas</option>
            <option value="pending_confirmation">Pendente confirmação</option>
            <option value="needs_reformulation">Pedir reformulação</option>
            <option value="rejected">Rejeitadas</option>
            <option value="unmatched_user">Sem usuário</option>
          </select>
          <select v-model="filters.type" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos os tipos</option>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="investment">Investimento</option>
            <option value="query">Consulta</option>
          </select>
          <select v-model="filters.confidenceBand" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">Qualquer confiança</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
          <input v-model="filters.phone" type="text" placeholder="Telefone" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <input v-model="filters.from" type="date" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <input v-model="filters.to" type="date" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Teste de envio</h3>
        <div class="space-y-3">
          <input v-model="outbound.phone" type="text" placeholder="Telefone com DDI" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <textarea v-model="outbound.messageText" rows="4" placeholder="Mensagem de teste" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"></textarea>
          <button @click="sendTestMessage" :disabled="sendingOutbound" class="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <i :class="sendingOutbound ? 'fa-solid fa-spinner fa-spin mr-2' : 'fa-brands fa-whatsapp mr-2'"></i>
            Enviar mensagem
          </button>
          <p class="text-xs text-slate-500">Se a configuração do provedor ainda não estiver pronta, o envio fica registrado como skipped.</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Total</p>
        <p class="text-2xl font-bold text-slate-800 mt-2">{{ summary.total }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Pendentes</p>
        <p class="text-2xl font-bold text-amber-600 mt-2">{{ summary.pending }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Gravadas</p>
        <p class="text-2xl font-bold text-emerald-600 mt-2">{{ summary.recorded }}</p>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase text-slate-500">Sem vínculo</p>
        <p class="text-2xl font-bold text-rose-600 mt-2">{{ summary.unmatched }}</p>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1">
      <div v-if="loading" class="p-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i>
        <p>Carregando mensagens...</p>
      </div>

      <div v-else-if="messages.length === 0" class="p-12 text-center text-slate-400">
        <i class="fa-brands fa-whatsapp text-3xl mb-3"></i>
        <p>Nenhuma mensagem encontrada.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="message in messages" :key="message.id" class="p-5">
          <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div class="space-y-3 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2.5 py-1 rounded-full text-xs font-semibold border" :class="statusBadgeClass(message.processing_status)">
                  {{ statusLabel(message.processing_status) }}
                </span>
                <span class="text-xs text-slate-400">{{ formatDate(message.created_at) }}</span>
                <span class="text-xs text-slate-400">{{ message.phone }}</span>
                <span v-if="message.user" class="text-xs text-slate-500">Usuário: {{ message.user.email }}</span>
              </div>

              <div class="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p class="text-xs font-semibold uppercase text-slate-500 mb-2">Mensagem recebida</p>
                <p class="text-sm text-slate-800 leading-relaxed">{{ message.message_text }}</p>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="rounded-xl border border-slate-200 p-4">
                  <p class="text-xs font-semibold uppercase text-slate-500 mb-3">Interpretação</p>
                  <div v-if="message.interpretation" class="space-y-2 text-sm text-slate-700">
                    <p><strong>Tipo:</strong> {{ typeLabel(message.interpretation.detected_type) }}</p>
                    <p><strong>Valor:</strong> {{ formatCurrency(message.interpretation.detected_amount) }}</p>
                    <p><strong>Categoria:</strong> {{ message.interpretation.detected_category || '—' }}</p>
                    <p><strong>Descrição:</strong> {{ message.interpretation.detected_description || '—' }}</p>
                    <p><strong>Data:</strong> {{ message.interpretation.detected_date || '—' }}</p>
                    <p><strong>Confiança:</strong> {{ formatConfidence(message.interpretation.confidence) }}</p>
                    <p><strong>Origem:</strong> {{ message.interpretation.used_ai ? 'IA' : 'Parser por regras' }}</p>
                  </div>
                  <p v-else class="text-sm text-slate-400">Sem interpretação registrada.</p>
                </div>

                <div class="rounded-xl border border-slate-200 p-4">
                  <p class="text-xs font-semibold uppercase text-slate-500 mb-3">Transação gerada</p>
                  <div v-if="message.transaction" class="space-y-2 text-sm text-slate-700">
                    <p><strong>Tipo:</strong> {{ typeLabel(message.transaction.type) }}</p>
                    <p><strong>Valor:</strong> {{ formatCurrency(message.transaction.value) }}</p>
                    <p><strong>Categoria:</strong> {{ message.transaction.category }}</p>
                    <p><strong>Descrição:</strong> {{ message.transaction.description }}</p>
                    <p><strong>Data:</strong> {{ message.transaction.date }}</p>
                  </div>
                  <p v-else class="text-sm text-slate-400">Ainda sem transação vinculada.</p>
                </div>
              </div>
            </div>

            <div class="w-full xl:w-[320px] space-y-3">
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p class="text-xs font-semibold uppercase text-slate-500 mb-3">Ações</p>
                <div class="flex flex-wrap gap-2">
                  <button v-if="canConfirm(message)" @click="confirmMessage(message)" class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">Confirmar</button>
                  <button v-if="canReject(message)" @click="rejectMessage(message)" class="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors">Rejeitar</button>
                  <button @click="toggleCorrection(message)" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium transition-colors">Corrigir</button>
                </div>
              </div>

              <div v-if="editingMessageId === message.id" class="rounded-xl border border-slate-200 p-4 space-y-3">
                <select v-model="correction.type" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="investment">Investimento</option>
                </select>
                <input v-model="correction.amount" type="number" step="0.01" placeholder="Valor" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.category" type="text" placeholder="Categoria" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.description" type="text" placeholder="Descrição" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.transaction_date" type="date" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
                <button @click="saveCorrection(message)" class="w-full px-3 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white text-sm font-medium transition-colors">Salvar correção</button>
              </div>
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
      loading: true,
      sendingOutbound: false,
      messages: [],
      editingMessageId: null,
      filters: {
        search: '',
        status: '',
        type: '',
        confidenceBand: '',
        phone: '',
        from: '',
        to: ''
      },
      outbound: {
        phone: '',
        messageText: ''
      },
      correction: {
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        transaction_date: ''
      }
    }
  },
  computed: {
    summary() {
      return {
        total: this.messages.length,
        pending: this.messages.filter((item) => item.processing_status === 'pending_confirmation').length,
        recorded: this.messages.filter((item) => item.transaction).length,
        unmatched: this.messages.filter((item) => item.processing_status === 'unmatched_user').length
      };
    }
  },
  methods: {
    async fetchMessages() {
      this.loading = true;
      try {
        const userId = sessionStorage.getItem('userId');
        const params = new URLSearchParams();
        Object.entries(this.filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });

        const res = await fetch(`/api/messages?${params.toString()}`, {
          headers: { 'user-id': userId }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar mensagens.');
        this.messages = data.filter((item) => {
          const detectedType = item.interpretation?.detected_type || '';
          const confidence = Number(item.interpretation?.confidence || 0);
          const matchesType = !this.filters.type || detectedType === this.filters.type;
          const matchesConfidence = !this.filters.confidenceBand ||
            (this.filters.confidenceBand === 'high' && confidence >= 0.85) ||
            (this.filters.confidenceBand === 'medium' && confidence >= 0.6 && confidence < 0.85) ||
            (this.filters.confidenceBand === 'low' && confidence < 0.6);
          return matchesType && matchesConfidence;
        });
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      } finally {
        this.loading = false;
      }
    },
    formatDate(value) {
      if (!value) return 'Sem data';
      return new Date(value).toLocaleString('pt-BR');
    },
    formatCurrency(value) {
      if (value === null || value === undefined || value === '') return '—';
      return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },
    formatConfidence(value) {
      return `${Math.round((Number(value || 0) || 0) * 100)}%`;
    },
    statusLabel(status) {
      const map = {
        processed: 'Processada',
        pending_confirmation: 'Pendente confirmação',
        needs_reformulation: 'Pedir reformulação',
        rejected: 'Rejeitada',
        unmatched_user: 'Sem usuário',
        unsupported_message: 'Não suportada'
      };
      return map[status] || status || 'Recebida';
    },
    statusBadgeClass(status) {
      if (status === 'processed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (status === 'pending_confirmation') return 'bg-amber-50 text-amber-700 border-amber-200';
      if (status === 'unmatched_user' || status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
      return 'bg-slate-50 text-slate-700 border-slate-200';
    },
    typeLabel(type) {
      if (type === 'income') return 'Receita';
      if (type === 'investment') return 'Investimento';
      if (type === 'query') return 'Consulta';
      return 'Despesa';
    },
    canConfirm(message) {
      return message.interpretation && message.interpretation.decision_status === 'pending_confirmation';
    },
    canReject(message) {
      return message.interpretation && ['pending_confirmation', 'needs_reformulation'].includes(message.interpretation.decision_status);
    },
    toggleCorrection(message) {
      if (this.editingMessageId === message.id) {
        this.editingMessageId = null;
        return;
      }

      this.editingMessageId = message.id;
      this.correction = {
        type: message.interpretation?.detected_type || 'expense',
        amount: message.interpretation?.detected_amount || '',
        category: message.interpretation?.detected_category || '',
        description: message.interpretation?.detected_description || '',
        transaction_date: message.interpretation?.detected_date || new Date().toISOString().slice(0, 10)
      };
    },
    async confirmMessage(message) {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch(`/api/messages/${message.id}/confirm`, {
          method: 'POST',
          headers: { 'user-id': userId }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao confirmar mensagem.');
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mensagem confirmada', showConfirmButton: false, timer: 2200 });
        this.fetchMessages();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      }
    },
    async rejectMessage(message) {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch(`/api/messages/${message.id}/reject`, {
          method: 'POST',
          headers: { 'user-id': userId }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao rejeitar mensagem.');
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Mensagem rejeitada', showConfirmButton: false, timer: 2200 });
        this.fetchMessages();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      }
    },
    async saveCorrection(message) {
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch(`/api/messages/${message.id}/correction`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify(this.correction)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao salvar correção.');
        this.editingMessageId = null;
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Correção salva', showConfirmButton: false, timer: 2200 });
        this.fetchMessages();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      }
    },
    async sendTestMessage() {
      if (!this.outbound.phone || !this.outbound.messageText) return;
      this.sendingOutbound = true;
      try {
        const userId = sessionStorage.getItem('userId');
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify(this.outbound)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao enviar mensagem.');
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Envio registrado (${data.delivery_status})`, showConfirmButton: false, timer: 2600 });
        this.outbound.messageText = '';
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      } finally {
        this.sendingOutbound = false;
      }
    }
  },
  mounted() {
    this.fetchMessages();
  }
}
</script>
