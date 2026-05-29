// frontend/js/components/EstudianteDashboard.js
/**
 * Componente EstudianteDashboard.
 * 
 * Responsabilidad:
 * 1. Renderizar la vista adaptada para estudiantes.
 * 2. Cargar el formulario minimalista para reportar incidencias.
 * 3. Cargar un listado plano de tarjetas para revisar exclusivamente las incidencias creadas por el propio estudiante.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Asigna el contenedor principal y recupera el usuario del sessionStorage.
 * 2. Render: Inicializa la estructura del grid.
 * 3. Cargar Reportes Propios (Efecto Secundario): Consume la API, filtra por `usuario_id` del estudiante actual
 *    y renderiza los elementos en formato de tarjetas individuales minimalistas.
 */

import { authService } from "../services/authService.js";
import { ReportForm } from "./ReportForm.js";
import { apiFetch } from "../services/api.js";

export class EstudianteDashboard {
    /**
     * Inicializa la vista de estudiante.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.usuarioActual = authService.getUsuarioActual();
    }

    /**
     * Dibuja el marco de la SPA y lanza la carga del formulario y de las tarjetas.
     */
    async render() {
        if (!this.contenedor || !this.usuarioActual) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                <!-- Encabezado de la página -->
                <div style="margin-bottom: 2rem;">
                    <span class="badge-minimal badge-info">Estudiante</span>
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Mis Incidencias</h2>
                    <p class="text-muted-custom">Registra desperfectos del campus y mantente al tanto del estado de resolución.</p>
                </div>

                <!-- Grid de dos columnas (Formulario a la izquierda, Tarjetas a la derecha) -->
                <div class="spa-grid" style="padding: 0;">
                    <!-- Columna de reporte -->
                    <div id="estudiante-form-col"></div>
                    
                    <!-- Columna de tarjetas (Mis Reportes) -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                            <h3 style="font-weight: 700; margin: 0;">Historial de Reportes</h3>
                            <button class="btn-minimal btn-outline" id="btn-refresh-estudiante" style="padding: 0.4rem 0.75rem;">
                                <i class="bi bi-arrow-clockwise" id="est-refresh-icon"></i>
                            </button>
                        </div>
                        <div id="estudiante-cards-container" style="display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Cargador spinner -->
                            <div class="flat-card" style="text-align: center; padding: 3rem 1.5rem;">
                                <div class="loader-spinner" style="margin: 0 auto 1rem auto;"></div>
                                <span class="text-muted-custom">Cargando tus reportes...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Renderizar el formulario minimalista en su columna
        const form = new ReportForm("#estudiante-form-col", async () => {
            // Callback reactivo al reportar con éxito
            await this.cargarMisReportes();
        });
        form.render();

        // Cargar y filtrar el listado de incidencias del estudiante
        await this.cargarMisReportes();

        // Vincular el evento del botón refrescar
        const btnRefresh = document.getElementById("btn-refresh-estudiante");
        if (btnRefresh) {
            btnRefresh.addEventListener("click", async () => {
                const icon = document.getElementById("est-refresh-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.cargarMisReportes();
            });
        }
    }

    /**
     * Consume la API global de incidencias y filtra por el ID del usuario en sesión.
     */
    async cargarMisReportes() {
        const cardsContainer = document.getElementById("estudiante-cards-container");
        if (!cardsContainer) return;

        try {
            const respuesta = await apiFetch("/reportes/");
            if (!respuesta.ok) {
                throw new Error("No se pudo conectar con el servidor.");
            }
            const reportes = await respuesta.json();

            // Filtrar exclusivamente los creados por este estudiante
            const misReportes = reportes.filter(r => r.usuario_id === this.usuarioActual.id);

            // Renderizar listado o estado vacío
            if (misReportes.length === 0) {
                cardsContainer.innerHTML = `
                    <div class="flat-card" style="text-align: center; padding: 4rem 2rem;">
                        <i class="bi bi-check2-circle" style="color: var(--accent-green); font-size: 2.5rem; margin-bottom: 1rem; display: block;"></i>
                        <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Sin reportes</h4>
                        <p class="text-muted-custom" style="max-width: 250px; margin: 0 auto;">No has registrado ningún problema de infraestructura todavía.</p>
                    </div>
                `;
                return;
            }

            // Dibuja las tarjetas individuales minimalistas
            cardsContainer.innerHTML = misReportes.map(reporte => {
                const fechaStr = new Date(reporte.creado_en).toLocaleString("es-BO", {
                    dateStyle: "short",
                    timeStyle: "short"
                });

                // Asignar clase de estado del badge
                let badgeClass = "badge-warning";
                if (reporte.estado === "en proceso") badgeClass = "badge-info";
                if (reporte.estado === "resuelto") badgeClass = "badge-success";

                return `
                    <div class="flat-card" style="border-left: 3px solid var(--accent); transition: transform 0.2s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <h4 style="font-weight: 700; margin: 0; font-size: 1.05rem; color: var(--text-primary);">${reporte.titulo}</h4>
                            <span class="badge-minimal ${badgeClass}">${reporte.estado.toUpperCase()}</span>
                        </div>
                        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">
                            ${reporte.descripcion}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                            <span><i class="bi bi-geo-alt-fill" style="margin-right: 0.25rem;"></i> ${reporte.ubicacion}</span>
                            <span><i class="bi bi-calendar3" style="margin-right: 0.25rem;"></i> ${fechaStr}</span>
                        </div>
                    </div>
                `;
            }).join("");

        } catch (error) {
            cardsContainer.innerHTML = `
                <div class="flat-card" style="text-align: center; padding: 2rem 1rem;">
                    <i class="bi bi-exclamation-triangle" style="color: #ef4444; font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <h5 style="font-weight: 700; margin-bottom: 0.25rem;">Error al cargar datos</h5>
                    <span class="text-muted-custom">${error.message}</span>
                </div>
            `;
        }
    }
}
