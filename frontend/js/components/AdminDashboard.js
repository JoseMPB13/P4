// frontend/js/components/AdminDashboard.js
/**
 * Componente AdminDashboard.
 * 
 * Responsabilidad:
 * 1. Renderizar la vista para el rol Administrador.
 * 2. Visualizar métricas globales en un grid limpio (Total, Resueltos, Pendientes).
 * 3. Mostrar una tabla de auditoría visual avanzada con todos los reportes,
 *    permitiendo cambiar el estado (PUT) y eliminar (DELETE) reportes físicamente.
 * 4. Mostrar una tarjeta lateral de monitoreo técnico (Base de Datos, Redis, Cache, Latencia).
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Asigna contenedor y guarda la referencia de inicialización.
 * 2. Render: Dibuja la grilla global y los contenedores de auditoría.
 * 3. Cargar Datos (Efecto): Realiza fetch de reportes, calcula estadísticas,
 *    e inyecta la tabla de auditoría y las métricas del sistema.
 */

import { apiFetch } from "../services/api.js";

export class AdminDashboard {
    /**
     * Inicializa el panel del Administrador.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.inicializado = false;
    }

    /**
     * Dibuja el marco de la SPA del Administrador.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                
                <!-- Encabezado de la página -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <span class="badge-minimal badge-success" style="background-color: rgba(16, 185, 129, 0.15); color: var(--accent-green);">Administrador</span>
                        <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Panel de Administración</h2>
                        <p class="text-muted-custom">Consola de auditoría, control de estados y diagnóstico técnico de infraestructura.</p>
                    </div>
                    <button class="btn-minimal btn-outline" id="btn-refresh-admin" style="padding: 0.5rem 0.85rem;">
                        <i class="bi bi-arrow-clockwise" id="admin-refresh-icon"></i> Refrescar
                    </button>
                </div>

                <!-- Grid de Métricas Globales -->
                <div class="stats-grid-minimal" id="admin-metrics-grid" style="margin-bottom: 2rem;">
                    <div class="stat-box-minimal">
                        <div class="stat-number info">0</div>
                        <div class="stat-label">Cargando...</div>
                    </div>
                </div>

                <!-- Grid Principal (Auditoría a la izquierda, Diagnóstico a la derecha) -->
                <div class="spa-grid" style="grid-template-columns: 2fr 1fr; padding: 0;">
                    
                    <!-- Columna Izquierda: Listado y Acciones de Auditoría -->
                    <div>
                        <div style="margin-bottom: 1rem;">
                            <h3 style="font-weight: 700; margin: 0;">Auditoría de Incidencias</h3>
                        </div>
                        <div class="table-wrapper">
                            <table class="table-minimal" id="admin-audit-table">
                                <thead>
                                    <tr>
                                        <th style="width: 8%">ID</th>
                                        <th style="width: 32%">Incidencia</th>
                                        <th style="width: 20%">Ubicación</th>
                                        <th style="width: 20%">Reportado Por</th>
                                        <th style="width: 15%">Estado</th>
                                        <th style="width: 5%">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 3rem;">
                                            <div class="loader-spinner" style="margin: 0 auto;"></div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Columna Derecha: Diagnóstico de Servidores e Infraestructura -->
                    <div>
                        <div style="margin-bottom: 1rem;">
                            <h3 style="font-weight: 700; margin: 0;">Diagnóstico Técnico</h3>
                        </div>
                        <div class="flat-card" style="padding: 1.5rem;">
                            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; color: var(--text-primary);">
                                <i class="bi bi-cpu" style="color: var(--accent); margin-right: 0.5rem;"></i> Estado de Servidores
                            </h4>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.8125rem;">
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Base de Datos</span>
                                    <span style="color: var(--accent-green); font-weight: 600;">PostgreSQL (Supabase)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Cola de Eventos</span>
                                    <span style="color: var(--accent-green); font-weight: 600;">Redis Upstash (Online)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">API Endpoint</span>
                                    <span style="font-family: monospace; color: var(--text-secondary);">/api/v1 (FastAPI)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Latencia API</span>
                                    <span style="color: var(--accent-green); font-weight: 600;" id="api-latency">34 ms</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding-bottom: 0.25rem;">
                                    <span class="text-muted-custom">Nivel de Seguridad</span>
                                    <span style="color: var(--accent-blue); font-weight: 600;">JWT JWT/Bearer</span>
                                </div>
                            </div>
                            
                            <!-- Acciones del Sistema -->
                            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                <button class="btn-minimal btn-outline" id="btn-mock-cache" style="font-size: 0.75rem; justify-content: center; padding: 0.5rem;">
                                    <i class="bi bi-trash2 me-1"></i> Limpiar Caché de Redis
                                </button>
                                <button class="btn-minimal btn-text" id="btn-mock-logs" style="font-size: 0.75rem; justify-content: center; color: var(--text-secondary);">
                                    <i class="bi bi-download me-1"></i> Descargar Logs del Sistema
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Cargar datos del servidor
        await this.cargarDatos();

        // Registrar listeners de eventos de forma única
        if (!this.inicializado) {
            this.inicializarEventos();
            this.inicializado = true;
        }
    }

    /**
     * Consulta la API, computa métricas e inyecta los resultados en la UI.
     */
    async cargarDatos() {
        const metricsGrid = document.getElementById("admin-metrics-grid");
        const auditTableBody = document.querySelector("#admin-audit-table tbody");

        try {
            const tiempoInicio = performance.now();
            const respuesta = await apiFetch("/reportes/");
            const tiempoFin = performance.now();
            
            // Actualizar latencia calculada
            const latencyEl = document.getElementById("api-latency");
            if (latencyEl) {
                latencyEl.textContent = `${Math.round(tiempoFin - tiempoInicio)} ms`;
            }

            if (!respuesta.ok) {
                throw new Error("Fallo al establecer enlace de auditoría.");
            }

            const reportes = await respuesta.json();

            // Calcular Métricas
            const total = reportes.length;
            const resueltos = reportes.filter(r => r.estado === "resuelto").length;
            const pendientes = reportes.filter(r => r.estado === "pendiente").length;
            const enProceso = reportes.filter(r => r.estado === "en proceso").length;

            // Inyectar Métricas
            if (metricsGrid) {
                metricsGrid.innerHTML = `
                    <div class="stat-box-minimal">
                        <div class="stat-number" style="color: var(--text-primary);">${total}</div>
                        <div class="stat-label">Total Incidencias</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number warning">${pendientes}</div>
                        <div class="stat-label">Pendientes</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number info" style="color: var(--accent-blue);">${enProceso}</div>
                        <div class="stat-label">En Proceso</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number success">${resueltos}</div>
                        <div class="stat-label">Resueltas</div>
                    </div>
                `;
            }

            // Inyectar Filas de Auditoría
            if (auditTableBody) {
                if (total === 0) {
                    auditTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                                No hay incidencias registradas en la base de datos.
                            </td>
                        </tr>
                    `;
                    return;
                }

                auditTableBody.innerHTML = reportes.map(rep => {
                    const reporter = rep.usuario ? rep.usuario.nombre : "Anónimo";
                    
                    const fotoHTML = rep.imagen_url ? `
                        <a href="${rep.imagen_url}" target="_blank" title="Ver evidencia fotográfica" style="margin-left: 0.5rem; color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem;">
                            <i class="bi bi-image"></i> Ver Foto
                        </a>
                    ` : "";

                    return `
                        <tr>
                            <td style="font-weight: 600; color: var(--text-secondary);">#${rep.id}</td>
                            <td>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.15rem; display: flex; align-items: center;">
                                    ${rep.titulo}
                                    ${fotoHTML}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${rep.descripcion}
                                </div>
                            </td>
                            <td><span style="font-size: 0.8125rem;">${rep.ubicacion}</span></td>
                            <td><div style="font-weight: 500; font-size: 0.8125rem;">${reporter}</div></td>
                            <td>
                                <select class="select-minimal select-admin-estado" data-id="${rep.id}">
                                    <option value="pendiente" ${rep.estado === "pendiente" ? "selected" : ""}>⚠️ Pendiente</option>
                                    <option value="en proceso" ${rep.estado === "en proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                                    <option value="resuelto" ${rep.estado === "resuelto" ? "selected" : ""}>✅ Resuelto</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn-minimal btn-text btn-admin-eliminar" data-id="${rep.id}" style="color: #ef4444; padding: 0.25rem;">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join("");
            }

        } catch (error) {
            if (auditTableBody) {
                auditTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 3rem; color: #ef4444;">
                            ⚠️ Error al conectar con el servidor: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    /**
     * Vincula listeners utilizando delegación de eventos.
     */
    inicializarEventos() {
        // Delegar clics y cambios de estado en la tabla
        this.contenedor.addEventListener("click", async (e) => {
            // Acción Eliminar Reporte (Purga)
            const btnEliminar = e.target.closest(".btn-admin-eliminar");
            if (btnEliminar) {
                const id = btnEliminar.dataset.id;
                if (confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente el reporte #${id}? Esta acción es irreversible.`)) {
                    await this.eliminarReporte(id);
                }
            }

            // Acción mock limpiar caché de Redis
            const btnCache = e.target.closest("#btn-mock-cache");
            if (btnCache) {
                btnCache.innerHTML = `<span class="loader-spinner" style="margin-right: 0.25rem;"></span> Limpiando...`;
                setTimeout(() => {
                    alert("✅ Caché purgada y sincronizada con Supabase.");
                    btnCache.innerHTML = `<i class="bi bi-trash2 me-1"></i> Limpiar Caché de Redis`;
                }, 1000);
            }

            // Acción mock descargar logs
            const btnLogs = e.target.closest("#btn-mock-logs");
            if (btnLogs) {
                alert("📥 Descargando archivo de logs del sistema (system_audit.log)...");
            }

            // Refrescar manual
            const btnRefresh = e.target.closest("#btn-refresh-admin");
            if (btnRefresh) {
                const icon = document.getElementById("admin-refresh-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.cargarDatos();
            }
        });

        // Capturar cambios en dropdown de estado de administración
        this.contenedor.addEventListener("change", async (e) => {
            if (e.target.matches(".select-admin-estado")) {
                const id = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                await this.actualizarEstado(id, nuevoEstado, e.target);
            }
        });
    }

    /**
     *PUT para cambiar el estado.
     */
    async actualizarEstado(id, nuevoEstado, selectEl) {
        const previo = selectEl.defaultValue;

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
                throw new Error("No autorizado o error de servidor.");
            }

            selectEl.defaultValue = nuevoEstado;
            await this.cargarDatos();

        } catch (error) {
            alert(`❌ Error al actualizar estado: ${error.message}`);
            selectEl.value = previo;
        }
    }

    /**
     * DELETE para purgar el reporte de la BD.
     */
    async eliminarReporte(id) {
        try {
            const respuesta = await apiFetch(`/reportes/${id}`, {
                method: "DELETE"
            });

            if (!respuesta.ok) {
                throw new Error("No autorizado o error del servidor.");
            }

            // Recargar datos tras eliminar exitosamente
            await this.cargarDatos();

        } catch (error) {
            alert(`❌ Error al eliminar reporte: ${error.message}`);
        }
    }
}
