// frontend/js/components/AdminDashboard.js
/**
 * Componente AdminDashboard Refactorizado.
 * 
 * Responsabilidad:
 * 1. Renderizar la interfaz del Administrador bajo un esquema de pestañas internas (Incidencias y Usuarios).
 * 2. Pestaña Incidencias: Auditoría con tabla minimalista, botón "Ver Detalles" que abre un Modal
 *    Multimedia (Glassmorphism), asignación dinámica de personal de mantenimiento, registro automático
 *    de historial y visualización de timeline / comentarios.
 * 3. Pestaña Usuarios: CRUD completo de usuarios (Crear, Editar, Eliminar) mediante DTOs de seguridad.
 * 
 * COMENTARIOS: Todo el flujo implementa delegación de eventos y llamadas asíncronas seguras a través de apiFetch.
 */

import { apiFetch } from "../services/api.js";
import { notifier } from "../utils/notifier.js";

export class AdminDashboard {
    /**
     * Inicializa el panel del Administrador.
     * @param {string} selectorContenedor - Selector CSS del elemento contenedor.
     */
    constructor(selectorContenedor) {
        this.contenedor = document.querySelector(selectorContenedor);
        this.inicializado = false;
        this.currentTab = "incidencias"; // Pestaña por defecto: auditoría de reportes
    }

