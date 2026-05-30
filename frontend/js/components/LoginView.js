// frontend/js/components/LoginView.js
/**
 * Componente LoginView.
 * 
 * Responsabilidad: Renderizar una pantalla de acceso ultra limpia y minimalista,
 * centrada, con inputs estilizados y un botón de acción simple.
 * Permite alternar de forma fluida a la creación de cuenta (Registro) en la misma tarjeta.
 * 
 * CICLO DE RENDERING (React-style):
 * 1. Constructor: Almacena el selector del contenedor principal.
 * 2. Render: Dibuja la estructura HTML limpia del Login/Registro sin distractores.
 * 3. Inicializar Eventos: Asocia listeners para el cambio dinámico de paneles y el submit de formularios.
 */

import { authService } from "../services/authService.js";
import { notifier } from "../utils/notifier.js";

export class LoginView {
    /**
     * Inicializa la vista de acceso.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
    }

    /**
     * Renderiza el formulario de acceso minimalista plano.
     */
    render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 1.5rem;">
                <div class="flat-card" style="width: 100%; max-width: 400px; padding: 2.5rem 2rem;">
                    
                    <!-- Contenedor del Logo y Títulos -->
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <i class="bi bi-shield-lock" style="font-size: 3rem; color: var(--accent); display: block; margin-bottom: 0.5rem;"></i>
                        <h2 style="font-weight: 700; font-size: 1.5rem; letter-spacing: -0.02em;" id="auth-title">Acceso al Portal</h2>
                        <p class="text-muted-custom" id="auth-subtitle">Ingresa tus credenciales institucionales</p>
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
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 1rem;">
                                <span class="loader-spinner d-none" id="login-spinner" style="margin-right: 0.5rem;"></span>
                                Acceder
                            </button>
                        </form>
                        
                        <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8125rem;">
                            <span class="text-muted-custom">¿No tienes una cuenta?</span>
                            <a href="#" id="link-show-register" style="color: var(--accent); margin-left: 0.25rem; font-weight: 600;">Regístrate</a>
                        </div>
                    </div>

                    <!-- Panel 2: Register -->
                    <div id="panel-register" style="display: none;">
                        <form id="register-form">
                            <div class="form-group">
                                <label for="reg-nombre" class="form-label-minimal">Nombre Completo</label>
                                <input type="text" class="form-control-minimal" id="reg-nombre" required placeholder="Juan Pérez">
                            </div>
                            <div class="form-group">
                                <label for="reg-email" class="form-label-minimal">Correo Electrónico</label>
                                <input type="email" class="form-control-minimal" id="reg-email" required placeholder="usuario@universidad.edu.bo">
                            </div>
                            <div class="form-group">
                                <label for="reg-password" class="form-label-minimal">Contraseña</label>
                                <input type="password" class="form-control-minimal" id="reg-password" required placeholder="Mínimo 6 caracteres">
                            </div>
                            <button type="submit" class="btn-minimal btn-accent" style="width: 100%; margin-top: 1rem;">
                                <span class="loader-spinner d-none" id="reg-spinner" style="margin-right: 0.5rem;"></span>
                                Crear Cuenta
                            </button>
                        </form>
                        
                        <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8125rem;">
                            <span class="text-muted-custom">¿Ya tienes una cuenta?</span>
                            <a href="#" id="link-show-login" style="color: var(--accent); margin-left: 0.25rem; font-weight: 600;">Inicia Sesión</a>
                        </div>
                    </div>

                    <!-- Mensajes de Alerta -->
                    <div id="auth-alert" class="alert-minimal" style="margin-top: 1.5rem;"></div>

