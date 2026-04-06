module.exports = async () => {
    try {
        const db = require('../config/db');
        if (db && typeof db.closePoolForTests === 'function') {
            await db.closePoolForTests();
        }
    } catch (err) {
        console.error('Error cerrando pool MySQL al finalizar tests:', err);
    }
};
