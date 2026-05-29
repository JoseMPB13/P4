// frontend/js/main.js
/**
 * Punto de entrada principal de la aplicación SPA.
 * Responsabilidad: Inicializar y coordinar la renderización dinámica del layout global,
 * la barra de navegación minimalista y todos los componentes interactivos.
 */

import { AuthModal } from "./components/AuthModal.js";
import { StatsCard } from "./components/StatsCard.js";
import { ReportForm } from "./components/ReportForm.js";
import { Dashboard } from "./components/Dashboard.js";
import { authService } from "./services/authService.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 [SPA Main] Inicializando SPA minimalista con módulos ES6...");

    // 1. Renderizar la Barra de Navegación Superior de forma dinámica
    const navbarContainer = document.getElementById("navbar-container");
    if (navbarContainer) {
        const usuario = authService.getUsuarioActual();
        navbarContainer.className = "navbar-minimal";
        navbarContainer.innerHTML = `
            <div class="brand-minimal">
                <i class="bi bi-building-fill-gear brand-icon"></i>
                <span>UPDS <span style="font-weight: 300; opacity: 0.8;">Infraestructura</span></span>
            </div>
            <ul class="nav-links">
                ${usuario ? `
                    <li><span style="font-size: 0.875rem; color: var(--text-secondary);">Hola, <strong>${usuario.nombre}</strong></span></li>
                    <li><button class="btn-minimal btn-outline" id="btn-logout">Cerrar Sesión</button></li>
                ` : `
                    <li><button class="btn-minimal btn-accent" id="btn-login-modal">Iniciar Sesión</button></li>
                `}
            </ul>
        `;

        // Registrar eventos del navbar
        const btnLoginModal = document.getElementById("btn-login-modal");
        if (btnLoginModal) {
            btnLoginModal.addEventListener("click", () => {
                const overlay = document.querySelector(".modal-overlay");
                if (overlay) overlay.classList.add("active");
            });
        }

        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.addEventListener("click", async () => {
                await authService.logout();
                window.location.reload();
            });
        }
    }

    // 2. Estructurar el Contenedor Principal (#app-root) de la SPA
    const appRoot = document.getElementById("app-root");
    if (appRoot) {
        appRoot.innerHTML = `
            <div style="max-width: 1200px; margin: 2.5rem auto 0 auto; padding: 0 1.5rem;">
                <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Portal de Infraestructura</h1>
                <p style="color: var(--text-secondary); margin-bottom: 2rem; max-width: 600px;">
                    Portal de monitoreo y reporte en tiempo real de desperfectos físicos en las aulas y laboratorios del campus universitario.
                </p>
                <!-- Contenedor para tarjetas de estadísticas -->
                <div id="stats-container"></div>
            </div>
            
            <!-- Grid de dos columnas (Formulario de reporte e Incidencias activas) -->
            <div class="spa-grid">
                <div id="form-container"></div>
                <div id="dashboard-container"></div>
            </div>
            
            <!-- Contenedor para la inyección del modal de autenticación -->
            <div id="auth-modal-container"></div>
        `;
    }

    // 3. Instanciar e inyectar el Modal de Autenticación
    const authModal = new AuthModal("#auth-modal-container");
    authModal.render();

    // 4. Instanciar, inyectar y actualizar la tarjeta de Estadísticas
    const statsCard = new StatsCard("#stats-container");
    statsCard.render();
    await statsCard.actualizarContadores();

    // 5. Instanciar y renderizar el Dashboard de reportes
    const dashboard = new Dashboard("#dashboard-container", async () => {
        await statsCard.actualizarContadores();
    });
    await dashboard.render();

    // 6. Instanciar y renderizar el Formulario de reportes
    const reportForm = new ReportForm("#form-container", async () => {
        await dashboard.render();
        await statsCard.actualizarContadores();
    });
    reportForm.render();

    console.log("✅ [SPA Main] Todos los componentes han sido cargados y vinculados.");
});
