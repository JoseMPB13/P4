// frontend/js/services/websocket.js
import { API_URL } from "./api.js";
import { notifier } from "../utils/notifier.js";

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
                
                // Despachar evento personalizado global en el documento para actualización atómica de las vistas
                document.dispatchEvent(new CustomEvent('ws:evento', { detail: datos }));
                
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
     * Procesa y mapea el evento para lanzar la notificación adecuada utilizando notifier.show().
     * @param {Object} evento - Payload del evento WebSocket.
     */
    procesarEvento(evento) {
        const { tipo, payload } = evento;
        if (!tipo || !payload) return;

        // Comentario en español: Mapeamos los mensajes de Redis Pub/Sub recibidos por WebSocket
        // y los canalizamos a través de la utilidad centralizada notifier.show(), eliminando
        // por completo el método redundante local mostrarNotificacion() y su manipulación manual de DOM.
        if (tipo === "reporte:creado") {
            const esCritica = payload.prioridad === "alta" || payload.prioridad === "critica";
            notifier.show({
                tipo: esCritica ? "error" : "success",
                titulo: esCritica ? `🚨 ALERTA CRÍTICA: ${payload.titulo}` : `Nuevo Reporte de Falla o Problema: ${payload.titulo}`,
                mensaje: esCritica ? `Se ha registrado una falla o problema urgente en ${payload.ubicacion}.` : `Reportada por ${payload.usuario?.nombre || "Usuario"} en ${payload.ubicacion}.`
            });
        } else if (tipo === "reporte:critico") {
            notifier.show({
                tipo: "error",
                titulo: `🚨 ALERTA CRÍTICA: ${payload.titulo}`,
                mensaje: `Falla o problema de alta prioridad registrado en ${payload.ubicacion}.`
            });
        } else if (tipo === "reporte:actualizado" || tipo === "reporte:cambio_estado") {
            // Comentario en español: Leemos la propiedad 'accion' inyectada por el backend para discriminar 
            // el tipo de notificación y evitar el solapamiento visual en las alertas Toast.
            const accion = evento.accion || "actualizar_estado";

            if (accion === "asignar_tecnico") {
                const tecnicoNombre = payload.tecnico ? payload.tecnico.nombre : "sin asignar";
                notifier.show({
                    tipo: "success",
                    titulo: `Técnico Asignado: ${payload.titulo}`,
                    mensaje: `La tarea ha sido asignada a ${tecnicoNombre} en ${payload.ubicacion}.`
                });
            } else if (accion === "agregar_comentario") {
                notifier.show({
                    tipo: "info",
                    titulo: `Nuevo Comentario: ${payload.titulo}`,
                    mensaje: `Se ha registrado una nueva nota en la bitácora técnica de ${payload.ubicacion}.`
                });
            } else {
                notifier.show({
                    tipo: "success",
                    titulo: `Actualización: ${payload.titulo}`,
                    mensaje: `Estado cambiado a "${payload.estado.toUpperCase()}" en ${payload.ubicacion}.`
                });
            }
        } else if (tipo === "reporte:eliminado") {
            notifier.show({
                tipo: "error",
                titulo: "Falla o Problema Removido",
                mensaje: "El reporte ha sido eliminado del sistema"
            });
        } else if (tipo === "comentario:creado") {
            notifier.show({
                tipo: "warning",
                titulo: `Nuevo Comentario: ${payload.reporte_titulo || "Falla o Problema"}`,
                mensaje: `Un técnico ha agregado una actualización a la bitácora.`
            });
        }
    }
}

export const socketService = new WebSocketService();
