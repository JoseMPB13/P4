// frontend/js/components/PersonalDashboard.js
/**
 * Componente PersonalDashboard.
 * 
 * Responsabilidad:
 * 1. Renderizar la bandeja de entrada para el personal técnico.
 * 2. Cargar una lista compacta con todas las incidencias pendientes (pendiente / en proceso) en la universidad.
 * 3. Proveer botones de acción sutiles para cambiar el estado rápidamente a "En Proceso" o "Resuelto".
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Asigna el contenedor principal y vincula listeners de eventos.
 * 2. Render: Inicializa la estructura del contenedor.
 * 3. Cargar Bandeja de Incidencias (Efecto Secundario): Solicita a la API los reportes,
 *    filtra los pendientes y renderiza la bandeja compacta.
 * 4. Cambiar Estado Handler: Ejecuta PUT contra el endpoint de reportes, refrescando la bandeja.
 */

import { apiFetch } from "../services/api.js";
import { StatsCard } from "./StatsCard.js";

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
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Bandeja de Incidencias</h2>
                    <p class="text-muted-custom">Listado compacto de problemas reportados activos y listos para atender en el campus.</p>
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

                    <!-- Contenedor de lista tipo inbox -->
                    <div id="personal-inbox-container" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="flat-card" style="text-align: center; padding: 3rem 1.5rem;">
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

        // Cargar bandeja de tareas pendientes
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
            const respuesta = await apiFetch("/reportes/");
            if (!respuesta.ok) {
                throw new Error("Error al obtener la lista de incidencias.");
            }
            const reportes = await respuesta.json();

            // Filtrar incidencias pendientes (todo excepto resuelto)
            const activas = reportes.filter(r => r.estado !== "resuelto");

            if (activas.length === 0) {
                inboxContainer.innerHTML = `
                    <div class="flat-card" style="text-align: center; padding: 4rem 2rem;">
                        <i class="bi bi-emoji-smile" style="color: var(--accent-green); font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                        <h4 style="font-weight: 700; margin-bottom: 0.5rem;">¡Bandeja vacía!</h4>
                        <p class="text-muted-custom">No hay incidencias pendientes. ¡Buen trabajo!</p>
                    </div>
                `;
                return;
            }

            // Inyectar ítems compactos tipo inbox
            inboxContainer.innerHTML = activas.map(item => {
                const fechaStr = new Date(item.creado_en).toLocaleString("es-BO", {
                    dateStyle: "short",
                    timeStyle: "short"
                });
                const reportante = item.usuario ? item.usuario.nombre : "Anónimo";

                // Determinar el borde y estilo del indicador según el estado
                const esEnProceso = item.estado === "en proceso";
                const colorBorde = esEnProceso ? "#3b82f6" : "var(--accent)";
                const badgeClass = esEnProceso ? "badge-info" : "badge-warning";

                return `
                    <div class="flat-card" style="border-left: 4px solid ${colorBorde}; padding: 1.25rem 1.5rem; transition: background 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; gap: 1rem;">
                            <div>
                                <span class="badge-minimal ${badgeClass}" style="margin-bottom: 0.5rem;">${item.estado.toUpperCase()}</span>
                                <h4 style="font-weight: 700; margin: 0; font-size: 1.1rem; color: var(--text-primary);">${item.titulo}</h4>
                            </div>
                            <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                                ${!esEnProceso ? `
                                    <button class="btn-minimal btn-outline btn-inbox-estado" data-id="${item.id}" data-estado="en proceso" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
                                        ⚙️ Trabajar
                                    </button>
                                ` : ""}
                                <button class="btn-minimal btn-accent btn-inbox-estado" data-id="${item.id}" data-estado="resuelto" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; background-color: var(--accent-green); color: white;">
                                    ✅ Resolver
                                </button>
                            </div>
                        </div>
                        
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">
                            ${item.descripcion}
                        </p>
                        
                        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); gap: 0.5rem;">
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
                <div class="flat-card" style="text-align: center; padding: 2rem 1rem;">
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
        // Capturar clics de los botones de cambio de estado
        this.contenedor.addEventListener("click", async (e) => {
            const btn = e.target.closest(".btn-inbox-estado");
            if (btn) {
                const id = btn.dataset.id;
                const nuevoEstado = btn.dataset.estado;
                await this.cambiarEstado(id, nuevoEstado);
            }

            const btnRefresh = e.target.closest("#btn-refresh-personal");
            if (btnRefresh) {
                const icon = document.getElementById("pers-refresh-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.cargarBandeja();
                if (this.stats) await this.stats.actualizarContadores();
            }
        });
    }

    /**
     * Ejecuta PUT al servidor para cambiar el estado.
     */
    async cambiarEstado(id, nuevoEstado) {
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
                throw new Error("No fue posible actualizar la incidencia.");
            }

            // Recargar la bandeja y contadores
            await this.cargarBandeja();
            if (this.stats) {
                await this.stats.actualizarContadores();
            }

        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        }
    }
}
