const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE || 'Users';

function nowIso() {
    return new Date().toISOString();
}

function normalizeStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value === 'ACTIVE') return 'ACTIVE';
    return 'INACTIVE';
}

async function findUserByEmail(email) {
    if (!email) return null;

    const result = await dynamodb.scan({
        TableName: USERS_TABLE,
        FilterExpression: '#email = :email',
        ExpressionAttributeNames: { '#email': 'email' },
        ExpressionAttributeValues: { ':email': email }
    }).promise();

    const items = result.Items || [];
    if (items.length === 0) return null;

    const scoreItem = (item) => {
        let score = 0;
        const id = String(item.id || '');
        if (id && !id.startsWith('paypal#')) score += 50;
        if (item.subscriptionStatus === 'ACTIVE' || item.isSubscribed === true) score += 20;
        if (item.subscriptionId) score += 10;
        if (item.subscriptionPlanId) score += 5;
        if (item.subscriptionUpdatedAt) score += 2;
        return score;
    };

    const sorted = [...items].sort((a, b) => {
        const scoreDiff = scoreItem(b) - scoreItem(a);
        if (scoreDiff !== 0) return scoreDiff;

        const aTime = Date.parse(a.subscriptionUpdatedAt || a.updatedAt || a.createdAt || 0) || 0;
        const bTime = Date.parse(b.subscriptionUpdatedAt || b.updatedAt || b.createdAt || 0) || 0;
        return bTime - aTime;
    });

    return sorted[0] || null;
}

