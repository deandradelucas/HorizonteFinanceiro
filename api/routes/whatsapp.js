const express = require('express');
const repository = require('../services/whatsapp/repository');
const provider = require('../services/whatsapp/provider');
const whatsappService = require('../services/whatsapp/service');

const parseNumber = (value) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

module.exports = ({ authenticate, requireSuperAdmin }) => {
    const router = express.Router();

    router.get('/webhooks/whatsapp', (req, res) => {
        const verification = provider.getWebhookVerificationResponse(req.query);
        if (!verification.ok) {
            return res.status(403).send('Forbidden');
        }

        return res.status(200).send(verification.challenge);
    });

    router.post('/webhooks/whatsapp', async (req, res, next) => {
        try {
            const result = await whatsappService.processWebhookPayload(req.body || {});
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    });

    router.post('/whatsapp/send', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const phone = repository.normalizePhone(req.body?.phone);
            const messageText = String(req.body?.messageText || '').trim();

            if (!isValidWhatsAppPhone(phone)) return res.status(400).json({ error: 'Telefone inválido. Use DDI + DDD + número.' });
            if (!messageText) return res.status(400).json({ error: 'Mensagem é obrigatória.' });

            const outbound = await whatsappService.sendAndLogOutboundMessage({
                user: req.currentUser,
                incomingMessage: null,
                phone,
                messageText
            });

            res.json(outbound);
        } catch (error) {
            next(error);
        }
    });

    router.get('/messages', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const messages = await repository.listMessages({
                userId: req.query.userId ? parseInt(req.query.userId, 10) : null,
                status: req.query.status || null,
                phone: req.query.phone || null,
                from: req.query.from || null,
                to: req.query.to || null,
                search: req.query.search || null,
                limit: req.query.limit || 100
            });
            res.json(messages);
        } catch (error) {
            next(error);
        }
    });

    router.get('/whatsapp/outbound', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const messages = await repository.listOutboundMessages({
                userId: req.query.userId ? parseInt(req.query.userId, 10) : null,
                phone: req.query.phone || null,
                limit: req.query.limit || 20
            });
            res.json(messages);
        } catch (error) {
            next(error);
        }
    });

    router.get('/users/:id/messages', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (!Number.isFinite(userId)) return res.status(400).json({ error: 'UsuÃ¡rio invÃ¡lido.' });
            const messages = await repository.listMessages({ userId, limit: 100 });
            res.json(messages);
        } catch (error) {
            next(error);
        }
    });

    router.get('/users/:id/transactions', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (!Number.isFinite(userId)) return res.status(400).json({ error: 'UsuÃ¡rio invÃ¡lido.' });
            const transactions = await repository.listUserTransactions(userId);
            res.json(transactions);
        } catch (error) {
            next(error);
        }
    });

    router.post('/transactions/manual', authenticate, async (req, res, next) => {
        try {
            const targetUserId = req.currentUser?.role === 'super_admin' && req.body?.userId
                ? parseInt(req.body.userId, 10)
                : parseInt(req.userId, 10);

            if (!Number.isFinite(targetUserId)) return res.status(400).json({ error: 'UsuÃ¡rio invÃ¡lido.' });

            const payload = {
                type: req.body?.type,
                amount: parseNumber(req.body?.amount),
                category: String(req.body?.category || '').trim(),
                description: String(req.body?.description || '').trim(),
                transaction_date: String(req.body?.transaction_date || '').trim(),
                confidence: parseNumber(req.body?.confidence) ?? 1
            };

            if (!['income', 'expense', 'investment'].includes(payload.type)) {
                return res.status(400).json({ error: 'Tipo invÃ¡lido.' });
            }
            if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
                return res.status(400).json({ error: 'Valor invÃ¡lido.' });
            }
            if (!payload.category || !payload.description || !/^\d{4}-\d{2}-\d{2}$/.test(payload.transaction_date)) {
                return res.status(400).json({ error: 'Payload invÃ¡lido.' });
            }

            const transaction = await repository.saveTransactionFromInterpretation({
                userId: targetUserId,
                incomingMessageId: req.body?.originMessageId || null,
                interpretation: payload
            });

            res.status(201).json(transaction);
        } catch (error) {
            next(error);
        }
    });

    router.post('/messages/:id/confirm', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const transaction = await whatsappService.confirmMessage(req.params.id);
            res.json(transaction);
        } catch (error) {
            next(error);
        }
    });

    router.post('/messages/:id/reject', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const result = await whatsappService.rejectMessage(req.params.id);
            res.json(result);
        } catch (error) {
            next(error);
        }
    });

    router.put('/messages/:id/correction', authenticate, requireSuperAdmin, async (req, res, next) => {
        try {
            const payload = {
                type: req.body?.type,
                amount: parseNumber(req.body?.amount),
                category: String(req.body?.category || '').trim(),
                description: String(req.body?.description || '').trim(),
                transaction_date: String(req.body?.transaction_date || '').trim(),
                confidence: parseNumber(req.body?.confidence) ?? 1
            };

            if (!['income', 'expense', 'investment'].includes(payload.type)) {
                return res.status(400).json({ error: 'Tipo invÃ¡lido.' });
            }
            if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
                return res.status(400).json({ error: 'Valor invÃ¡lido.' });
            }
            if (!payload.category || !payload.description || !/^\d{4}-\d{2}-\d{2}$/.test(payload.transaction_date)) {
                return res.status(400).json({ error: 'Payload de correÃ§Ã£o invÃ¡lido.' });
            }

            const result = await whatsappService.correctMessage(req.params.id, payload);
            res.json(result);
        } catch (error) {
            next(error);
        }
    });

    return router;
};

