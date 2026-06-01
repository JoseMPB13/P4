// frontend/js/components/PersonalDashboard.js
/**
 * Componente PersonalDashboard.
 * 
 * Responsabilidad:
 * 1. Renderizar la bandeja de entrada para el personal técnico.
 * 2. Cargar una lista compacta con todas las incidencias asignadas al técnico autenticado
 *    llamando al endpoint seguro del backend GET /api/reportes/mantenimiento.
 * 3. Proveer un modal de inspección multimedia y bitácora técnica de comentarios en tiempo real.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Asigna el contenedor principal y vincula listeners de eventos.
 * 2. Render: Inicializa la estructura del contenedor.
 * 3. Cargar Bandeja de Incidencias: Solicita los reportes asignados, renderiza usando Glassmorphism
 *    y añade bordes HSL dinámicos según prioridad.
 * 4. Inspección & Modal: Abre una vista detallada con evidencia fotográfica (o placeholder si no hay foto),
 *    historial de cambios y un sistema reactivo de comentarios técnicos (bitácora).
 */

import { apiFetch } from "../services/api.js";
import { StatsCard } from "./StatsCard.js";
import { notifier } from "../utils/notifier.js";

export class PersonalDashboard {
    /**
     * Inicializa la vista del personal técnico.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.inicializado = false;
    }

    /**
     * Dibuja la bandeja de entrada e inicia la obtención de datos.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 900px; margin: 2rem auto; padding: 0 1.5rem;">
                
                <!-- Encabezado de la página -->
                <div style="margin-bottom: 2rem;">
                    <span class="badge-minimal badge-warning">Técnico</span>
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Bandeja de Problemas o Fallas</h2>
                    <p class="text-muted-custom">Listado compacto de problemas asignados a tu cuenta y listos para atender en el campus.</p>
                </div>

                <!-- Tarjeta de estadísticas compacta superior -->
                <div id="personal-stats" style="margin-bottom: 2rem;"></div>

                <!-- Bandeja de Entrada de Incidencias -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <h3 style="font-weight: 700; margin: 0;">Bandeja de Tareas</h3>
                        <button class="btn-minimal btn-outline" id="btn-refresh-personal" style="padding: 0.4rem 0.75rem;">
                            <i class="bi bi-arrow-clockwise" id="pers-refresh-icon"></i>
                        </button>
                    </div>

                    <!-- Contenedor de lista tipo inbox con Glassmorphism -->
                    <div id="personal-inbox-container" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="glass-task-card" style="text-align: center; padding: 3rem 1.5rem;">
                            <div class="loader-spinner" style="margin: 0 auto 1rem auto;"></div>
                            <span class="text-muted-custom">Cargando bandeja de tareas...</span>
                        </div>
                    </div>
                </div>

            </div>
        `;

        // Renderizar estadísticas arriba de la bandeja
        this.stats = new StatsCard("#personal-stats");
        this.stats.render();
        await this.stats.actualizarContadores();

        // Cargar bandeja de tareas asignadas pendientes
        await this.cargarBandeja();

        // Vincular e inicializar listeners de eventos
        if (!this.inicializado) {
            this.inicializarEventos();
            this.inicializado = true;
        }
    }

    /**
     * Obtiene los reportes y renderiza solo los que no están resueltos.
     */
    async cargarBandeja() {
        const inboxContainer = document.getElementById("personal-inbox-container");
        if (!inboxContainer) return;

        try {
            // Comentario en español: Consultamos el endpoint seguro /reportes/mantenimiento
            // el cual filtra automáticamente por el ID del usuario en el token JWT.
            const respuesta = await apiFetch("/reportes/mantenimiento");
            if (!respuesta.ok) {
                throw new Error("Error al obtener la lista de fallas o problemas asignados.");
            }
            const reportes = await respuesta.json();

            // Filtrar incidencias no resueltas (pendiente / en proceso)
            const activas = reportes.filter(r => r.estado !== "resuelto");

            if (activas.length === 0) {
                inboxContainer.innerHTML = `
                    <div class="glass-task-card" style="text-align: center; padding: 4rem 2rem; border-left: 5px solid hsl(142, 50%, 45%);">
                        <i class="bi bi-emoji-smile" style="color: var(--accent-green); font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                        <h4 style="font-weight: 700; margin-bottom: 0.5rem;">¡Bandeja vacía!</h4>
                        <p class="text-muted-custom">No tienes problemas o fallas pendientes asignados en este momento.</p>
                    </div>
                `;
                return;
            }

            // Inyectar ítems compactos tipo inbox con bordes dinámicos HSL y estilos premium
            inboxContainer.innerHTML = activas.map(item => {
                const fechaStr = new Date(item.creado_en).toLocaleString("es-BO", {
                    dateStyle: "short",
                    timeStyle: "short"
                });
                const reportante = item.usuario ? item.usuario.nombre : "Anónimo";

                // Comentario en español: Determinamos las clases de diseño para el borde HSL
                // de acuerdo con la prioridad del reporte (alta, media o baja).
                const prioridadLower = item.prioridad.toLowerCase();
                const claseBordePrioridad = `priority-hsl-${prioridadLower}`;

                // Comentario en español: Clase dinámica HSL para los badges del estado
                const badgeStateClass = item.estado === "en proceso" ? "badge-status-proceso" : "badge-status-pendiente";

                return `
                    <div class="glass-task-card ${claseBordePrioridad}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                            <div>
                                <span class="badge-minimal ${badgeStateClass}" style="margin-bottom: 0.5rem; display: inline-block;">
                                    ${item.estado.toUpperCase()}
                                </span>
                                <h4 style="font-weight: 700; margin: 0; font-size: 1.1rem; color: var(--text-primary);">${item.titulo}</h4>
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                                <button class="btn-minimal btn-accent btn-inbox-inspect" data-id="${item.id}" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
                                    🔍 Inspeccionar
                                </button>
                            </div>
                        </div>
                        
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${item.descripcion}
                        </p>
                        
                        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); gap: 0.5rem; margin-top: 0.5rem;">
                            <span><i class="bi bi-geo-alt-fill" style="margin-right: 0.25rem;"></i> ${item.ubicacion}</span>
                            <span>
                                <i class="bi bi-person-fill" style="margin-right: 0.25rem;"></i> ${reportante} 
                                <span style="opacity: 0.5; margin: 0 0.25rem;">|</span> 
                                <i class="bi bi-clock-fill" style="margin-right: 0.25rem;"></i> ${fechaStr}
                            </span>
                        </div>
                    </div>
                `;
            }).join("");

        } catch (error) {
            inboxContainer.innerHTML = `
                <div class="glass-task-card" style="text-align: center; padding: 2rem 1rem; border-left: 5px solid #ef4444;">
                    <i class="bi bi-x-circle" style="color: #ef4444; font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <h5 style="font-weight: 700; margin-bottom: 0.25rem;">Error de conexión</h5>
                    <span class="text-muted-custom">${error.message}</span>
                </div>
            `;
        }
    }

