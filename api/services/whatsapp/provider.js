const META_API_URL = 'https://graph.facebook.com/v22.0';
const WASCRIPT_API_URL = (process.env.WASCRIPT_API_URL || process.env.WHATSSCALE_API_URL || 'https://api-whatsapp.wascript.com.br').replace(/\/+$/, '');

const getWascriptToken = () => (
    process.env.WASCRIPT_API_TOKEN ||
    process.env.WHATSSCALE_API_KEY ||
    process.env.WHATSSCALE_TOKEN ||
    ''
).trim();

const hasMetaConfig = () => Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
);

const hasWascriptConfig = () => Boolean(getWascriptToken());

const hasWhatsAppProviderConfig = () => hasWascriptConfig() || hasMetaConfig();

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');

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

    if (events.length > 0) {
        return events;
    }

    const candidateText = [
        payload?.message?.text,
        payload?.message?.body,
        payload?.messageText,
        payload?.text,
        payload?.body,
        payload?.mensagem,
        payload?.conteudo,
        payload?.content,
        payload?.eventData?.message,
        payload?.eventData?.text,
        payload?.dadosDoEvento?.mensagem,
        payload?.dadosDoEvento?.texto
    ].find((value) => typeof value === 'string' && value.trim());

    const candidatePhone = [
        payload?.phone,
        payload?.numero,
        payload?.number,
        payload?.from,
        payload?.contact?.phone,
        payload?.contact?.number,
        payload?.perfilContato?.numero,
        payload?.dadosDoEvento?.numero,
        payload?.eventData?.phone,
        payload?.eventData?.number
    ].find((value) => value);

    const candidateProviderId = [
        payload?.providerMessageId,
        payload?.messageId,
        payload?.message_id,
        payload?.id,
        payload?.eventId,
        payload?.event_id,
        payload?.dadosDoEvento?.id,
        payload?.eventData?.id
    ].find((value) => value);

    const candidateName = [
        payload?.name,
        payload?.nome,
        payload?.contact?.name,
        payload?.perfilContato?.nome,
        payload?.eventData?.name
    ].find((value) => typeof value === 'string' && value.trim());

    if (candidatePhone || candidateText) {
        events.push({
            providerMessageId: candidateProviderId ? String(candidateProviderId) : null,
            phone: candidatePhone ? String(candidatePhone) : null,
            contactName: candidateName ? String(candidateName) : null,
            timestamp: payload?.timestamp || payload?.created_at || payload?.data || new Date().toISOString(),
            type: candidateText ? 'text' : String(payload?.type || payload?.event || 'unknown'),
            text: candidateText ? String(candidateText).trim() : '',
            rawMessage: payload,
            rawPayload: payload
        });
    }

    return events;
};

const sendViaWascript = async ({ phone, messageText }) => {
    const response = await fetch(`${WASCRIPT_API_URL}/api/enviar-texto/${encodeURIComponent(getWascriptToken())}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            phone: normalizePhone(phone),
            message: messageText
        })
    });

    const rawPayload = await response.json().catch(() => ({}));
    if (!response.ok || rawPayload?.success === false) {
        const error = new Error(rawPayload?.message || 'Wascript send failed.');
        error.status = response.status;
        error.payload = rawPayload;
        throw error;
    }

    return {
        delivery_status: 'sent',
        provider_message_id: rawPayload?.messageId || rawPayload?.id || rawPayload?.data?.id || null,
        raw_payload: rawPayload
    };
};

const sendViaMeta = async ({ phone, messageText }) => {
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

const sendWhatsAppMessage = async ({ phone, messageText }) => {
    if (!hasWhatsAppProviderConfig()) {
        return {
            delivery_status: 'skipped',
            provider_message_id: null,
            raw_payload: { reason: 'missing_whatsapp_env' }
        };
    }

    if (hasWascriptConfig()) {
        return sendViaWascript({ phone, messageText });
    }

    return sendViaMeta({ phone, messageText });
};

module.exports = {
    hasWhatsAppProviderConfig,
    getWebhookVerificationResponse,
    extractMessagesFromPayload,
    sendWhatsAppMessage
};
