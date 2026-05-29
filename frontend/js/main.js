// frontend/js/main.js
/**
 * Punto de entrada principal de la aplicación frontend.
 * Responsabilidad: Inicializar y coordinar la renderización de componentes
 * modularizados una vez que el DOM esté completamente cargado.
 */

import { AuthModal } from "./components/AuthModal.js";
import { StatsCard } from "./components/StatsCard.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 [Main] Inicializando módulos ES6 en el frontend...");

    // 1. Instanciar e inyectar el Modal de Autenticación
    const authModal = new AuthModal("#auth-modal-container");
    authModal.render();

    // 2. Instanciar, inyectar y actualizar la tarjeta de Estadísticas
    const statsCard = new StatsCard("#stats-container");
    statsCard.render();
    await statsCard.actualizarContadores();

    console.log("✅ [Main] Todos los componentes iniciales han sido cargados y renderizados.");
});
