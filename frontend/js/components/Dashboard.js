// frontend/js/components/Dashboard.js
/**
 * Componente Dashboard.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Guarda la referencia al elemento contenedor en el DOM.
 * 2. Render: Limpia el contenedor principal e inyecta un estado de carga/spinner minimalista.
 * 3. Fetch Data (Efecto Secundario): Solicita asíncronamente las incidencias a la API.
 * 4. Render Table: Pinta las filas de la tabla minimalista (.table-minimal) e inyecta selects (.select-minimal)
 *    de estado si el rol de usuario es técnico o administrador, o badges (.badge-minimal) estáticos en caso de estudiante.
 * 5. Event Binding: Aplica delegación de eventos al contenedor para capturar cambios en selects o clics en el botón de actualización.
 */

import { apiFetch } from "../services/api.js";
import { authService } from "../services/authService.js";

export class Dashboard {
    /**
     * Inicializa el componente Dashboard.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     * @param {Function} alCambiarEstado - Callback ejecutado tras actualizar con éxito un reporte.
     */
    constructor(selectorContenedor, alCambiarEstado = null) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.alCambiarEstado = alCambiarEstado;
        this.inicializado = false;
    }

    /**
     * Obtiene el listado de incidencias del backend y desencadena el renderizado de la tabla.
     */
    async render() {
        if (!this.contenedor) return;

        // Renderizado del estado de carga (loader minimalista)
        this.contenedor.innerHTML = `
            <div class="flat-card" style="text-align: center; padding: 4rem 2rem;">
                <div class="loader-spinner" style="width: 2.5rem; height: 2.5rem; margin-bottom: 1rem;"></div>
                <h5 style="color: var(--text-secondary); font-weight: 500;">Obteniendo información del campus...</h5>
            </div>
        `;

        try {
            const respuesta = await apiFetch("/reportes/");
            if (!respuesta.ok) {
                throw new Error("Imposible establecer comunicación con el servidor de datos.");
            }
            const reportes = await respuesta.json();

            // Renderizar tabla de reportes
            this.renderTabla(reportes);

            // Registrar listeners de delegación de eventos de forma única
            if (!this.inicializado) {
                this.inicializarEventos();
                this.inicializado = true;
            }

        } catch (error) {
            this.contenedor.innerHTML = `
                <div class="flat-card" style="text-align: center; padding: 3rem 2rem;">
                    <i class="bi bi-cloud-slash" style="color: #ef4444; font-size: 2.5rem; margin-bottom: 1rem; display: block;"></i>
                    <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Error de conexión</h4>
                    <p class="text-muted-custom" style="margin-bottom: 1.5rem;">${error.message}</p>
                    <button class="btn-minimal btn-outline" id="btn-reintentar-fetch">
                        Reintentar <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            `;

            const btnReintentar = document.getElementById("btn-reintentar-fetch");
            if (btnReintentar) {
                btnReintentar.addEventListener("click", () => this.render());
            }
        }
    }

    /**
     * Dibuja la estructura HTML de la tabla con los datos del servidor.
     * @param {Array} reportes - Lista de reportes.
     */
    renderTabla(reportes) {
        const usuarioActual = authService.getUsuarioActual();
        const esPersonalAutorizado = usuarioActual && (usuarioActual.rol === "personal_mantenimiento" || usuarioActual.rol === "admin");

        if (reportes.length === 0) {
            this.contenedor.innerHTML = `
                <div class="flat-card" style="text-align: center; padding: 4rem 2rem;">
                    <i class="bi bi-clipboard-check" style="color: var(--accent-green); font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Sin Novedades</h4>
                    <p class="text-muted-custom">No existen problemas reportados activos en la universidad.</p>
                </div>
            `;
            return;
        }

        // Crear las filas de la tabla de forma dinámica
        const filasHTML = reportes.map(reporte => {
            const fechaStr = new Date(reporte.creado_en).toLocaleString("es-BO", {
                dateStyle: "short",
                timeStyle: "short"
            });
            const autor = reporte.usuario ? reporte.usuario.nombre : "Anónimo";

            let estadoHTML = "";
            if (esPersonalAutorizado) {
                // Dropdown de cambio de estado interactivo
                estadoHTML = `
                    <select class="select-minimal select-estado" data-id="${reporte.id}">
                        <option value="pendiente" ${reporte.estado === "pendiente" ? "selected" : ""}>⚠️ Pendiente</option>
                        <option value="en proceso" ${reporte.estado === "en proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                        <option value="resuelto" ${reporte.estado === "resuelto" ? "selected" : ""}>✅ Resuelto</option>
                    </select>
                `;
            } else {
                // Badge de estado estático plano
                let badgeClass = "badge-warning";
                if (reporte.estado === "en proceso") badgeClass = "badge-info";
                if (reporte.estado === "resuelto") badgeClass = "badge-success";

                estadoHTML = `
                    <span class="badge-minimal ${badgeClass}">
                        ${reporte.estado.toUpperCase()}
                    </span>
                `;
            }

            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-secondary);">#${reporte.id}</td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${reporte.titulo}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${reporte.descripcion}
                        </div>
                    </td>
                    <td>
                        <span style="font-size: 0.875rem;"><i class="bi bi-geo-alt-fill" style="color: var(--accent); margin-right: 0.25rem;"></i>${reporte.ubicacion}</span>
                    </td>
                    <td>
                        <span style="font-size: 0.75rem; background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: capitalize;">
                            ${reporte.tipo_problema}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 500; font-size: 0.8125rem;">${autor}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${fechaStr}</div>
                    </td>
                    <td>${estadoHTML}</td>
                </tr>
            `;
        }).join("");

        // Inyecta el contenedor de la tabla en el DOM
        this.contenedor.innerHTML = `
            <div class="flat-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-weight: 700; margin: 0;">
                        <i class="bi bi-list-task" style="color: var(--accent-blue); margin-right: 0.5rem;"></i>Monitoreo de Incidencias
                    </h3>
                    <button class="btn-minimal btn-outline" id="btn-refrescar-dashboard" style="padding: 0.4rem 0.75rem;">
                        <i class="bi bi-arrow-clockwise" id="refrescar-icon"></i>
                    </button>
                </div>
                
                <div class="table-wrapper">
                    <table class="table-minimal">
                        <thead>
                            <tr>
                                <th style="width: 8%">ID</th>
                                <th style="width: 37%">Incidencia</th>
                                <th style="width: 20%">Ubicación</th>
                                <th style="width: 15%">Tipo</th>
                                <th style="width: 15%">Reportado por</th>
                                <th style="width: 5%">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Vincula el listener de cambio de estado empleando delegación de eventos.
     */
    inicializarEventos() {
        // Capturar cambios en los dropdowns de estado (.select-estado)
        this.contenedor.addEventListener("change", async (e) => {
            if (e.target.matches(".select-estado")) {
                const reporteId = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                await this.actualizarEstadoReporte(reporteId, nuevoEstado, e.target);
            }
        });

        // Capturar clics en botón de refresco
        this.contenedor.addEventListener("click", async (e) => {
            const btnRefrescar = e.target.closest("#btn-refrescar-dashboard");
            if (btnRefrescar) {
                const icon = document.getElementById("refrescar-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.render();
            }
        });
    }

    /**
     * Realiza petición PUT para modificar el estado y refrescar las vistas de la SPA.
     */
    async actualizarEstadoReporte(id, nuevoEstado, selectEl) {
        const valorPrevio = selectEl.defaultValue;

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
                const data = await respuesta.json();
                throw new Error(data.error || data.detail || "No autorizado o error de API.");
            }

            // Actualizar valor base
            selectEl.defaultValue = nuevoEstado;

            // Invocar callback si existe
            if (this.alCambiarEstado) {
                await this.alCambiarEstado();
            }

        } catch (error) {
            alert(`❌ Error al actualizar el estado: ${error.message}`);
            selectEl.value = valorPrevio;
        }
    }
}
