<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
      <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 class="font-bold text-lg text-slate-800">
          {{ isEdit ? 'Editar usuário' : 'Novo usuário' }}
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 transition">
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div class="p-6 overflow-y-auto">
        <form @submit.prevent="saveUser" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
            <input 
              type="email" 
              v-model="formData.email" 
              required
              :disabled="isEdit"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none disabled:opacity-60"
              placeholder="exemplo@email.com"
            >
            <p v-if="isEdit" class="text-xs text-slate-400 mt-1">O e-mail não pode ser alterado.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input 
              type="text" 
              v-model="formData.name" 
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              placeholder="Nome do usuário"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Telefone do WhatsApp</label>
            <input 
              type="text" 
              v-model="formData.phone" 
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              placeholder="5511999999999"
            >
            <p class="text-xs text-slate-400 mt-1">Use o mesmo número que o usuário enviará para o webhook.</p>
          </div>

          <div v-if="!isEdit">
            <label class="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input 
              type="password" 
              v-model="formData.password" 
              required
              class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              placeholder="••••••••"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nível de acesso</label>
            <select v-model="formData.role" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div v-if="isEdit" class="pt-2">
            <label class="flex items-center cursor-pointer gap-2">
              <input type="checkbox" v-model="formData.is_active" class="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary">
              <span class="text-sm font-medium text-slate-700">Conta ativa</span>
            </label>
            <p class="text-xs text-slate-500 mt-1 pl-6">Desmarcar impedirá o usuário de fazer login.</p>
          </div>
        </form>
      </div>

      <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
        <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition">
          Cancelar
        </button>
        <button @click="saveUser" :disabled="loading" class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2">
          <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i>
          {{ isEdit ? 'Salvar alterações' : 'Criar usuário' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    user: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      formData: {
        email: '',
        name: '',
        phone: '',
        password: '',
        role: 'user',
        is_active: true
      },
      loading: false
    }
  },
  computed: {
    isEdit() {
      return !!this.user;
    }
  },
  methods: {
    async saveUser() {
      if (!this.formData.email) return;
      if (!this.isEdit && !this.formData.password) return;

      this.loading = true;
      try {
        const userId = sessionStorage.getItem('userId');
        let endpoint = '/api/admin/users';
        let method = 'POST';

        if (this.isEdit) {
          endpoint = `/api/admin/users/${this.user.id}/role`;
          method = 'PUT';
        }

        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId
          },
          body: JSON.stringify(this.formData)
        });

        const data = await res.json();
        if (res.ok) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.isEdit ? 'Usuário atualizado' : 'Usuário criado',
            showConfirmButton: false,
            timer: 3000
          });
          this.$emit('saved');
          this.$emit('close');
        } else {
          Swal.fire('Erro', data.error || 'Ocorreu um erro.', 'error');
        }
      } catch (error) {
        Swal.fire('Erro', 'Falha na comunicação com o servidor.', 'error');
      } finally {
        this.loading = false;
      }
    }
  },
  mounted() {
    if (this.user) {
      this.formData = {
        email: this.user.email,
        name: this.user.name || '',
        phone: this.user.phone || '',
        role: this.user.role,
        is_active: this.user.is_active
      };
    }
  }
}
</script>
