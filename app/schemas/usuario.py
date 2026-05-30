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

    model_config = ConfigDict(from_attributes=True)
