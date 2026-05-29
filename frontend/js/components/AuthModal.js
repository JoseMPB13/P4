// frontend/js/components/AuthModal.js
/**
 * Componente AuthModal.
 * Responsabilidad: Inyectar la interfaz del modal de autenticación (Login/Registro)
 * en el DOM y gestionar el envío de formularios mediante el servicio de autenticación.
 */

import { authService } from "../services/authService.js";

export class AuthModal {
    /**
     * Inicializa el componente.
     * @param {string} selectorContenedor - Selector CSS del contenedor donde inyectar el HTML.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Inyecta la estructura HTML del modal de autenticación.
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div class="modal fade" id="authModal" tabindex="-1" aria-labelledby="authModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content rounded-4 border-0 shadow-lg">
                        <div class="modal-header border-0 pb-0 justify-content-end">
                            <button type="button" class="btn-close shadow-none" data-bs-close="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body px-4 pb-4 pt-2">
                            <!-- Nav Tabs para alternar entre Login y Register -->
                            <ul class="nav nav-pills nav-fill bg-light p-1 rounded-pill mb-4" id="authTab" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active rounded-pill fw-semibold py-2" id="login-tab" data-bs-toggle="tab" data-bs-target="#login-panel" type="button" role="tab" aria-controls="login-panel" aria-selected="true">
                                        Iniciar Sesión
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link rounded-pill fw-semibold py-2" id="register-tab" data-bs-toggle="tab" data-bs-target="#register-panel" type="button" role="tab" aria-controls="register-panel" aria-selected="false">
                                        Registrarse
                                    </button>
                                </li>
                            </ul>

                            <div class="tab-content" id="authTabContent">
                                <!-- Panel 1: Login -->
                                <div class="tab-pane fade show active" id="login-panel" role="tabpanel" aria-labelledby="login-tab">
                                    <div class="text-center mb-4">
                                        <h3 class="fw-bold text-navy">¡Bienvenido de nuevo!</h3>
                                        <p class="text-muted fs-6">Ingresa tus credenciales institucionales</p>
                                    </div>
                                    <form id="login-form" novalidate>
                                        <div class="mb-3">
                                            <label for="login-email" class="form-label fw-semibold text-navy">Correo Electrónico</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-envelope"></i></span>
                                                <input type="email" class="form-control bg-light border-start-0 ps-0" id="login-email" required placeholder="nombre@universidad.edu">
                                            </div>
                                            <div class="invalid-feedback">Por favor ingresa un correo electrónico institucional válido.</div>
                                        </div>
                                        <div class="mb-4">
                                            <label for="login-password" class="form-label fw-semibold text-navy">Contraseña</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-lock"></i></span>
                                                <input type="password" class="form-control bg-light border-start-0 ps-0" id="login-password" required placeholder="••••••••" minlength="6">
                                            </div>
                                            <div class="invalid-feedback">La contraseña debe tener al menos 6 caracteres.</div>
                                        </div>
                                        <button type="submit" class="btn btn-navy w-100 py-2.5 rounded-pill fw-semibold shadow-sm mb-3">
                                            <span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true" id="login-spinner"></span>
                                            Acceder <i class="bi bi-arrow-right ms-1"></i>
                                        </button>
                                    </form>
                                </div>

                                <!-- Panel 2: Register -->
                                <div class="tab-pane fade" id="register-panel" role="tabpanel" aria-labelledby="register-tab">
                                    <div class="text-center mb-4">
                                        <h3 class="fw-bold text-navy">Crea tu cuenta</h3>
                                        <p class="text-muted fs-6">Únete a la red de reportes de infraestructura</p>
                                    </div>
                                    <form id="register-form" novalidate>
                                        <div class="mb-3">
                                            <label for="reg-nombre" class="form-label fw-semibold text-navy">Nombre Completo</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-person"></i></span>
                                                <input type="text" class="form-control bg-light border-start-0 ps-0" id="reg-nombre" required placeholder="Ej. Juan Pérez">
                                            </div>
                                            <div class="invalid-feedback">El nombre completo es obligatorio.</div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="reg-email" class="form-label fw-semibold text-navy">Correo Electrónico</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-envelope"></i></span>
                                                <input type="email" class="form-control bg-light border-start-0 ps-0" id="reg-email" required placeholder="usuario@universidad.edu.bo">
                                            </div>
                                            <div class="invalid-feedback">Ingresa un correo con formato válido.</div>
                                        </div>
                                        <div class="mb-3">
                                            <label for="reg-password" class="form-label fw-semibold text-navy">Contraseña</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-lock"></i></span>
                                                <input type="password" class="form-control bg-light border-start-0 ps-0" id="reg-password" required placeholder="Mínimo 6 caracteres" minlength="6">
                                            </div>
                                            <div class="invalid-feedback">La contraseña debe tener mínimo 6 caracteres.</div>
                                        </div>
                                        <div class="mb-4">
                                            <label for="reg-rol" class="form-label fw-semibold text-navy">Rol en la Plataforma</label>
                                            <div class="input-group">
                                                <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-people"></i></span>
                                                <select class="form-select bg-light border-start-0 ps-0" id="reg-rol" required>
                                                    <option value="estudiante" selected>Estudiante</option>
                                                    <option value="personal_mantenimiento">Personal de Mantenimiento</option>
                                                    <option value="admin">Administrador</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" class="btn btn-navy w-100 py-2.5 rounded-pill fw-semibold shadow-sm mb-3">
                                            <span class="spinner-border spinner-border-sm d-none me-2" role="status" aria-hidden="true" id="reg-spinner"></span>
                                            Registrar Cuenta <i class="bi bi-check-circle-fill ms-1"></i>
                                        </button>
                                    </form>
                                </div>
                            </div>

                            <!-- Contenedor de notificaciones de alerta dentro del Modal -->
                            <div id="auth-alert" class="alert d-none mt-3" role="alert"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Asocia los eventos después de renderizar el HTML en el DOM
        this.inicializarEventos();
    }

    /**
     * Registra los eventos submit de los formularios e interactúa con el servicio de autenticación.
     */
    inicializarEventos() {
        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                if (!loginForm.checkValidity()) {
                    e.stopPropagation();
                    loginForm.classList.add("was-validated");
                    return;
                }

                const email = document.getElementById("login-email").value;
                const password = document.getElementById("login-password").value;

                this.mostrarCarga("login-spinner", true);
                this.limpiarAlerta();

                try {
                    // Llamamos al servicio de Autenticación
                    await authService.login(email, password);

                    this.mostrarAlerta("success", "✅ ¡Acceso concedido! Redireccionando...");

                    // Recarga la interfaz tras 1.5s
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);

                } catch (error) {
                    this.mostrarAlerta("danger", `❌ ${error.message}`);
                } finally {
                    this.mostrarCarga("login-spinner", false);
                }
            });
        }

        if (registerForm) {
            registerForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                if (!registerForm.checkValidity()) {
                    e.stopPropagation();
                    registerForm.classList.add("was-validated");
                    return;
                }

                const nombre = document.getElementById("reg-nombre").value;
                const email = document.getElementById("reg-email").value;
                const password = document.getElementById("reg-password").value;
                const rol = document.getElementById("reg-rol").value;

                this.mostrarCarga("reg-spinner", true);
                this.limpiarAlerta();

                try {
                    // Llamamos al servicio de Autenticación
                    await authService.register({ nombre, email, password, rol });

                    this.mostrarAlerta("success", "🎉 ¡Cuenta registrada con éxito! Inicia sesión para continuar.");
                    registerForm.reset();
                    registerForm.classList.remove("was-validated");

                    // Cambia a la pestaña de login tras 2 segundos
                    setTimeout(() => {
                        const loginTab = document.getElementById("login-tab");
                        if (loginTab) loginTab.click();
                    }, 2000);

                } catch (error) {
                    this.mostrarAlerta("danger", `❌ ${error.message}`);
                } finally {
                    this.mostrarCarga("reg-spinner", false);
                }
            });
        }
    }

    /**
     * Muestra u oculta el spinner del botón.
     * @param {string} spinnerId - ID del spinner.
     * @param {boolean} mostrar - Flag de visibilidad.
     */
    mostrarCarga(spinnerId, mostrar) {
        const spinner = document.getElementById(spinnerId);
        if (!spinner) return;
        if (mostrar) {
            spinner.classList.remove("d-none");
        } else {
            spinner.classList.add("d-none");
        }
    }

    /**
     * Despliega un mensaje de alerta en el modal.
     * @param {string} tipo - Tipo de alerta ('success', 'danger').
     * @param {string} mensaje - Texto del mensaje.
     */
    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("auth-alert");
        if (!alertBox) return;
        alertBox.className = `alert alert-${tipo} mt-3 d-block`;
        alertBox.textContent = mensaje;
    }

    /**
     * Limpia y oculta cualquier alerta previa.
     */
    limpiarAlerta() {
        const alertBox = document.getElementById("auth-alert");
        if (alertBox) {
            alertBox.className = "alert d-none mt-3";
            alertBox.textContent = "";
        }
    }
}
