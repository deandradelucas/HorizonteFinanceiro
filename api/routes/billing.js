const express = require('express');
const db = require('../db');
const asaas = require('../services/billing/asaas');

const supabase = db.supabase;

const requireSupabase = () => {
    if (!supabase) throw new Error('Supabase client not initialized.');
    return supabase;
};

const safeNumber = (value, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');
const todayPlusDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
};

module.exports = ({ authenticate, getUserById }) => {
    const router = express.Router();

    const loadPlan = async (code = 'pro_monthly') => {
        const client = requireSupabase();
        const { data, error } = await client
            .from('subscription_plans')
            .select('*')
            .eq('code', code)
            .eq('active', true)
            .maybeSingle();
        if (error) throw error;
        return data;
    };

    const upsertBillingSubscription = async (payload) => {
        const client = requireSupabase();
        const { data: existing, error: existingError } = await client
            .from('billing_subscriptions')
            .select('*')
            .eq('user_id', payload.user_id)
            .eq('provider', payload.provider)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
            const { data, error } = await client
                .from('billing_subscriptions')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }

        const { data, error } = await client
            .from('billing_subscriptions')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    };

    const upsertBillingPayment = async (payload) => {
        const client = requireSupabase();
        const { data: existing, error: existingError } = await client
            .from('billing_payments')
            .select('*')
            .eq('provider_payment_id', payload.provider_payment_id)
            .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
            const { data, error } = await client
                .from('billing_payments')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select('*')
                .single();
            if (error) throw error;
            return data;
        }

        const { data, error } = await client
            .from('billing_payments')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    };

    const syncUserBilling = async (userId, patch) => {
        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select('id, role, billing_exempt, subscription_status, subscription_plan_code, subscription_payment_method, subscription_next_due_date, billing_provider, asaas_customer_id, subscription_id, phone, email, name')
            .single();
        if (error) throw error;
        return data;
    };

    const logBillingEvent = async (payload) => {
        const client = requireSupabase();
        const { data, error } = await client
            .from('billing_events')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return data;
    };

    const getBillingSnapshot = async (userId) => {
        const client = requireSupabase();
        const user = await getUserById(userId);
        if (!user) return null;

        const [planResult, subscriptionResult, paymentsResult] = await Promise.all([
            client.from('subscription_plans').select('*').eq('active', true).order('amount', { ascending: true }),
            client.from('billing_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            client.from('billing_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
        ]);

        if (planResult.error) throw planResult.error;
        if (subscriptionResult.error) throw subscriptionResult.error;
        if (paymentsResult.error) throw paymentsResult.error;

        const exempt = user.role === 'super_admin' || user.billing_exempt === true;
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone || null,
                role: user.role,
                billing_exempt: exempt,
                subscription_status: exempt ? 'active' : (user.subscription_status || 'inactive'),
                subscription_plan_code: exempt ? 'super_admin_free' : (user.subscription_plan_code || null),
                subscription_payment_method: user.subscription_payment_method || null,
                subscription_next_due_date: user.subscription_next_due_date || null
            },
            plans: planResult.data || [],
            subscription: subscriptionResult.data || null,
            payments: paymentsResult.data || []
        };
    };

    router.get('/billing/plans', async (req, res, next) => {
        try {
            const client = requireSupabase();
            const { data, error } = await client.from('subscription_plans').select('*').eq('active', true);
            if (error) throw error;
            res.json(data || []);
        } catch (error) {
            next(error);
        }
    });

    router.get('/billing/me', authenticate, async (req, res, next) => {
        try {
            const snapshot = await getBillingSnapshot(parseInt(req.userId, 10));
            res.json(snapshot);
        } catch (error) {
            next(error);
        }
    });

    router.post('/billing/subscribe', authenticate, async (req, res, next) => {
        try {
            const user = await getUserById(req.userId);
            if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
            if (user.role === 'super_admin') {
                await syncUserBilling(user.id, {
                    billing_exempt: true,
                    billing_provider: 'internal',
                    subscription_status: 'active',
                    subscription_plan_code: 'super_admin_free',
                    subscription_payment_method: 'free'
                });
                return res.json({ mode: 'free', message: 'Super admin liberado gratuitamente.' });
            }

            const plan = await loadPlan(String(req.body?.planCode || 'pro_monthly'));
            if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

            const method = req.body?.paymentMethod === 'credit_card' ? 'credit_card' : 'pix';
            const phone = normalizePhone(req.body?.phone || user.phone);
            if (!phone || phone.length < 10) {
                return res.status(400).json({ error: 'Informe um telefone válido para cobrança.' });
            }

            const customer = await asaas.createOrUpdateCustomer({
                customerId: user.asaas_customer_id || null,
                name: user.name || user.email,
                email: user.email,
                phone,
                externalReference: user.id
            });

            let result;
            if (method === 'credit_card') {
                result = await asaas.createCardCheckout({
                    customer: customer.id,
                    value: safeNumber(plan.amount),
                    name: plan.name,
                    description: plan.description || plan.name,
                    successUrl: `${req.protocol}://${req.get('host')}/billing`
                });
            } else {
                const subscription = await asaas.createPixSubscription({
                    customer: customer.id,
                    value: safeNumber(plan.amount),
                    description: plan.description || plan.name,
                    externalReference: `${user.id}:${plan.code}`,
                    nextDueDate: todayPlusDays(1)
                });

                const payments = await asaas.listSubscriptionPayments(subscription.id);
                const payment = payments?.data?.[0] || null;
                const pixQr = payment ? await asaas.getPaymentPixQrCode(payment.id).catch(() => null) : null;

                result = {
                    mode: 'pix',
                    subscription,
                    payment,
                    pixQrCode: pixQr
                };
            }

            const persistedSubscription = await upsertBillingSubscription({
                user_id: user.id,
                provider: 'asaas',
                provider_customer_id: customer.id,
                provider_subscription_id: result.subscription?.id || null,
                plan_code: plan.code,
                status: method === 'credit_card' ? 'checkout_pending' : (result.subscription?.status || 'pending'),
                payment_method: method,
                checkout_url: result.id ? (result.url || result.checkoutUrl || null) : (result.checkoutUrl || null),
                invoice_url: result.payment?.invoiceUrl || result.subscription?.invoiceUrl || null,
                pix_payload: result.pixQrCode?.payload || result.pixQrCode?.encodedImage || null,
                pix_encoded_image: result.pixQrCode?.encodedImage || null,
                next_due_date: result.subscription?.nextDueDate || null,
                last_payment_id: result.payment?.id || null,
                metadata: result
            });

            if (result.payment?.id) {
                await upsertBillingPayment({
                    user_id: user.id,
                    billing_subscription_id: persistedSubscription.id,
                    provider: 'asaas',
                    provider_payment_id: result.payment.id,
                    provider_subscription_id: result.subscription?.id || null,
                    status: result.payment.status || 'PENDING',
                    amount: safeNumber(result.payment.value || plan.amount),
                    billing_type: result.payment.billingType || 'PIX',
                    due_date: result.payment.dueDate || null,
                    invoice_url: result.payment.invoiceUrl || null,
                    pix_payload: result.pixQrCode?.payload || null,
                    pix_encoded_image: result.pixQrCode?.encodedImage || null,
                    raw_payload: result.payment
                });
            }

            await syncUserBilling(user.id, {
                phone,
                billing_provider: 'asaas',
                asaas_customer_id: customer.id,
                subscription_status: method === 'credit_card' ? 'checkout_pending' : 'pending',
                subscription_plan_code: plan.code,
                subscription_payment_method: method,
                subscription_id: result.subscription?.id || null,
                subscription_next_due_date: result.subscription?.nextDueDate || null
            });

            res.status(201).json({
                mode: method,
                plan,
                checkoutUrl: result.url || result.checkoutUrl || null,
                invoiceUrl: result.payment?.invoiceUrl || null,
                pixQrCode: result.pixQrCode || null,
                subscriptionId: result.subscription?.id || null,
                paymentId: result.payment?.id || null
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/billing/cancel', authenticate, async (req, res, next) => {
        try {
            const client = requireSupabase();
            const { data: subscription, error } = await client
                .from('billing_subscriptions')
                .select('*')
                .eq('user_id', req.userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada.' });

            if (subscription.provider === 'asaas' && subscription.provider_subscription_id) {
                await asaas.cancelSubscription(subscription.provider_subscription_id);
            }

            await client.from('billing_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscription.id);
            await syncUserBilling(req.userId, { subscription_status: 'cancelled' });
            res.json({ message: 'Assinatura cancelada.' });
        } catch (error) {
            next(error);
        }
    });

    router.post('/webhooks/asaas', async (req, res, next) => {
        try {
            const client = requireSupabase();
            const expectedWebhookToken = String(process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
            const receivedWebhookToken = String(req.headers['asaas-access-token'] || '');
            if (expectedWebhookToken && expectedWebhookToken !== receivedWebhookToken) {
                return res.status(401).json({ error: 'Webhook Asaas não autorizado.' });
            }

            const eventType = String(req.body?.event || 'UNKNOWN');
            const payment = req.body?.payment || null;
            const subscription = req.body?.subscription || null;
            const providerEventId = `${eventType}:${payment?.id || subscription?.id || Date.now()}`;

            const existing = await client.from('billing_events').select('id').eq('provider_event_id', providerEventId).maybeSingle();
            if (existing.error) throw existing.error;
            if (existing.data) return res.json({ ok: true, duplicate: true });

            const userReference = payment?.customer || subscription?.customer || null;
            const { data: users, error: usersError } = await client
                .from('users')
                .select('id, asaas_customer_id, role')
                .not('asaas_customer_id', 'is', null);
            if (usersError) throw usersError;

            const matchedUser = (users || []).find((item) => item.asaas_customer_id === userReference) || null;
            const userId = matchedUser?.id || null;

            await logBillingEvent({
                provider: 'asaas',
                provider_event_id: providerEventId,
                event_type: eventType,
                user_id: userId,
                provider_subscription_id: payment?.subscription || subscription?.id || null,
                provider_payment_id: payment?.id || null,
                payload: req.body,
                processed: false
            });

            if (userId && payment?.id) {
                await upsertBillingPayment({
                    user_id: userId,
                    provider: 'asaas',
                    provider_payment_id: payment.id,
                    provider_subscription_id: payment.subscription || null,
                    status: payment.status || 'PENDING',
                    amount: safeNumber(payment.value),
                    billing_type: payment.billingType || null,
                    due_date: payment.dueDate || null,
                    paid_at: payment.clientPaymentDate || payment.paymentDate || null,
                    invoice_url: payment.invoiceUrl || null,
                    raw_payload: payment
                });
            }

            if (userId) {
                const patch = {
                    billing_provider: 'asaas',
                    billing_last_event_at: new Date().toISOString()
                };

                if (/PAYMENT_CONFIRMED|PAYMENT_RECEIVED|PAYMENT_UPDATED/.test(eventType) && /(RECEIVED|CONFIRMED|RECEIVED_IN_CASH)/.test(String(payment?.status || ''))) {
                    patch.subscription_status = 'active';
                    patch.billing_last_payment_at = new Date().toISOString();
                    patch.subscription_next_due_date = payment?.dueDate || null;
                } else if (/PAYMENT_OVERDUE|PAYMENT_DELETED/.test(eventType) || /OVERDUE|REFUNDED|CHARGEBACK/.test(String(payment?.status || ''))) {
                    patch.subscription_status = 'past_due';
                } else if (/SUBSCRIPTION_DELETED/.test(eventType)) {
                    patch.subscription_status = 'cancelled';
                }

                if (subscription?.id) patch.subscription_id = subscription.id;
                if (payment?.subscription) patch.subscription_id = payment.subscription;

                await syncUserBilling(userId, patch);
            }

            await client.from('billing_events').update({ processed: true }).eq('provider_event_id', providerEventId);
            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
};
