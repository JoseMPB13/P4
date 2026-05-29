// frontend/js/components/AuthView.js
/**
 * Componente AuthView.
 * Responsabilidad: Inyectar la interfaz de inicio de sesión y registro limpia
 * directamente en el #app-root de la SPA cuando no existe una sesión activa.
 */

import { authService } from "../services/authService.js";

export class AuthView {
    /**
     * Inicializa el componente.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Dibuja la tarjeta de autenticación centrada con pestañas Acceder / Registro.
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 1.5rem;">
                <div class="flat-card" style="width: 100%; max-width: 450px;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <i class="bi bi-building-fill-gear" style="font-size: 3.5rem; color: var(--accent); display: block; margin-bottom: 0.75rem;"></i>
                        <h2 style="font-weight: 800; font-size: 1.75rem; letter-spacing: -0.02em;">UPDS Infraestructura</h2>
                        <p class="text-muted-custom">Inicia sesión para reportar o monitorear desperfectos</p>
                    </div>
                    
                    <div class="tabs-minimal">
                        <button class="tab-btn-minimal active" id="tab-login">Acceder</button>
                        <button class="tab-btn-minimal" id="tab-register">Registro</button>
                    </div>
                    
                    <!-- Panel 1: Login -->
                    <div id="panel-login">
                        <form id="login-form">
                            <div class="form-group">
                                <label for="login-email" class="form-label-minimal">Correo Electrónico</label>
                                <input type="email" class="form-control-minimal" id="login-email" required placeholder="nombre@universidad.edu.bo">
                            </div>
                            <div class="form-group">
                                <label for="login-password" class="form-label-minimal">Contraseña</label>
                                <input type="password" class="form-control-minimal" id="login-password" required placeholder="••••••••">
                            </div>
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 0.75rem;">
                                <span class="loader-spinner d-none" id="login-spinner" style="margin-right: 0.5rem;"></span>
                                Acceder <i class="bi bi-arrow-right-short" style="margin-left: 0.25rem;"></i>
                            </button>
                        </form>
                    </div>
                    
                    <!-- Panel 2: Register -->
                    <div id="panel-register" style="display: none;">
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
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 0.75rem;">
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
     * Vincula y gestiona eventos para login, registro y navegación entre pestañas.
     */
    inicializarEventos() {
        const tabLogin = document.getElementById("tab-login");
        const tabRegister = document.getElementById("tab-register");
        const panelLogin = document.getElementById("panel-login");
        const panelRegister = document.getElementById("panel-register");
        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        // 1. Cambio de pestañas
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

        // 2. Envío de Login
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const emailEl = document.getElementById("login-email");
                const passwordEl = document.getElementById("login-password");

                if (!emailEl.value.trim() || !passwordEl.value) {
                    this.mostrarAlerta("danger", "⚠️ Todos los campos son obligatorios.");
                    return;
                }

                const email = emailEl.value.trim();
                const password = passwordEl.value;

                this.mostrarCarga("login-spinner", true);
                this.limpiarAlerta();

                try {
                    await authService.login(email, password);
                    this.mostrarAlerta("success", "✅ ¡Acceso concedido! Redireccionando...");
                    
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

        // 3. Envío de Registro
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

    mostrarCarga(spinnerId, mostrar) {
        const spinner = document.getElementById(spinnerId);
        if (!spinner) return;
        if (mostrar) spinner.classList.remove("d-none");
        else spinner.classList.add("d-none");
    }

    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("auth-alert");
        if (!alertBox) return;
        alertBox.className = `alert-minimal alert-${tipo} active`;
        alertBox.textContent = mensaje;
    }

    limpiarAlerta() {
        const alertBox = document.getElementById("auth-alert");
        if (alertBox) {
            alertBox.className = "alert-minimal";
            alertBox.textContent = "";
        }
    }
}
