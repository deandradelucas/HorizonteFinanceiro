const os = require('os');
const dotenv = require('dotenv');
const app = require('./api/index');

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const networkName of Object.keys(interfaces)) {
        for (const iface of interfaces[networkName] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Horizonte Financeiro rodando em http://localhost:${PORT}`);
    console.log(`Acesso na rede local: http://${localIP}:${PORT}`);
});
