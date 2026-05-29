// frontend/js/components/ReportForm.js
/**
 * Componente ReportForm.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Recibe el selector del contenedor del DOM donde se inyectará.
 * 2. Render: Evalúa el estado actual de autenticación (si hay un usuario logueado en sessionStorage).
 *    - Si está autenticado, inyecta la UI del formulario de reporte de incidencias.
 *    - Si no está autenticado, inyecta una vista de bloqueo invitando al usuario a iniciar sesión.
 * 3. Inicializar Eventos (Post-Render): Asocia listeners de eventos en el DOM (evento submit del formulario).
 * 4. Submit Handler: Captura los datos, valida con Bootstrap, inyecta el ID de usuario autenticado
 *    y llama a la API con apiFetch (POST /reportes/) inyectando automáticamente el JWT.
 */

import { apiFetch } from "../services/api.js";
import { authService } from "../services/authService.js";

export class ReportForm {
    /**
     * Inicializa el componente de formulario.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     * @param {Function} alEnviarExitoso - Callback opcional ejecutado al crear un reporte con éxito.
     */
    constructor(selectorContenedor, alEnviarExitoso = null) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.alEnviarExitoso = alEnviarExitoso;
    }

    /**
     * Determina el estado y renderiza la interfaz correspondiente en el DOM.
     */
    render() {
        if (!this.contenedor) return;

        const usuario = authService.getUsuarioActual();

        if (usuario) {
            // Renderizado del formulario para usuarios autenticados
            this.contenedor.innerHTML = `
                <div class="card bg-glass border-0 shadow-lg p-4 rounded-4 transition-hover">
                    <h3 class="fw-bold text-white mb-3">
                        <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>Reportar Nueva Incidencia
                    </h3>
                    <p class="text-white-60 small mb-4">
                        Hola, <strong>${usuario.nombre}</strong>. Describe detalladamente el problema para que el equipo de mantenimiento pueda atenderlo.
                    </p>
                    <form id="reporte-form" novalidate>
                        <div class="mb-3">
                            <label for="rep-titulo" class="form-label fw-semibold text-white">Título de la Incidencia</label>
                            <input type="text" class="form-control bg-glass-input text-white border-0 py-2.5" id="rep-titulo" required placeholder="Ej: Gotera en techo del Aula 101">
                            <div class="invalid-feedback text-warning">El título es obligatorio.</div>
                        </div>
                        <div class="mb-3">
                            <label for="rep-descripcion" class="form-label fw-semibold text-white">Descripción Detallada</label>
                            <textarea class="form-control bg-glass-input text-white border-0 py-2" id="rep-descripcion" rows="3" required placeholder="Describe el problema de forma detallada (ej. causa aparente, urgencia)..."></textarea>
                            <div class="invalid-feedback text-warning">La descripción es obligatoria.</div>
                        </div>
                        <div class="row g-3 mb-4">
                            <div class="col-md-6">
                                <label for="rep-ubicacion" class="form-label fw-semibold text-white">Ubicación Física</label>
                                <input type="text" class="form-control bg-glass-input text-white border-0 py-2.5" id="rep-ubicacion" required placeholder="Ej: Bloque B, Planta Alta">
                                <div class="invalid-feedback text-warning">La ubicación es obligatoria.</div>
                            </div>
                            <div class="col-md-6">
                                <label for="rep-tipo" class="form-label fw-semibold text-white">Tipo de Incidencia</label>
                                <select class="form-select bg-glass-input text-white border-0 py-2.5" id="rep-tipo" required>
                                    <option value="" disabled selected>Selecciona un tipo...</option>
                                    <option value="gotera">Fontanería / Gotera</option>
                                    <option value="daño eléctrico">Falla Eléctrica</option>
                                    <option value="infraestructura">Daño Estructural</option>
                                    <option value="mobiliario">Mobiliario Dañado</option>
                                    <option value="otro">Otro</option>
                                </select>
                                <div class="invalid-feedback text-warning">Selecciona un tipo de problema válido.</div>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-warning w-100 py-2.5 rounded-pill fw-semibold shadow-sm transition-transform">
                            <span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true" id="form-spinner"></span>
                            Enviar Reporte <i class="bi bi-send-fill ms-1"></i>
                        </button>
                    </form>
                    <div id="form-alert" class="alert d-none mt-3" role="alert"></div>
                </div>
            `;
            // Asociar eventos del formulario
            this.inicializarEventos(usuario.id);
        } else {
            // Renderizado de estado no autenticado (Bloqueo)
            this.contenedor.innerHTML = `
                <div class="card bg-glass border-0 shadow-lg p-5 rounded-4 text-center">
                    <div class="py-3">
                        <div class="mb-4">
                            <i class="bi bi-lock-fill text-warning display-4"></i>
                        </div>
                        <h4 class="fw-bold text-white">Inicia sesión para Reportar</h4>
                        <p class="text-white-60 mb-4 mx-auto" style="max-width: 400px;">
                            Debes estar registrado y haber iniciado sesión para poder registrar problemas de infraestructura y hacer seguimiento en tiempo real.
                        </p>
                        <button class="btn btn-warning px-4 py-2.5 rounded-pill fw-semibold shadow" data-bs-toggle="modal" data-bs-target="#authModal">
                            Acceder / Registrarse <i class="bi bi-box-arrow-in-right ms-1"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Vincula el listener del formulario y define el flujo de envío de datos.
     * @param {number} usuarioId - ID del usuario actual que reporta.
     */
    inicializarEventos(usuarioId) {
        const form = document.getElementById("reporte-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Validación de Bootstrap
            if (!form.checkValidity()) {
                e.stopPropagation();
                form.classList.add("was-validated");
                return;
            }

            // Recolectar datos
            const titulo = document.getElementById("rep-titulo").value.trim();
            const descripcion = document.getElementById("rep-descripcion").value.trim();
            const ubicacion = document.getElementById("rep-ubicacion").value.trim();
            const tipo_problema = document.getElementById("rep-tipo").value;

            this.mostrarCarga(true);
            this.limpiarAlerta();

            try {
                // Realizar petición POST al backend
                // Nota: apiFetch inyecta automáticamente el token JWT Bearer
                const respuesta = await apiFetch("/reportes/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        titulo,
                        descripcion,
                        ubicacion,
                        tipo_problema,
                        usuario_id: usuarioId
                    })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.error || data.detail || "Error al enviar el reporte.");
                }

                this.mostrarAlerta("success", "✅ ¡Reporte enviado con éxito! Se procesará a la brevedad.");
                form.reset();
                form.classList.remove("was-validated");

                // Ejecuta callback si existe (útil para refrescar el Dashboard de reportes en tiempo real)
                if (this.alEnviarExitoso) {
                    setTimeout(() => {
                        this.alEnviarExitoso();
                    }, 1000);
                }

            } catch (error) {
                this.mostrarAlerta("danger", `❌ Error: ${error.message}`);
            } finally {
                this.mostrarCarga(false);
            }
        });
    }

    /**
     * Controla la visualización del spinner en el botón de envío.
     * @param {boolean} mostrar - Flag de visibilidad.
     */
    mostrarCarga(mostrar) {
        const spinner = document.getElementById("form-spinner");
        if (!spinner) return;
        if (mostrar) {
            spinner.classList.remove("d-none");
        } else {
            spinner.classList.add("d-none");
        }
    }

    /**
     * Muestra alertas en la UI del formulario.
     * @param {string} tipo - Tipo de alerta ('success', 'danger').
     * @param {string} mensaje - Texto explicativo.
     */
    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("form-alert");
        if (!alertBox) return;
        alertBox.className = `alert alert-${tipo} mt-3 d-block`;
        alertBox.textContent = mensaje;
    }

    /**
     * Limpia y oculta cualquier alerta previa.
     */
    limpiarAlerta() {
        const alertBox = document.getElementById("form-alert");
        if (alertBox) {
            alertBox.className = "alert d-none mt-3";
            alertBox.textContent = "";
        }
    }
}
