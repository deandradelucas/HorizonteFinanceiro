/**
 * adminUsersService.js
 * 
 * Provides backend services for the Super Admin Dashboard.
 * Interacts with the Supabase `users`, `user_activity_logs`, and `user_permissions` tables.
 * Includes the AI Command Executor logic using OpenAI.
 */

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
require('dotenv').config();

// Re-initialize a service-role or client with admin privileges if needed.
// For this application, we are using the URL and KEY from the environment.
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_API_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Provide your OpenAI key in the .env file
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key' // fallback for local testing without breaking start
});

const adminService = {

    /**
     * Logs an action to the `user_activity_logs` table.
     * @param {string|number} userId - The ID of the targeted user (optional)
     * @param {string} action - Short title of the action (e.g. 'Bloqueio de Usuário')
     * @param {string} description - Detailed description
     */
    async logActivity(userId, action, description) {
        try {
            if (!userId) userId = null;
            await supabase
                .from('user_activity_logs')
                .insert([{ user_id: userId, action, description }]);
            console.log(`[Admin Activity Logged]: ${action}`);
        } catch (err) {
            console.error('[Admin Log Error]:', err.message);
        }
    },

    /**
     * Gets all users for the dashboard table.
     */
    async getAllUsers() {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, name, email, role, is_active, last_login, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return users || [];
    },

    /**
     * Adds a new user to the system.
     */
    async addUser(email, password, role = 'user', name = '') {
        // In a real scenario, use Supabase Auth to create the user, but this system
        // handles auth via a custom `users` table check.
        const { data, error } = await supabase
            .from('users')
            .insert([{ email, password, role, is_active: true, name }])
            .select();

        if (error) throw error;

        if (data && data.length > 0) {
            await this.logActivity(data[0].id, 'Criação de Usuário', `Usuário ${email} criado com role ${role}`);
        }
        return data[0];
    },

    /**
     * Updates a user's role and status.
     */
    async updateUserRole(id, role, is_active = true) {
        const { data, error } = await supabase
            .from('users')
            .update({ role, is_active })
            .eq('id', id)
            .select();

        if (error) throw error;
        await this.logActivity(id, 'Atualização de Acesso', `Role alterada para ${role}. Status: ${is_active ? 'Ativo' : 'Bloqueado'}`);
        return data[0];
    },

    /**
     * Blocks a user (prevents login).
     */
    async blockUser(id) {
        const { data, error } = await supabase
            .from('users')
            .update({ is_active: false })
            .eq('id', id)
            .select();

        if (error) throw error;
        await this.logActivity(id, 'Usuário Bloqueado', 'O usuário foi impedido de acessar o sistema.');
        return data[0];
    },

    /**
     * Unblocks a user.
     */
    async unblockUser(id) {
        const { data, error } = await supabase
            .from('users')
            .update({ is_active: true })
            .eq('id', id)
            .select();

        if (error) throw error;
        await this.logActivity(id, 'Usuário Desbloqueado', 'O acesso foi restabelecido.');
        return data[0];
    },

    /**
     * Gets permissions object for a specific user.
     */
    async getPermissions(userId) {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('permissions')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
        return data || { permissions: {} };
    },

    /**
     * Updates the JSON permissions for a user.
     */
    async updatePermissions(userId, permissionsObj) {
        // Upsert behavior on Supabase for a 1:1 table relation where user_id is UNIQUE
        const { data, error } = await supabase
            .from('user_permissions')
            .upsert({ user_id: userId, permissions: permissionsObj, updated_at: new Date() }, { onConflict: 'user_id' })
            .select();

        if (error) throw error;
        await this.logActivity(userId, 'Permissões Alteradas', 'O arquivo JSON de permissões (RBAC) foi atualizado.');
        return data[0];
    },

    /**
     * Returns users active in the last 15 minutes.
     */
    async getOnlineUsers() {
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();

        // Select users whose last_login or last activity tracker is > 15 mins ago
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, role, last_login')
            .gte('last_login', fifteenMinsAgo)
            .order('last_login', { ascending: false });

        if (error) throw error;
        // Map to normalized structure returned by frontend
        return (users || []).map(u => ({
            ...u,
            last_activity: u.last_login
        }));
    },

    /**
     * Forces a logout (softly, by invalidating session timestamp or setting a flag)
     */
    async forceLogout(id) {
        // For this custom auth architecture, we set last_login far into the past 
        // to simulate token expiration, or clear it.
        const { error } = await supabase
            .from('users')
            .update({ last_login: null })
            .eq('id', id);

        if (error) throw error;
        await this.logActivity(id, 'Force Logout', 'O Super Admin derrubou a sessão web do usuário.');
        return { success: true };
    },

    /**
     * Fetches statistics for the dashboard counter widgets.
     */
    async getDashboardStats() {
        const { count: total, error: e1 } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: blocked, error: e2 } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false);

        const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
        const { count: online, error: e3 } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login', fifteenMinsAgo);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { count: actionsToday, error: e4 } = await supabase.from('user_activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());

        return { total: total || 0, online: online || 0, blocked: blocked || 0, actionsToday: actionsToday || 0 };
    },

    /**
     * Aggregates activity logs for the audit trail UI.
     */
    async getLogs() {
        // Intentionally limiting to 100 for dashboard performance
        const { data, error } = await supabase
            .from('user_activity_logs')
            .select(`
            id, action, description, created_at, user_id,
            users ( email )
        `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        return data.map(log => ({
            ...log,
            user_email: log.users ? log.users.email : 'Sistema/Desconhecido'
        }));
    },

    /**
     * Parses natural language into an executable command, then runs it.
     */
    async processAICommand(prompt, executorId) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Chave OPENAI_API_KEY não configurada no .env.");
        }

        // Step 1: Use LLM to extract intent
        const systemPrompt = `
      You are an AI assistant orchestrating a Super Admin interface for a financial system.
      Extract the intent and parameters from the user's natural language request.
      Respond strictly in JSON format.
      Available actions: 
      - "BLOCK_USER" (requires "email" param)
      - "UNBLOCK_USER" (requires "email" param)
      - "CHANGE_ROLE" (requires "email", "role" (must be 'user', 'admin', or 'super_admin'))
      - "FORCE_LOGOUT" (requires "email")
      - "UNKNOWN" (if intent is unclear)
      
      Example valid output:
      {
        "action": "BLOCK_USER",
        "params": { "email": "teste@email.com" },
        "human_readable_summary": "I will block user teste@email.com"
      }
    `;

        const aiCall = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const llmResponse = JSON.parse(aiCall.choices[0].message.content);

        // Step 2: Ensure valid intent
        if (llmResponse.action === 'UNKNOWN' || !llmResponse.params?.email) {
            await this.logActivity(executorId, 'Comando IA Falhou', `O LLM não conseguiu entender o prompt: "${prompt}"`);
            throw new Error("Não consegui entender ou processar sua requisição. Especifique um e-mail alvo.");
        }

        // Step 3: Find User ID by Email inside Supabase
        const { data: targetUser, error } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', llmResponse.params.email)
            .single();

        if (error || !targetUser) {
            throw new Error(`Usuário não encontrado: ${llmResponse.params.email}`);
        }

        const tId = targetUser.id;

        // Step 4: Execute mapped action
        switch (llmResponse.action) {
            case 'BLOCK_USER':
                await this.blockUser(tId);
                break;
            case 'UNBLOCK_USER':
                await this.unblockUser(tId);
                break;
            case 'CHANGE_ROLE':
                const newRole = llmResponse.params.role || 'user';
                // Need to fetch current active state to not accidentally unblock them
                const { data: currentState } = await supabase.from('users').select('is_active').eq('id', tId).single();
                await this.updateUserRole(tId, newRole, currentState.is_active);
                break;
            case 'FORCE_LOGOUT':
                await this.forceLogout(tId);
                break;
            default:
                throw new Error(`Ação LLM desconhecida mapeada: ${llmResponse.action}`);
        }

        // Step 5: Log the AI usage
        await this.logActivity(executorId, 'Execução IA Concluída', `Prompt original: "${prompt}". Consequência: ${llmResponse.action} no usuario ${tId}.`);

        return {
            action: llmResponse.action,
            message: llmResponse.human_readable_summary || "Comando processado via Inteligência Artificial."
        };
    }

};

module.exports = adminService;
