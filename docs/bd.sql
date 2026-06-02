-- =====================================================================
-- BLUEPRINT DE BASE DE DATOS: GESTIÓN DE INFRAESTRUCTURA UNIVERSITARIA
-- VERSIÓN: 2.0 (COMPLETA - SAAS READY)
-- =====================================================================

-- Eliminar tablas en orden inverso de dependencias por seguridad en testing
DROP TABLE IF EXISTS historial_estados;
DROP TABLE IF EXISTS comentarios;
DROP TABLE IF EXISTS reportes;
DROP TABLE IF EXISTS usuarios;

-- 1. TABLA DE USUARIOS (Con soporte RBAC)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(30) DEFAULT 'estudiante' NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_rol CHECK (rol IN ('estudiante', 'personal_mantenimiento', 'admin'))
);
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- 2. TABLA DE REPORTES (Conexión relacional con Usuarios)
CREATE TABLE reportes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    tipo_problema VARCHAR(50) NOT NULL,
    ubicacion VARCHAR(200) NOT NULL,
    imagen_url VARCHAR(255) NULL,
    prioridad VARCHAR(20) DEFAULT 'media' NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    usuario_id INT NOT NULL, -- Estudiante que reporta
    asignado_a INT NULL,     -- Técnico de mantenimiento asignado
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT chk_prioridad CHECK (prioridad IN ('baja', 'media', 'alta')),
    CONSTRAINT chk_estado CHECK (estado IN ('pendiente', 'en proceso', 'resuelto'))
);
CREATE INDEX idx_reportes_estado ON reportes (estado);
CREATE INDEX idx_reportes_usuario ON reportes (usuario_id);

-- 3. TABLA DE COMENTARIOS (Trazabilidad y Bitácoras de Mantenimiento)
CREATE TABLE comentarios (
    id SERIAL PRIMARY KEY,
    reporte_id INT NOT NULL,
    usuario_id INT NOT NULL,
    texto TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX idx_comentarios_reporte ON comentarios(reporte_id);

-- 4. TABLA DE HISTORIAL DE ESTADOS (Auditoría para tableros de control)
CREATE TABLE historial_estados (
    id SERIAL PRIMARY KEY,
    reporte_id INT NOT NULL,
    usuario_id INT NOT NULL, -- Quién realizó el cambio
    estado_anterior VARCHAR(20) NOT NULL,
    estado_nuevo VARCHAR(20) NOT NULL,
    cambiado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);