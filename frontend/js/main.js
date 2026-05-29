// frontend/js/main.js
/**
 * Núcleo de la SPA - Enrutador Central de la Aplicación.
 * 
 * Responsabilidad:
 * 1. Controlar el estado centralizado de la sesión (verificando la existencia del JWT en sessionStorage).
 * 2. Implementar la función de enrutado lógico `renderApp()` que decide la UI a inyectar en el lienzo principal (`#app-root`).
 * 
 * CICLO DE DECISIÓN Y FLUJO (React-style):
 * - Al cargar el DOM, lee la presencia del token.
 * - CASO A: Sin token activo -> Renderiza de forma limpia la vista de autenticación `AuthView` en el cuerpo principal.
 * - CASO B: Con token activo -> Dibuja la barra de navegación con los datos del usuario autenticado y evalúa su rol:
 *   - Rol: "admin" -> Inicializa e inyecta `AdminDashboard`.
 *   - Rol: "estudiante" -> Inicializa e inyecta `EstudianteDashboard`.
 *   - Rol: "personal_mantenimiento" o "personal" -> Inicializa e inyecta `PersonalDashboard`.
 */

import { authService } from "./services/authService.js";
import { AuthView } from "./components/AuthView.js";
import { AdminDashboard } from "./components/AdminDashboard.js";
import { EstudianteDashboard } from "./components/EstudianteDashboard.js";
import { PersonalDashboard } from "./components/PersonalDashboard.js";

/**
 * Función enrutadora principal que evalúa el estado y renderiza la vista correspondiente.
 */
async function renderApp() {
    const appRoot = document.getElementById("app-root");
    const navbarContainer = document.getElementById("navbar-container");
    
    if (!appRoot) return;

    // Obtener información del usuario actual y verificar token
    const token = sessionStorage.getItem("token");
    const usuario = authService.getUsuarioActual();

    // =========================================================================
    // 🛡️ CASO A: NO HAY SESIÓN ACTIVA (SIN TOKEN)
    // =========================================================================
    if (!token || !usuario) {
        console.log("🔒 [SPA Router] Usuario no autenticado. Renderizando formulario de acceso...");
        
        // Renderizar navbar minimalista vacío (solo marca)
        if (navbarContainer) {
            navbarContainer.className = "navbar-minimal";
            navbarContainer.innerHTML = `
                <div class="brand-minimal">
                    <i class="bi bi-building-fill-gear brand-icon"></i>
                    <span>UPDS <span style="font-weight: 300; opacity: 0.8;">Infraestructura</span></span>
                </div>
            `;
        }

        // Limpiar lienzo principal y renderizar la vista de Login/Registro
        appRoot.innerHTML = `<div id="auth-view-container"></div>`;
        const authView = new AuthView("#auth-view-container");
        authView.render();
        return;
    }

    // =========================================================================
    // 🔓 CASO B: SESIÓN ACTIVA (TOKEN JWT EXISTENTE)
    // =========================================================================
    console.log(`🔓 [SPA Router] Sesión iniciada. Usuario: ${usuario.nombre} | Rol: ${usuario.rol}`);

    // 1. Dibujar el Navbar del usuario logueado con datos de sesión
    if (navbarContainer) {
        navbarContainer.className = "navbar-minimal";
        navbarContainer.innerHTML = `
            <div class="brand-minimal">
                <i class="bi bi-building-fill-gear brand-icon"></i>
                <span>UPDS <span style="font-weight: 300; opacity: 0.8;">Infraestructura</span></span>
            </div>
            <ul class="nav-links">
                <li>
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">
                        Hola, <strong>${usuario.nombre}</strong>
                    </span>
                </li>
                <li>
                    <button class="btn-minimal btn-outline" id="btn-logout" style="padding: 0.4rem 0.8rem;">
                        <i class="bi bi-box-arrow-right me-1"></i> Salir
                    </button>
                </li>
            </ul>
        `;

        // Asociar evento de cierre de sesión
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.addEventListener("click", async () => {
                await authService.logout();
                window.location.reload();
            });
        }
    }

    // Limpiar el contenedor principal para pintar el Dashboard específico
    appRoot.innerHTML = `<div id="dashboard-view-container"></div>`;

    // 2. Evaluar el rol del usuario e inyectar el componente idóneo
    const rol = usuario.rol;

    if (rol === "admin") {
        // [ADMINISTRADOR] -> Acceso total
        console.log("🛠️ [SPA Router] Cargando Panel del Administrador...");
        const adminDashboard = new AdminDashboard("#dashboard-view-container");
        await adminDashboard.render();

    } else if (rol === "estudiante") {
        // [ESTUDIANTE] -> Envío de incidencias y visualización
        console.log("🎓 [SPA Router] Cargando Panel de Estudiante...");
        const estudianteDashboard = new EstudianteDashboard("#dashboard-view-container");
        await estudianteDashboard.render();

    } else if (rol === "personal_mantenimiento" || rol === "personal") {
        // [PERSONAL / TÉCNICO] -> Gestión de incidencias en curso
        console.log("⚙️ [SPA Router] Cargando Panel de Mantenimiento...");
        const personalDashboard = new PersonalDashboard("#dashboard-view-container");
        await personalDashboard.render();

    } else {
        // En caso de que el rol sea indefinido o corrupto (Fail-Safe)
        console.error("⚠️ [SPA Router] Rol no reconocido:", rol);
        appRoot.innerHTML = `
            <div class="flat-card" style="text-align: center; max-width: 500px; margin: 4rem auto; padding: 3rem 2rem;">
                <i class="bi bi-exclamation-octagon" style="color: #ef4444; font-size: 3rem; display: block; margin-bottom: 1rem;"></i>
                <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Perfil Invalido</h4>
                <p class="text-muted-custom" style="margin-bottom: 1.5rem;">Tu cuenta no posee un perfil con privilegios asignados en el sistema.</p>
                <button class="btn-minimal btn-accent" id="btn-error-logout">Cerrar Sesión</button>
            </div>
        `;
        const btnErrorLogout = document.getElementById("btn-error-logout");
        if (btnErrorLogout) {
            btnErrorLogout.addEventListener("click", async () => {
                await authService.logout();
                window.location.reload();
            });
        }
    }
}

// Ejecutar enrutado lógico en cuanto el DOM de la página esté cargado
document.addEventListener("DOMContentLoaded", () => {
    renderApp();
});
