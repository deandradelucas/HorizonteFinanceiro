<template>
  <div class="flex flex-col h-full w-full gap-6 text-slate-900">
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
          <input v-model="filters.search" type="text" placeholder="Buscar texto ou telefone" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
          <select v-model="filters.status" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos os status</option>
            <option value="processed">Processadas</option>
            <option value="pending_confirmation">Pendente confirmação</option>
            <option value="needs_reformulation">Pedir reformulação</option>
            <option value="rejected">Rejeitadas</option>
            <option value="unmatched_user">Sem usuÃ¡rio</option>
          </select>
          <select v-model="filters.type" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos os tipos</option>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="investment">Investimento</option>
            <option value="query">Consulta</option>
          </select>
          <select v-model="filters.confidenceBand" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
            <option value="">Qualquer confiança</option>
            <option value="high">Alta</option>
            <option value="medium">MÃ©dia</option>
            <option value="low">Baixa</option>
          </select>
          <input v-model="filters.phone" type="text" placeholder="Telefone" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
          <input v-model="filters.from" type="date" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
          <input v-model="filters.to" type="date" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Teste de envio</h3>
        <div class="space-y-3">
          <input v-model="outbound.phone" type="text" placeholder="Telefone com DDI" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
          <textarea v-model="outbound.messageText" rows="4" placeholder="Mensagem de teste" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary resize-none"></textarea>
          <button @click="sendTestMessage" :disabled="sendingOutbound" class="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
            <i :class="sendingOutbound ? 'fa-solid fa-spinner fa-spin mr-2' : 'fa-brands fa-whatsapp mr-2'"></i>
            Enviar mensagem
          </button>
          <p class="text-xs text-slate-500">Se a configuração do provedor ainda não estiver pronta, o envio fica registrado como skipped.</p>
        </div>

        <div class="mt-5 border-t border-slate-200 pt-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wide">Últimos envios</h4>
            <button @click="fetchOutboundHistory" class="text-xs font-medium text-primary hover:underline">Atualizar</button>
          </div>

          <div v-if="outboundHistory.length === 0" class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
            Nenhum envio registrado ainda.
          </div>

          <div v-else class="space-y-2">
            <div v-for="item in outboundHistory" :key="item.id" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">{{ item.phone }}</p>
                  <p class="text-xs text-slate-500">{{ formatDate(item.created_at) }}</p>
                </div>
                <span class="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border" :class="outboundBadgeClass(item.delivery_status)">
                  {{ deliveryStatusText(item) }}
                </span>
              </div>
              <p class="mt-2 text-sm text-slate-700 line-clamp-2">{{ item.message_text }}</p>
              <p v-if="item.raw_payload?.message || item.raw_payload?.reason || item.raw_payload?.error?.message" class="mt-2 text-xs text-slate-500">
                {{ item.raw_payload?.message || item.raw_payload?.reason || item.raw_payload?.error?.message }}
              </p>
              <div class="mt-2 flex items-center justify-between gap-3">
                <p class="text-[11px] text-slate-500 truncate">
                  {{ outboundTechnicalSummary(item) }}
                </p>
                <button @click="showOutboundDetails(item)" class="shrink-0 text-xs font-medium text-primary hover:underline">
                  Ver detalhes
                </button>
              </div>
            </div>
          </div>
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
                    <p><strong>Categoria:</strong> {{ message.interpretation.detected_category || 'â€”' }}</p>
                    <p><strong>Descrição:</strong> {{ message.interpretation.detected_description || 'â€”' }}</p>
                    <p><strong>Data:</strong> {{ message.interpretation.detected_date || 'â€”' }}</p>
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
                <select v-model="correction.type" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="investment">Investimento</option>
                </select>
                <input v-model="correction.amount" type="number" step="0.01" placeholder="Valor" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.category" type="text" placeholder="Categoria" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.description" type="text" placeholder="Descrição" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
                <input v-model="correction.transaction_date" type="date" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary">
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
      outboundHistory: [],
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
        await this.fetchOutboundHistory();
      } catch (error) {
        Swal.fire('Erro', error.message, 'error');
      } finally {
        this.loading = false;
      }
    },
    async fetchOutboundHistory() {
      const userId = sessionStorage.getItem('userId');
      const params = new URLSearchParams({ limit: '8' });
      if (this.outbound.phone) params.set('phone', this.outbound.phone);
      const res = await fetch(`/api/whatsapp/outbound?${params.toString()}`, {
        headers: { 'user-id': userId }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar histórico de envios.');
      this.outboundHistory = data;
    },
    formatDate(value) {
      if (!value) return 'Sem data';
      return new Date(value).toLocaleString('pt-BR');
    },
    formatCurrency(value) {
      if (value === null || value === undefined || value === '') return 'â€”';
      return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },
    formatConfidence(value) {
      return `${Math.round((Number(value || 0) || 0) * 100)}%`;
    },
    deliveryStatusLabel(status) {
      const map = {
        sent: 'Enviado ao provedor',
        skipped: 'Configuração do provedor ausente',
        failed: 'Falha no provedor',
        queued: 'Na fila de envio'
      };
      return map[status] || status || 'Status desconhecido';
    },
    outboundBadgeClass(status) {
      if (status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
      if (status === 'skipped') return 'bg-amber-50 text-amber-700 border-amber-200';
      return 'bg-slate-50 text-slate-700 border-slate-200';
    },
    outboundTechnicalSummary(item) {
      const provider = item?.raw_payload?.provider || 'provedor não informado';
      const httpStatus = item?.raw_payload?.http_status || 'sem status HTTP';
      const providerMessageId = item?.provider_message_id || item?.raw_payload?.messageId || item?.raw_payload?.id || 'sem id';
      return `${provider} | HTTP ${httpStatus} | id ${providerMessageId}`;
    },
    showOutboundDetails(item) {
      const rawPayload = item?.raw_payload || {};
      Swal.fire({
        title: 'Detalhes do envio',
        html: `<pre style="text-align:left;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto;background:#0f172a;color:#e2e8f0;padding:16px;border-radius:12px;">${this.escapeHtml(JSON.stringify(rawPayload, null, 2))}</pre>`,
        width: 720,
        confirmButtonText: 'Fechar'
      });
    },
    escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        const providerMessage =
          data?.raw_payload?.message ||
          data?.raw_payload?.error?.message ||
          data?.raw_payload?.reason ||
          '';

        Swal.fire({
          icon: data.delivery_status === 'failed' ? 'warning' : 'success',
          title: this.deliveryStatusLabel(data.delivery_status),
          text: providerMessage ? String(providerMessage) : 'A resposta do provedor foi registrada com sucesso.',
          confirmButtonText: 'OK'
        });
        this.outbound.messageText = '';
        await this.fetchOutboundHistory();
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



