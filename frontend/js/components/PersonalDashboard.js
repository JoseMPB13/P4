// frontend/js/components/PersonalDashboard.js
/**
 * Componente PersonalDashboard.
 * Responsabilidad: Agrupar y coordinar la renderización del panel de control
 * correspondiente a usuarios con rol de Personal de Mantenimiento / Técnico (Gestión de estados).
 */

import { StatsCard } from "./StatsCard.js";
import { Dashboard } from "./Dashboard.js";

export class PersonalDashboard {
    /**
     * Inicializa el panel de Mantenimiento.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Ciclo de Renderizado:
     * 1. Inyecta los contenedores secundarios específicos (estadísticas y tabla interactiva de estados).
     * 2. Inicializa y renderiza el componente StatsCard.
     * 3. Inicializa y renderiza el componente Dashboard para la actualización interactiva de los estados.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                <div style="margin-bottom: 2rem;">
                    <span class="badge-minimal badge-warning">Técnico</span>
                    <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Panel de Mantenimiento</h2>
                    <p class="text-muted-custom">Gestiona las incidencias asignadas y actualiza el estado de las tareas de reparación.</p>
                </div>
                
                <!-- Contenedor para las estadísticas de mantenimiento -->
                <div id="personal-stats"></div>
                
                <!-- Contenedor para el monitoreo interactivo de los reportes -->
                <div id="personal-dashboard" style="margin-top: 2rem;"></div>
            </div>
        `;

        // Renderizado del componente StatsCard
        const statsCard = new StatsCard("#personal-stats");
        statsCard.render();
        await statsCard.actualizarContadores();

        // Renderizado del componente Dashboard
        const dashboard = new Dashboard("#personal-dashboard", async () => {
            await statsCard.actualizarContadores();
        });
        await dashboard.render();
    }
}
