const { interpretWithRules } = require('./parser');
const { interpretWithAI } = require('./ai');
const { executeFinancialQuery, formatCurrency } = require('./queries');
const provider = require('./provider');
const repository = require('./repository');

const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.6;
const confirmationPattern = /^(sim|confirmar|ok|pode lançar|pode lancar|confirmado)$/i;
const rejectionPattern = /^(nao|não|cancelar|corrigir|errado)$/i;

const formatRecordedMessage = (interpretation) => {
    const label = interpretation.type === 'income'
        ? 'Receita'
        : interpretation.type === 'investment'
            ? 'Investimento'
            : 'Despesa';

    return `${label} de ${formatCurrency(interpretation.amount)} registrada em ${interpretation.category || 'outros'}.`;
};

const formatConfirmationMessage = (interpretation) => {
    const label = interpretation.type === 'income'
        ? 'uma receita'
        : interpretation.type === 'investment'
            ? 'um investimento'
            : 'uma despesa';

    return `Entendi ${label} de ${formatCurrency(interpretation.amount)} em ${interpretation.category || 'outros'} para ${interpretation.transaction_date}. Responda SIM para confirmar ou NÃO para cancelar.`;
};

const sendAndLogOutboundMessage = async ({ user, incomingMessage, phone, messageText }) => {
    let providerResult;
    try {
        providerResult = await provider.sendWhatsAppMessage({ phone, messageText });
    } catch (error) {
        providerResult = {
            delivery_status: 'failed',
            provider_message_id: null,
            raw_payload: error.payload || { message: error.message }
        };

        await repository.logIntegrationEvent({
            context: 'whatsapp_send',
            level: 'error',
            message: error.message,
            payload: { phone, incoming_message_id: incomingMessage?.id || null, provider_payload: error.payload || null }
        });
    }

    await repository.createOutboundMessage({
        user_id: user?.id || null,
        incoming_message_id: incomingMessage?.id || null,
        phone,
        message_text: messageText,
        provider_message_id: providerResult.provider_message_id,
        delivery_status: providerResult.delivery_status,
        raw_payload: providerResult.raw_payload
    });

    return providerResult;
};

const buildInterpretation = async (messageText) => {
    const ruleResult = interpretWithRules(messageText);
    if (ruleResult.type === 'query') return ruleResult;
    if (ruleResult.confidence >= HIGH_CONFIDENCE) return ruleResult;

    try {
        const aiResult = await interpretWithAI(messageText);
        if (aiResult && (aiResult.confidence || 0) >= (ruleResult.confidence || 0)) {
            return aiResult;
        }
    } catch (error) {
        await repository.logIntegrationEvent({
            context: 'whatsapp_ai',
            level: 'error',
            message: error.message,
            payload: { message_text: messageText }
        });
    }

    return ruleResult;
};

const handlePendingConfirmationReply = async ({ user, incomingMessage, messageText }) => {
    const pending = await repository.getLatestPendingInterpretationByUser(user.id);
    if (!pending) return null;

    if (confirmationPattern.test(messageText)) {
        const transaction = await repository.saveTransactionFromInterpretation({
            userId: user.id,
            incomingMessageId: pending.incoming.id,
            interpretation: pending.interpretation
        });

        await repository.updateInterpretation(pending.interpretation.id, { decision_status: 'confirmed' });
        await repository.updateIncomingMessage(pending.incoming.id, { processing_status: 'processed' });
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'processed' });

        await sendAndLogOutboundMessage({
            user,
            incomingMessage,
            phone: incomingMessage.phone,
            messageText: `Confirmação recebida. ${formatRecordedMessage({
                type: pending.interpretation.detected_type,
                amount: pending.interpretation.detected_amount,
                category: pending.interpretation.detected_category
            })}`
        });

        return { action: 'confirmed', transaction };
    }

    if (rejectionPattern.test(messageText)) {
        await repository.updateInterpretation(pending.interpretation.id, { decision_status: 'rejected' });
        await repository.updateIncomingMessage(pending.incoming.id, { processing_status: 'rejected' });
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'processed' });

        await sendAndLogOutboundMessage({
            user,
            incomingMessage,
            phone: incomingMessage.phone,
            messageText: 'Entendido. Não registrei a movimentação. Pode me reenviar a mensagem com mais detalhes.'
        });

        return { action: 'rejected' };
    }

    return null;
};

