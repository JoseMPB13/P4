// frontend/js/components/AuthModal.js
/**
 * Componente AuthModal.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Guarda la referencia al elemento contenedor en el DOM.
 * 2. Render: Inyecta el modal-overlay, modal-box, las pestañas de navegación (tabs-minimal)
 *    y los dos paneles de formularios (Login/Registro) con inputs minimalistas y alertas personalizadas.
 * 3. Inicializar Eventos (Post-Render):
 *    - Toggles de Pestañas: Modifica el display de los paneles y la clase .active de los botones de pestañas.
 *    - Cierre de Modal: Remueve la clase .active de la capa overlay al hacer clic en cerrar o en el fondo.
 *    - Formulario Submit: Valida datos y ejecuta login/registro contra authService.
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
     * Inyecta la estructura HTML del modal de autenticación minimalista.
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-box">
                    <div class="modal-header-minimal">
                        <h4 style="font-weight: 700; color: var(--text-primary);">Ingreso al Sistema</h4>
                        <button class="btn-minimal btn-text" id="btn-close-modal" style="padding: 0.25rem;"><i class="bi bi-x-lg"></i></button>
                    </div>
                    
                    <div class="tabs-minimal">
                        <button class="tab-btn-minimal active" id="tab-login">Acceder</button>
                        <button class="tab-btn-minimal" id="tab-register">Registro</button>
                    </div>
                    
                    <!-- Panel 1: Login -->
                    <div id="panel-login">
                        <div style="text-align: center; margin-bottom: 1.5rem;">
                            <h3 style="font-weight: 700; margin-bottom: 0.25rem;">¡Bienvenido!</h3>
                            <p class="text-muted-custom">Ingresa tus credenciales institucionales</p>
                        </div>
                        <form id="login-form">
                            <div class="form-group">
                                <label for="login-email" class="form-label-minimal">Correo Electrónico</label>
                                <input type="email" class="form-control-minimal" id="login-email" required placeholder="nombre@universidad.edu.bo">
                            </div>
                            <div class="form-group">
                                <label for="login-password" class="form-label-minimal">Contraseña</label>
                                <input type="password" class="form-control-minimal" id="login-password" required placeholder="••••••••">
                            </div>
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 0.5rem;">
                                <span class="loader-spinner d-none" id="login-spinner" style="margin-right: 0.5rem;"></span>
                                Acceder <i class="bi bi-arrow-right-short" style="margin-left: 0.25rem;"></i>
                            </button>
                        </form>
                    </div>
                    
                    <!-- Panel 2: Register -->
                    <div id="panel-register" style="display: none;">
                        <div style="text-align: center; margin-bottom: 1.5rem;">
                            <h3 style="font-weight: 700; margin-bottom: 0.25rem;">Crea tu cuenta</h3>
                            <p class="text-muted-custom">Únete a la red de reportes de infraestructura</p>
                        </div>
                        <form id="register-form">
                            <div class="form-group">
                                <label for="reg-nombre" class="form-label-minimal">Nombre Completo</label>
                                <input type="text" class="form-control-minimal" id="reg-nombre" required placeholder="Ej. Juan Pérez">
                            </div>
                            <div class="form-group">
                                <label for="reg-email" class="form-label-minimal">Correo Electrónico</label>
                                <input type="email" class="form-control-minimal" id="reg-email" required placeholder="usuario@universidad.edu.bo">
                            </div>
                            <div class="form-group">
                                <label for="reg-password" class="form-label-minimal">Contraseña</label>
                                <input type="password" class="form-control-minimal" id="reg-password" required placeholder="Mínimo 6 caracteres">
                            </div>
                            <div class="form-group">
                                <label for="reg-rol" class="form-label-minimal">Rol en la Plataforma</label>
                                <select class="form-control-minimal" id="reg-rol" required style="appearance: none;">
                                    <option value="estudiante" selected>Estudiante</option>
                                    <option value="personal_mantenimiento">Personal de Mantenimiento</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 0.5rem;">
                                <span class="loader-spinner d-none" id="reg-spinner" style="margin-right: 0.5rem;"></span>
                                Registrar Cuenta <i class="bi bi-check-circle" style="margin-left: 0.25rem;"></i>
                            </button>
                        </form>
                    </div>
                    
                    <div id="auth-alert" class="alert-minimal"></div>
                </div>
            </div>
        `;

        this.inicializarEventos();
    }

    /**
     * Vincula listeners de interactividad de la interfaz y envío de datos.
     */
    inicializarEventos() {
        const overlay = this.contenedor.querySelector(".modal-overlay");
        const btnClose = document.getElementById("btn-close-modal");
        
        const tabLogin = document.getElementById("tab-login");
        const tabRegister = document.getElementById("tab-register");
        
        const panelLogin = document.getElementById("panel-login");
        const panelRegister = document.getElementById("panel-register");

        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        // 1. Lógica de Pestañas (Tabs Switching)
        if (tabLogin && tabRegister) {
            tabLogin.addEventListener("click", () => {
                tabLogin.classList.add("active");
                tabRegister.classList.remove("active");
                panelLogin.style.display = "block";
                panelRegister.style.display = "none";
                this.limpiarAlerta();
            });

            tabRegister.addEventListener("click", () => {
                tabRegister.classList.add("active");
                tabLogin.classList.remove("active");
                panelLogin.style.display = "none";
                panelRegister.style.display = "block";
                this.limpiarAlerta();
            });
        }

        // 2. Lógica de Cierre de Modal
        if (btnClose && overlay) {
            btnClose.addEventListener("click", () => {
                overlay.classList.remove("active");
            });

            // Cerrar al hacer clic en la capa overlay externa (fuera de la caja modal)
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove("active");
                }
            });
        }

        // 3. Envío de Formulario de Inicio de Sesión (Login)
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const emailEl = document.getElementById("login-email");
                const passwordEl = document.getElementById("login-password");

                if (!emailEl.value.trim() || !passwordEl.value.trim()) {
                    this.mostrarAlerta("danger", "⚠️ Todos los campos son obligatorios.");
                    return;
                }

                const email = emailEl.value.trim();
                const password = passwordEl.value;

                this.mostrarCarga("login-spinner", true);
                this.limpiarAlerta();

                try {
                    await authService.login(email, password);
                    this.mostrarAlerta("success", "✅ ¡Acceso concedido! Recargando portal...");

                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);

                } catch (error) {
                    this.mostrarAlerta("danger", `❌ ${error.message}`);
                } finally {
                    this.mostrarCarga("login-spinner", false);
                }
            });
        }

        // 4. Envío de Formulario de Registro
        if (registerForm) {
            registerForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const nombreEl = document.getElementById("reg-nombre");
                const emailEl = document.getElementById("reg-email");
                const passwordEl = document.getElementById("reg-password");
                const rolEl = document.getElementById("reg-rol");

                if (!nombreEl.value.trim() || !emailEl.value.trim() || !passwordEl.value.trim() || !rolEl.value) {
                    this.mostrarAlerta("danger", "⚠️ Todos los campos son obligatorios.");
                    return;
                }

                if (passwordEl.value.length < 6) {
                    this.mostrarAlerta("danger", "⚠️ La contraseña debe tener al menos 6 caracteres.");
                    return;
                }

                const nombre = nombreEl.value.trim();
                const email = emailEl.value.trim();
                const password = passwordEl.value;
                const rol = rolEl.value;

                this.mostrarCarga("reg-spinner", true);
                this.limpiarAlerta();

                try {
                    await authService.register({ nombre, email, password, rol });
                    this.mostrarAlerta("success", "🎉 ¡Cuenta registrada con éxito! Ya puedes iniciar sesión.");
                    registerForm.reset();

                    // Switch a la pestaña de login tras un breve lapso
                    setTimeout(() => {
                        tabLogin.click();
                    }, 1500);

                } catch (error) {
                    this.mostrarAlerta("danger", `❌ ${error.message}`);
                } finally {
                    this.mostrarCarga("reg-spinner", false);
                }
            });
        }
    }

    /**
     * Muestra o esconde el spinner de carga.
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
     * Despliega la alerta minimalista en el modal.
     */
    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("auth-alert");
        if (!alertBox) return;
        alertBox.className = `alert-minimal alert-${tipo} active`;
        alertBox.textContent = mensaje;
    }

    /**
     * Limpia la alerta del modal.
     */
    limpiarAlerta() {
        const alertBox = document.getElementById("auth-alert");
        if (alertBox) {
            alertBox.className = "alert-minimal";
            alertBox.textContent = "";
        }
    }
}