                </div>
            </div>
        `;

        this.inicializarEventos();
    }

    /**
     * Registra eventos de formularios y alternador de paneles.
     */
    inicializarEventos() {
        const linkShowRegister = document.getElementById("link-show-register");
        const linkShowLogin = document.getElementById("link-show-login");
        
        const panelLogin = document.getElementById("panel-login");
        const panelRegister = document.getElementById("panel-register");

        const authTitle = document.getElementById("auth-title");
        const authSubtitle = document.getElementById("auth-subtitle");

        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");

        // Alternar Vista a Registro
        if (linkShowRegister) {
            linkShowRegister.addEventListener("click", (e) => {
                e.preventDefault();
                panelLogin.style.display = "none";
                panelRegister.style.display = "block";
                authTitle.textContent = "Crear Cuenta";
                authSubtitle.textContent = "Únete a la plataforma de reportes";
                this.limpiarAlerta();
            });
        }

        // Alternar Vista a Login
        if (linkShowLogin) {
            linkShowLogin.addEventListener("click", (e) => {
                e.preventDefault();
                panelRegister.style.display = "none";
                panelLogin.style.display = "block";
                authTitle.textContent = "Acceso al Portal";
                authSubtitle.textContent = "Ingresa tus credenciales institucionales";
                this.limpiarAlerta();
            });
        }

        // Evento Submit de Login
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const email = document.getElementById("login-email").value.trim();
                const password = document.getElementById("login-password").value;

                if (!email || !password) {
                    notifier.show({
                        tipo: "warning",
                        titulo: "Campos Incompletos",
                        mensaje: "Todos los campos son obligatorios."
                    });
                    return;
                }

                this.mostrarCarga("login-spinner", true);
                this.limpiarAlerta();

                try {
                    await authService.login(email, password);
                    
                    // Comentario en español: Se introduce un retraso obligatorio de 1500ms para garantizar
                    // que la tarjeta visual premium de éxito sea plenamente visible para el usuario antes de recargar.
                    notifier.show({
                        tipo: "success",
                        titulo: "Acceso Concedido",
                        mensaje: "¡Sesión iniciada con éxito! Redireccionando..."
                    });
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);

                } catch (error) {
                    if (error.status === 401) {
                        // Comentario en español: Mensaje seguro y genérico para fallos de autenticación (HTTP 401)
                        notifier.show({
                            tipo: "error",
                            titulo: "Acceso Denegado",
                            mensaje: "Credenciales incorrectas (correo o contraseña no válidos)."
                        });
                    } else if (error.status === 400 || error.status === 422) {
                        notifier.show({
                            tipo: "warning",
                            titulo: "Advertencia",
                            mensaje: error.message
                        });
                    } else {
                        notifier.show({
                            tipo: "error",
                            titulo: "Error de Acceso",
                            mensaje: error.message || "Ocurrió un error inesperado al intentar iniciar sesión."
                        });
                    }
                } finally {
                    this.mostrarCarga("login-spinner", false);
                }
            });
        }

        // Evento Submit de Registro
        if (registerForm) {
            registerForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const nombre = document.getElementById("reg-nombre").value.trim();
                const email = document.getElementById("reg-email").value.trim();
                const password = document.getElementById("reg-password").value;

                if (!nombre || !email || !password) {
                    notifier.show({
                        tipo: "warning",
                        titulo: "Campos Incompletos",
                        mensaje: "Todos los campos son obligatorios."
                    });
                    return;
                }

                if (password.length < 6) {
                    notifier.show({
                        tipo: "warning",
                        titulo: "Contraseña Corta",
                        mensaje: "La contraseña debe tener mínimo 6 caracteres."
                    });
                    return;
                }

                this.mostrarCarga("reg-spinner", true);
                this.limpiarAlerta();

                try {
                    // Comentario en español: Se envían exclusivamente las propiedades de nombre, email y password.
                    // Se remueve la lectura del rol para asegurar que el registro sea inmune a manipulación de privilegios.
                    await authService.register({ nombre, email, password });
                    
                    // Comentario en español: Retraso de 1500ms para permitir al usuario apreciar visualmente el Toast
                    // de cuenta registrada de manera fluida antes de redirigir al formulario de acceso.
                    notifier.show({
                        tipo: "success",
                        titulo: "Registro Exitoso",
                        mensaje: "🎉 ¡Tu cuenta ha sido creada correctamente! Ya puedes iniciar sesión."
                    });
                    
                    registerForm.reset();

                    setTimeout(() => {
                        if (linkShowLogin) linkShowLogin.click();
                    }, 1500);

                } catch (error) {
                    if (error.status === 400 || error.status === 422) {
                        notifier.show({
                            tipo: "warning",
                            titulo: "Advertencia de Registro",
                            mensaje: error.message
                        });
                    } else {
                        notifier.show({
                            tipo: "error",
                            titulo: "Error de Registro",
                            mensaje: error.message || "Ocurrió un error inesperado al intentar registrar la cuenta."
                        });
                    }
                } finally {
                    this.mostrarCarga("reg-spinner", false);
                }
            });
        }
    }

    /**
     * Muestra/oculta spinners de carga.
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
     * Despliega la alerta minimalista en el panel.
     */
    mostrarAlerta(tipo, mensaje) {
        const alertBox = document.getElementById("auth-alert");
        if (!alertBox) return;
        alertBox.className = `alert-minimal alert-${tipo} active`;
        alertBox.textContent = mensaje;
    }

    /**
     * Limpia la alerta del panel.
     */
    limpiarAlerta() {
        const alertBox = document.getElementById("auth-alert");
        if (alertBox) {
            alertBox.className = "alert-minimal";
            alertBox.textContent = "";
        }
    }
}
