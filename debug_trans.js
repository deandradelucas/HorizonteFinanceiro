const db = require('./db');

async function testTransaction() {
    console.log('Testing transaction insert via proxy...');
    try {
        const result = await db.transactions.query(
            'INSERT INTO transactions (user_id, type, description, value, category, date, isRecurring) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [14, 'expense', 'Test from Proxy', 99.99, 'lazer', '2023-03-04', 0]
        );
        console.log('Result:', result);
    } catch (err) {
        console.error('FAILED:');
        console.error('Message:', err.message);
        console.error('Error Object:', JSON.stringify(err, null, 2));
    }
}

testTransaction();
