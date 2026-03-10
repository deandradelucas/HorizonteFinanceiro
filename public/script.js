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
    const applyStoredTheme = () => {
        const siteTheme = localStorage.getItem('siteTheme') || 'default';
        if (siteTheme === 'default') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.dataset.theme = siteTheme;
        }
    };

    applyStoredTheme();

    const applyAuthHorizonImage = () => {
        if (!document.body.classList.contains('auth-login-v2') && !document.body.classList.contains('auth-register-v2')) {
            return;
        }

        const horizonImages = [
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1800&q=80",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80",
            "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1800&q=80"
        ];

        const storageKey = 'authHorizonImageIndex';
        const lastIndex = Number.parseInt(sessionStorage.getItem(storageKey) || '-1', 10);
        let nextIndex = Math.floor(Math.random() * horizonImages.length);

        if (horizonImages.length > 1) {
            while (nextIndex === lastIndex) {
                nextIndex = Math.floor(Math.random() * horizonImages.length);
            }
        }

        sessionStorage.setItem(storageKey, String(nextIndex));
        const randomImage = horizonImages[nextIndex];
        document.body.style.setProperty('--auth-horizon-image', `url('${randomImage}')`);
    };

    applyAuthHorizonImage();

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
            adminLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = "/super-admin.html";
            });
            adminLink.id = "superAdminLink";
            adminLink.className = "nav-item admin-portal-btn";
            adminLink.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span>Painel Admin</span>';
            nav.appendChild(adminLink);
        }
    }

    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        const businessLink = Array.from(sidebarNav.querySelectorAll('.nav-item'))
            .find((item) => (item.getAttribute('href') || '') === '/cnpj');
        const investmentsLink = Array.from(sidebarNav.querySelectorAll('.nav-item'))
            .find((item) => (item.getAttribute('href') || '') === '/investments');

        if (!businessLink && investmentsLink) {
            const cnpjLink = document.createElement('a');
            cnpjLink.href = '/cnpj';
            cnpjLink.className = 'nav-item';
            cnpjLink.innerHTML = '<i class="fa-solid fa-building"></i> CNPJ';
            if (window.location.pathname === '/cnpj' || window.location.pathname === '/cnpj.html') {
                cnpjLink.classList.add('active');
            }
            investmentsLink.insertAdjacentElement('afterend', cnpjLink);
        }

        const pfLink = Array.from(sidebarNav.querySelectorAll('.nav-item'))
            .find((item) => (item.getAttribute('href') || '') === '/transactions');
        if (pfLink && !pfLink.dataset.keepLabel) {
            pfLink.innerHTML = '<i class="fa-solid fa-user"></i> PF';
        }

        const billingLink = Array.from(sidebarNav.querySelectorAll('.nav-item'))
            .find((item) => (item.getAttribute('href') || '') === '/billing');
        const configPlaceholder = Array.from(sidebarNav.querySelectorAll('.nav-item'))
            .find((item) => (item.getAttribute('href') || '') === '#');

        if (!billingLink && configPlaceholder) {
            configPlaceholder.setAttribute('href', '/billing');
            configPlaceholder.innerHTML = '<i class="fa-solid fa-credit-card"></i> Assinatura';
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

    // Nota: A inicialização do modo escuro é tratada via scripts inline nos arquivos HTML para evitar o "flash" de cor clara.

    // --- LÓGICA DE CADASTRO ---
    // Gerencia o formulário de criação de nova conta e validação de força de senha
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const form = document.getElementById('registerForm');
    const strengthBar = document.getElementById('strengthBar');

    const bindPasswordToggle = (toggle, input) => {
        if (!toggle || !input) return;

        const icon = toggle.matches('i') ? toggle : toggle.querySelector('i');
        toggle.addEventListener('click', () => {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);

            if (!icon) return;
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    };

    bindPasswordToggle(togglePassword, passwordInput);
    bindPasswordToggle(toggleConfirmPassword, confirmPasswordInput);

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
            const loginIcon = toggleLoginPassword.matches('i')
                ? toggleLoginPassword
                : toggleLoginPassword.querySelector('i');
            if (type === 'text') {
                if (loginIcon) {
                    loginIcon.classList.remove('fa-eye');
                    loginIcon.classList.add('fa-eye-slash');
                }
            } else {
                if (loginIcon) {
                    loginIcon.classList.remove('fa-eye-slash');
                    loginIcon.classList.add('fa-eye');
                }
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
            const financialScopeField = document.getElementById('financialScope');
            const financialScope = financialScopeField ? financialScopeField.value : 'pf';

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
                isRecurring,
                financialScope
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
                        window.location.href = financialScope === 'pj' ? `${BASE_PATH}/cnpj` : `${BASE_PATH}/dashboard`;
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
                title: 'Categorias do mês',
                description: 'Ranking de gastos por categoria no mês atual.'
            },
            'subcategory-chart': {
                title: 'Subcategorias do mês',
                description: 'Ranking de gastos por subcategoria no mês atual.'
            },
            recent: {
                title: 'Transações recentes',
                description: 'Lista rápida das últimas movimentações.'
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

                // Atualizar saudação e checar permissão Super Admin
                const welcomeEl = document.getElementById('userWelcome');
                if (welcomeEl && userName) {
                    welcomeEl.textContent = `Bem-vindo(a), ${userName}! Aqui está o resumo das suas finanças.`;
                }

                const billingStatusPill = document.getElementById('billingStatusPill');
                const renderBillingStatus = (billing) => {
                    if (!billingStatusPill || !billing || !billing.user) return;

                    const billingUser = billing.user;
                    let text = 'Assinatura inativa';
                    let statusClass = 'inactive';

                    if (billingUser.billing_exempt) {
                        text = 'Isento de cobrança';
                        statusClass = 'exempt';
                    } else if (billingUser.subscription_status === 'active') {
                        text = billingUser.subscription_next_due_date
                            ? `Vence em ${new Date(`${billingUser.subscription_next_due_date}T12:00:00`).toLocaleDateString('pt-BR')}`
                            : 'Assinatura ativa';
                        statusClass = 'active';
                    } else if (billingUser.subscription_status === 'pending' || billingUser.subscription_status === 'checkout_pending') {
                        text = 'Assinatura pendente';
                        statusClass = 'pending';
                    } else if (billingUser.subscription_status === 'past_due') {
                        text = 'Cobrança em atraso';
                        statusClass = 'past_due';
                    } else if (billingUser.subscription_status === 'cancelled') {
                        text = 'Assinatura cancelada';
                    }

                    billingStatusPill.textContent = text;
                    billingStatusPill.className = `dashboard-status-pill ${statusClass}`;
                    billingStatusPill.hidden = false;
                };

                // Carregar Transações, Metas e Cobrança em paralelo
                const [transactionsRes, goalsRes, billingRes] = await Promise.all([
                    fetch(`${BASE_PATH}/api/transactions`, { headers: { 'user-id': userId } }),
                    fetch(`${BASE_PATH}/api/goals`, { headers: { 'user-id': userId } }),
                    fetch(`${BASE_PATH}/api/billing/me`, { headers: { 'user-id': userId } })
                ]);

                const transactions = await transactionsRes.json();
                const goals = await goalsRes.json();
                const billing = billingRes.ok ? await billingRes.json() : null;
                renderBillingStatus(billing);
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

                const renderSpendingMap = (containerId, emptyId, items) => {
                    const container = document.getElementById(containerId);
                    const empty = document.getElementById(emptyId);
                    if (!container || !empty) return;

                    container.innerHTML = '';
                    empty.hidden = items.length > 0;
                    if (!items.length) return;

                    const maxValue = items[0]?.total || 0;
                    items.forEach((item) => {
                        const row = document.createElement('div');
                        row.className = 'spending-map-row';
                        const pct = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
                        row.innerHTML = `
                            <div class="spending-map-main">
                                <div class="spending-map-copy">
                                    <strong>${normalizeLabel(item.category)}</strong>
                                    <span>${normalizeLabel(item.subcategory)}</span>
                                </div>
                                <div class="mini-track">
                                    <div class="mini-track-fill" style="width:${pct}%"></div>
                                </div>
                            </div>
                            <span class="spending-map-value">${formatMoney(item.total)}</span>
                        `;
                        container.appendChild(row);
                    });
                };

                const renderRecurringChart = (items) => {
                    const container = document.getElementById('recurringChartBars');
                    const empty = document.getElementById('recurringChartEmpty');
                    if (!container || !empty) return;

                    container.innerHTML = '';
                    empty.hidden = items.length > 0;
                    if (!items.length) return;

                    const maxValue = Math.max(...items.map((item) => item.total), 1);
                    items.forEach((item, idx) => {
                        const row = document.createElement('div');
                        row.className = 'insight-bar-item';
                        const pct = (item.total / maxValue) * 100;
                        const color = idx % 2 === 0
                            ? 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)'
                            : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)';
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

                const renderMonthRadar = (items, categoryData, subcategoryData) => {
                    const caption = document.getElementById('subcategoryChartPeriod');
                    const subcategoryContainer = document.getElementById('subcategoryChartBars');
                    const subcategoryEmpty = document.getElementById('subcategoryChartEmpty');
                    const subcategoryCard = subcategoryContainer ? subcategoryContainer.closest('.dashboard-chart-card') : null;
                    const subcategoryTitle = subcategoryContainer ? subcategoryContainer.parentElement.querySelector('.section-header h3') : null;

                    if (subcategoryTitle) subcategoryTitle.textContent = 'Radar do Mês';
                    if (caption) caption.textContent = currentMonthLabel;
                    if (!subcategoryContainer || !subcategoryEmpty) return;

                    if (subcategoryCard) {
                        subcategoryCard.classList.remove('dashboard-chart-card');
                        subcategoryCard.classList.add('dashboard-side-card');
                    }

                    subcategoryEmpty.hidden = true;
                    const count = items.length;
                    const avg = count ? items.reduce((sum, item) => sum + toSafeNumber(item.value), 0) / count : 0;
                    const topCategory = categoryData[0]?.label || 'Sem categoria';
                    const topSubcategory = subcategoryData[0]?.label || 'Sem subcategoria';

                    subcategoryContainer.innerHTML = `
                        <div class="radar-grid">
                            <div class="radar-metric">
                                <span>Lançamentos</span>
                                <strong>${count} movimentações</strong>
                            </div>
                            <div class="radar-metric">
                                <span>Ticket médio</span>
                                <strong>${formatMoney(avg)}</strong>
                            </div>
                            <div class="radar-metric">
                                <span>Categoria líder</span>
                                <strong>${normalizeLabel(topCategory)}</strong>
                            </div>
                            <div class="radar-metric">
                                <span>Subcategoria líder</span>
                                <strong>${normalizeLabel(topSubcategory)}</strong>
                            </div>
                        </div>
                    `;
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
                const combinedSpendingData = [...currentMonthExpenses.reduce((groups, item) => {
                    const category = String(item.category || 'Sem categoria').trim() || 'Sem categoria';
                    const subcategory = String(item.description || 'Sem subcategoria').trim() || 'Sem subcategoria';
                    const key = `${category}__${subcategory}`;
                    const current = groups.get(key) || { category, subcategory, total: 0 };
                    current.total += toSafeNumber(item.value);
                    groups.set(key, current);
                    return groups;
                }, new Map()).values()]
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 6);

                const isRecurringFlag = (transaction) => {
                    const raw = transaction?.isRecurring ?? transaction?.is_recurring ?? transaction?.recurring ?? transaction?.is_recorrente;
                    return raw === true || raw === 1 || raw === '1';
                };

                const currentMonthRecurring = transactions
                    .filter((t) => isRecurringFlag(t) && String(t.date || '').startsWith(currentMonthKey))
                    .map((t) => ({
                        ...t,
                        value: toSafeNumber(t.value),
                        category: String(t.category || 'Sem categoria')
                    }));

                const recurringChartData = aggregateByField(currentMonthRecurring, 'category');

                const currentBalance = toSafeNumber(totalIncomes - totalExpenses);
                const investedTotal = transactions
                    .filter((t) => String(t.category || '').toLowerCase() === 'investimentos')
                    .reduce((sum, t) => sum + toSafeNumber(t.value), 0);

                // Atualizar os Cards
                const summaryValues = {
                    balance: formatMoney(currentBalance),
                    income: formatMoney(totalIncomes),
                    expense: formatMoney(totalExpenses),
                    investment: formatMoney(investedTotal)
                };

                document.querySelectorAll('.summary-card[data-summary-key]').forEach((card) => {
                    const key = card.dataset.summaryKey;
                    const amountEl = card.querySelector('.amount');
                    if (amountEl && summaryValues[key]) {
                        amountEl.textContent = summaryValues[key];
                    }
                });

                const horizonBalance = document.getElementById('horizonBalance');
                const horizonCashflow = document.getElementById('horizonCashflow');
                const horizonTip = document.getElementById('horizonTip');
                if (horizonBalance) horizonBalance.textContent = `Saldo: ${formatMoney(currentBalance)}`;

                const flowValue = totalIncomes - totalExpenses;
                if (horizonCashflow) horizonCashflow.textContent = `Fluxo: ${formatMoney(flowValue)}`;

                if (horizonTip) {
                    const delta = Math.abs(flowValue);
                    if (flowValue < 0) {
                        horizonTip.textContent = `A saída está ${formatMoney(delta)} acima da entrada. Que tal revisar despesas recorrentes?`;
                    } else if (flowValue > 0) {
                        horizonTip.textContent = `A entrada está ${formatMoney(delta)} acima da saída. Considere reforçar sua reserva.`;
                    } else {
                        horizonTip.textContent = 'Entrada e saída estão equilibradas no período.';
                    }
                }

                window.horizonContext = {
                    balance: formatMoney(currentBalance),
                    income: formatMoney(totalIncomes),
                    expense: formatMoney(totalExpenses),
                    investment: formatMoney(investedTotal),
                    cashflow: formatMoney(flowValue),
                    balanceValue: currentBalance,
                    incomeValue: totalIncomes,
                    expenseValue: totalExpenses,
                    investmentValue: investedTotal,
                    cashflowValue: flowValue,
                    monthLabel: currentMonthLabel,
                    transactionsCount: transactions.length,
                    topCategories: categoryChartData
                };

                const categoryPeriod = document.getElementById('categoryChartPeriod');
                const subcategoryPeriod = document.getElementById('subcategoryChartPeriod');
                const recurringPeriod = document.getElementById('recurringChartPeriod');
                if (categoryPeriod) categoryPeriod.textContent = currentMonthLabel;
                if (subcategoryPeriod) subcategoryPeriod.textContent = currentMonthLabel;
                if (recurringPeriod) {
                    const recurringCount = currentMonthRecurring.length;
                    recurringPeriod.textContent = `${currentMonthLabel} • ${recurringCount} recorrente${recurringCount === 1 ? '' : 's'}`;
                }

                const categoryTitle = document.getElementById('categoryChartBars')?.parentElement?.querySelector('.section-header h3');
                if (categoryTitle) categoryTitle.textContent = 'Mapa de Gastos do Mês';

                renderSpendingMap('categoryChartBars', 'categoryChartEmpty', combinedSpendingData);
                renderMonthRadar(currentMonthExpenses, categoryChartData, subcategoryChartData);
                renderRecurringChart(recurringChartData);

                // 2. Meta em Destaque no Dashboard
                const goalContainer = document.getElementById('mainGoalContainer');
                if (goalContainer && goals.length > 0) {
                    goalContainer.style.display = 'block'; // Make it visible
                    // Pegar a meta com maior progresso que ainda não terminou, ou a primeira
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
                            "O primeiro passo é sempre o mais importante!",
                            "Toda grande jornada começa com uma pequena economia.",
                            "Mantenha o foco, o seu futuro agradece!",
                            "Cada passo conta! Continue economizando e você vai chegar lá!"
                        ],
                        middle: [
                            "Você está no caminho certo! Continue firme.",
                            "Mais da metade já foi! O sucesso está logo ali.",
                            "Sua disciplina está dando frutos, parabéns!",
                            "Continue economizando e você vai chegar lá!"
                        ],
                        end: [
                            "Quase lá! Só mais um pouco de esforço.",
                            "A linha de chegada está à vista! Não pare agora.",
                            "Você é uma inspiração na gestão financeira!",
                            "Cada passo conta! Você vai chegar lá!"
                        ],
                        complete: [
                            "PARABÉNS! Você conquistou seu objetivo!",
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
                        const currentMoney = mainGoal.actualCurrentValue;

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

    // --- HORIZON AGENT ---
    const horizonOpenBtn = document.getElementById('horizonOpenBtn');
    const horizonVoiceBtn = document.getElementById('horizonVoiceBtn');
    const horizonModal = document.getElementById('horizonModal');
    const horizonCloseBtn = document.getElementById('horizonCloseBtn');
    const horizonChat = document.getElementById('horizonChat');
    const horizonForm = document.getElementById('horizonForm');
    const horizonInput = document.getElementById('horizonInput');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const voiceRecognition = SpeechRecognition ? new SpeechRecognition() : null;

    if (voiceRecognition) {
        voiceRecognition.lang = 'pt-BR';
        voiceRecognition.interimResults = false;
        voiceRecognition.maxAlternatives = 1;
    }

    const openHorizonModal = () => {
        if (!horizonModal) return;
        horizonModal.classList.add('open');
        horizonModal.setAttribute('aria-hidden', 'false');

        if (horizonChat && window.horizonContext) {
            const { balance, income, expense, investment, cashflow, monthLabel } = window.horizonContext;
            let summary = horizonChat.querySelector('[data-horizon-summary="true"]');
            if (!summary) {
                summary = document.createElement('div');
                summary.className = 'horizon-message horizon-message--agent';
                summary.dataset.horizonSummary = 'true';
                horizonChat.appendChild(summary);
            }
            summary.innerHTML = `
                <strong>Horizon</strong>
                <p>${monthLabel}: saldo ${balance}, entrada ${income}, saída ${expense}, investimentos ${investment} e fluxo ${cashflow}.</p>
            `;
            horizonChat.scrollTop = horizonChat.scrollHeight;
        }

        if (horizonInput) horizonInput.focus();
    };

    const closeHorizonModal = () => {
        if (!horizonModal) return;
        horizonModal.classList.remove('open');
        horizonModal.setAttribute('aria-hidden', 'true');
    };

    if (horizonOpenBtn) {
        horizonOpenBtn.addEventListener('click', openHorizonModal);
    }

    if (horizonVoiceBtn) {
        horizonVoiceBtn.addEventListener('click', () => {
            if (!voiceRecognition) {
                const fallback = document.createElement('div');
                fallback.className = 'horizon-message horizon-message--agent';
                fallback.innerHTML = '<strong>Horizon</strong><p>Seu navegador não suporta entrada por voz.</p>';
                horizonChat?.appendChild(fallback);
                return;
            }

            openHorizonModal();
            horizonVoiceBtn.classList.add('is-listening');
            horizonVoiceBtn.textContent = 'Ouvindo...';
            voiceRecognition.start();
        });

        if (voiceRecognition) {
            voiceRecognition.addEventListener('result', (event) => {
                const transcript = event.results?.[0]?.[0]?.transcript || '';
                if (horizonInput) {
                    horizonInput.value = transcript;
                    horizonInput.focus();
                }
            });

            const resetVoiceButton = () => {
                if (!horizonVoiceBtn) return;
                horizonVoiceBtn.classList.remove('is-listening');
                horizonVoiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Falar';
            };

            voiceRecognition.addEventListener('end', resetVoiceButton);
            voiceRecognition.addEventListener('error', resetVoiceButton);
        }
    }

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-horizon-open="true"]')) {
            openHorizonModal();
        }
    });

    if (horizonCloseBtn) {
        horizonCloseBtn.addEventListener('click', closeHorizonModal);
    }

    if (horizonModal) {
        horizonModal.addEventListener('click', (event) => {
            if (event.target === horizonModal) {
                closeHorizonModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && horizonModal?.classList.contains('open')) {
            closeHorizonModal();
        }
    });

    const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
        .format(Number.isFinite(value) ? value : 0);

    const getHorizonResponse = (question) => {
        const q = question.toLowerCase();
        const ctx = window.horizonContext || {};
        const cashflow = Number(ctx.cashflowValue || 0);
        const income = Number(ctx.incomeValue || 0);
        const expense = Number(ctx.expenseValue || 0);
        const investment = Number(ctx.investmentValue || 0);
        const balance = Number(ctx.balanceValue || 0);
        const monthLabel = ctx.monthLabel || 'Período atual';
        const topCategory = Array.isArray(ctx.topCategories) && ctx.topCategories[0]
            ? ctx.topCategories[0]
            : null;

        const hasData = income !== 0 || expense !== 0 || investment !== 0 || (ctx.transactionsCount || 0) > 0;
        const sections = [];

        if (!hasData) {
            sections.push({ title: 'Diagnóstico', text: 'Ainda não tenho dados suficientes para analisar sua conta.' });
            sections.push({ title: 'O que está indo bem', text: 'Você já abriu o painel — isso é o primeiro passo certo.' });
            sections.push({ title: 'Pontos de atenção', text: 'Sem entradas e saídas registradas, não consigo medir seu fluxo.' });
            sections.push({ title: 'O que fazer agora', text: 'Registre pelo menos 10 transações recentes para termos um diagnóstico real.' });
            sections.push({ title: 'Próximo passo recomendado', text: 'Me diga sua renda média mensal e seus custos fixos para eu montar um plano.' });
        } else {
            const diagnosticParts = [
                `${monthLabel}: entrada ${formatBRL(income)}, saída ${formatBRL(expense)}, investimentos ${formatBRL(investment)} e fluxo ${formatBRL(cashflow)}.`,
                `Saldo em conta: ${formatBRL(balance)}.`
            ];
            if (topCategory) {
                diagnosticParts.push(`Maior categoria de gasto: ${topCategory.label} (${formatBRL(topCategory.total)}).`);
            }
            sections.push({ title: 'Diagnóstico', text: diagnosticParts.join(' ') });

            const positives = [];
            if (income > 0) positives.push('Há entrada registrada, o que permite planejar com mais clareza.');
            if (cashflow > 0) positives.push('Seu fluxo está positivo, indicando margem financeira.');
            if (investment > 0) positives.push('Você já está investindo, sinal de disciplina.');
            if (!positives.length) positives.push('Você está no início da organização financeira, o que é positivo.');
            sections.push({ title: 'O que está indo bem', text: positives.join(' ') });

            const alerts = [];
            if (cashflow < 0) alerts.push(`A saída supera a entrada em ${formatBRL(Math.abs(cashflow))}.`);
            if (balance < 0) alerts.push(`Saldo em conta negativo (${formatBRL(balance)}).`);
            if (expense > income && income > 0) alerts.push('O padrão de gastos está acima da capacidade de entrada.');
            if (topCategory && expense > 0 && topCategory.total / expense > 0.5) {
                alerts.push(`Alta concentração de gastos em ${topCategory.label}.`);
            }
            if (!alerts.length) alerts.push('Nenhum desequilíbrio crítico identificado neste período.');
            sections.push({ title: 'Pontos de atenção', text: alerts.join(' ') });

            const actions = [];
            if (cashflow < 0) {
                actions.push('Revise gastos recorrentes e defina um teto por categoria.');
                actions.push('Negocie contas fixas com maior peso no mês.');
            } else {
                actions.push('Separe uma parte do fluxo positivo para reserva de emergência.');
                actions.push('Automatize aportes mensais para manter consistência.');
            }
            if (topCategory) {
                actions.push(`Crie um limite específico para ${topCategory.label} já no próximo mês.`);
            }
            sections.push({ title: 'O que fazer agora', text: actions.slice(0, 3).join(' ') });

            const isBusiness = q.includes('cnpj') || q.includes('empresa') || q.includes('negócio') || q.includes('mei');
            if (q.includes('bolsa') || q.includes('ação') || q.includes('acoes')) {
                sections.push({
                    title: 'Próximo passo recomendado',
                    text: cashflow <= 0
                        ? 'Antes de bolsa, estabilize o fluxo e construa reserva. Depois, definimos perfil, prazo e percentual de alocação.'
                        : 'Defina seu perfil e prazo. Comece com uma parcela pequena e diversificada, sem comprometer caixa.'
                });
            } else if (q.includes('renda fixa') || q.includes('tesouro')) {
                sections.push({
                    title: 'Próximo passo recomendado',
                    text: 'Para liquidez, priorize Tesouro Selic. Para metas, avalie CDB/LCI/LCA conforme prazo e imposto.'
                });
            } else if (isBusiness) {
                sections.push({
                    title: 'Próximo passo recomendado',
                    text: 'Mapeie capital de giro, custos fixos e sazonalidade. Separar caixa do sócio é prioridade.'
                });
            } else {
                sections.push({
                    title: 'Próximo passo recomendado',
                    text: 'Me diga sua renda mensal, custos fixos e objetivo principal para montar um plano de 30 dias.'
                });
            }
        }

        return sections
            .map((section) => `<span class="horizon-section-title">${section.title}:</span> ${section.text}`)
            .join('<br>');
    };

    if (horizonForm && horizonInput && horizonChat) {
        horizonForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const text = horizonInput.value.trim();
            if (!text) return;

            const userMessage = document.createElement('div');
            userMessage.className = 'horizon-message horizon-message--user';
            userMessage.innerHTML = `<strong>Você</strong><p>${text}</p>`;
            horizonChat.appendChild(userMessage);

            const agentMessage = document.createElement('div');
            agentMessage.className = 'horizon-message horizon-message--agent';
            agentMessage.innerHTML = `<strong>Horizon</strong><p>${getHorizonResponse(text)}</p>`;
            horizonChat.appendChild(agentMessage);

            horizonChat.scrollTop = horizonChat.scrollHeight;
            horizonInput.value = '';
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


