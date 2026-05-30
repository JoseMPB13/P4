// frontend/js/utils/notifier.js
/**
 * Servicio de Utilidad de Notificaciones Flotantes (Toasts).
 * Responsabilidad: Instanciar y manejar notificaciones de tipo Toast dinámicamente en el DOM,
 * insertándolas en el contenedor global '#notifications-feed'.
 */

export const notifier = {
    /**
     * Muestra una alerta flotante en la interfaz.
     * @param {Object} params - Parámetros de la alerta.
     * @param {string} params.tipo - Categoría de la alerta ('success', 'error', 'warning').
     * @param {string} params.titulo - Título destacado de la tarjeta.
     * @param {string} params.mensaje - Mensaje o descripción descriptiva.
     * @param {number} [params.duracion=4000] - Tiempo de vida en milisegundos.
     */
    show({ tipo, titulo, mensaje, duracion = 4000 }) {
        // Localizamos el contenedor global ya declarado en index.html
        const feed = document.getElementById("notifications-feed");
        if (!feed) {
            console.warn("No se encontró el contenedor '#notifications-feed' en el DOM.");
            return;
        }

        // Creamos dinámicamente la tarjeta de notificación
        const card = document.createElement("div");
        card.className = `notification-card notif-${tipo}`;

        // Mapear el ícono correspondiente según los requisitos del sistema de seguridad y usabilidad
        const iconos = {
            success: "bi-check-circle-fill",
            error: "bi-exclamation-triangle-fill",
            warning: "bi-exclamation-circle-fill"
        };
        const icono = iconos[tipo] || "bi-info-circle-fill";

        // Estructura interna de la tarjeta de alerta premium (Glassmorphism)
        card.innerHTML = `
            <div class="notif-icon-container">
                <i class="bi ${icono}" style="font-size: 1.25rem;"></i>
            </div>
            <div class="notif-body">
                <span class="notif-title" style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.875rem;">${titulo}</span>
                <span class="notif-text" style="font-family: var(--font-sans); font-size: 0.775rem; line-height: 1.4;">${mensaje}</span>
            </div>
        `;

        // Añadimos la tarjeta al contenedor global
        feed.appendChild(card);

        // Retraso de 10ms antes de inyectar la clase 'show' para asegurar que el navegador registre 
        // el elemento en el DOM y dispare la transición CSS de entrada correctamente.
        setTimeout(() => {
            card.classList.add("show");
        }, 10);

        // Temporizador para activar la animación de salida (fade-out) y luego remover físicamente el elemento del DOM
        setTimeout(() => {
            card.classList.add("fade-out");
            
            // Esperamos a que finalice la transición de opacidad/escala (300ms) antes de remover el nodo
            card.addEventListener("transitionend", () => {
                card.remove();
            });
        }, duracion);
    }
};
