// frontend/js/main.js
/**
 * Punto de entrada principal de la aplicación frontend.
 * Responsabilidad: Inicializar y coordinar la renderización de componentes
 * modularizados una vez que el DOM esté completamente cargado.
 */

import { AuthModal } from "./components/AuthModal.js";
import { StatsCard } from "./components/StatsCard.js";
import { ReportForm } from "./components/ReportForm.js";
import { Dashboard } from "./components/Dashboard.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 [Main] Inicializando módulos ES6 en el frontend...");

    // 1. Instanciar e inyectar el Modal de Autenticación
    const authModal = new AuthModal("#auth-modal-container");
    authModal.render();

    // 2. Instanciar, inyectar y actualizar la tarjeta de Estadísticas
    const statsCard = new StatsCard("#stats-container");
    statsCard.render();
    await statsCard.actualizarContadores();

    // 3. Instanciar y renderizar el Dashboard de reportes
    // Al cambiar de estado en el dashboard, actualizamos los contadores de estadísticas de inmediato
    const dashboard = new Dashboard("#dashboard-container", async () => {
        await statsCard.actualizarContadores();
    });
    await dashboard.render();

    // 4. Instanciar y renderizar el Formulario de reportes
    // Al enviar con éxito, refrescamos el dashboard y actualizamos los contadores
    const reportForm = new ReportForm("#form-container", async () => {
        await dashboard.render();
        await statsCard.actualizarContadores();
    });
    reportForm.render();

    console.log("✅ [Main] Todos los componentes han sido cargados y renderizados con éxito.");
});