const finalizeTransaction = async ({ user, incomingMessage, interpretation }) => {
    const transaction = await repository.saveTransactionFromInterpretation({
        userId: user.id,
        incomingMessageId: incomingMessage.id,
        interpretation
    });

    await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'processed' });
    await repository.updateInterpretation(interpretation.id, { decision_status: 'auto_recorded' });

    await sendAndLogOutboundMessage({
        user,
        incomingMessage,
        phone: incomingMessage.phone,
        messageText: formatRecordedMessage({
            type: interpretation.detected_type || interpretation.type,
            amount: interpretation.detected_amount ?? interpretation.amount,
            category: interpretation.detected_category || interpretation.category
        })
    });

    return { action: 'recorded', incomingMessageId: incomingMessage.id, transaction };
};

const processSingleIncomingMessage = async (event) => {
    const phone = repository.normalizePhone(event.phone);
    if (!phone) {
        await repository.logIntegrationEvent({
            context: 'whatsapp_webhook',
            level: 'warn',
            message: 'Mensagem sem telefone válido.',
            payload: event
        });
        return { status: 'ignored', reason: 'invalid_phone' };
    }

    const existing = await repository.getIncomingMessageByProviderId(event.providerMessageId);
    if (existing) {
        return { status: 'duplicate', incomingMessageId: existing.id };
    }

    const user = await repository.findUserByPhone(phone);
    const incomingMessage = await repository.createIncomingMessage({
        user_id: user?.id || null,
        phone,
        provider_message_id: event.providerMessageId,
        message_text: event.text,
        raw_payload: event.rawPayload,
        source: 'whatsapp',
        processing_status: 'received'
    });

    if (!user || user.is_active === false) {
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'unmatched_user' });
        await sendAndLogOutboundMessage({
            user: null,
            incomingMessage,
            phone,
            messageText: 'Não encontrei seu cadastro por este número. Atualize seu telefone no sistema para continuar.'
        });
        return { status: 'unmatched_user', incomingMessageId: incomingMessage.id };
    }

    if (event.type !== 'text') {
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'unsupported_message' });
        await sendAndLogOutboundMessage({
            user,
            incomingMessage,
            phone,
            messageText: 'Por enquanto eu entendo apenas mensagens de texto.'
        });
        return { status: 'unsupported_message', incomingMessageId: incomingMessage.id };
    }

    const confirmationReply = await handlePendingConfirmationReply({
        user,
        incomingMessage,
        messageText: event.text.trim()
    });
    if (confirmationReply) {
        return { status: confirmationReply.action, incomingMessageId: incomingMessage.id };
    }

    const interpretation = await buildInterpretation(event.text);
    const interpretationRecord = await repository.saveInterpretation(incomingMessage.id, {
        ...interpretation,
        decision_status: 'pending'
    });

    if (interpretation.type === 'query') {
        const answer = await executeFinancialQuery({
            userId: user.id,
            metric: interpretation.metric,
            period: interpretation.period,
            category: interpretation.category
        });

        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'processed' });
        await repository.updateInterpretation(interpretationRecord.id, { decision_status: 'answered' });
        await sendAndLogOutboundMessage({ user, incomingMessage, phone, messageText: answer });
        return { status: 'answered', incomingMessageId: incomingMessage.id };
    }

    if (!interpretation.amount || interpretation.type === 'unknown') {
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'needs_reformulation' });
        await repository.updateInterpretation(interpretationRecord.id, { decision_status: 'needs_reformulation' });
        await sendAndLogOutboundMessage({
            user,
            incomingMessage,
            phone,
            messageText: 'Não consegui entender bem essa mensagem. Tente algo como "gastei 50 com uber" ou "recebi 1200 do cliente João".'
        });
        return { status: 'needs_reformulation', incomingMessageId: incomingMessage.id };
    }

    if ((interpretation.confidence || 0) >= HIGH_CONFIDENCE) {
        return finalizeTransaction({ user, incomingMessage, interpretation: { ...interpretationRecord, ...interpretation } });
    }

    if ((interpretation.confidence || 0) >= MEDIUM_CONFIDENCE) {
        await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'pending_confirmation' });
        await repository.updateInterpretation(interpretationRecord.id, { decision_status: 'pending_confirmation' });
        await sendAndLogOutboundMessage({
            user,
            incomingMessage,
            phone,
            messageText: formatConfirmationMessage(interpretation)
        });
        return { status: 'pending_confirmation', incomingMessageId: incomingMessage.id };
    }

    await repository.updateIncomingMessage(incomingMessage.id, { processing_status: 'needs_reformulation' });
    await repository.updateInterpretation(interpretationRecord.id, { decision_status: 'needs_reformulation' });
    await sendAndLogOutboundMessage({
        user,
        incomingMessage,
        phone,
        messageText: 'Sua mensagem ficou ambígua. Pode reenviar separando valor, categoria e data?'
    });
    return { status: 'needs_reformulation', incomingMessageId: incomingMessage.id };
};

