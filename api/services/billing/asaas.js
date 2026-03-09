const API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

const requireAsaasKey = () => {
    const apiKey = String(process.env.ASAAS_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('Asaas API key not configured.');
    }
    return apiKey;
};

const asaasRequest = async (pathname, { method = 'GET', body } = {}) => {
    const apiKey = requireAsaasKey();
    const response = await fetch(`${API_URL}${pathname}`, {
        method,
        headers: {
            access_token: apiKey,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.errors?.[0]?.description || payload?.message || 'Asaas request failed.');
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
};

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');
const formatDate = (value) => new Date(value).toISOString().slice(0, 10);

const createOrUpdateCustomer = async ({ customerId, name, email, phone, externalReference }) => {
    const payload = {
        name,
        email,
        mobilePhone: normalizePhone(phone),
        externalReference: String(externalReference)
    };

    if (customerId) {
        return asaasRequest(`/customers/${customerId}`, { method: 'POST', body: payload });
    }

    return asaasRequest('/customers', { method: 'POST', body: payload });
};

const createPixSubscription = async ({ customer, value, description, externalReference, nextDueDate }) => {
    return asaasRequest('/subscriptions', {
        method: 'POST',
        body: {
            customer,
            billingType: 'PIX',
            cycle: 'MONTHLY',
            value,
            nextDueDate,
            description,
            externalReference
        }
    });
};

const createCardCheckout = async ({ customer, value, name, description, successUrl }) => {
    return asaasRequest('/checkouts', {
        method: 'POST',
        body: {
            name,
            description,
            billingTypes: ['CREDIT_CARD'],
            chargeTypes: ['RECURRENT'],
            callback: {
                successUrl,
                autoRedirect: true
            },
            subscription: {
                cycle: 'MONTHLY',
                nextDueDate: formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
            },
            items: [
                {
                    name,
                    value,
                    quantity: 1
                }
            ],
            customer
        }
    });
};

const listSubscriptionPayments = async (subscriptionId) => {
    return asaasRequest(`/payments?subscription=${subscriptionId}`);
};

const getPayment = async (paymentId) => {
    return asaasRequest(`/payments/${paymentId}`);
};

const getPaymentPixQrCode = async (paymentId) => {
    return asaasRequest(`/payments/${paymentId}/pixQrCode`);
};

const cancelSubscription = async (subscriptionId) => {
    return asaasRequest(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
};

module.exports = {
    createOrUpdateCustomer,
    createPixSubscription,
    createCardCheckout,
    listSubscriptionPayments,
    getPayment,
    getPaymentPixQrCode,
    cancelSubscription
};
