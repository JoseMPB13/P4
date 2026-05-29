// frontend/js/components/Dashboard.js
/**
 * Componente Dashboard.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Recibe el selector del contenedor y guarda la referencia en el DOM.
 * 2. Render: Limpia el contenedor principal y pinta la estructura base (cargador/spinner).
 * 3. Fetch Data (Efecto Secundario): Ejecuta de forma asíncrona la petición al backend para obtener reportes.
 * 4. Render Table: Reemplaza la estructura base con la tabla de datos procesados.
 *    - Determina el rol del usuario autenticado (estudiante, personal_mantenimiento, admin).
 *    - Si es técnico o administrador, renderiza un select editable por fila para actualizar el estado en la base de datos.
 *    - Si es estudiante o visitante, renderiza una etiqueta estática (badge).
 * 5. Event Binding: Asocia un event listener de delegación de eventos al contenedor para capturar cambios
 *    en los dropdowns de estado sin re-bindear en cada fila.
 */

import { apiFetch } from "../services/api.js";
import { authService } from "../services/authService.js";

export class Dashboard {
    /**
     * Inicializa el componente Dashboard.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     * @param {Function} alCambiarEstado - Callback opcional ejecutado al actualizar el estado de un reporte.
     */
    constructor(selectorContenedor, alCambiarEstado = null) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.alCambiarEstado = alCambiarEstado;
        this.inicializado = false;
    }

    /**
     * Ejecuta el rendering de la interfaz del dashboard y obtiene reportes de la API.
     */
    async render() {
        if (!this.contenedor) return;

        // Renderizado del loader inicial (Simula estado de carga)
        this.contenedor.innerHTML = `
            <div class="card bg-glass border-0 shadow-lg p-5 rounded-4 mt-4 text-center">
                <div class="spinner-border text-info mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Cargando incidencias...</span>
                </div>
                <h5 class="text-white fw-semibold">Cargando incidencias del campus...</h5>
            </div>
        `;

        try {
            // Petición al endpoint público de reportes
            const respuesta = await apiFetch("/reportes/");
            if (!respuesta.ok) {
                throw new Error("No se pudo conectar con el servidor de datos.");
            }
            const reportes = await respuesta.json();

            // Renderizar la tabla principal con los datos recibidos
            this.renderTabla(reportes);

            // Registrar los eventos únicamente en el primer render para evitar duplicados
            if (!this.inicializado) {
                this.inicializarEventos();
                this.inicializado = true;
            }

        } catch (error) {
            this.contenedor.innerHTML = `
                <div class="card bg-glass border-0 shadow-lg p-5 rounded-4 mt-4 text-center">
                    <i class="bi bi-cloud-slash-fill text-danger display-4 mb-3"></i>
                    <h4 class="text-white fw-bold">Error de Conexión</h4>
                    <p class="text-white-60">${error.message}</p>
                    <button class="btn btn-outline-light rounded-pill btn-sm mt-2 px-3" onclick="window.location.reload()">
                        Reintentar <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            `;
        }
    }

    /**
     * Renderiza la tabla completa con el listado de reportes.
     * @param {Array} reportes - Lista de incidencias de la base de datos.
     */
    renderTabla(reportes) {
        const usuarioActual = authService.getUsuarioActual();
        const esPersonalAutorizado = usuarioActual && (usuarioActual.rol === "personal_mantenimiento" || usuarioActual.rol === "admin");

        if (reportes.length === 0) {
            this.contenedor.innerHTML = `
                <div class="card bg-glass border-0 shadow-lg p-5 rounded-4 mt-4 text-center">
                    <i class="bi bi-clipboard-check text-success display-4 mb-3"></i>
                    <h4 class="text-white fw-bold">Sin Novedades</h4>
                    <p class="text-white-60 mb-0">No hay problemas de infraestructura reportados actualmente en la universidad.</p>
                </div>
            `;
            return;
        }

        // Mapea las filas de la tabla de forma dinámica
        const filasHTML = reportes.map(reporte => {
            const fechaStr = new Date(reporte.creado_en).toLocaleString("es-BO", {
                dateStyle: "short",
                timeStyle: "short"
            });
            const autor = reporte.usuario ? reporte.usuario.nombre : "Anónimo";

            // Renderizado condicional del estado (Select para personal autorizado, Badge estático para estudiantes)
            let estadoHTML = "";
            if (esPersonalAutorizado) {
                estadoHTML = `
                    <select class="form-select form-select-sm bg-dark text-white border-0 select-estado select-estado-glass" data-id="${reporte.id}">
                        <option value="pendiente" ${reporte.estado === "pendiente" ? "selected" : ""}>⚠️ Pendiente</option>
                        <option value="en proceso" ${reporte.estado === "en proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                        <option value="resuelto" ${reporte.estado === "resuelto" ? "selected" : ""}>✅ Resuelto</option>
                    </select>
                `;
            } else {
                let badgeClass = "bg-warning text-dark";
                if (reporte.estado === "en proceso") badgeClass = "bg-info text-dark";
                if (reporte.estado === "resuelto") badgeClass = "bg-success text-white";
                
                estadoHTML = `
                    <span class="badge rounded-pill ${badgeClass} px-3 py-2 fw-semibold">
                        ${reporte.estado.toUpperCase()}
                    </span>
                `;
            }

            return `
                <tr>
                    <td class="fw-bold text-white-60">#${reporte.id}</td>
                    <td>
                        <div class="fw-bold text-white">${reporte.titulo}</div>
                        <small class="text-white-50 text-truncate d-inline-block" style="max-width: 250px;">${reporte.descripcion}</small>
                    </td>
                    <td>
                        <span class="text-white"><i class="bi bi-geo-alt-fill text-warning me-1"></i>${reporte.ubicacion}</span>
                    </td>
                    <td>
                        <span class="badge bg-secondary text-white-80 text-capitalize">${reporte.tipo_problema}</span>
                    </td>
                    <td>
                        <div class="text-white-80 font-monospace small">${autor}</div>
                        <div class="text-white-50 small">${fechaStr}</div>
                    </td>
                    <td>${estadoHTML}</td>
                </tr>
            `;
        }).join("");

        // Inyecta el contenedor de la tabla en el DOM
        this.contenedor.innerHTML = `
            <div class="card bg-glass border-0 shadow-lg p-4 rounded-4 mt-4 transition-hover">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3 class="fw-bold text-white mb-0">
                        <i class="bi bi-list-task text-info me-2"></i>Monitoreo de Incidencias
                    </h3>
                    <button class="btn btn-outline-light btn-sm rounded-pill py-1.5 px-3" id="btn-refrescar-dashboard">
                        <i class="bi bi-arrow-clockwise me-1"></i> Refrescar
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-hover text-white align-middle mb-0">
                        <thead class="text-white-60 border-bottom border-secondary">
                            <tr>
                                <th scope="col" style="width: 5%">ID</th>
                                <th scope="col" style="width: 35%">Incidencia</th>
                                <th scope="col" style="width: 20%">Ubicación</th>
                                <th scope="col" style="width: 15%">Tipo</th>
                                <th scope="col" style="width: 15%">Reportado por</th>
                                <th scope="col" style="width: 10%">Estado</th>
                            </tr>
                        </thead>
                        <tbody class="border-0">
                            ${filasHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Vincula y gestiona eventos de cambio e interactividad del dashboard.
     */
    inicializarEventos() {
        // Event Delegation para cambios en dropdowns de estado
        this.contenedor.addEventListener("change", async (e) => {
            if (e.target.matches(".select-estado")) {
                const reporteId = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                
                await this.actualizarEstadoReporte(reporteId, nuevoEstado, e.target);
            }
        });

        // Click en botón refrescar
        this.contenedor.addEventListener("click", async (e) => {
            const btnRefrescar = e.target.closest("#btn-refrescar-dashboard");
            if (btnRefrescar) {
                const icon = btnRefrescar.querySelector("i");
                if (icon) icon.classList.add("spin-animation");
                await this.render();
            }
        });
    }

    /**
     * Envía la petición PUT a la API para modificar el estado de una incidencia.
     * @param {string|number} id - ID único del reporte.
     * @param {string} nuevoEstado - El valor del nuevo estado ('pendiente', 'en proceso', 'resuelto').
     * @param {HTMLElement} selectEl - Referencia al elemento select para restauración en caso de error.
     */
    async actualizarEstadoReporte(id, nuevoEstado, selectEl) {
        const valorAnterior = selectEl.defaultValue;
        
        try {
            // Envía la petición PUT usando apiFetch
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
                const data = await respuesta.json();
                throw new Error(data.error || data.detail || "No autorizado o error del servidor.");
            }

            // Avisar al callback de cambio de estado (refrescar estadísticas, etc.)
            if (this.alCambiarEstado) {
                await this.alCambiarEstado();
            }

            // Guardamos el nuevo valor como default
            selectEl.defaultValue = nuevoEstado;

        } catch (error) {
            alert(`❌ Error al actualizar estado: ${error.message}`);
            // Restaurar el select a su valor previo en caso de error
            selectEl.value = valorAnterior;
        }
    }
}
