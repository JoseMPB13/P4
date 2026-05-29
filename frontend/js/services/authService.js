// frontend/js/services/authService.js
/**
 * Servicio de Autenticación de Usuario.
 * Responsabilidad: Manejar el flujo de inicio de sesión, registro y cierre de sesión,
 * interactuando con la API y persistiendo las credenciales en sessionStorage.
 */

import { apiFetch } from "./api.js";

/**
 * Utilidad interna para decodificar la sección del Payload de un token JWT.
 * Permite extraer la información del usuario (email, nombre) sin dependencias de terceros.
 * @param {string} token - Token JWT.
 * @returns {Object|null} Payload decodificado o null si el formato es inválido.
 */
function decodificarToken(token) {
    try {
        const partes = token.split(".");
        if (partes.length !== 3) return null;
        
        // Decodificación de base64url a UTF-8 compatible con Unicode
        const payloadBase64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
        const payloadJson = atob(payloadBase64);
        return JSON.parse(payloadJson);
    } catch (error) {
        console.error("Error al decodificar el token JWT:", error);
        return null;
    }
}

export const authService = {
    /**
     * Inicia sesión del usuario utilizando credenciales de correo y contraseña.
     * @param {string} email - Correo institucional.
     * @param {string} password - Contraseña en texto plano.
     * @returns {Promise<Object>} Datos de respuesta del login (token).
     */
    async login(email, password) {
        const respuesta = await apiFetch("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(data.error || data.detail || "Error al iniciar sesión.");
        }

        // Guardar token en el almacenamiento de sesión
        sessionStorage.setItem("token", data.access_token);
        sessionStorage.setItem("token_type", data.token_type);

        // Extraer y decodificar datos del usuario
        const payload = decodificarToken(data.access_token);
        if (payload) {
            const datosUsuario = {
                email: payload.sub,
                nombre: payload.nombre
            };
            sessionStorage.setItem("usuario", JSON.stringify(datosUsuario));
        }

        return data;
    },

    /**
     * Registra un nuevo usuario en la base de datos.
     * @param {Object} userData - Datos de registro (nombre, email, password, rol).
     * @returns {Promise<Object>} Datos del usuario creado.
     */
    async register(userData) {
        const respuesta = await apiFetch("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(data.error || data.detail || "Error al registrar la cuenta.");
        }

        return data;
    },

    /**
     * Cierra la sesión activa del usuario, notificando al backend para invalidar el token
     * en la lista negra de Redis y limpiando el almacenamiento local.
     */
    async logout() {
        const token = sessionStorage.getItem("token");
        if (token) {
            try {
                // Notificar al backend sobre el cierre de sesión.
                // Como es POST, apiFetch inyectará el token de forma automática.
                await apiFetch("/auth/logout", {
                    method: "POST"
                });
            } catch (error) {
                console.warn("No se pudo notificar el logout al servidor de Redis:", error.message);
            }
        }

        // Limpiar almacenamiento local (Fail-Safe)
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("token_type");
        sessionStorage.removeItem("usuario");
    }
};