    /**
     * Vincula listeners utilizando delegación de eventos.
     */
    inicializarEventos() {
        this.contenedor.addEventListener("click", async (e) => {
            // Comentario en español: Capturamos el evento de clic en el botón de inspección
            // para levantar el modal flotante con los detalles.
            const btnInspect = e.target.closest(".btn-inbox-inspect");
            if (btnInspect) {
                const id = btnInspect.dataset.id;
                await this.abrirModalPorId(id);
                return;
            }

            const btnRefresh = e.target.closest("#btn-refresh-personal");
            if (btnRefresh) {
                const icon = document.getElementById("pers-refresh-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.cargarBandeja();
                if (this.stats) await this.stats.actualizarContadores();
                setTimeout(() => {
                    if (icon) icon.classList.remove("spin-animation");
                }, 800);
            }
        });
    }

    /**
     * Recupera el detalle completo y actual de la incidencia y levanta el modal.
     * @param {string|number} id - Identificador del reporte.
     */
    async abrirModalPorId(id) {
        try {
            const respuesta = await apiFetch(`/reportes/${id}`);
            if (!respuesta.ok) {
                throw new Error("No se pudo obtener la información fresca del reporte.");
            }
            const reporte = await respuesta.json();
            this.abrirModal(reporte);
        } catch (error) {
            notifier.show({
                tipo: "error",
                titulo: "Fallo al inspeccionar",
                mensaje: error.message
            });
        }
    }

    /**
     * Genera e inyecta dinámicamente el modal en el DOM del cliente.
     * @param {Object} reporte - Datos serializados de la incidencia.
     */
    abrirModal(reporte) {
        // Eliminar modal previo si existe
        const modalExistente = document.getElementById("inspection-modal");
        if (modalExistente) modalExistente.remove();

        const modalDiv = document.createElement("div");
        modalDiv.id = "inspection-modal";
        modalDiv.className = "modal-overlay active"; // modal-overlay ya existe en styles.css

        // Comentario en español: Construimos de forma condicional la sección de evidencia.
        // Si no hay imagen_url, renderizamos el placeholder estético con bordes de guión e icono gris.
        const imagenHTML = reporte.imagen_url 
            ? `<img src="${reporte.imagen_url}" alt="Evidencia de la falla o problema" class="evidence-img-large" />` 
            : `<div class="evidence-image-placeholder">
                 <i class="bi bi-camera-video-off-fill"></i>
                 <span>Sin evidencia fotográfica adjunta</span>
               </div>`;

        // Comentario en español: Mapeamos los comentarios de la bitácora inmutable.
        const comentariosHTML = reporte.comentarios && reporte.comentarios.length > 0
            ? reporte.comentarios.map(c => {
                const cFecha = new Date(c.creado_en).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
                return `
                    <div class="comment-bubble">
                        <div class="comment-meta">
                            <strong>${c.usuario ? c.usuario.nombre : "Técnico"}</strong>
                            <span>${cFecha}</span>
                        </div>
                        <div class="comment-text">${c.texto}</div>
                    </div>
                `;
              }).join("")
            : `<div class="text-muted-custom" id="no-comments-msg" style="text-align: center; padding: 1rem; font-size: 0.85rem;">No hay notas registradas en esta tarea.</div>`;

        const esEnProceso = reporte.estado === "en proceso";

        modalDiv.innerHTML = `
            <div class="modal-content glassmorphism" style="max-width: 800px; width: 90%; background: rgba(17, 24, 39, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 2rem;">
                <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800;">Detalles de la Falla o Problema #${reporte.id}</h3>
                    <button class="modal-close-btn" id="modal-close" style="background: none; border: none; color: var(--text-secondary); font-size: 1.75rem; cursor: pointer;">&times;</button>
                </div>
                
                <div class="modal-double-column">
                    <!-- Columna Izquierda: Evidencia Fotográfica -->
                    <div class="evidence-column">
                        ${imagenHTML}
                    </div>
                    
                    <!-- Columna Derecha: Información del Reporte y Notas -->
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="badge-minimal priority-hsl-${reporte.prioridad.toLowerCase()}" style="font-weight:600;">
                                ${reporte.prioridad.toUpperCase()}
                            </span>
                            <span class="badge-minimal badge-status-${reporte.estado === 'en proceso' ? 'proceso' : reporte.estado}" style="font-weight:600;">
                                ${reporte.estado.toUpperCase()}
                            </span>
                        </div>
                        
                        <h4 style="font-weight: 700; color: var(--text-primary); margin: 0; font-size: 1.2rem;">${reporte.titulo}</h4>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">${reporte.descripcion}</p>
                        
                        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.25rem;">
                            <span><i class="bi bi-geo-alt-fill"></i> Ubicación: ${reporte.ubicacion}</span>
                            <span><i class="bi bi-person-fill"></i> Reportado por: ${reporte.usuario ? reporte.usuario.nombre : "Anónimo"}</span>
                            <span><i class="bi bi-calendar-event"></i> Fecha: ${new Date(reporte.creado_en).toLocaleString("es-BO")}</span>
                        </div>
                        
                        <!-- Acciones del Técnico -->
                        <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            <h5 style="font-weight: 600; margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--text-primary);">Acciones Técnicas</h5>
                            <div style="display: flex; gap: 0.5rem;">
                                ${!esEnProceso ? `
                                    <button class="btn-minimal btn-outline" id="modal-btn-proceso" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                                        ⚙️ Iniciar Trabajo
                                    </button>
                                ` : ""}
                                <button class="btn-minimal" id="modal-btn-resolver" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background-color: var(--accent-green); color: white;">
                                    ✅ Marcar como Resuelto
                                </button>
                            </div>
                        </div>

                        <!-- Bitácora de Comentarios -->
                        <div style="margin-top: 0.5rem;">
                            <h5 style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-primary);">Notas y Bitácora Técnica</h5>
                            <div class="comments-timeline" id="modal-comments-list">
                                ${comentariosHTML}
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                                <textarea class="glass-textarea" id="modal-comment-text" placeholder="Escriba una nota técnica sobre los avances de la reparación..."></textarea>
                                <button class="btn-minimal btn-accent" id="modal-btn-submit-comment" style="align-self: flex-end; padding: 0.4rem 1rem; font-size: 0.8rem;">
                                    Enviar Nota
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        // Vincular los eventos interactivos del modal
        const closeBtn = modalDiv.querySelector("#modal-close");
        closeBtn.addEventListener("click", () => modalDiv.remove());

        modalDiv.addEventListener("click", (e) => {
            if (e.target === modalDiv) modalDiv.remove();
        });

        // Evento Iniciar Trabajo
        const btnProceso = modalDiv.querySelector("#modal-btn-proceso");
        if (btnProceso) {
            btnProceso.addEventListener("click", async () => {
                await this.cambiarEstadoYNotificar(reporte.id, "en proceso");
                modalDiv.remove();
            });
        }

        // Evento Marcar como Resuelto
        const btnResolver = modalDiv.querySelector("#modal-btn-resolver");
        if (btnResolver) {
            btnResolver.addEventListener("click", async () => {
                await this.cambiarEstadoYNotificar(reporte.id, "resuelto");
                modalDiv.remove();
            });
        }

        // Evento Registrar Comentario en Bitácora
        const btnSubmitComment = modalDiv.querySelector("#modal-btn-submit-comment");
        btnSubmitComment.addEventListener("click", async () => {
            const txtArea = modalDiv.querySelector("#modal-comment-text");
            const texto = txtArea.value.trim();
            if (!texto) {
                notifier.show({
                    tipo: "warning",
                    titulo: "Nota vacía",
                    mensaje: "Por favor, escriba la descripción antes de enviarla."
                });
                return;
            }
            await this.enviarComentario(reporte.id, texto, modalDiv);
        });
    }

    /**
     * Envía la petición PUT al backend para cambiar el estado.
     * @param {string|number} id - ID del reporte.
     * @param {string} nuevoEstado - Nuevo estado a asignar ('en proceso' / 'resuelto').
     */
    async cambiarEstadoYNotificar(id, nuevoEstado) {
        try {
            const respuesta = await apiFetch(`/reportes/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    estado: nuevoEstado
                })
            });

            if (!respuesta.ok) {
                throw new Error("No fue posible actualizar el estado de la falla o problema.");
            }

            // Comentario en español: Notificación visual tipo Toast que salta al técnico tras cambiar estado
            notifier.show({
                tipo: "success",
                titulo: "Estado Actualizado",
                mensaje: `La falla o problema #${id} ha sido marcada como '${nuevoEstado.toUpperCase()}' correctamente.`
            });

            // Recargar bandeja y estadísticas principales
            await this.cargarBandeja();
            if (this.stats) {
                await this.stats.actualizarContadores();
            }

        } catch (error) {
            notifier.show({
                tipo: "error",
                titulo: "Fallo de actualización",
                mensaje: error.message
            });
        }
    }

    /**
     * Registra un comentario técnico en la bitácora inmutable del reporte.
     * @param {string|number} reporteId - ID del reporte.
     * @param {string} texto - Contenido de la nota.
     * @param {HTMLElement} modalDiv - Elemento del modal en el DOM.
     */
    async enviarComentario(reporteId, texto, modalDiv) {
        try {
            const respuesta = await apiFetch(`/reportes/${reporteId}/comentarios`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ texto })
            });

            if (!respuesta.ok) {
                throw new Error("No fue posible registrar la nota técnica en la base de datos.");
            }

            const nuevoComentario = await respuesta.json();

            // Comentario en español: Confirmación Toast del comentario registrado exitosamente
            notifier.show({
                tipo: "success",
                titulo: "Nota guardada",
                mensaje: "La nota técnica ha sido registrada en el servidor con éxito."
            });

            // Limpiar área de texto
            const txtArea = modalDiv.querySelector("#modal-comment-text");
            if (txtArea) txtArea.value = "";

            // Añadir de forma reactiva e inmediata el comentario en la interfaz
            const commentsContainer = modalDiv.querySelector("#modal-comments-list");
            const noCommentsMsg = modalDiv.querySelector("#no-comments-msg");
            if (noCommentsMsg) noCommentsMsg.remove();

            const cFecha = new Date(nuevoComentario.creado_en).toLocaleString("es-BO", {
                dateStyle: "short",
                timeStyle: "short"
            });
            const nuevoComentarioHTML = `
                <div class="comment-bubble" style="animation: fadeIn 0.3s ease;">
                    <div class="comment-meta">
                        <strong>${nuevoComentario.usuario ? nuevoComentario.usuario.nombre : "Técnico"}</strong>
                        <span>${cFecha}</span>
                    </div>
                    <div class="comment-text">${nuevoComentario.texto}</div>
                </div>
            `;
            
            if (commentsContainer) {
                commentsContainer.insertAdjacentHTML("beforeend", nuevoComentarioHTML);
                commentsContainer.scrollTop = commentsContainer.scrollHeight;
            }

            // Recargar bandeja oculta de fondo
            await this.cargarBandeja();

        } catch (error) {
            notifier.show({
                tipo: "error",
                titulo: "Fallo al comentar",
                mensaje: error.message
            });
        }
    }
}
