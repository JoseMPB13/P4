// frontend/js/components/AdminDashboard.js
/**
 * Componente AdminDashboard.
 * Responsabilidad: Agrupar y coordinar la renderización del panel de control
 * correspondiente a usuarios con rol de Administrador (Acceso total).
 */

import { StatsCard } from "./StatsCard.js";
import { ReportForm } from "./ReportForm.js";
import { Dashboard } from "./Dashboard.js";

export class AdminDashboard {
    /**
     * Inicializa el panel de Administración.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Ciclo de Renderizado:
     * 1. Inyecta los contenedores secundarios (estadísticas, formulario de reporte y tabla interactiva).
     * 2. Inicializa e inyecta StatsCard, Dashboard y ReportForm.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                <div style="margin-bottom: 2rem;">
                    <span class="badge-minimal badge-success" style="background-color: rgba(16, 185, 129, 0.15); color: var(--accent-green);">Administrador</span>
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Panel de Administración</h2>
                    <p class="text-muted-custom">Supervisa el estado del campus, reporta nuevas fallas y modifica prioridades y estados.</p>
                </div>
                
                <!-- Contenedor para estadísticas del administrador -->
                <div id="admin-stats"></div>
                
                <!-- Contenedor grid para reportar y monitorear -->
                <div class="spa-grid" style="margin-top: 2rem; padding: 0;">
                    <div id="admin-form"></div>
                    <div id="admin-dashboard"></div>
                </div>
            </div>
        `;

        // Renderizado del componente StatsCard
        const statsCard = new StatsCard("#admin-stats");
        statsCard.render();
        await statsCard.actualizarContadores();

        // Renderizado del componente Dashboard
        const dashboard = new Dashboard("#admin-dashboard", async () => {
            await statsCard.actualizarContadores();
        });
        await dashboard.render();

        // Renderizado del componente ReportForm
        const reportForm = new ReportForm("#admin-form", async () => {
            await dashboard.render();
            await statsCard.actualizarContadores();
        });
        reportForm.render();
    }
}
