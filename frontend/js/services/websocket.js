// frontend/js/services/websocket.js
import { API_URL } from "./api.js";

// Construir la URL del WebSocket de forma dinámica a partir de la API_URL
const wsBaseUrl = API_URL
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/api$/, "/ws");

class WebSocketService {
    constructor() {
        this.socket = null;
        this.reconectador = null;
        this.intentandoConectar = false;
    }

    /**
     * Inicializa la conexión del socket si no existe.
     */
    inicializar() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            console.log("📡 [WebSocket] Conexión ya activa o conectando.");
            return;
        }

        console.log(`📡 [WebSocket] Conectando a ${wsBaseUrl}...`);
        this.intentandoConectar = true;
        this.actualizarBadge("connecting");

        try {
            this.socket = new WebSocket(wsBaseUrl);
            this.inicializarEventos();
        } catch (error) {
            console.error("📡 [WebSocket ERROR] Error al crear la instancia:", error);
            this.actualizarBadge("disconnected");
            this.programarReconexion();
        }
    }

    /**
     * Vincula los controladores de eventos nativos del WebSocket.
     */
    inicializarEventos() {
        this.socket.onopen = () => {
            console.log("📡 [WebSocket] Conectado exitosamente al servidor.");
            this.intentandoConectar = false;
            this.actualizarBadge("connected");
            
            // Limpiar intervalo de reconexión si estaba activo
            if (this.reconectador) {
                clearInterval(this.reconectador);
                this.reconectador = null;
            }
        };

        this.socket.onclose = () => {
            console.warn("📡 [WebSocket] Conexión cerrada.");
            this.actualizarBadge("disconnected");
            this.programarReconexion();
        };

        this.socket.onerror = (error) => {
            console.error("📡 [WebSocket ERROR] Error en la conexión:", error);
            this.actualizarBadge("disconnected");
        };

        this.socket.onmessage = (event) => {
            try {
                const datos = JSON.parse(event.data);
                console.log("📡 [WebSocket] Evento recibido:", datos);
                this.procesarEvento(datos);
            } catch (err) {
                console.error("📡 [WebSocket ERROR] No se pudo parsear el mensaje:", err);
            }
        };
    }

    /**
     * Programa un intento de reconexión cada 5 segundos.
     */
    programarReconexion() {
        if (this.reconectador) return;

        console.log("📡 [WebSocket] Iniciando reconexión automática en 5 segundos...");
        this.reconectador = setInterval(() => {
            if (!this.intentandoConectar && (!this.socket || this.socket.readyState === WebSocket.CLOSED)) {
                this.inicializar();
            }
        }, 5000);
    }

    /**
     * Cierra voluntariamente la conexión y detiene reconexiones.
     */
    desconectar() {
        console.log("📡 [WebSocket] Desconectando voluntariamente...");
        if (this.reconectador) {
            clearInterval(this.reconectador);
            this.reconectador = null;
        }

        if (this.socket) {
            // Remover handlers para evitar bucle de reconexión al cerrar
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.close();
            this.socket = null;
        }
        
        this.intentandoConectar = false;
        this.actualizarBadge("disconnected");
    }

    /**
     * Actualiza el estado visual del badge en el Navbar.
     * @param {'connected'|'connecting'|'disconnected'} estado 
     */
    actualizarBadge(estado) {
        const badgeEl = document.getElementById("ws-badge");
        if (!badgeEl) return;

        // Limpiar clases previas
        badgeEl.className = "ws-badge";
        
        const dotEl = badgeEl.querySelector(".status-dot") || document.createElement("span");
        dotEl.className = "status-dot";
        
        if (estado === "connected") {
            badgeEl.classList.add("status-connected");
            badgeEl.innerHTML = "";
            badgeEl.appendChild(dotEl);
            badgeEl.appendChild(document.createTextNode(" En Línea"));
        } else if (estado === "connecting") {
            badgeEl.classList.add("status-connecting");
            badgeEl.innerHTML = "";
            badgeEl.appendChild(dotEl);
            badgeEl.appendChild(document.createTextNode(" Conectando"));
        } else {
            badgeEl.classList.add("status-disconnected");
            badgeEl.innerHTML = "";
            badgeEl.appendChild(dotEl);
            badgeEl.appendChild(document.createTextNode(" Desconectado"));
        }
    }

    /**
     * Procesa y mapea el evento para lanzar la notificación adecuada.
     * @param {Object} evento - Payload del evento WebSocket.
     */
    procesarEvento(evento) {
        const { tipo, payload } = evento;
        if (!tipo || !payload) return;

        let claseNotif = "notif-creado";
        let iconoHtml = '<i class="bi bi-info-circle-fill"></i>';
        let titulo = "Incidencia Reportada";
        let mensaje = "";

        // Mapear los 4 eventos correspondientes a las alertas HSL
        if (tipo === "reporte:creado") {
            // Si la prioridad es alta o crítica, se mapea a reporte:critico
            if (payload.prioridad === "alta" || payload.prioridad === "critica") {
                claseNotif = "notif-critico";
                iconoHtml = '<i class="bi bi-exclamation-triangle-fill"></i>';
                titulo = `🚨 ALERTA CRÍTICA: ${payload.titulo}`;
                mensaje = `Se ha registrado una incidencia urgente en ${payload.ubicacion}.`;
            } else {
                claseNotif = "notif-creado"; // Azul HSL
                iconoHtml = '<i class="bi bi-plus-circle-fill"></i>';
                titulo = `Nueva Incidencia: ${payload.titulo}`;
                mensaje = `Reportada por ${payload.usuario?.nombre || "Usuario"} en ${payload.ubicacion}.`;
            }
        } else if (tipo === "reporte:critico") {
            claseNotif = "notif-critico"; // Rojo HSL parpadeante
            iconoHtml = '<i class="bi bi-exclamation-triangle-fill"></i>';
            titulo = `🚨 ALERTA CRÍTICA: ${payload.titulo}`;
            mensaje = `Incidencia de alta prioridad registrada en ${payload.ubicacion}.`;
        } else if (tipo === "reporte:actualizado" || tipo === "reporte:cambio_estado") {
            claseNotif = "notif-cambio-estado"; // Verde HSL
            iconoHtml = '<i class="bi bi-arrow-left-right"></i>';
            titulo = `Actualización: ${payload.titulo}`;
            mensaje = `Estado cambiado a "${payload.estado.toUpperCase()}" en ${payload.ubicacion}.`;
        } else if (tipo === "comentario:creado") {
            claseNotif = "notif-comentario"; // Ámbar HSL
            iconoHtml = '<i class="bi bi-chat-right-text-fill"></i>';
            titulo = `Nuevo Comentario: ${payload.reporte_titulo || "Incidencia"}`;
            mensaje = `Un técnico ha agregado una actualización a la bitácora.`;
        } else {
            // Evento no reconocido
            return;
        }

        this.mostrarNotificacion(claseNotif, iconoHtml, titulo, mensaje);
    }

    /**
     * Inyecta dinámicamente una tarjeta de notificación en el feed.
     */
    mostrarNotificacion(claseNotif, iconoHtml, titulo, mensaje) {
        const feed = document.getElementById("notifications-feed");
        if (!feed) return;

        // Crear contenedor de la tarjeta
        const card = document.createElement("div");
        card.className = `notification-card ${claseNotif}`;
        
        // Obtener hora actual legible
        const horaStr = new Date().toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit"
        });

        card.innerHTML = `
            <div class="notif-icon-container">
                ${iconoHtml}
            </div>
            <div class="notif-body">
                <span class="notif-title">${titulo}</span>
                <span class="notif-text">${mensaje}</span>
                <span class="notif-time">${horaStr}</span>
            </div>
        `;

        // Agregar al inicio del feed
        feed.prepend(card);

        // Disparar animación de entrada en el siguiente frame
        requestAnimationFrame(() => {
            card.classList.add("show");
        });

        // Configurar auto-cierre tras 6 segundos con animación fade-out
        setTimeout(() => {
            card.classList.remove("show");
            card.classList.add("fade-out");
            card.addEventListener("transitionend", () => {
                card.remove();
            });
        }, 6000);
    }
}

export const socketService = new WebSocketService();
