// Archivo: backend/generar-hash.js
const bcrypt = require('bcryptjs');

const password = 'Java1234.'; // <-- ¡Tu contraseña!
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Copia y usa estos valores para tu base de datos:');
console.log('HASH:', hash);
console.log('SALT:', salt);