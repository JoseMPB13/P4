// frontend/js/components/EstudianteDashboard.js
/**
 * Componente EstudianteDashboard.
 * Responsabilidad: Agrupar y coordinar la renderización del panel de control
 * correspondiente a usuarios con rol de Estudiante (Reportar incidencias y ver estadísticas).
 */

import { StatsCard } from "./StatsCard.js";
import { ReportForm } from "./ReportForm.js";
import { Dashboard } from "./Dashboard.js";

export class EstudianteDashboard {
    /**
     * Inicializa el panel de Estudiante.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Ciclo de Renderizado:
     * 1. Inyecta los contenedores secundarios específicos del estudiante (estadísticas, formulario y tabla).
     * 2. Inicializa y renderiza el componente StatsCard.
     * 3. Inicializa y renderiza el componente Dashboard para visualización de incidencias.
     * 4. Inicializa y renderiza el componente ReportForm para creación de incidencias.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                <div style="margin-bottom: 2rem;">
                    <span class="badge-minimal badge-info">Estudiante</span>
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Panel del Estudiante</h2>
                    <p class="text-muted-custom">Reporta y realiza el seguimiento a las incidencias de infraestructura del campus.</p>
                </div>
                
                <!-- Contenedor para la tarjeta de estadísticas agregadas -->
                <div id="estudiante-stats"></div>
                
                <!-- Contenedor grid para el formulario y el monitoreo -->
                <div class="spa-grid" style="margin-top: 2rem; padding: 0;">
                    <div id="estudiante-form"></div>
                    <div id="estudiante-dashboard"></div>
                </div>
            </div>
        `;

        // Renderizado del componente StatsCard
        const statsCard = new StatsCard("#estudiante-stats");
        statsCard.render();
        await statsCard.actualizarContadores();

        // Renderizado del componente Dashboard
        const dashboard = new Dashboard("#estudiante-dashboard", async () => {
            await statsCard.actualizarContadores();
        });
        await dashboard.render();

        // Renderizado del componente ReportForm con callback reactivo de actualización
        const reportForm = new ReportForm("#estudiante-form", async () => {
            await dashboard.render();
            await statsCard.actualizarContadores();
        });
        reportForm.render();
    }
}
