// frontend/js/services/api.js
/**
 * Servicio API centralizado.
 * Responsabilidad: Centralizar todas las peticiones fetch() al backend de FastAPI,
 * gestionando las cabeceras HTTP y el formateo de datos.
 */

// URL base de la API backend de FastAPI
const API_URL = "http://localhost:8000/api";

export const apiService = {
    /**
     * Inicia sesión de un usuario con correo y contraseña.
     * @param {string} email - Correo del usuario.
     * @param {string} password - Contraseña en texto plano.
     * @returns {Promise<Object>} Token JWT recibido del backend.
     */
    async login(email, password) {
        // Realiza petición POST al endpoint de login
        const respuesta = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();
        if (!respuesta.ok) {
            // Lanza error con el detalle provisto por FastAPI
            throw new Error(data.error || data.detail || "Error al iniciar sesión.");
        }
        return data;
    },

    /**
     * Registra un nuevo usuario en la plataforma.
     * @param {string} nombre - Nombre completo.
     * @param {string} email - Correo electrónico institucional.
     * @param {string} password - Contraseña (mínimo 6 caracteres).
     * @param {string} rol - Rol asignado ('estudiante', 'personal_mantenimiento', 'admin').
     * @returns {Promise<Object>} Datos del usuario registrado.
     */
    async register(nombre, email, password, rol) {
        // Realiza petición POST al endpoint de registro
        const respuesta = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nombre, email, password, rol })
        });

        const data = await respuesta.json();
        if (!respuesta.ok) {
            // Lanza error si el correo ya existe u ocurre otra validación
            throw new Error(data.error || data.detail || "Error en el registro.");
        }
        return data;
    },

    /**
     * Obtiene el listado completo de reportes de infraestructura (Ruta Pública).
     * @returns {Promise<Array>} Listado de reportes.
     */
    async getReportes() {
        const respuesta = await fetch(`${API_URL}/reportes/`);
        if (!respuesta.ok) {
            const data = await respuesta.json();
            throw new Error(data.error || data.detail || "No se pudieron cargar los reportes.");
        }
        return await respuesta.json();
    }
};