    /**
     * Dibuja el marco de la SPA del Administrador con pestañas internas.
     */
    async render() {
        if (!this.contenedor) return;

        this.contenedor.innerHTML = `
            <div style="max-width: 1200px; margin: 2rem auto; padding: 0 1.5rem;">
                
                <!-- Encabezado de la página -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <span class="badge-minimal badge-success" style="background-color: rgba(16, 185, 129, 0.15); color: var(--accent-green);">Administrador</span>
                        <h2 style="font-size: 2.25rem; margin-top: 0.5rem; font-weight: 800; letter-spacing: -0.03em;">Panel de Administración</h2>
                        <p class="text-muted-custom">Consola de auditoría de reportes, control de accesos de usuarios y diagnóstico de infraestructura.</p>
                    </div>
                    <button class="btn-minimal btn-outline" id="btn-refresh-admin" style="padding: 0.5rem 0.85rem;">
                        <i class="bi bi-arrow-clockwise" id="admin-refresh-icon"></i> Refrescar
                    </button>
                </div>

                <!-- Pestañas de Navegación Interna (Admin RBAC Views) -->
                <div style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; padding-bottom: 0.25rem;">
                    <button class="btn-minimal ${this.currentTab === 'incidencias' ? 'btn-primary' : 'btn-outline'}" id="tab-incidencias" style="padding: 0.5rem 1.25rem;">
                        <i class="bi bi-file-earmark-text me-1"></i> Incidencias
                    </button>
                    <button class="btn-minimal ${this.currentTab === 'usuarios' ? 'btn-primary' : 'btn-outline'}" id="tab-usuarios" style="padding: 0.5rem 1.25rem;">
                        <i class="bi bi-people-fill me-1"></i> Usuarios
                    </button>
                </div>

                <!-- Grid de Métricas Globales -->
                <div class="stats-grid-minimal" id="admin-metrics-grid" style="margin-bottom: 2rem;">
                    <div class="stat-box-minimal">
                        <div class="stat-number info">0</div>
                        <div class="stat-label">Cargando...</div>
                    </div>
                </div>

                <!-- Contenedor Dinámico de la Pestaña Activa -->
                <div id="admin-tab-content">
                    <div style="text-align: center; padding: 3rem;">
                        <div class="loader-spinner" style="margin: 0 auto;"></div>
                    </div>
                </div>

            </div>

            <!-- MODAL 1: Expediente / Auditoría Multimedia e Historial de Incidencia -->
            <div id="incidencia-modal" class="modal-overlay">
                <div class="modal-content glassmorphism">
                    <div class="modal-header">
                        <h3 id="modal-title">Detalle de Incidencia</h3>
                        <button class="modal-close-btn" id="btn-close-modal">&times;</button>
                    </div>
                    <div class="modal-body" id="modal-details-body">
                        <!-- Carga dinámica asíncrona -->
                    </div>
                </div>
            </div>

            <!-- MODAL 2: Formulario CRUD de Usuarios (Crear / Editar) -->
            <div id="usuario-modal" class="modal-overlay">
                <div class="modal-content glassmorphism" style="max-width: 480px;">
                    <div class="modal-header">
                        <h3 id="usuario-modal-title">Registrar Usuario</h3>
                        <button class="modal-close-btn" id="btn-close-usuario-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="usuario-form" style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="hidden" id="usuario-id-input">
                            <div>
                                <label for="usuario-nombre" class="form-label" style="display: block; margin-bottom: 0.25rem; font-size: 0.8125rem;">Nombre Completo</label>
                                <input type="text" id="usuario-nombre" required class="input-minimal" style="width: 100%; box-sizing: border-box;">
                            </div>
                            <div>
                                <label for="usuario-email" class="form-label" style="display: block; margin-bottom: 0.25rem; font-size: 0.8125rem;">Correo Electrónico</label>
                                <input type="email" id="usuario-email" required class="input-minimal" style="width: 100%; box-sizing: border-box;">
                            </div>
                            <div id="password-field-container">
                                <label for="usuario-password" id="usuario-password-label" class="form-label" style="display: block; margin-bottom: 0.25rem; font-size: 0.8125rem;">Contraseña (mínimo 6 caracteres)</label>
                                <input type="password" id="usuario-password" required class="input-minimal" style="width: 100%; box-sizing: border-box;">
                            </div>
                            <div>
                                <label for="usuario-rol" class="form-label" style="display: block; margin-bottom: 0.25rem; font-size: 0.8125rem;">Rol Operacional (RBAC)</label>
                                <select id="usuario-rol" required class="select-minimal" style="width: 100%; box-sizing: border-box;">
                                    <option value="estudiante">Estudiante</option>
                                    <option value="personal_mantenimiento">Personal de Mantenimiento</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button type="submit" class="btn-minimal btn-primary" style="margin-top: 1rem; width: 100%; justify-content: center;">Guardar Cambios</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        // Cargar el contenido de la pestaña actual
        await this.cargarPestañaContent();

        // Registrar los listeners delegados sólo una vez
        if (!this.inicializado) {
            this.inicializarEventos();
            this.inicializado = true;
        }
    }

    /**
     * Carga el marcado HTML y datos específicos para la pestaña activa.
     */
    async cargarPestañaContent() {
        const contentContainer = document.getElementById("admin-tab-content");
        if (!contentContainer) return;

        if (this.currentTab === "incidencias") {
            contentContainer.innerHTML = `
                <div class="spa-grid" style="grid-template-columns: 2fr 1fr; padding: 0; gap: 2rem;">
                    
                    <!-- Columna Izquierda: Listado y Acciones de Auditoría -->
                    <div>
                        <div style="margin-bottom: 1rem;">
                            <h3 style="font-weight: 700; margin: 0;">Auditoría de Incidencias</h3>
                        </div>
                        <div class="table-wrapper">
                            <table class="table-minimal" id="admin-audit-table">
                                <thead>
                                    <tr>
                                        <th style="width: 8%">ID</th>
                                        <th style="width: 35%">Incidencia</th>
                                        <th style="width: 20%">Ubicación</th>
                                        <th style="width: 22%">Reportado Por</th>
                                        <th style="width: 10%">Estado</th>
                                        <th style="width: 5%">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 3rem;">
                                            <div class="loader-spinner" style="margin: 0 auto;"></div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Columna Derecha: Servidores y Diagnóstico Técnico -->
                    <div>
                        <div style="margin-bottom: 1rem;">
                            <h3 style="font-weight: 700; margin: 0;">Diagnóstico Técnico</h3>
                        </div>
                        <div class="flat-card" style="padding: 1.5rem;">
                            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; color: var(--text-primary);">
                                <i class="bi bi-cpu" style="color: var(--accent); margin-right: 0.5rem;"></i> Estado de Servidores
                            </h4>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.8125rem;">
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Base de Datos</span>
                                    <span style="color: var(--accent-green); font-weight: 600;">PostgreSQL (Supabase)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Cola de Eventos</span>
                                    <span style="color: var(--accent-green); font-weight: 600;">Redis Upstash (Online)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">API Endpoint</span>
                                    <span style="font-family: monospace; color: var(--text-secondary);">/api/v1 (FastAPI)</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                                    <span class="text-muted-custom">Latencia API</span>
                                    <span style="color: var(--accent-green); font-weight: 600;" id="api-latency">-- ms</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding-bottom: 0.25rem;">
                                    <span class="text-muted-custom">Nivel de Seguridad</span>
                                    <span style="color: var(--accent-blue); font-weight: 600;">JWT Bearer</span>
                                </div>
                            </div>
                            
                            <!-- Acciones del Sistema -->
                            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                <button class="btn-minimal btn-outline" id="btn-mock-cache" style="font-size: 0.75rem; justify-content: center; padding: 0.5rem;">
                                    <i class="bi bi-trash2 me-1"></i> Limpiar Caché de Redis
                                </button>
                                <button class="btn-minimal btn-text" id="btn-mock-logs" style="font-size: 0.75rem; justify-content: center; color: var(--text-secondary);">
                                    <i class="bi bi-download me-1"></i> Descargar Logs del Sistema
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            await this.cargarDatosReportes();
        } else if (this.currentTab === "usuarios") {
            contentContainer.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="font-weight: 700; margin: 0;">Gestión de Cuentas de Usuarios</h3>
                        <button class="btn-minimal btn-primary" id="btn-crear-usuario">
                            <i class="bi bi-person-plus-fill me-1"></i> Registrar Usuario
                        </button>
                    </div>
                    <div class="table-wrapper">
                        <table class="table-minimal" id="admin-users-table">
                            <thead>
                                <tr>
                                    <th style="width: 10%">ID</th>
                                    <th style="width: 30%">Nombre</th>
                                    <th style="width: 35%">Correo Electrónico</th>
                                    <th style="width: 20%">Rol (RBAC)</th>
                                    <th style="width: 5%">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="5" style="text-align: center; padding: 3rem;">
                                        <div class="loader-spinner" style="margin: 0 auto;"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            await this.cargarDatosUsuarios();
        }
    }

    /**
     * Obtiene reportes del backend y los renderiza en la tabla de auditoría con soporte de métricas.
     */
    async cargarDatosReportes() {
        const metricsGrid = document.getElementById("admin-metrics-grid");
        const auditTableBody = document.querySelector("#admin-audit-table tbody");

        try {
            const tiempoInicio = performance.now();
            const respuesta = await apiFetch("/reportes/");
            const tiempoFin = performance.now();
            
            const latencyEl = document.getElementById("api-latency");
            if (latencyEl) {
                latencyEl.textContent = `${Math.round(tiempoFin - tiempoInicio)} ms`;
            }

            if (!respuesta.ok) {
                throw new Error("Fallo al establecer enlace de auditoría.");
            }

            const reportes = await respuesta.json();

            // Calcular Métricas Globales
            const total = reportes.length;
            const resueltos = reportes.filter(r => r.estado === "resuelto").length;
            const pendientes = reportes.filter(r => r.estado === "pendiente").length;
            const enProceso = reportes.filter(r => r.estado === "en proceso").length;

            if (metricsGrid) {
                metricsGrid.innerHTML = `
                    <div class="stat-box-minimal">
                        <div class="stat-number" style="color: var(--text-primary);">${total}</div>
                        <div class="stat-label">Total Incidencias</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number warning">${pendientes}</div>
                        <div class="stat-label">Pendientes</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number info" style="color: var(--accent-blue);">${enProceso}</div>
                        <div class="stat-label">En Proceso</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number success">${resueltos}</div>
                        <div class="stat-label">Resueltas</div>
                    </div>
                `;
            }

            if (auditTableBody) {
                if (total === 0) {
                    auditTableBody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                                No hay incidencias registradas en la base de datos.
                            </td>
                        </tr>
                    `;
                    return;
                }

                auditTableBody.innerHTML = reportes.map(rep => {
                    const reporter = rep.usuario ? rep.usuario.nombre : "Anónimo";
                    
                    return `
                        <tr>
                            <td style="font-weight: 600; color: var(--text-secondary);">#${rep.id}</td>
                            <td>
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.15rem; display: flex; align-items: center; justify-content: space-between;">
                                    <span>${rep.titulo}</span>
                                    <button class="btn-minimal btn-text btn-admin-detalles" data-id="${rep.id}" style="color: var(--accent); font-size: 0.75rem; padding: 0.15rem 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                        <i class="bi bi-card-text"></i> Detalles
                                    </button>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${rep.descripcion}
                                </div>
                            </td>
                            <td><span style="font-size: 0.8125rem;">${rep.ubicacion}</span></td>
                            <td><div style="font-weight: 500; font-size: 0.8125rem;">${reporter}</div></td>
                            <td>
                                <select class="select-minimal select-admin-estado" data-id="${rep.id}">
                                    <option value="pendiente" ${rep.estado === "pendiente" ? "selected" : ""}>⚠️ Pendiente</option>
                                    <option value="en proceso" ${rep.estado === "en proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                                    <option value="resuelto" ${rep.estado === "resuelto" ? "selected" : ""}>✅ Resuelto</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn-minimal btn-text btn-admin-eliminar" data-id="${rep.id}" style="color: #ef4444; padding: 0.25rem;">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join("");
            }

        } catch (error) {
            if (auditTableBody) {
                auditTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 3rem; color: #ef4444;">
                            ⚠️ Error al conectar con el servidor: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    /**
     * Obtiene el listado de usuarios (requiere rol de admin) y los inyecta en la tabla CRUD de usuarios.
     */
    async cargarDatosUsuarios() {
        const usersTableBody = document.querySelector("#admin-users-table tbody");
        const metricsGrid = document.getElementById("admin-metrics-grid");

        try {
            const respuesta = await apiFetch("/usuarios/");
            if (!respuesta.ok) {
                throw new Error("No autorizado o error al recuperar lista de usuarios.");
            }
            const usuarios = await respuesta.json();

            // Actualizar métricas del sistema adaptadas a cuentas
            if (metricsGrid) {
                const totalUsr = usuarios.length;
                const admins = usuarios.filter(u => u.rol === "admin").length;
                const tecnicos = usuarios.filter(u => u.rol === "personal_mantenimiento").length;
                const estudiantes = usuarios.filter(u => u.rol === "estudiante").length;

                metricsGrid.innerHTML = `
                    <div class="stat-box-minimal">
                        <div class="stat-number" style="color: var(--text-primary);">${totalUsr}</div>
                        <div class="stat-label">Cuentas Activas</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number success">${admins}</div>
                        <div class="stat-label">Administradores</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number warning">${tecnicos}</div>
                        <div class="stat-label">Personal Soporte</div>
                    </div>
                    <div class="stat-box-minimal">
                        <div class="stat-number info" style="color: var(--accent-blue);">${estudiantes}</div>
                        <div class="stat-label">Estudiantes</div>
                    </div>
                `;
            }

            if (usersTableBody) {
                if (usuarios.length === 0) {
                    usersTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                                No hay usuarios registrados en la base de datos.
                            </td>
                        </tr>
                    `;
                    return;
                }

                usersTableBody.innerHTML = usuarios.map(usr => {
                    let rolBadgeClass = "badge-info";
                    let rolLabel = usr.rol;
                    if (usr.rol === "admin") {
                        rolBadgeClass = "badge-success";
                        rolLabel = "Administrador";
                    } else if (usr.rol === "personal_mantenimiento") {
                        rolBadgeClass = "badge-warning";
                        rolLabel = "Mantenimiento";
                    } else {
                        rolBadgeClass = "badge-estudiante";
                        rolLabel = "Estudiante";
                    }

                    return `
                        <tr>
                            <td style="font-weight: 600; color: var(--text-secondary);">#${usr.id}</td>
                            <td><div style="font-weight: 600; color: var(--text-primary);">${usr.nombre}</div></td>
                            <td><span style="font-size: 0.8125rem; font-family: monospace; color: var(--text-secondary);">${usr.email}</span></td>
                            <td>
                                <span class="badge-minimal ${rolBadgeClass}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                                    ${rolLabel}
                                </span>
                            </td>
                            <td>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <button class="btn-minimal btn-text btn-user-editar" data-id="${usr.id}" data-nombre="${usr.nombre}" data-email="${usr.email}" data-rol="${usr.rol}" style="color: var(--accent); padding: 0.25rem;" title="Editar usuario">
                                        <i class="bi bi-pencil-fill"></i>
                                    </button>
                                    <button class="btn-minimal btn-text btn-user-eliminar" data-id="${usr.id}" style="color: #ef4444; padding: 0.25rem;" title="Eliminar usuario">
                                        <i class="bi bi-trash-fill"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join("");
            }
        } catch (error) {
            if (usersTableBody) {
                usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 3rem; color: #ef4444;">
                            ⚠️ Error al conectar con el servidor: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    /**
     * Formatea fechas de forma robusta soportando formatos de PostgreSQL, ISO y strings con espacios.
     */
    formatDate(dateInput) {
        if (!dateInput) return "N/A";
        if (dateInput instanceof Date) {
            return dateInput.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
        }
        let dateStr = String(dateInput).trim();
        // Cambiar formato con espacio de PostgreSQL a formato ISO estándar
        if (dateStr.includes(" ") && !dateStr.includes("T")) {
            dateStr = dateStr.replace(" ", "T");
        }
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
            // Eliminar milisegundos o zonas no estándar si falla
            const cleanStr = dateStr.split(".")[0];
            const parsedClean = new Date(cleanStr);
            if (!isNaN(parsedClean.getTime())) {
                return parsedClean.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
            }
            return dateStr; // Fallback al string crudo
        }
        return parsed.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
    }

    /**
     * Recupera expediente detallado e inyecta la UI del Modal Glassmorphic de Auditoría Multimedia.
     */
    async abrirModalIncidencia(id) {
        const modal = document.getElementById("incidencia-modal");
        const detailsBody = document.getElementById("modal-details-body");
        if (!modal || !detailsBody) return;

        // Activar transición visual
        modal.classList.add("active");
        detailsBody.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <div class="loader-spinner" style="margin: 0 auto;"></div>
                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.8125rem;">Cargando expediente técnico...</p>
            </div>
        `;

        try {
            // 1. Obtener detalles frescos del reporte
            const resReporte = await apiFetch(`/reportes/${id}`);
            if (!resReporte.ok) throw new Error("Fallo al obtener expediente del reporte.");
            const rep = await resReporte.json();

            // 2. Obtener lista de usuarios para cargar dropdown de técnicos
            const resUsuarios = await apiFetch("/usuarios/");
            let tecnicos = [];
            if (resUsuarios.ok) {
                const usuarios = await resUsuarios.json();
                // Comentario en español: Filtramos los usuarios para que el selector de asignación técnica
                // contenga únicamente a aquellos con el rol 'personal_mantenimiento', evitando asignar incidentes
                // a usuarios estudiantes o administradores que no realizan labores de soporte físico.
                tecnicos = usuarios.filter(u => u.rol === "personal_mantenimiento");
            }

            const reporter = rep.usuario ? rep.usuario.nombre : "Anónimo";
            const reporterEmail = rep.usuario ? rep.usuario.email : "N/A";
            const fechaStr = this.formatDate(rep.creado_en);

            // Evidencia fotográfica de Supabase Storage
            const evidenciaHTML = rep.imagen_url && rep.imagen_url.trim().startsWith("http") ? `
                <div style="margin-top: 1rem;">
                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Evidencia Multimedia</label>
                    <img src="${rep.imagen_url}" class="notif-media-preview" alt="Evidencia de infraestructura" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color); max-height: 200px; object-fit: cover;">
                </div>
            ` : `
                <div style="margin-top: 1rem;">
                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Evidencia Multimedia</label>
                    <div class="media-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 140px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: 8px; color: var(--text-muted);">
                        <i class="bi bi-image" style="font-size: 2.5rem; filter: grayscale(1); opacity: 0.5; margin-bottom: 0.5rem;"></i>
                        <span style="font-size: 0.75rem;">Sin evidencia fotográfica adjunta</span>
                    </div>
                </div>
            `;

            // Asignación de Técnico dropdown
            const selectTecnicoHTML = `
                <div style="margin-bottom: 1.25rem;">
                    <label for="modal-tecnico-select" class="form-label" style="display: block; margin-bottom: 0.35rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Asignar Técnico de Soporte</label>
                    <select id="modal-tecnico-select" class="select-minimal" style="width: 100%;" data-id="${rep.id}">
                        <option value="">-- Sin asignar --</option>
                        ${tecnicos.map(t => `<option value="${t.id}" ${rep.asignado_a === t.id ? 'selected' : ''}>🛠️ ${t.nombre}</option>`).join("")}
                    </select>
                </div>
            `;

            // Selector de Estados
            const selectEstadoHTML = `
                <div style="margin-bottom: 1.25rem;">
                    <label for="modal-estado-select" class="form-label" style="display: block; margin-bottom: 0.35rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Actualizar Estado</label>
                    <select id="modal-estado-select" class="select-minimal" style="width: 100%;" data-id="${rep.id}">
                        <option value="pendiente" ${rep.estado === "pendiente" ? "selected" : ""}>⚠️ Pendiente</option>
                        <option value="en proceso" ${rep.estado === "en proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                        <option value="resuelto" ${rep.estado === "resuelto" ? "selected" : ""}>✅ Resuelto</option>
                    </select>
                </div>
            `;

            // Timeline de historial de estados inmutables
            const timelineHTML = `
                <div style="margin-top: 1.25rem;">
                    <h4 style="font-size: 0.875rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">
                        <i class="bi bi-clock-history" style="color: var(--accent); margin-right: 0.35rem;"></i> Línea de Tiempo de Estados
                    </h4>
                    <div class="timeline-container" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 150px; overflow-y: auto; padding-right: 0.5rem;">
                        ${rep.historial && rep.historial.length > 0 ? rep.historial.map(h => {
                            const dateH = this.formatDate(h.cambiado_en);
                            const changer = h.usuario ? h.usuario.nombre : "Sistema";
                            return `
                                <div class="timeline-item" style="border-left: 2px solid var(--accent); padding-left: 0.75rem; font-size: 0.75rem; position: relative;">
                                    <div style="font-weight: 700; color: var(--text-primary);">${h.estado_anterior.toUpperCase()} &rarr; ${h.estado_nuevo.toUpperCase()}</div>
                                    <div style="color: var(--text-secondary); margin-top: 0.1rem;">Cambiado por: <strong>${changer}</strong></div>
                                    <div style="color: var(--text-muted); font-size: 0.6875rem; margin-top: 0.1rem;">${dateH}</div>
                                </div>
                            `;
                        }).join("") : `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;">No se registran transiciones de estado.</div>`}
                    </div>
                </div>
            `;

            // Bitácora de comentarios en tiempo real
            const comentariosHTML = `
                <div style="margin-top: 1.25rem;">
                    <h4 style="font-size: 0.875rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">
                        <i class="bi bi-chat-left-text" style="color: var(--accent); margin-right: 0.35rem;"></i> Notas y Bitácora Técnica
                    </h4>
                    <div class="comments-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding-right: 0.5rem; margin-bottom: 0.75rem;">
                        ${rep.comentarios && rep.comentarios.length > 0 ? rep.comentarios.map(c => {
                            const dateC = this.formatDate(c.creado_en);
                            const author = c.usuario ? c.usuario.nombre : "Anónimo";
                            const authorRol = c.usuario ? (c.usuario.rol === 'admin' ? 'Admin' : c.usuario.rol === 'personal_mantenimiento' ? 'Técnico' : 'Estudiante') : 'Usuario';
                            return `
                                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 0.5rem; border-radius: 6px; font-size: 0.75rem;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-weight: 700;">
                                        <span style="color: var(--text-primary);">${author} (${authorRol})</span>
                                        <span style="color: var(--text-muted); font-size: 0.6875rem;">${dateC}</span>
                                    </div>
                                    <div style="color: var(--text-secondary); word-break: break-word;">${c.texto}</div>
                                </div>
                            `;
                        }).join("") : `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 0.5rem 0;" id="no-comments-msg">Sin notas ni bitácora técnica registrada.</div>`}
                    </div>
                    <!-- Formulario de Notas -->
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <textarea id="modal-comment-text" placeholder="Escribir nota de soporte..." class="input-minimal" style="flex: 1; height: 38px; resize: none; font-size: 0.75rem; padding: 0.5rem; box-sizing: border-box;"></textarea>
                        <button class="btn-minimal btn-primary" id="btn-modal-add-comment" data-id="${rep.id}" style="height: 38px; font-size: 0.75rem; padding: 0 0.75rem;">
                            <i class="bi bi-send-fill"></i>
                        </button>
                    </div>
                </div>
            `;

            detailsBody.innerHTML = `
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
                    <!-- Columna Izquierda: Información de la Incidencia -->
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <span class="badge-minimal" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); margin-bottom: 0.25rem; display: inline-block;">Expediente #${rep.id}</span>
                            <h3 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: var(--text-primary);">${rep.titulo}</h3>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                Por <strong>${reporter}</strong> (${reporterEmail}) el ${fechaStr}
                            </div>
                        </div>
                        <div>
                            <label class="form-label" style="display: block; margin-bottom: 0.15rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Ubicación física</label>
                            <div style="font-size: 0.8125rem; color: var(--text-secondary);"><i class="bi bi-geo-alt-fill" style="color: var(--accent); margin-right: 0.25rem;"></i> ${rep.ubicacion}</div>
                        </div>
                        <div>
                            <label class="form-label" style="display: block; margin-bottom: 0.15rem; font-weight: 700; font-size: 0.8125rem; color: var(--text-primary);">Descripción detallada</label>
                            <div style="font-size: 0.8125rem; color: var(--text-secondary); white-space: pre-line; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 0.5rem 0.75rem; border-radius: 6px;">${rep.descripcion}</div>
                        </div>
                        ${evidenciaHTML}
                    </div>

                    <!-- Columna Derecha: Diagnóstico y Trazabilidad -->
                    <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        ${selectTecnicoHTML}
                        ${selectEstadoHTML}
                        ${timelineHTML}
                        ${comentariosHTML}
                    </div>
                </div>
            `;

        } catch (error) {
            detailsBody.innerHTML = `
                <div class="alert-minimal alert-error" style="margin: 2rem 0; padding: 1.5rem; border-radius: 8px;">
                    <i class="bi bi-exclamation-triangle-fill"></i> Error al recuperar expediente: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Vincula listeners utilizando delegación de eventos en el contenedor SPA principal.
     */
    inicializarEventos() {
        // Delegar clics en todo el contenedor
        this.contenedor.addEventListener("click", async (e) => {
            // Pestaña Incidencias
            const btnTabIncidencias = e.target.closest("#tab-incidencias");
            if (btnTabIncidencias) {
                this.currentTab = "incidencias";
                await this.render();
                return;
            }

            // Pestaña Usuarios
            const btnTabUsuarios = e.target.closest("#tab-usuarios");
            if (btnTabUsuarios) {
                this.currentTab = "usuarios";
                await this.render();
                return;
            }

            // Botón Ver Detalles (Modal Multimedia)
            const btnDetalles = e.target.closest(".btn-admin-detalles");
            if (btnDetalles) {
                const id = btnDetalles.dataset.id;
                await this.abrirModalIncidencia(id);
                return;
            }

            // Botón Cerrar Modal Incidencia
            const btnCloseModal = e.target.closest("#btn-close-modal");
            if (btnCloseModal) {
                document.getElementById("incidencia-modal").classList.remove("active");
                // Recargar listado al cerrar por si se cambiaron estados o técnicos
                await this.cargarDatosReportes();
                return;
            }

            // Botón Eliminar Reporte
            const btnEliminar = e.target.closest(".btn-admin-eliminar");
            if (btnEliminar) {
                const id = btnEliminar.dataset.id;
                if (confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente el reporte #${id}? Esta acción es irreversible.`)) {
                    await this.eliminarReporte(id);
                }
                return;
            }

            // Botón Limpiar Caché de Redis
            const btnCache = e.target.closest("#btn-mock-cache");
            if (btnCache) {
                btnCache.innerHTML = `<span class="loader-spinner" style="margin-right: 0.25rem;"></span> Limpiando...`;
                setTimeout(() => {
                    alert("✅ Cachés de Redis depuradas e invalidadas con éxito.");
                    btnCache.innerHTML = `<i class="bi bi-trash2 me-1"></i> Limpiar Caché de Redis`;
                }, 800);
                return;
            }

            // Botón Descargar Logs
            const btnLogs = e.target.closest("#btn-mock-logs");
            if (btnLogs) {
                alert("📥 Descargando archivo de trazabilidad global (system_audit.log)...");
                return;
            }

            // Refrescar manual
            const btnRefresh = e.target.closest("#btn-refresh-admin");
            if (btnRefresh) {
                const icon = document.getElementById("admin-refresh-icon");
                if (icon) icon.classList.add("spin-animation");
                await this.cargarPestañaContent();
                if (icon) icon.classList.remove("spin-animation");
                return;
            }

            // Registrar Usuario (Abrir Modal CRUD)
            const btnCrearUsr = e.target.closest("#btn-crear-usuario");
            if (btnCrearUsr) {
                document.getElementById("usuario-id-input").value = "";
                document.getElementById("usuario-nombre").value = "";
                document.getElementById("usuario-email").value = "";
                document.getElementById("usuario-rol").value = "estudiante";
                document.getElementById("usuario-password").value = "";

                document.getElementById("usuario-modal-title").textContent = "Registrar Usuario";
                document.getElementById("password-field-container").style.display = "block";
                document.getElementById("usuario-password").setAttribute("required", "required");
                document.getElementById("usuario-password-label").textContent = "Contraseña (mínimo 6 caracteres)";
                document.getElementById("usuario-password").placeholder = "••••••••";

                document.getElementById("usuario-modal").classList.add("active");
                return;
            }

            // Cerrar Modal Usuario
            const btnCloseUsrModal = e.target.closest("#btn-close-usuario-modal");
            if (btnCloseUsrModal) {
                document.getElementById("usuario-modal").classList.remove("active");
                return;
            }

            // Editar Usuario (Abrir Modal CRUD populated)
            const btnEditarUsr = e.target.closest(".btn-user-editar");
            if (btnEditarUsr) {
                const id = btnEditarUsr.dataset.id;
                const nombre = btnEditarUsr.dataset.nombre;
                const email = btnEditarUsr.dataset.email;
                const rol = btnEditarUsr.dataset.rol;

                document.getElementById("usuario-id-input").value = id;
                document.getElementById("usuario-nombre").value = nombre;
                document.getElementById("usuario-email").value = email;
                document.getElementById("usuario-rol").value = rol;
                document.getElementById("usuario-password").value = "";

                document.getElementById("usuario-modal-title").textContent = "Modificar Usuario";
                document.getElementById("password-field-container").style.display = "block"; // Se mantiene visible
                document.getElementById("usuario-password").removeAttribute("required"); // No requerida para la edición
                document.getElementById("usuario-password-label").textContent = "Nueva Contraseña (dejar en blanco para conservar)";
                document.getElementById("usuario-password").placeholder = "Dejar en blanco para no cambiar";

                document.getElementById("usuario-modal").classList.add("active");
                return;
            }

            // Eliminar Usuario
            const btnEliminarUsr = e.target.closest(".btn-user-eliminar");
            if (btnEliminarUsr) {
                const id = btnEliminarUsr.dataset.id;
                if (confirm(`⚠️ ¿Deseas eliminar permanentemente el usuario #${id}? Se removerán sus permisos RBAC.`)) {
                    await this.eliminarUsuario(id);
                }
                return;
            }

            // Agregar Comentario desde Modal de Detalle
            const btnAddComment = e.target.closest("#btn-modal-add-comment");
            if (btnAddComment) {
                const id = btnAddComment.dataset.id;
                const textarea = document.getElementById("modal-comment-text");
                const texto = textarea.value.trim();

                if (!texto) {
                    alert("⚠️ El comentario no puede estar vacío.");
                    return;
                }

                try {
                    const respuesta = await apiFetch(`/reportes/${id}/comentarios`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ texto })
                    });

                    if (!respuesta.ok) {
                        const err = await respuesta.json();
                        throw new Error(err.detail || "Error al enviar nota.");
                    }

                    textarea.value = "";
                    
                    // Comentario en español: Alertamos localmente tras agregar un comentario exitoso
                    // para dar confirmación instantánea antes de recargar.
                    notifier.show({
                        tipo: "success",
                        titulo: "Nota Registrada",
                        mensaje: "El comentario se ha añadido a la bitácora técnica."
                    });

                    // Recargar reactivamente el modal para mostrar la nueva bitácora
                    await this.abrirModalIncidencia(id);

                } catch (error) {
                    alert(`❌ Error: ${error.message}`);
                }
                return;
            }
        });

        // Capturar cambios en Dropdowns de estado en tabla principal
        this.contenedor.addEventListener("change", async (e) => {
            if (e.target.matches(".select-admin-estado")) {
                const id = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                await this.actualizarEstado(id, nuevoEstado, e.target);
            }
        });

        // Capturar cambios de dropdowns interactivos dentro del Modal de Incidencia
        document.body.addEventListener("change", async (e) => {
            // Cambiar técnico asignado
            if (e.target.id === "modal-tecnico-select") {
                const id = e.target.dataset.id;
                const tecnicoId = e.target.value ? parseInt(e.target.value) : null;
                await this.actualizarPropiedadReporte(id, { asignado_a: tecnicoId }, "técnico asignado");
                // Recargar reactivamente para refrescar timeline
                await this.abrirModalIncidencia(id);
            }

            // Cambiar estado operacional
            if (e.target.id === "modal-estado-select") {
                const id = e.target.dataset.id;
                const nuevoEstado = e.target.value;
                await this.actualizarPropiedadReporte(id, { estado: nuevoEstado }, "estado");
                // Recargar reactivamente para refrescar timeline
                await this.abrirModalIncidencia(id);
            }
        });

        // Formulario Submit CRUD de Usuarios
        document.body.addEventListener("submit", async (e) => {
            if (e.target.id === "usuario-form") {
                e.preventDefault();
                await this.guardarUsuario();
            }
        });
    }

    /**
     * PUT para actualizar cualquier campo del reporte desde el modal.
     */
    async actualizarPropiedadReporte(id, bodyData, campoLabel) {
        try {
            const respuesta = await apiFetch(`/reportes/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(bodyData)
            });

            if (!respuesta.ok) {
                const err = await respuesta.json();
                throw new Error(err.detail || "Fallo en la petición.");
            }

            // Comentario en español: Alertamos localmente al administrador sobre el éxito de la asignación
            // o modificación de propiedades de la incidencia utilizando notifier.show().
            if (campoLabel === "técnico asignado") {
                notifier.show({
                    tipo: "success",
                    titulo: "Técnico Asignado",
                    mensaje: "El personal técnico ha sido asignado con éxito."
                });
            } else {
                notifier.show({
                    tipo: "success",
                    titulo: "Propiedad Guardada",
                    mensaje: "Se actualizó el campo correctamente."
                });
            }

        } catch (error) {
            alert(`❌ Error al actualizar ${campoLabel}: ${error.message}`);
        }
    }

    /**
     * PUT para cambiar el estado desde la tabla principal.
     */
    async actualizarEstado(id, nuevoEstado, selectEl) {
        const previo = selectEl.defaultValue;

        try {
            const respuesta = await apiFetch(`/reportes/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    estado: nuevoEstado
                })
            });

            if (!respuesta.ok) {
                const err = await respuesta.json();
                throw new Error(err.detail || "No autorizado o error de servidor.");
            }

            selectEl.defaultValue = nuevoEstado;
            
            // Comentario en español: Se dispara un toast local instantáneo de éxito para dar feedback
            // inmediato sobre la actualización del estado de la incidencia, sin esperar la latencia del WebSocket.
            notifier.show({
                tipo: "success",
                titulo: "Estado Actualizado",
                mensaje: "El nuevo estado se ha guardado"
            });

            await this.cargarDatosReportes();

        } catch (error) {
            notifier.show({
                tipo: "error",
                titulo: "Error al actualizar estado",
                mensaje: error.message
            });
            selectEl.value = previo;
        }
    }

    /**
     * DELETE para purgar el reporte de la BD.
     */
    async eliminarReporte(id) {
        try {
            const respuesta = await apiFetch(`/reportes/${id}`, {
                method: "DELETE"
            });

            if (!respuesta.ok) {
                const err = await respuesta.json();
                throw new Error(err.detail || "No autorizado o error del servidor.");
            }

            // Comentario en español: Se muestra una alerta local de confirmación inmediata tras
            // eliminar con éxito el reporte en el servidor, garantizando feedback visual rápido.
            notifier.show({
                tipo: "success",
                titulo: "Incidencia Eliminada",
                mensaje: "El registro fue borrado localmente"
            });

            await this.cargarDatosReportes();

        } catch (error) {
            notifier.show({
                tipo: "error",
                titulo: "Error al eliminar reporte",
                mensaje: error.message
            });
        }
    }

    /**
     * POST o PUT para registrar o modificar datos de un usuario de forma segura.
     */
    async guardarUsuario() {
        const id = document.getElementById("usuario-id-input").value;
        const nombre = document.getElementById("usuario-nombre").value.trim();
        const email = document.getElementById("usuario-email").value.trim();
        const rol = document.getElementById("usuario-rol").value;
        const password = document.getElementById("usuario-password").value;

        const isEdit = id !== "";
        let url = "/usuarios/";
        let method = "POST";
        let bodyObj = { nombre, email, rol };

        if (isEdit) {
            url += id;
            method = "PUT";
            // Para edición, password es opcional
            if (password.trim() !== "") {
                bodyObj.password = password;
            }
        } else {
            // Para creación, password es mandatorio
            bodyObj.password = password;
        }

        try {
            const respuesta = await apiFetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(bodyObj)
            });

            if (!respuesta.ok) {
                const err = await respuesta.json();
                const errorObj = new Error(err.error || err.detail || "Error en la operación del servidor.");
                errorObj.status = respuesta.status;
                throw errorObj;
            }

            document.getElementById("usuario-modal").classList.remove("active");
            await this.cargarDatosUsuarios();

            // Desplegar notificación de éxito correspondiente
            if (isEdit) {
                notifier.show({
                    tipo: "success",
                    titulo: "Usuario Actualizado",
                    mensaje: "Los cambios se guardaron con éxito"
                });
            } else {
                notifier.show({
                    tipo: "success",
                    titulo: "Usuario Creado",
                    mensaje: "El usuario fue registrado correctamente"
                });
            }

        } catch (error) {
            const isWarning = error.status === 400 || error.status === 422;
            notifier.show({
                tipo: isWarning ? "warning" : "error",
                titulo: isWarning ? "Advertencia" : "Error en Operación",
                mensaje: error.message || "Ocurrió un error al guardar el usuario."
            });
        }
    }

    /**
     * DELETE para remover una cuenta de usuario.
     */
    async eliminarUsuario(id) {
        try {
            const respuesta = await apiFetch(`/usuarios/${id}`, {
                method: "DELETE"
            });

            if (!respuesta.ok) {
                const err = await respuesta.json();
                const errorObj = new Error(err.error || err.detail || "Fallo del servidor.");
                errorObj.status = respuesta.status;
                throw errorObj;
            }

            await this.cargarDatosUsuarios();

            // Notificación estética tras eliminación exitosa
            notifier.show({
                tipo: "success",
                titulo: "Usuario Eliminado",
                mensaje: "La cuenta ha sido removida del sistema"
            });

        } catch (error) {
            const isWarning = error.status === 400 || error.status === 403;
            notifier.show({
                tipo: isWarning ? "warning" : "error",
                titulo: isWarning ? "Advertencia" : "Error al Eliminar",
                mensaje: error.message || "Ocurrió un error al intentar eliminar el usuario."
            });
        }
    }
}
