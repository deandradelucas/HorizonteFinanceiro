const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'financeiro.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if transactions table exists
    db.all("PRAGMA table_info(transactions)", (err, rows) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        const hasUserId = rows.some(row => row.name === 'user_id');
        if (!hasUserId) {
            console.log("Adding user_id column to transactions table...");
            db.run("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)", (err) => {
                if (err) {
                    console.error("Error adding column:", err.message);
                } else {
                    console.log("Column user_id added successfully.");
                }
                db.close();
            });
        } else {
            console.log("Column user_id already exists.");
            db.close();
        }
    });
});
