// frontend/js/services/api.js
/**
 * Cliente API centralizado y envoltura de fetch.
 * Responsabilidad: Definir la URL base e implementar una envoltura personalizada de fetch()
 * que inyecte automáticamente la cabecera de Authorization JWT para peticiones de escritura (POST, PUT, DELETE).
 */

// URL base de la API backend de FastAPI
export const API_URL = window.location.origin + "/api";

let estaRefrescando = false;

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
        // Evitamos bucles infinitos en endpoints de inicio de sesión o refresco
        if (ruta === "/auth/login" || ruta === "/auth/refresh") {
            return respuesta;
        }

        const refreshToken = sessionStorage.getItem("refresh_token");
        if (refreshToken && !estaRefrescando) {
            estaRefrescando = true;
            console.log("⚠️ [API Interceptor] Token de acceso expirado. Intentando refresco silencioso...");
            
            try {
                const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    console.log("✨ [API Interceptor] Token refrescado exitosamente.");
                    
                    // Guardar los nuevos tokens
                    sessionStorage.setItem("token", data.access_token);
                    sessionStorage.setItem("token_type", data.token_type);
                    sessionStorage.setItem("refresh_token", data.refresh_token);

                    // Reintentar la petición original con el nuevo token
                    opciones.headers["Authorization"] = `Bearer ${data.access_token}`;
                    estaRefrescando = false;
                    return await fetch(url, opciones);
                }
            } catch (err) {
                console.error("❌ [API Interceptor] Error al refrescar token:", err);
            }
            estaRefrescando = false;
        }

        console.warn("⚠️ [API Interceptor] Sesión expirada sin posibilidad de refresco. Wiping credentials and reloading...");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("token_type");
        sessionStorage.removeItem("refresh_token");
        sessionStorage.removeItem("usuario");
        
        // Recargar la ventana para forzar la redirección del Router SPA al AuthView
        window.location.reload();
    }

    return respuesta;
}
