// frontend/js/app.js
/**
 * Lógica del Lado del Cliente (JavaScript Vanilla).
 * Responsabilidad: Manejar la validación interactiva de formularios, las peticiones fetch() 
 * hacia el backend de FastAPI para registro, login y consulta de estadísticas, y administrar
 * de forma segura el almacenamiento del token JWT en el SessionStorage del navegador.
 */

// URL base del backend de la API (por defecto Uvicorn corre en el puerto 8000)
const API_URL = "http://localhost:8000/api";

document.addEventListener("DOMContentLoaded", () => {
    inicializarFormularios();
    cargarEstadisticas();
});

/**
 * Inicializa y asocia los eventos a los formularios de Login y Registro.
 */
function inicializarFormularios() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Validar de forma nativa con Bootstrap
            if (!loginForm.checkValidity()) {
                e.stopPropagation();
                loginForm.classList.add("was-validated");
                return;
            }

            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            mostrarCarga("login-spinner", true);
            limpiarAlerta();

            try {
                // El endpoint de Login /auth/login espera un formato JSON que mapee UsuarioLogin
                const respuesta = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.detail || "Error al iniciar sesión. Inténtelo de nuevo.");
                }

                // Guardar el token de forma segura en la sesión del navegador
                sessionStorage.setItem("token", data.access_token);
                sessionStorage.setItem("token_type", data.token_type);
                
                mostrarAlerta("success", "✅ ¡Acceso concedido! Redireccionando...");
                
                // Simular redirección al dashboard/tablero técnico tras 1.5s
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (error) {
                mostrarAlerta("danger", `❌ ${error.message}`);
            } finally {
                mostrarCarga("login-spinner", false);
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

            mostrarCarga("reg-spinner", true);
            limpiarAlerta();

            try {
                // El endpoint /auth/register espera UsuarioCreate (ahora incluye rol)
                const respuesta = await fetch(`${API_URL}/auth/register`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ nombre, email, password, rol })
                });

                const data = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(data.detail || "Error en el registro del usuario.");
                }

                mostrarAlerta("success", "🎉 ¡Cuenta registrada con éxito! Inicia sesión para continuar.");
                registerForm.reset();
                registerForm.classList.remove("was-validated");

                // Activar pestaña de login automáticamente
                setTimeout(() => {
                    const loginTab = document.getElementById("login-tab");
                    if (loginTab) loginTab.click();
                }, 2000);

            } catch (error) {
                mostrarAlerta("danger", `❌ ${error.message}`);
            } finally {
                mostrarCarga("reg-spinner", false);
            }
        });
    }
}

/**
 * Consulta de manera asíncrona la lista de reportes para calcular estadísticas agregadas.
 */
async function cargarEstadisticas() {
    try {
        const respuesta = await fetch(`${API_URL}/reportes/`);
        if (!respuesta.ok) return;

        const reportes = await respuesta.json();

        // Calcular cantidades agregadas según el campo 'estado'
        const total = reportes.length;
        const enProceso = reportes.filter(r => r.estado === "en proceso").length;
        const resuelto = reportes.filter(r => r.estado === "resuelto").length;

        // Actualizar el DOM
        document.getElementById("stats-total").textContent = total;
        document.getElementById("stats-proceso").textContent = enProceso;
        document.getElementById("stats-resuelto").textContent = resuelto;

    } catch (error) {
        console.warn("No se pudieron cargar las estadísticas en tiempo real: ", error.message);
    }
}

/**
 * Muestra o despliega el spinner de carga en los botones.
 */
function mostrarCarga(spinnerId, mostrar) {
    const spinner = document.getElementById(spinnerId);
    if (!spinner) return;
    if (mostrar) {
        spinner.classList.remove("d-none");
    } else {
        spinner.classList.add("d-none");
    }
}

/**
 * Despliega un banner de alerta con Bootstrap en el modal de autenticación.
 */
function mostrarAlerta(tipo, mensaje) {
    const alertBox = document.getElementById("auth-alert");
    if (!alertBox) return;

    alertBox.className = `alert alert-${tipo} mt-3 d-block`;
    alertBox.textContent = mensaje;
}

/**
 * Limpia y oculta cualquier alerta previa.
 */
function limpiarAlerta() {
    const alertBox = document.getElementById("auth-alert");
    if (alertBox) {
        alertBox.className = "alert d-none mt-3";
        alertBox.textContent = "";
    }
}
