# app/schemas/usuario.py
"""
Módulo de Esquemas de Pydantic para Usuarios y Tokens (DTOs).
Responsabilidad: Definir y validar la estructura de datos entrantes y salientes
relacionados con el registro, inicio de sesión, y la generación de tokens JWT.

Contiene explicaciones académicas sobre las validaciones aplicadas a nivel de esquema.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

class UsuarioBase(BaseModel):
    """
    Estructura de datos base para las transferencias de usuario.
    """
    # EmailStr valida automáticamente que la cadena tenga formato de correo electrónico.
    email: EmailStr = Field(
        ..., 
        description="Correo electrónico institucional o personal del usuario",
        examples=["usuario@universidad.edu.bo"]
    )
    nombre: str = Field(
        ..., 
        description="Nombre completo del usuario",
        examples=["Juan Pérez"]
    )

class UsuarioCreate(UsuarioBase):
    """
    DTO utilizado para validar el payload de registro de nuevos usuarios (POST /auth/register).
    Comentario en español: Se ha removido el campo 'rol' y su validador para prevenir inyecciones
    de parámetros desde peticiones manipuladas del lado del cliente. Toda cuenta nueva
    adquirirá un rol por defecto en el backend.
    """
    password: str = Field(
        ..., 
        description="Contraseña en texto plano para el registro de la cuenta (mínimo 6 caracteres)",
        examples=["secreto123"]
    )

    @field_validator("password")
    @classmethod
    def validar_longitud_password(cls, valor: str) -> str:
        """
        Validador personalizado para garantizar la complejidad mínima de la contraseña.
        """
        if not valor or len(valor.strip()) < 6:
            raise ValueError("La contraseña debe tener como mínimo 6 caracteres válidos.")
        return valor

    @field_validator("nombre")
    @classmethod
    def validar_nombre_no_vacio(cls, valor: str) -> str:
        """
        Validador para evitar nombres vacíos o que contengan únicamente espacios en blanco.
        """
        if not valor or not valor.strip():
            raise ValueError("El nombre es obligatorio y no puede estar en blanco.")
        return valor.strip()

class UsuarioLogin(BaseModel):
    """
    DTO utilizado para validar las credenciales en el inicio de sesión (POST /auth/login).
    """
    email: EmailStr = Field(
        ...,
        description="Correo electrónico registrado",
        examples=["usuario@universidad.edu.bo"]
    )
    password: str = Field(
        ...,
        description="Contraseña en texto plano correspondiente a la cuenta",
        examples=["secreto123"]
    )

class UsuarioResponse(BaseModel):
    """
    DTO para dar formato de salida seguro a la información del usuario en las respuestas de la API.
    Oculte de forma estricta los campos sensibles como hashes de contraseñas.
    """
    id: int = Field(..., description="Identificador único autoincremental del usuario")
    email: EmailStr = Field(..., description="Correo electrónico institucional")
    nombre: str = Field(..., description="Nombre completo")
    rol: str = Field(..., description="Rol actual del usuario en la plataforma")

    # Configuración de Pydantic v2 para permitir el mapeo de atributos del modelo ORM de SQLAlchemy.
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """
    DTO de respuesta que retorna las credenciales de acceso temporal (Token JWT) tras un login exitoso.
    """
    access_token: str = Field(..., description="Token de acceso firmado digitalmente mediante JWT")
    token_type: str = Field(default="bearer", description="Esquema de autenticación (comúnmente 'bearer')")
    refresh_token: str = Field(..., description="Token de refresco de larga duración firmado mediante JWT")

    model_config = ConfigDict(from_attributes=True)


class TokenRefreshRequest(BaseModel):
    """
    DTO utilizado para validar el payload de la petición de refresco de token.
    """
    refresh_token: str = Field(..., description="Token de refresco JWT para solicitar un nuevo token de acceso")


from typing import Optional

class UsuarioCreateAdmin(UsuarioBase):
    """
    DTO de Pydantic utilizado por el Administrador para crear nuevos usuarios de forma directa
    especificando el rol y la contraseña inicial (POST /api/usuarios).
    """
    password: str = Field(
        ...,
        description="Contraseña inicial en texto plano para la cuenta (mínimo 6 caracteres)",
        examples=["secreto123"]
    )
    rol: str = Field(
        default="estudiante",
        description="Rol inicial asignado para el control de accesos RBAC ('estudiante', 'personal_mantenimiento', 'admin')",
        examples=["estudiante"]
    )

    @field_validator("password")
    @classmethod
    def validar_longitud_password(cls, valor: str) -> str:
        """
        Valida que la contraseña cumpla con el estándar mínimo de longitud.
        """
        if not valor or len(valor.strip()) < 6:
            raise ValueError("La contraseña debe tener como mínimo 6 caracteres válidos.")
        return valor

    @field_validator("rol")
    @classmethod
    def validar_rol_permitido(cls, valor: str) -> str:
        """
        Garantiza que el rol inyectado por el administrador sea un rol soportado en el sistema.
        """
        roles_validos = ["estudiante", "personal_mantenimiento", "admin"]
        if valor not in roles_validos:
            raise ValueError(f"El rol debe ser uno de los siguientes: {', '.join(roles_validos)}")
        return valor


class UsuarioUpdate(BaseModel):
    """
    DTO de Pydantic utilizado para la actualización parcial y selectiva de la información del usuario
    por parte del Administrador (PUT /api/usuarios/{id}).
    """
    email: Optional[EmailStr] = Field(default=None, description="Nuevo correo electrónico del usuario")
    nombre: Optional[str] = Field(default=None, description="Nuevo nombre completo")
    rol: Optional[str] = Field(default=None, description="Nuevo rol de accesos en la plataforma")
    password: Optional[str] = Field(default=None, description="Nueva contraseña en texto plano (opcional)")

    @field_validator("password")
    @classmethod
    def validar_longitud_password_opcional(cls, valor: Optional[str]) -> Optional[str]:
        """
        Aplica validación de longitud únicamente si se proporciona una nueva contraseña.
        """
        if valor is not None:
            if len(valor.strip()) < 6:
                raise ValueError("La contraseña debe tener como mínimo 6 caracteres válidos.")
            return valor
        return None

    @field_validator("rol")
    @classmethod
    def validar_rol_permitido_opcional(cls, valor: Optional[str]) -> Optional[str]:
        """
        Valida el nuevo rol opcional frente a los roles soportados en el esquema de la BD.
        """
        if valor is not None:
            roles_validos = ["estudiante", "personal_mantenimiento", "admin"]
            if valor not in roles_validos:
                raise ValueError(f"El rol debe ser uno de los siguientes: {', '.join(roles_validos)}")
            return valor
        return None