const processWebhookPayload = async (payload) => {
    const events = provider.extractMessagesFromPayload(payload);
    const results = [];

    for (const event of events) {
        try {
            results.push(await processSingleIncomingMessage(event));
        } catch (error) {
            await repository.logIntegrationEvent({
                context: 'whatsapp_webhook',
                level: 'error',
                message: error.message,
                payload: { event, stack: error.stack }
            });
            results.push({ status: 'error', error: error.message });
        }
    }

    return { received: events.length, processed: results };
};

const confirmMessage = async (messageId) => {
    const details = await repository.getMessageDetails(messageId);
    if (!details || !details.user || !details.interpretation) {
        throw new Error('Mensagem pendente não encontrada.');
    }

    const existingTransaction = await repository.getTransactionByMessageId(messageId);
    if (existingTransaction) return existingTransaction;

    const transaction = await repository.saveTransactionFromInterpretation({
        userId: details.user.id,
        incomingMessageId: details.id,
        interpretation: {
            detected_type: details.interpretation.detected_type,
            detected_amount: details.interpretation.detected_amount,
            detected_category: details.interpretation.detected_category,
            detected_description: details.interpretation.detected_description,
            detected_date: details.interpretation.detected_date,
            confidence: details.interpretation.confidence
        }
    });

    await repository.updateIncomingMessage(details.id, { processing_status: 'processed' });
    await repository.updateInterpretation(details.interpretation.id, { decision_status: 'confirmed' });
    return transaction;
};

const rejectMessage = async (messageId) => {
    const details = await repository.getMessageDetails(messageId);
    if (!details || !details.interpretation) {
        throw new Error('Mensagem não encontrada.');
    }

    await repository.updateIncomingMessage(details.id, { processing_status: 'rejected' });
    await repository.updateInterpretation(details.interpretation.id, { decision_status: 'rejected' });
    return { ok: true };
};

const correctMessage = async (messageId, payload) => {
    const details = await repository.getMessageDetails(messageId);
    if (!details || !details.user || !details.interpretation) {
        throw new Error('Mensagem não encontrada.');
    }

    const updatedInterpretation = await repository.updateInterpretation(details.interpretation.id, {
        detected_type: payload.type,
        detected_amount: payload.amount,
        detected_category: payload.category,
        detected_description: payload.description,
        detected_date: payload.transaction_date,
        confidence: payload.confidence ?? 1,
        decision_status: 'corrected'
    });

    const existingTransaction = await repository.getTransactionByMessageId(messageId);
    let transaction;
    if (existingTransaction) {
        transaction = await repository.updateTransactionByMessage(messageId, {
            type: payload.type,
            value: payload.amount,
            category: payload.category,
            description: payload.description,
            date: payload.transaction_date,
            confidence: payload.confidence ?? 1
        });
    } else {
        transaction = await repository.saveTransactionFromInterpretation({
            userId: details.user.id,
            incomingMessageId: details.id,
            interpretation: updatedInterpretation
        });
    }

    await repository.updateIncomingMessage(details.id, { processing_status: 'processed' });
    return { interpretation: updatedInterpretation, transaction };
};

module.exports = {
    processWebhookPayload,
    sendAndLogOutboundMessage,
    confirmMessage,
    rejectMessage,
    correctMessage
};
