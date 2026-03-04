const { users } = require('./db');

async function testRegister() {
    console.log('Testing registration with name, email, password...');
    try {
        const result = await users.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            ['Test User', `test_${Date.now()}@example.com`, 'password123']
        );
        console.log('Success:', result);
    } catch (err) {
        console.error('FAILED with error:');
        console.error('Message:', err.message);
        console.error('Full Error:', err);
    }
}

testRegister();
