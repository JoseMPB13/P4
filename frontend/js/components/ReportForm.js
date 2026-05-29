// frontend/js/components/ReportForm.js
/**
 * Componente ReportForm.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Guarda la referencia al elemento contenedor en el DOM.
 * 2. Render: Valida el estado de autenticación de sessionStorage.
 *    - Si está autenticado, inyecta la UI del formulario de reporte usando clases minimalistas.
 *    - Si no está autenticado, inyecta una vista plana de bloqueo.
 * 3. Inicializar Eventos (Post-Render): Vincula el evento submit al formulario.
 * 4. Submit Handler: Valida campos requeridos, realiza la llamada a la API (POST /reportes/)
 *    empleando la envoltura apiFetch y dispara el callback de éxito para refrescar la vista.
 */

import { apiFetch } from "../services/api.js";
import { authService } from "../services/authService.js";

export class ReportForm {
    /**
     * Inicializa el componente de formulario.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     * @param {Function} alEnviarExitoso - Callback ejecutado al reportar con éxito.
     */
    constructor(selectorContenedor, alEnviarExitoso = null) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.alEnviarExitoso = alEnviarExitoso;
    }

    /**
     * Evalúa la sesión activa y renderiza la interfaz idónea.
     */
    render() {
        if (!this.contenedor) return;

        const usuario = authService.getUsuarioActual();

        if (usuario) {
            // Interfaz de formulario minimalista plana
            this.contenedor.innerHTML = `
                <div class="flat-card">
                    <h3 style="margin-bottom: 0.5rem;">
                        <i class="bi bi-exclamation-triangle-fill" style="color: var(--accent); margin-right: 0.5rem;"></i>Nueva Incidencia
                    </h3>
                    <p class="text-muted-custom" style="margin-bottom: 1.5rem;">
                        Hola, <strong>${usuario.nombre}</strong>. Registra fallas físicas detectadas para su reparación inmediata.
                    </p>
                    
                    <form id="reporte-form" novalidate>
                        <div class="form-group">
                            <label for="rep-titulo" class="form-label-minimal">Título</label>
                            <input type="text" class="form-control-minimal" id="rep-titulo" required placeholder="Ej: Gotera en techo del Aula 101">
                        </div>
                        
                        <div class="form-group">
                            <label for="rep-descripcion" class="form-label-minimal">Descripción Detallada</label>
                            <textarea class="form-control-minimal" id="rep-descripcion" rows="3" required placeholder="Detalla el problema observado..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="rep-ubicacion" class="form-label-minimal">Ubicación Física</label>
                            <input type="text" class="form-control-minimal" id="rep-ubicacion" required placeholder="Ej: Bloque B, Planta Alta, Aula 101">
                        </div>
                        
                        <div class="form-group">
                            <label for="rep-tipo" class="form-label-minimal">Tipo de Problema</label>
                            <select class="form-control-minimal" id="rep-tipo" required>
                                <option value="" disabled selected>Seleccione una categoría...</option>
                                <option value="Infraestructura">Infraestructura</option>
                                <option value="Electricidad">Electricidad</option>
                                <option value="Plomería">Plomería</option>
                                <option value="Mobiliario">Mobiliario</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label-minimal">Evidencia Fotográfica</label>
                            <div class="media-upload-wrapper">
                                <label for="imagen-incidencia" class="btn-minimal btn-outline" style="width: 100%; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                    <i class="bi bi-camera-fill" style="font-size: 1.10rem;"></i> Adjuntar Evidencia (Cámara / Galería)
                                </label>
                                <input type="file" id="imagen-incidencia" accept="image/*" style="display: none;">
                            </div>
                            <div id="preview-container" class="preview-container d-none">
                                <img id="preview-image" src="" alt="Vista Previa" class="preview-image">
                                <button type="button" id="btn-remove-preview" class="btn-remove-preview" title="Quitar imagen">&times;</button>
                            </div>
                        </div>

                        <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 1rem;">
                            <span class="loader-spinner d-none" id="form-spinner" style="margin-right: 0.5rem;"></span>
                            Enviar Reporte <i class="bi bi-send-fill" style="margin-left: 0.25rem;"></i>
                        </button>
                    </form>
                    <div id="form-alert" class="alert-minimal"></div>
                </div>
            `;
            // Enlazar handlers de eventos
            this.inicializarEventos(usuario.id);
        } else {
            // Vista de bloqueo en diseño plano
            this.contenedor.innerHTML = `
                <div class="flat-card" style="text-align: center; padding: 3.5rem 2rem;">
                    <div style="margin-bottom: 1.5rem;">
                        <i class="bi bi-lock-fill" style="color: var(--accent); font-size: 3rem;"></i>
                    </div>
                    <h4 style="margin-bottom: 0.75rem; font-weight: 700;">Inicia sesión para reportar</h4>
                    <p class="text-muted-custom" style="margin-bottom: 1.5rem; max-width: 320px; margin-left: auto; margin-right: auto;">
                        Debes haber iniciado sesión con tu cuenta institucional para enviar reportes de mantenimiento.
                    </p>
                    <button class="btn-minimal btn-accent" id="btn-lock-auth">
                        Iniciar Sesión <i class="bi bi-box-arrow-in-right" style="margin-left: 0.25rem;"></i>
                    </button>
                </div>
            `;

            // Registrar acción para el botón de login cuando está bloqueado
            const btnLockAuth = document.getElementById("btn-lock-auth");
            if (btnLockAuth) {
                btnLockAuth.addEventListener("click", () => {
                    const overlay = document.querySelector(".modal-overlay");
                    if (overlay) overlay.classList.add("active");
                });
            }
        }
    }

    /**
     * Vincula la lógica de captura de envío de formulario.
     * @param {number} usuarioId - ID del autor del reporte.
     */
    /**
     * Vincula la lógica de captura de envío de formulario.
     * @param {number} usuarioId - ID del autor del reporte.
     */
    inicializarEventos(usuarioId) {
        const form = document.getElementById("reporte-form");
        if (!form) return;

        const fileInput = document.getElementById("imagen-incidencia");
        const previewContainer = document.getElementById("preview-container");
        const previewImage = document.getElementById("preview-image");
        const btnRemovePreview = document.getElementById("btn-remove-preview");

        // Escuchador de cambios en el input de archivo (Captura de imagen / Galería)
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    // Instanciar FileReader para renderizar la miniatura localmente
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        if (previewImage) previewImage.src = evt.target.result;
                        if (previewContainer) previewContainer.classList.remove("d-none");
                    };
                    reader.readAsDataURL(file);
                } else {
                    this.limpiarVistaPrevia();
                }
            });
        }

        // Acción para remover la imagen seleccionada y ocultar el contenedor
        if (btnRemovePreview) {
            btnRemovePreview.addEventListener("click", (e) => {
                e.preventDefault();
                this.limpiarVistaPrevia();
            });
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const tituloEl = document.getElementById("rep-titulo");
            const descripcionEl = document.getElementById("rep-descripcion");
            const ubicacionEl = document.getElementById("rep-ubicacion");
            const tipoEl = document.getElementById("rep-tipo");

            // Validación simple manual sin depender de Bootstrap
            if (!tituloEl.value.trim() || !descripcionEl.value.trim() || !ubicacionEl.value.trim() || !tipoEl.value) {
                this.mostrarAlerta("danger", "⚠️ Todos los campos son obligatorios.");
                return;
            }

            const titulo = tituloEl.value.trim();
            const descripcion = descripcionEl.value.trim();
            const ubicacion = ubicacionEl.value.trim();
            const tipo_problema = tipoEl.value;

            // Generar Object URL corto y local para cumplir con VARCHAR(255) en la base de datos
            let imagen_url = null;
            if (fileInput && fileInput.files && fileInput.files[0]) {
                imagen_url = URL.createObjectURL(fileInput.files[0]);
            }

            this.mostrarCarga(true);
            this.limpiarAlerta();

            try {
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
                        usuario_id: usuarioId,
                        imagen_url: imagen_url
                    })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.error || data.detail || "Error al registrar el reporte.");
                }

                this.mostrarAlerta("success", "✅ ¡Incidencia reportada con éxito!");
                form.reset();
                this.limpiarVistaPrevia();

                // Disparar callback para refrescar el Dashboard
                if (this.alEnviarExitoso) {
                    setTimeout(() => {
                        this.alEnviarExitoso();
                    }, 1000);
                }

            } catch (error) {
                this.mostrarAlerta("danger", `❌ ${error.message}`);
            } finally {
                this.mostrarCarga(false);
            }
        });
    }

    /**
     * Limpia el input de archivos y el contenedor de previsualización.
     */
    limpiarVistaPrevia() {
        const fileInput = document.getElementById("imagen-incidencia");
        const previewContainer = document.getElementById("preview-container");
        const previewImage = document.getElementById("preview-image");
        if (fileInput) fileInput.value = "";
        if (previewImage) previewImage.src = "";
        if (previewContainer) previewContainer.classList.add("d-none");
    }

    /**
     * Controla el spinner del botón.
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
     * Despliega alerta minimalista.
     */
    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("form-alert");
        if (!alertBox) return;
        alertBox.className = `alert-minimal alert-${tipo} active`;
        alertBox.textContent = mensaje;
    }

    /**
     * Limpia alerta.
     */
    limpiarAlerta() {
        const alertBox = document.getElementById("form-alert");
        if (alertBox) {
            alertBox.className = "alert-minimal";
            alertBox.textContent = "";
        }
    }
}
