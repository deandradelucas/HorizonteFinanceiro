// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): Script principal do frontend.
//   - LÃ³gica de cadastro de usuÃ¡rio (formulÃ¡rio + validaÃ§Ã£o de senha)
//   - LÃ³gica de login (autenticaÃ§Ã£o + "lembrar e-mail")
//   - Registro de transaÃ§Ãµes (receitas/despesas)
//   - Carregamento do dashboard (cards de resumo + tabela)
//   - Modo escuro (toggle + sincronizaÃ§Ã£o com o servidor)
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

    // --- PERMISSÃ•ES GLOBAIS DE UI ---
    // Checa se o usuÃ¡rio logado Ã© Super Admin e injeta o botÃ£o em qualquer pÃ¡gina que tenha o sidebar
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

    const logoutLinks = document.querySelectorAll('.nav-item.logout');
    if (logoutLinks.length > 0) {
        logoutLinks.forEach((link) => {
            link.addEventListener('click', async (event) => {
                event.preventDefault();

                try {
                    await fetch(`${BASE_PATH}/api/logout`, { method: 'POST' });
                } catch (error) {
                    console.error('Erro ao encerrar sessao:', error);
                }

                sessionStorage.removeItem('userId');
                sessionStorage.removeItem('userName');
                localStorage.removeItem('userRole');
                window.location.href = `${BASE_PATH}/login`;
            });
        });
    }

    // Nota: A inicializaÃ§Ã£o do modo escuro Ã© tratada via scripts inline nos arquivos HTML para evitar o "flash" de cor clara.

    // --- LÃ“GICA DE CADASTRO ---
    // Gerencia o formulÃ¡rio de criaÃ§Ã£o de nova conta e validaÃ§Ã£o de forÃ§a de senha
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
                alert('As senhas nÃ£o coincidem. Por favor, verifique.');
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
                alert('Erro na conexÃ£o com o servidor.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LÃ“GICA DE LOGIN ---
    // Gerencia a autenticaÃ§Ã£o do usuÃ¡rio e a funcionalidade "Lembrar-me"
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
                alert('Erro na conexÃ£o com o servidor.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LÃ“GICA DE REGISTRO DE ITEM (DASHBOARD) ---
    // Gerencia a adiÃ§Ã£o de novas receitas e despesas
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

            // Pegar os valores do formulÃ¡rio
            const typeInput = document.querySelector('input[name="transactionType"]:checked');
            const type = typeInput ? typeInput.value : 'expense';
            const descriptionField = document.getElementById('itemDescription');
            const descriptionCustomField = document.getElementById('itemDescriptionCustom');
            const categoryField = document.getElementById('itemCategory');
            const description = descriptionField && descriptionField.value === 'outros' && descriptionCustomField
                ? descriptionCustomField.value.trim()
                : descriptionField.value;
            const valueRaw = document.getElementById('itemValue').value;
            const category = categoryField ? categoryField.value : '';
            const date = document.getElementById('itemDate').value;
            const isRecurring = document.getElementById('itemRecurring') ? document.getElementById('itemRecurring').checked : false;

            const parsedValue = parseFloat(
                String(valueRaw || '')
                    .replace(/\s/g, '')
                    .replace('R$', '')
                    .replace(/\./g, '')
                    .replace(',', '.')
                    .replace(/[^0-9.-]/g, '')
            );

            const newTransaction = {
                type,
                description,
                value: Number.isFinite(parsedValue) ? parsedValue : 0,
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
                alert('Erro ao salvar transaÃ§Ã£o. Tente novamente.');
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- CARREGAR DADOS NO DASHBOARD ---
    // Busca transaÃ§Ãµes do servidor e calcula resumo (Saldo, Receitas, Despesas)
    const dashboardCards = document.querySelector('.summary-cards');
    if (dashboardCards) {
        const toSafeNumber = (value, fallback = 0) => {
            const parsed = typeof value === 'number' ? value : parseFloat(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const formatMoney = (value) => {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toSafeNumber(value));
        };

        const normalizeTransactionType = (type) => {
            if (type === 'receita') return 'income';
            if (type === 'despesa') return 'expense';
            return type;
        };

        const dashboardLayout = document.getElementById('dashboardLayout');
        const dashboardLayoutEditor = document.getElementById('dashboardLayoutEditor');
        const dashboardLayoutControls = document.getElementById('dashboardLayoutControls');
        const dashboardLayoutEditBtn = document.getElementById('dashboardLayoutEditBtn');
        const dashboardLayoutSaveBtn = document.getElementById('dashboardLayoutSaveBtn');
        const dashboardLayoutCloseBtn = document.getElementById('dashboardLayoutCloseBtn');
        const dashboardLayoutResetBtn = document.getElementById('dashboardLayoutResetBtn');
        const dashboardWidgets = dashboardLayout ? Array.from(dashboardLayout.querySelectorAll('.dashboard-widget')) : [];
        const dashboardWidgetMeta = {
            goal: {
                title: 'Meta em destaque',
                description: 'Bloco com progresso da meta principal.'
            },
            summary: {
                title: 'Resumo financeiro',
                description: 'Cards de saldo, receitas, despesas e economia.'
            },
            'category-chart': {
                title: 'Categorias do mÃªs',
                description: 'Ranking de gastos por categoria no mÃªs atual.'
            },
            'subcategory-chart': {
                title: 'Subcategorias do mÃªs',
                description: 'Ranking de gastos por subcategoria no mÃªs atual.'
            },
            recent: {
                title: 'TransaÃ§Ãµes recentes',
                description: 'Lista rÃ¡pida das Ãºltimas movimentaÃ§Ãµes.'
            }
        };

        const getDashboardLayoutStorageKey = () => `dashboard-layout:${sessionStorage.getItem('userId') || 'default'}`;

        const getDefaultDashboardLayoutState = () => ({
            order: dashboardWidgets.map((widget) => widget.dataset.widgetKey),
            hidden: []
        });

        const sanitizeDashboardLayoutState = (state) => {
            const defaults = getDefaultDashboardLayoutState();
            const knownKeys = new Set(defaults.order);
            const order = Array.isArray(state?.order)
                ? state.order.filter((key) => knownKeys.has(key))
                : [];
            const hidden = Array.isArray(state?.hidden)
                ? state.hidden.filter((key) => knownKeys.has(key))
                : [];

            defaults.order.forEach((key) => {
                if (!order.includes(key)) order.push(key);
            });

            return { order, hidden };
        };

        const loadDashboardLayoutState = () => {
            try {
                const raw = localStorage.getItem(getDashboardLayoutStorageKey());
                return raw ? sanitizeDashboardLayoutState(JSON.parse(raw)) : getDefaultDashboardLayoutState();
            } catch (error) {
                console.error('Erro ao carregar layout do dashboard:', error);
                return getDefaultDashboardLayoutState();
            }
        };

        const persistDashboardLayoutState = (state) => {
            localStorage.setItem(getDashboardLayoutStorageKey(), JSON.stringify(sanitizeDashboardLayoutState(state)));
        };

        const applyDashboardLayoutState = (state) => {
            if (!dashboardLayout) return;
            const safeState = sanitizeDashboardLayoutState(state);
            const widgetsByKey = Object.fromEntries(
                dashboardWidgets.map((widget) => [widget.dataset.widgetKey, widget])
            );

            safeState.order.forEach((key) => {
                if (widgetsByKey[key]) dashboardLayout.appendChild(widgetsByKey[key]);
            });

            dashboardWidgets.forEach((widget) => {
                widget.classList.toggle('layout-hidden', safeState.hidden.includes(widget.dataset.widgetKey));
            });
        };

        let savedDashboardLayoutState = loadDashboardLayoutState();
        let draftDashboardLayoutState = { ...savedDashboardLayoutState, order: [...savedDashboardLayoutState.order], hidden: [...savedDashboardLayoutState.hidden] };

        const renderDashboardLayoutControls = () => {
            if (!dashboardLayoutControls) return;
            dashboardLayoutControls.innerHTML = '';

            draftDashboardLayoutState.order.forEach((key, index) => {
                const meta = dashboardWidgetMeta[key];
                if (!meta) return;

                const item = document.createElement('div');
                item.className = 'dashboard-layout-item';

                const info = document.createElement('div');
                info.className = 'dashboard-layout-item-info';
                info.innerHTML = `<strong>${meta.title}</strong><span>${meta.description}</span>`;

                const actions = document.createElement('div');
                actions.className = 'dashboard-layout-item-actions';

                const toggleLabel = document.createElement('label');
                toggleLabel.className = 'layout-toggle';
                const toggle = document.createElement('input');
                toggle.type = 'checkbox';
                toggle.checked = !draftDashboardLayoutState.hidden.includes(key);
                toggle.addEventListener('change', () => {
                    if (toggle.checked) {
                        draftDashboardLayoutState.hidden = draftDashboardLayoutState.hidden.filter((itemKey) => itemKey !== key);
                    } else if (!draftDashboardLayoutState.hidden.includes(key)) {
                        draftDashboardLayoutState.hidden.push(key);
                    }

                    applyDashboardLayoutState(draftDashboardLayoutState);
                });
                toggleLabel.append(toggle, document.createTextNode('Mostrar'));

                const moveUpBtn = document.createElement('button');
                moveUpBtn.type = 'button';
                moveUpBtn.className = 'btn-secondary layout-move-btn';
                moveUpBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
                moveUpBtn.disabled = index === 0;
                moveUpBtn.addEventListener('click', () => {
                    const order = [...draftDashboardLayoutState.order];
                    [order[index - 1], order[index]] = [order[index], order[index - 1]];
                    draftDashboardLayoutState.order = order;
                    applyDashboardLayoutState(draftDashboardLayoutState);
                    renderDashboardLayoutControls();
                });

                const moveDownBtn = document.createElement('button');
                moveDownBtn.type = 'button';
                moveDownBtn.className = 'btn-secondary layout-move-btn';
                moveDownBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
                moveDownBtn.disabled = index === draftDashboardLayoutState.order.length - 1;
                moveDownBtn.addEventListener('click', () => {
                    const order = [...draftDashboardLayoutState.order];
                    [order[index], order[index + 1]] = [order[index + 1], order[index]];
                    draftDashboardLayoutState.order = order;
                    applyDashboardLayoutState(draftDashboardLayoutState);
                    renderDashboardLayoutControls();
                });

                actions.append(toggleLabel, moveUpBtn, moveDownBtn);
                item.append(info, actions);
                dashboardLayoutControls.appendChild(item);
            });
        };

        if (dashboardLayout && dashboardLayoutEditor && dashboardLayoutEditBtn && dashboardLayoutSaveBtn && dashboardLayoutCloseBtn && dashboardLayoutResetBtn) {
            applyDashboardLayoutState(savedDashboardLayoutState);

            dashboardLayoutEditBtn.addEventListener('click', () => {
                draftDashboardLayoutState = {
                    order: [...savedDashboardLayoutState.order],
                    hidden: [...savedDashboardLayoutState.hidden]
                };
                dashboardLayoutEditor.hidden = false;
                renderDashboardLayoutControls();
            });

            dashboardLayoutCloseBtn.addEventListener('click', () => {
                dashboardLayoutEditor.hidden = true;
                applyDashboardLayoutState(savedDashboardLayoutState);
            });

            dashboardLayoutSaveBtn.addEventListener('click', () => {
                savedDashboardLayoutState = sanitizeDashboardLayoutState(draftDashboardLayoutState);
                persistDashboardLayoutState(savedDashboardLayoutState);
                applyDashboardLayoutState(savedDashboardLayoutState);
                dashboardLayoutEditor.hidden = true;
            });

            dashboardLayoutResetBtn.addEventListener('click', () => {
                draftDashboardLayoutState = getDefaultDashboardLayoutState();
                savedDashboardLayoutState = getDefaultDashboardLayoutState();
                persistDashboardLayoutState(savedDashboardLayoutState);
                applyDashboardLayoutState(savedDashboardLayoutState);
                renderDashboardLayoutControls();
            });
        }

        const carregarDashboard = async () => {
            try {
                const userId = sessionStorage.getItem('userId');
                const userName = sessionStorage.getItem('userName');

                if (!userId) {
                    window.location.href = `${BASE_PATH}/login`;
                    return;
                }

                // Atualizar saudaÃ§Ã£o e checar permissÃ£o Super Admin
                const welcomeEl = document.getElementById('userWelcome');
                if (welcomeEl && userName) {
                    welcomeEl.textContent = `Bem-vindo(a), ${userName}! Aqui estÃ¡ o resumo das suas finanÃ§as.`;
                }

                // Carregar TransaÃ§Ãµes e Metas em paralelo
                const [transactionsRes, goalsRes] = await Promise.all([
                    fetch(`${BASE_PATH}/api/transactions`, { headers: { 'user-id': userId } }),
                    fetch(`${BASE_PATH}/api/goals`, { headers: { 'user-id': userId } })
                ]);

                const transactions = await transactionsRes.json();
                const goals = await goalsRes.json();
                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const currentMonthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                const normalizeLabel = (value) => {
                    const text = String(value || 'Sem nome').trim();
                    if (!text) return 'Sem nome';
                    return text.charAt(0).toUpperCase() + text.slice(1);
                };

                const renderBarChart = (containerId, emptyId, items, color) => {
                    const container = document.getElementById(containerId);
                    const empty = document.getElementById(emptyId);
                    if (!container || !empty) return;

                    container.innerHTML = '';
                    empty.hidden = items.length > 0;
                    if (!items.length) return;

                    const maxValue = items[0]?.total || 0;
                    items.forEach((item) => {
                        const row = document.createElement('div');
                        row.className = 'insight-bar-item';
                        const pct = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
                        row.innerHTML = `
                            <div class="insight-bar-head">
                                <strong>${normalizeLabel(item.label)}</strong>
                                <span>${formatMoney(item.total)}</span>
                            </div>
                            <div class="insight-bar-track">
                                <div class="insight-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                            </div>
                        `;
                        container.appendChild(row);
                    });
                };
                // 1. Calcular Totais
                let totalIncomes = 0;
                let totalExpenses = 0;

                transactions.forEach(t => {
                    const val = toSafeNumber(t.value);
                    const normalizedType = normalizeTransactionType(t.type);
                    if (normalizedType === 'income') totalIncomes += val;
                    else if (normalizedType === 'expense') totalExpenses += val;
                });

                const currentMonthExpenses = transactions
                    .filter((t) => normalizeTransactionType(t.type) === 'expense' && String(t.date || '').startsWith(currentMonthKey))
                    .map((t) => ({
                        ...t,
                        value: toSafeNumber(t.value),
                        category: String(t.category || 'Sem categoria'),
                        description: String(t.description || 'Sem subcategoria')
                    }));

                const aggregateByField = (items, field) => {
                    const groups = new Map();
                    items.forEach((item) => {
                        const key = String(item[field] || 'Sem nome').trim() || 'Sem nome';
                        groups.set(key, (groups.get(key) || 0) + toSafeNumber(item.value));
                    });
                    return [...groups.entries()]
                        .map(([label, total]) => ({ label, total }))
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 5);
                };

                const categoryChartData = aggregateByField(currentMonthExpenses, 'category');
                const subcategoryChartData = aggregateByField(currentMonthExpenses, 'description');

                const currentBalance = toSafeNumber(totalIncomes - totalExpenses);
                const investedTotal = transactions
                    .filter((t) => String(t.category || '').toLowerCase() === 'investimentos')
                    .reduce((sum, t) => sum + toSafeNumber(t.value), 0);

                // Atualizar os Cards
                const amountElements = document.querySelectorAll('.summary-card .amount');
                if (amountElements.length >= 3) {
                    amountElements[0].textContent = formatMoney(currentBalance);
                    amountElements[1].textContent = formatMoney(totalIncomes);
                    amountElements[2].textContent = formatMoney(totalExpenses);
                    if (amountElements[3]) amountElements[3].textContent = formatMoney(investedTotal);
                }

                const categoryPeriod = document.getElementById('categoryChartPeriod');
                const subcategoryPeriod = document.getElementById('subcategoryChartPeriod');
                if (categoryPeriod) categoryPeriod.textContent = currentMonthLabel;
                if (subcategoryPeriod) subcategoryPeriod.textContent = currentMonthLabel;

                renderBarChart('categoryChartBars', 'categoryChartEmpty', categoryChartData, 'linear-gradient(90deg, #7dd3fc 0%, #3b82f6 45%, #312e81 100%)');
                renderBarChart('subcategoryChartBars', 'subcategoryChartEmpty', subcategoryChartData, 'linear-gradient(90deg, #fde68a 0%, #f59e0b 48%, #c2410c 100%)');

                // 2. Meta em Destaque no Dashboard
                const goalContainer = document.getElementById('mainGoalContainer');
                if (goalContainer && goals.length > 0) {
                    goalContainer.style.display = 'block'; // Make it visible
                    // Pegar a meta com maior progresso que ainda nÃ£o terminou, ou a primeira
                    const goalsWithActualProgress = goals.map(g => {
                        const isAutomatic = g.category === 'objetivo_financeiro';
                        const targetValue = toSafeNumber(g.targetvalue);
                        const storedCurrentValue = toSafeNumber(g.currentvalue);
                        const currentValue = isAutomatic ? currentBalance : storedCurrentValue;
                        const pct = targetValue > 0 ? (currentValue / targetValue) : 0;
                        return { ...g, targetvalue: targetValue, actualCurrentValue: currentValue, actualPct: pct };
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
                            "O primeiro passo Ã© sempre o mais importante! ðŸš€",
                            "Toda grande jornada comeÃ§a com uma pequena economia.",
                            "Mantenha o foco, o seu futuro agradece!",
                            "Cada passo conta! Continue economizando e vocÃª vai chegar lÃ¡!"
                        ],
                        middle: [
                            "VocÃª estÃ¡ no caminho certo! Continue firme. ðŸ’ª",
                            "Mais da metade jÃ¡ foi! O sucesso estÃ¡ logo ali.",
                            "Sua disciplina estÃ¡ dando frutos, parabÃ©ns!",
                            "Continue economizando e vocÃª vai chegar lÃ¡!"
                        ],
                        end: [
                            "Quase lÃ¡! SÃ³ mais um pouco de esforÃ§o. âœ¨",
                            "A linha de chegada estÃ¡ Ã  vista! NÃ£o pare agora.",
                            "VocÃª Ã© uma inspiraÃ§Ã£o na gestÃ£o financeira!",
                            "Cada passo conta! VocÃª vai chegar lÃ¡!"
                        ],
                        complete: [
                            "PARABÃ‰NS! VocÃª conquistou seu objetivo! ðŸ†",
                            "Meta batida! Hora de celebrar e planejar a prÃ³xima.",
                            "IncrÃ­vel! VocÃª provou que com foco tudo Ã© possÃ­vel."
                        ]
                    };

                    let selectedPhrases;
                    if (pctInt >= 100) selectedPhrases = phrases.complete;
                    else if (pctInt >= 75) selectedPhrases = phrases.end;
                    else if (pctInt >= 25) selectedPhrases = phrases.middle;
                    else selectedPhrases = phrases.start;

                    const randomPhrase = selectedPhrases[Math.floor(Math.random() * selectedPhrases.length)];
                    document.getElementById('motivationPhrase').textContent = `"${randomPhrase}"`;

                    // --- LÃ³gica da Trilha de Marcos ---
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
                        const currentMoney = mainGoal.actualCurrentValue;

                        milestones.forEach(m => {
                            const step = document.createElement('div');
                            step.className = 'milestone-step';

                            if (currentMoney >= m.val) {
                                step.classList.add('achieved');
                            } else {
                                // Primeiro marco nÃ£o alcanÃ§ado Ã© o 'current' (prÃ³ximo objetivo)
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
                                    <h3 style="color: var(--text-main); font-weight: 500; font-size: 16px;">Nenhuma transaÃ§Ã£o encontrada</h3>
                                    <p style="font-size: 14px; margin-top: 4px;">Clique em "Novo LanÃ§amento" para adicionar sua primeira transaÃ§Ã£o.</p>
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
    // Alterna o tema visual e sincroniza a preferÃªncia com o servidor
    const darkModeBtn = document.getElementById('darkModeToggle');
    const body = document.body;

    if (darkModeBtn) {
        // Atualizar Ã­cone inicial se jÃ¡ estiver dark
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

        // Fechar ao clicar em um link (Ãºtil no mobile)
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


