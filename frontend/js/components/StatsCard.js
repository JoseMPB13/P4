// frontend/js/components/StatsCard.js
/**
 * Componente StatsCard.
 * Responsabilidad: Inyectar la interfaz de tarjetas de estadísticas agregadas
 * en el contenedor correspondiente del DOM y cargar los contadores dinámicamente.
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
     * Inyecta la estructura HTML base del componente en el DOM.
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div class="row g-3 mt-2">
                <div class="col-4">
                    <div class="p-3 bg-glass rounded-3 text-center">
                        <div class="h2 fw-bold text-warning mb-0" id="stats-total">0</div>
                        <small class="text-white-60">Creados</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 bg-glass rounded-3 text-center">
                        <div class="h2 fw-bold text-info mb-0" id="stats-proceso">0</div>
                        <small class="text-white-60">En Curso</small>
                    </div>
                </div>
                <div class="col-4">
                    <div class="p-3 bg-glass rounded-3 text-center">
                        <div class="h2 fw-bold text-success mb-0" id="stats-resuelto">0</div>
                        <small class="text-white-60">Resueltos</small>
                    </div>
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
