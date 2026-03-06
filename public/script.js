// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Script principal do frontend.
//   - Lógica de cadastro de usuário (formulário + validação de senha)
//   - Lógica de login (autenticação + "lembrar e-mail")
//   - Registro de transações (receitas/despesas)
//   - Carregamento do dashboard (cards de resumo + tabela)
//   - Modo escuro (toggle + sincronização com o servidor)
//   - Menu mobile (sidebar responsiva)
//   - Registro do Service Worker (PWA)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const BASE_PATH = '';

    // --- DISPLAY CURRENT DATE ---
    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        let formattedDate = today.toLocaleDateString('pt-BR', options);
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        dateDisplay.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 6px;"></i> ${formattedDate}`;
    }

    // --- PERMISSÕES GLOBAIS DE UI ---
    // Checa se o usuário logado é Super Admin e injeta o botão em qualquer página que tenha o sidebar
    const globalUserRole = localStorage.getItem('userRole');
    if (globalUserRole === 'super_admin' && !document.getElementById('superAdminLink')) {
        const nav = document.querySelector('.sidebar-nav');
        if (nav) {
            const adminLink = document.createElement('a');
            // Hardcode navigation with JS to bypass any strange event delegation like logout
            adminLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = "/super-admin.html";
            });
            adminLink.style.cursor = "pointer";
            adminLink.id = "superAdminLink";

            // Add custom styling so it stands out and doesn't look like the logout button
            adminLink.className = "nav-item admin-portal-btn";
            adminLink.style.marginTop = "auto";
            adminLink.style.border = "1px solid rgba(168, 85, 247, 0.4)";
            adminLink.style.backgroundColor = "rgba(168, 85, 247, 0.05)";
            adminLink.style.color = "#a855f7";
            adminLink.style.display = "flex";
            adminLink.style.alignItems = "center";
            adminLink.style.justifyContent = "center";
            adminLink.style.gap = "8px";

            adminLink.innerHTML = '<i class="fa-solid fa-shield-halved" style="color: #a855f7; font-size: 18px;"></i> <span style="font-weight: 700;">Painel Admin</span>';
            nav.appendChild(adminLink);
        }
    }

    // Nota: A inicialização do modo escuro é tratada via scripts inline nos arquivos HTML para evitar o "flash" de cor clara.

    // --- LÓGICA DE CADASTRO ---
    // Gerencia o formulário de criação de nova conta e validação de força de senha
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const form = document.getElementById('registerForm');
    const strengthBar = document.getElementById('strengthBar');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            if (type === 'text') {
                togglePassword.classList.remove('fa-eye');
                togglePassword.classList.add('fa-eye-slash');
            } else {
                togglePassword.classList.remove('fa-eye-slash');
                togglePassword.classList.add('fa-eye');
            }
        });
    }

    if (passwordInput && strengthBar) {
        passwordInput.addEventListener('input', () => {
            const value = passwordInput.value;
            let strength = 0;

            if (value.length > 0) {
                strength += 25;
                if (value.length >= 8) strength += 25;
                if (/[A-Z]/.test(value)) strength += 25;
                if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) strength += 25;
            }

            strengthBar.style.width = `${strength}%`;

            if (strength <= 25) {
                strengthBar.style.background = '#ef4444';
            } else if (strength <= 50) {
                strengthBar.style.background = '#f59e0b';
            } else if (strength <= 75) {
                strengthBar.style.background = '#eab308';
            } else {
                strengthBar.style.background = '#22c55e';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('As senhas não coincidem. Por favor, verifique.');
                return;
            }

            const btn = form.querySelector('.btn-primary');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';
            btn.disabled = true;

            try {
                const response = await fetch(`${BASE_PATH}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Conta Criada!';
                    btn.style.background = '#00ff88';

                    setTimeout(() => {
                        window.location.href = `${BASE_PATH}/login`;
                    }, 1500);
                } else {
                    alert(data.error || 'Erro ao criar conta.');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro na conexão com o servidor.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LÓGICA DE LOGIN ---
    // Gerencia a autenticação do usuário e a funcionalidade "Lembrar-me"
    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginForm = document.getElementById('loginForm');
    const rememberMe = document.getElementById('rememberMe');

    if (toggleLoginPassword && loginPasswordInput) {
        toggleLoginPassword.addEventListener('click', () => {
            const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPasswordInput.setAttribute('type', type);
            if (type === 'text') {
                toggleLoginPassword.classList.remove('fa-eye');
                toggleLoginPassword.classList.add('fa-eye-slash');
            } else {
                toggleLoginPassword.classList.remove('fa-eye-slash');
                toggleLoginPassword.classList.add('fa-eye');
            }
        });
    }

    if (loginForm) {
        if (localStorage.getItem('rememberedEmail')) {
            const loginEmailInput = document.getElementById('loginEmail');
            if (loginEmailInput) {
                loginEmailInput.value = localStorage.getItem('rememberedEmail');
                if (rememberMe) rememberMe.checked = true;
            }
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (rememberMe && rememberMe.checked) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            const btn = loginForm.querySelector('.btn-primary');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
            btn.disabled = true;

            try {
                const response = await fetch(`${BASE_PATH}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    sessionStorage.setItem('userId', data.id);
                    sessionStorage.setItem('userName', data.name);
                    localStorage.setItem('userRole', data.role); // Save role for UI checks

                    // Sync theme from DB to localstorage
                    if (data.darkMode) {
                        localStorage.setItem('darkMode', data.darkMode);
                        if (data.darkMode === 'enabled') {
                            document.body.classList.add('dark-mode');
                        } else {
                            document.body.classList.remove('dark-mode');
                        }
                    }

                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Acesso Permitido!';
                    btn.style.background = '#00ff88';

                    setTimeout(() => {
                        window.location.href = `${BASE_PATH}/dashboard`;
                    }, 1000);
                } else {
                    alert(data.error || 'Erro ao entrar.');
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro na conexão com o servidor.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LÓGICA DE REGISTRO DE ITEM (DASHBOARD) ---
    // Gerencia a adição de novas receitas e despesas
    const radioCards = document.querySelectorAll('.radio-card');
    if (radioCards.length > 0) {
        radioCards.forEach(card => {
            card.addEventListener('click', function () {
                radioCards.forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                const radio = this.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            });
        });
    }

    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = itemForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            btn.disabled = true;

            // Pegar os valores do formulário
            const typeInput = document.querySelector('input[name="transactionType"]:checked');
            const type = typeInput ? typeInput.value : 'expense';
            const description = document.getElementById('itemDescription').value;
            const valueRaw = document.getElementById('itemValue').value;
            const category = document.getElementById('itemCategory').value;
            const date = document.getElementById('itemDate').value;
            const isRecurring = document.getElementById('itemRecurring') ? document.getElementById('itemRecurring').checked : false;

            const newTransaction = {
                type,
                description,
                value: parseFloat(valueRaw),
                category,
                date,
                isRecurring
            };

            try {
                const userId = sessionStorage.getItem('userId');
                if (!userId) {
                    window.location.href = `${BASE_PATH}/login`;
                    return;
                }

                const response = await fetch(`${BASE_PATH}/api/transactions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': userId
                    },
                    body: JSON.stringify(newTransaction)
                });

                if (response.ok) {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo com sucesso!';
                    btn.style.background = '#22c55e';

                    setTimeout(() => {
                        itemForm.reset();
                        btn.innerHTML = originalText;
                        btn.style.background = '';
                        btn.disabled = false;
                        window.location.href = `${BASE_PATH}/dashboard`;
                    }, 1000);
                } else {
                    throw new Error('Falha ao salvar no servidor');
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro ao salvar transação. Tente novamente.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- CARREGAR DADOS NO DASHBOARD ---
    // Busca transações do servidor e calcula resumo (Saldo, Receitas, Despesas)
    const dashboardCards = document.querySelector('.summary-cards');
    if (dashboardCards) {
        const formatMoney = (value) => {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
        };

        const carregarDashboard = async () => {
            try {
                const userId = sessionStorage.getItem('userId');
                const userName = sessionStorage.getItem('userName');

                if (!userId) {
                    window.location.href = `${BASE_PATH}/login`;
                    return;
                }

                // Atualizar saudação e checar permissão Super Admin
                const welcomeEl = document.getElementById('userWelcome');
                if (welcomeEl && userName) {
                    welcomeEl.textContent = `Bem-vindo(a), ${userName}! Aqui está o resumo das suas finanças.`;
                }

                // Carregar Transações e Metas em paralelo
                const [transactionsRes, goalsRes] = await Promise.all([
                    fetch(`${BASE_PATH}/api/transactions`, { headers: { 'user-id': userId } }),
                    fetch(`${BASE_PATH}/api/goals`, { headers: { 'user-id': userId } })
                ]);

                const transactions = await transactionsRes.json();
                const goals = await goalsRes.json();

                // 1. Calcular Totais
                let totalIncomes = 0;
                let totalExpenses = 0;

                transactions.forEach(t => {
                    const val = parseFloat(t.value) || 0;
                    if (t.type === 'income') totalIncomes += val;
                    else if (t.type === 'expense') totalExpenses += val;
                });

                const currentBalance = totalIncomes - totalExpenses;
                const savings = currentBalance > 0 ? currentBalance : 0;

                // Atualizar os Cards
                const amountElements = document.querySelectorAll('.summary-card .amount');
                if (amountElements.length >= 3) {
                    amountElements[0].textContent = formatMoney(currentBalance);
                    amountElements[1].textContent = formatMoney(totalIncomes);
                    amountElements[2].textContent = formatMoney(totalExpenses);
                    if (amountElements[3]) amountElements[3].textContent = formatMoney(savings);
                }

                // 2. Meta em Destaque no Dashboard
                const goalContainer = document.getElementById('mainGoalContainer');
                if (goalContainer && goals.length > 0) {
                    goalContainer.style.display = 'block'; // Make it visible
                    // Pegar a meta com maior progresso que ainda não terminou, ou a primeira
                    const goalsWithActualProgress = goals.map(g => {
                        const isAutomatic = g.category === 'objetivo_financeiro';
                        const currentValue = isAutomatic ? currentBalance : g.currentvalue;
                        const pct = g.targetvalue > 0 ? (currentValue / g.targetvalue) : 0;
                        return { ...g, actualCurrentValue: currentValue, actualPct: pct };
                    });

                    const sortedGoals = goalsWithActualProgress.sort((a, b) => {
                        return b.actualPct - a.actualPct;
                    });

                    const mainGoal = sortedGoals[0];
                    const pctInt = Math.min(Math.round(mainGoal.actualPct * 100), 100);

                    // Automatic color logic based on progress
                    let barColor;
                    if (pctInt >= 80) barColor = '#22c55e'; // Green
                    else if (pctInt >= 40) barColor = '#f59e0b'; // Amber
                    else barColor = '#ef4444'; // Red

                    document.getElementById('mainGoalTitle').textContent = mainGoal.title;
                    const bar = document.getElementById('mainGoalBar');
                    bar.style.width = `${pctInt}%`;
                    bar.style.backgroundColor = barColor; // Applying calculated color

                    document.getElementById('mainGoalValues').textContent = `${formatMoney(mainGoal.actualCurrentValue)} de ${formatMoney(mainGoal.targetvalue)}`;
                    const pctDisplay = document.getElementById('mainGoalPct');
                    pctDisplay.textContent = `${pctInt}%`;
                    pctDisplay.style.color = barColor;

                    // Frases Motivacionais baseadas no progresso
                    const phrases = {
                        start: [
                            "O primeiro passo é sempre o mais importante! 🚀",
                            "Toda grande jornada começa com uma pequena economia.",
                            "Mantenha o foco, o seu futuro agradece!",
                            "Cada passo conta! Continue economizando e você vai chegar lá!"
                        ],
                        middle: [
                            "Você está no caminho certo! Continue firme. 💪",
                            "Mais da metade já foi! O sucesso está logo ali.",
                            "Sua disciplina está dando frutos, parabéns!",
                            "Continue economizando e você vai chegar lá!"
                        ],
                        end: [
                            "Quase lá! Só mais um pouco de esforço. ✨",
                            "A linha de chegada está à vista! Não pare agora.",
                            "Você é uma inspiração na gestão financeira!",
                            "Cada passo conta! Você vai chegar lá!"
                        ],
                        complete: [
                            "PARABÉNS! Você conquistou seu objetivo! 🏆",
                            "Meta batida! Hora de celebrar e planejar a próxima.",
                            "Incrível! Você provou que com foco tudo é possível."
                        ]
                    };

                    let selectedPhrases;
                    if (pctInt >= 100) selectedPhrases = phrases.complete;
                    else if (pctInt >= 75) selectedPhrases = phrases.end;
                    else if (pctInt >= 25) selectedPhrases = phrases.middle;
                    else selectedPhrases = phrases.start;

                    const randomPhrase = selectedPhrases[Math.floor(Math.random() * selectedPhrases.length)];
                    document.getElementById('motivationPhrase').textContent = `"${randomPhrase}"`;

                    // --- Lógica da Trilha de Marcos ---
                    const milestoneTrack = document.getElementById('milestoneTrack');
                    if (milestoneTrack) {
                        const milestones = [
                            { val: 5000, label: '5k' },
                            { val: 10000, label: '10k' },
                            { val: 25000, label: '25k' },
                            { val: 50000, label: '50k' },
                            { val: 100000, label: '100k' },
                            { val: 200000, label: '200k' },
                            { val: 300000, label: '300k' },
                            { val: 400000, label: '400k' },
                            { val: 500000, label: '500k' },
                            { val: 1000000, label: '1M' }
                        ];

                        milestoneTrack.innerHTML = '';
                        const currentMoney = mainGoal.currentvalue;

                        milestones.forEach(m => {
                            const step = document.createElement('div');
                            step.className = 'milestone-step';

                            if (currentMoney >= m.val) {
                                step.classList.add('achieved');
                            } else {
                                // Primeiro marco não alcançado é o 'current' (próximo objetivo)
                                const isNext = milestones.find(ms => currentMoney < ms.val) === m;
                                if (isNext) step.classList.add('current');
                            }

                            step.innerHTML = `
                                <div class="milestone-dot"></div>
                                <span class="milestone-label">${m.label}</span>
                            `;
                            milestoneTrack.appendChild(step);
                        });
                    }

                    goalContainer.style.display = 'block';
                }

                // 3. Preencher a Tabela
                const tbody = document.querySelector('.data-table tbody');
                if (tbody) {
                    tbody.innerHTML = '';

                    if (transactions.length === 0) {
                        tbody.innerHTML = `
                            <tr>
                                <td colspan="2" style="text-align: center; padding: 40px; color: var(--text-muted);">
                                    <div style="font-size: 32px; margin-bottom: 12px;"><i class="fa-solid fa-receipt"></i></div>
                                    <h3 style="color: var(--text-main); font-weight: 500; font-size: 16px;">Nenhuma transação encontrada</h3>
                                    <p style="font-size: 14px; margin-top: 4px;">Clique em "Novo Lançamento" para adicionar sua primeira transação.</p>
                                </td>
                            </tr>
                        `;
                    } else {
                        const recentTransactions = transactions.slice(0, 5);
                        recentTransactions.forEach(t => {
                            const tr = document.createElement('tr');
                            const isIncome = t.type === 'income';
                            const iconBg = isIncome ? 'green-bg' : 'red-bg';
                            const iconClass = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
                            const valueText = isIncome ? `+ ${formatMoney(t.value)}` : `- ${formatMoney(t.value)}`;
                            const valueClass = isIncome ? 'text-green' : 'text-red';

                            let categoryText = t.category.charAt(0).toUpperCase() + t.category.slice(1);
                            let tagClass = 'tag-blue';
                            if (t.category === 'alimentacao') tagClass = 'tag-orange';
                            if (t.category === 'contas') tagClass = 'tag-purple';

                            const dateObj = new Date(t.date);
                            dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
                            const formattedDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateObj);

                            tr.innerHTML = `
                                <td>
                                    <div class="item-desc">
                                        <div class="item-icon ${iconBg}"><i class="fa-solid ${iconClass}"></i></div>
                                        <span style="display: flex; flex-direction: column;">
                                            <span class="desc-text">${t.description}</span>
                                            <div class="item-meta">
                                                <span class="tag ${tagClass}">${categoryText}</span>
                                                <small>${formattedDate}</small>
                                            </div>
                                        </span>
                                    </div>
                                </td>
                                <td class="${valueClass} text-right">${valueText}</td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar dashboard:', error);
            }
        };

        carregarDashboard();
    }

    // --- MODO ESCURO ---
    // Alterna o tema visual e sincroniza a preferência com o servidor
    const darkModeBtn = document.getElementById('darkModeToggle');
    const body = document.body;

    if (darkModeBtn) {
        // Atualizar ícone inicial se já estiver dark
        if (body.classList.contains('dark-mode')) {
            darkModeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

        darkModeBtn.addEventListener('click', async () => {
            const isDark = body.classList.toggle('dark-mode');
            const themeState = isDark ? 'enabled' : 'disabled';

            // Persist locally for instant load
            localStorage.setItem('darkMode', themeState);
            darkModeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';

            // Sync with DB
            const userId = sessionStorage.getItem('userId');
            if (userId) {
                try {
                    await fetch(`${BASE_PATH}/api/user/preferences`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'user-id': userId
                        },
                        body: JSON.stringify({ darkMode: themeState })
                    });
                } catch (err) {
                    console.error('Erro ao sincronizar tema com o servidor:', err);
                }
            }
        });
    }

    // --- MENU MOBILE ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Fechar ao clicar em um link (útil no mobile)
        const navLinks = sidebar.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        });

        // Fechar ao clicar fora da sidebar (opcional, mas bom)
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target) && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });
    }
});
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("Service Worker registrado"))
        .catch(err => console.log("Erro SW:", err))
}