async function findUserBySubscriptionId(subscriptionId) {
    if (!subscriptionId) return null;

    const result = await dynamodb.scan({
        TableName: USERS_TABLE,
        FilterExpression: 'subscriptionId = :subscriptionId',
        ExpressionAttributeValues: { ':subscriptionId': subscriptionId },
        Limit: 1
    }).promise();

    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

async function upsertSubscription({
    email,
    userId,
    subscriptionId,
    planId,
    status,
    nextBillingTime,
    lastPaymentTime,
    lastPaymentAmount,
    lastPaymentCurrency,
    source
}) {
    const normalizedStatus = normalizeStatus(status);
    let targetUserId = userId;

    if (!targetUserId && email) {
        const existing = await findUserByEmail(email);
        if (existing && existing.id) {
            targetUserId = existing.id;
        }
    }

    if (!targetUserId && subscriptionId) {
        const existingBySub = await findUserBySubscriptionId(subscriptionId);
        if (existingBySub && existingBySub.id) {
            targetUserId = existingBySub.id;
            if (!email && existingBySub.email) {
                email = existingBySub.email;
            }
        }
    }

    // Fallback record in Users table when user row doesn't exist yet.
    if (!targetUserId && email) {
        targetUserId = `paypal#${email.toLowerCase()}`;
    }

    if (!targetUserId && subscriptionId) {
        targetUserId = `paypal#sub#${subscriptionId}`;
    }

    if (!targetUserId) {
        throw new Error('Unable to resolve user for subscription persistence');
    }

    const params = {
        TableName: USERS_TABLE,
        Key: { id: targetUserId },
        UpdateExpression: [
            'SET email = if_not_exists(email, :email)',
            'subscriptionId = :subscriptionId',
            'subscriptionPlanId = :planId',
            'subscriptionStatus = :status',
            'isSubscribed = :isSubscribed',
            'subscriptionNextBillingTime = :nextBillingTime',
            'subscriptionLastPaymentTime = :lastPaymentTime',
            'subscriptionLastPaymentAmount = :lastPaymentAmount',
            'subscriptionLastPaymentCurrency = :lastPaymentCurrency',
            'subscriptionSource = :source',
            'subscriptionUpdatedAt = :updatedAt'
        ].join(', '),
        ExpressionAttributeValues: {
            ':email': email || 'unknown@funstudy.local',
            ':subscriptionId': subscriptionId || null,
            ':planId': planId || null,
            ':status': normalizedStatus,
            ':isSubscribed': normalizedStatus === 'ACTIVE',
            ':nextBillingTime': nextBillingTime || null,
            ':lastPaymentTime': lastPaymentTime || null,
            ':lastPaymentAmount': lastPaymentAmount || null,
            ':lastPaymentCurrency': lastPaymentCurrency || null,
            ':source': source || 'paypal',
            ':updatedAt': nowIso()
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    return result.Attributes;
}

async function addPaymentRecord({
    email,
    userId,
    subscriptionId,
    amount,
    currency,
    paidAt,
    transactionId,
    status,
    source
}) {
    let targetUserId = userId;

    if (!targetUserId && email) {
        const existing = await findUserByEmail(email);
        if (existing && existing.id) targetUserId = existing.id;
    }

    if (!targetUserId && subscriptionId) {
        const existingBySub = await findUserBySubscriptionId(subscriptionId);
        if (existingBySub && existingBySub.id) targetUserId = existingBySub.id;
    }

    if (!targetUserId) {
        if (!email) {
            return null;
        }
        targetUserId = `paypal#${email.toLowerCase()}`;
    }

    const payment = {
        paymentId: transactionId || `txn_${Date.now()}`,
        subscriptionId: subscriptionId || null,
        amount: amount || null,
        currency: currency || null,
        status: status || 'COMPLETED',
        paidAt: paidAt || nowIso(),
        source: source || 'paypal'
    };

    const params = {
        TableName: USERS_TABLE,
        Key: { id: targetUserId },
        UpdateExpression: [
            'SET email = if_not_exists(email, :email)',
            'subscriptionPayments = list_append(if_not_exists(subscriptionPayments, :emptyList), :newPayment)',
            'subscriptionLastPaymentTime = :lastPaymentTime',
            'subscriptionLastPaymentAmount = :lastPaymentAmount',
            'subscriptionLastPaymentCurrency = :lastPaymentCurrency',
            'subscriptionUpdatedAt = :updatedAt'
        ].join(', '),
        ExpressionAttributeValues: {
            ':email': email || 'unknown@funstudy.local',
            ':emptyList': [],
            ':newPayment': [payment],
            ':lastPaymentTime': payment.paidAt,
            ':lastPaymentAmount': payment.amount,
            ':lastPaymentCurrency': payment.currency,
            ':updatedAt': nowIso()
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();
    return result.Attributes;
}

async function setSubscriptionCancelSyncStatus({
    email,
    userId,
    subscriptionId,
    pending,
    errorMessage
}) {
    let targetUserId = userId;

    if (!targetUserId && subscriptionId) {
        const existingBySub = await findUserBySubscriptionId(subscriptionId);
        if (existingBySub && existingBySub.id) {
            targetUserId = existingBySub.id;
            if (!email && existingBySub.email) {
                email = existingBySub.email;
            }
        }
    }

    if (!targetUserId && email) {
        const existingByEmail = await findUserByEmail(email);
        if (existingByEmail && existingByEmail.id) {
            targetUserId = existingByEmail.id;
        }
    }

    if (!targetUserId) {
        if (!email) return null;
        targetUserId = `paypal#${email.toLowerCase()}`;
    }

    const params = {
        TableName: USERS_TABLE,
        Key: { id: targetUserId },
        UpdateExpression: [
            'SET subscriptionCancelSyncPending = :pending',
            'subscriptionCancelSyncError = :errorMessage',
            'subscriptionCancelSyncUpdatedAt = :updatedAt'
        ].join(', '),
        ExpressionAttributeValues: {
            ':pending': !!pending,
            ':errorMessage': errorMessage || null,
            ':updatedAt': nowIso()
        },
        ReturnValues: 'ALL_NEW'
    };

    if (pending) {
        params.UpdateExpression += ' ADD subscriptionCancelSyncAttempts :one';
        params.ExpressionAttributeValues[':one'] = 1;
    }

    const result = await dynamodb.update(params).promise();
    return result.Attributes;
}

async function listPendingSubscriptionCancelSync({ limit = 50 } = {}) {
    const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

    const result = await dynamodb.scan({
        TableName: USERS_TABLE,
        FilterExpression: 'subscriptionCancelSyncPending = :pending',
        ExpressionAttributeValues: {
            ':pending': true
        }
    }).promise();

    const items = (result.Items || []).sort((a, b) => {
        const aTime = Date.parse(a.subscriptionCancelSyncUpdatedAt || 0) || 0;
        const bTime = Date.parse(b.subscriptionCancelSyncUpdatedAt || 0) || 0;
        return bTime - aTime;
    });

    return items.slice(0, parsedLimit);
}

module.exports = {
    findUserByEmail,
    findUserBySubscriptionId,
    upsertSubscription,
    addPaymentRecord,
    setSubscriptionCancelSyncStatus,
    listPendingSubscriptionCancelSync
};
