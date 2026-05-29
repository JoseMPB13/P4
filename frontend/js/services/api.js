// frontend/js/services/api.js
/**
 * Cliente API centralizado y envoltura de fetch.
 * Responsabilidad: Definir la URL base e implementar una envoltura personalizada de fetch()
 * que inyecte automáticamente la cabecera de Authorization JWT para peticiones de escritura (POST, PUT, DELETE).
 */

// URL base de la API backend de FastAPI
export const API_URL = "http://localhost:8000/api";

/**
 * Envoltura personalizada de fetch que inyecta automáticamente el token JWT.
 * @param {string} ruta - Ruta relativa de la API (ej: '/auth/login').
 * @param {Object} opciones - Opciones de configuración de fetch (method, body, headers, etc.).
 * @returns {Promise<Response>} Respuesta cruda del fetch nativo.
 */
export async function apiFetch(ruta, opciones = {}) {
    const url = `${API_URL}${ruta}`;

    // Asegurar la inicialización del objeto headers
    if (!opciones.headers) {
        opciones.headers = {};
    }

    // Asegurar que el método esté en mayúsculas (por defecto GET)
    const metodo = (opciones.method || "GET").toUpperCase();

    // Extraer automáticamente el token de sessionStorage si existe
    const token = sessionStorage.getItem("token");

    // Inyectar el token JWT únicamente en peticiones de escritura (POST, PUT, DELETE) si el token existe
    if (token && ["POST", "PUT", "DELETE"].includes(metodo)) {
        opciones.headers["Authorization"] = `Bearer ${token}`;
    }

    // Ejecutar la petición utilizando la función fetch nativa
    const respuesta = await fetch(url, opciones);

    return respuesta;
}
