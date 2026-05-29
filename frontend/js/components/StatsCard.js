// frontend/js/components/StatsCard.js
/**
 * Componente StatsCard.
 * Responsabilidad: Inyectar la interfaz de tarjetas de estadísticas agregadas
 * en el contenedor correspondiente del DOM y cargar los contadores dinámicamente.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Asigna el contenedor.
 * 2. Render: Pinta el contenedor usando la rejilla de estadísticas minimalista (.stats-grid-minimal).
 * 3. Actualizar Contadores (Efecto): Realiza fetch, suma cantidades por estado e inyecta los resultados en el DOM.
 */

import { apiFetch } from "../services/api.js";

export class StatsCard {
    /**
     * Inicializa el componente.
     * @param {string} selectorContenedor - Selector CSS del contenedor donde inyectar el HTML.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Inyecta la estructura HTML base del componente en el DOM (Diseño plano y minimalista).
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div class="stats-grid-minimal">
                <div class="stat-box-minimal">
                    <div class="stat-number warning" id="stats-total">0</div>
                    <div class="stat-label">Creados</div>
                </div>
                <div class="stat-box-minimal">
                    <div class="stat-number info" id="stats-proceso">0</div>
                    <div class="stat-label">En Curso</div>
                </div>
                <div class="stat-box-minimal">
                    <div class="stat-number success" id="stats-resuelto">0</div>
                    <div class="stat-label">Resueltos</div>
                </div>
            </div>
        `;
    }

    /**
     * Consulta los datos del backend y actualiza los contadores de la UI.
     */
    async actualizarContadores() {
        try {
            // Llama al servicio API para obtener los reportes
            const respuesta = await apiFetch("/reportes/");
            if (!respuesta.ok) {
                throw new Error("No se pudieron cargar los reportes de la API.");
            }
            const reportes = await respuesta.json();

            // Calcula métricas
            const total = reportes.length;
            const enProceso = reportes.filter(r => r.estado === "en proceso").length;
            const resuelto = reportes.filter(r => r.estado === "resuelto").length;

            // Actualiza los elementos del DOM inyectados
            const totalEl = document.getElementById("stats-total");
            const procesoEl = document.getElementById("stats-proceso");
            const resueltoEl = document.getElementById("stats-resuelto");

            if (totalEl) totalEl.textContent = total;
            if (procesoEl) procesoEl.textContent = enProceso;
            if (resueltoEl) resueltoEl.textContent = resuelto;

        } catch (error) {
            console.warn("No se pudieron cargar las estadísticas en tiempo real: ", error.message);
        }
    }
}
