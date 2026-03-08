const META_API_URL = 'https://graph.facebook.com/v22.0';

const hasWhatsAppProviderConfig = () => {
    return Boolean(
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_VERIFY_TOKEN
    );
};

const getWebhookVerificationResponse = (query) => {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return { ok: true, challenge };
    }

    return { ok: false };
};

const extractMessagesFromPayload = (payload = {}) => {
    const events = [];

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value || {};
            const messages = value.messages || [];
            const contacts = value.contacts || [];

            for (const message of messages) {
                const contact = contacts.find((item) => item.wa_id === message.from) || contacts[0] || null;
                events.push({
                    providerMessageId: message.id || null,
                    phone: message.from || null,
                    contactName: contact?.profile?.name || null,
                    timestamp: message.timestamp || null,
                    type: message.type || 'text',
                    text: message.text?.body || '',
                    rawMessage: message,
                    rawPayload: payload
                });
            }
        }
    }

    return events;
};

const sendWhatsAppMessage = async ({ phone, messageText }) => {
    if (!hasWhatsAppProviderConfig()) {
        return {
            delivery_status: 'skipped',
            provider_message_id: null,
            raw_payload: { reason: 'missing_whatsapp_env' }
        };
    }

    const response = await fetch(`${META_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: messageText }
        })
    });

    const rawPayload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(rawPayload?.error?.message || 'WhatsApp provider send failed.');
        error.status = response.status;
        error.payload = rawPayload;
        throw error;
    }

    return {
        delivery_status: 'sent',
        provider_message_id: rawPayload?.messages?.[0]?.id || null,
        raw_payload: rawPayload
    };
};

module.exports = {
    hasWhatsAppProviderConfig,
    getWebhookVerificationResponse,
    extractMessagesFromPayload,
    sendWhatsAppMessage
};
