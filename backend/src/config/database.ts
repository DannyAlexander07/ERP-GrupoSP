// Archivo: backend/src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Función para probar la conexión
export const testConnection = async () => {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conexión a la base de datos establecida exitosamente.');
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:', error);
    }
};

export default pool;