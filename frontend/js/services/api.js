// frontend/js/services/api.js
/**
 * Cliente API centralizado y envoltura de fetch.
 * Responsabilidad: Definir la URL base e implementar una envoltura personalizada de fetch()
 * que inyecte automáticamente la cabecera de Authorization JWT para peticiones de escritura (POST, PUT, DELETE).
 */

// URL base de la API backend de FastAPI
export const API_URL = window.location.origin + "/api";

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

    // Comentario en español: Inyectar el token JWT en TODAS las peticiones (incluyendo GET) si el token existe
    if (token) {
        opciones.headers["Authorization"] = `Bearer ${token}`;
    }

    // Comentario en español: Ejecutar la petición utilizando la función fetch nativa capturando errores de conexión
    let respuesta;
    try {
        respuesta = await fetch(url, opciones);
    } catch (error) {
        // Comentario en español: Error de red o conexión física. No limpiamos credenciales, simplemente relanzamos el error.
        throw error;
    }

    // Comentario en español: Interceptar respuestas de forma reactiva, limpiando credenciales ÚNICAMENTE ante un error HTTP 401
    if (respuesta && respuesta.status === 401) {
        console.warn("⚠️ [API Interceptor] Error 401 detectado. Wiping credentials and reloading...");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("token_type");
        sessionStorage.removeItem("usuario");
        
        // Recargar la ventana para forzar la redirección del Router SPA al AuthView
        window.location.reload();
    }

    return respuesta;
}
