// Asegúrate de poner la ruta correcta a tu archivo de conexión
const { initSchema } = require('./db/database.js');

console.log('Iniciando migración a Turso...');
initSchema().then(() => {
    console.log('¡Listo! Puedes borrar este archivo.');
    process.exit(0);
});