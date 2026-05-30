# app/api/endpoints/usuarios.py
"""
Capa de Controladores / Enrutadores para Usuarios (FastAPI APIRouter).
Responsabilidad: Exponer las rutas HTTP exclusivas de administración para realizar
operaciones CRUD sobre la entidad "Usuario".

Todas las rutas dentro de este router están protegidas mediante control de acceso
basado en roles (RBAC), requiriendo un token JWT firmado de administrador.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.usuario import UsuarioModel
from app.schemas.usuario import UsuarioCreateAdmin, UsuarioUpdate, UsuarioResponse
from app.services.auth import AuthService
from app.api.endpoints.reportes import get_current_user

# Definir el router con prefijo y tag para documentación interactiva Swagger
router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"]
)

def require_admin_role(usuario: UsuarioModel = Depends(get_current_user)) -> UsuarioModel:
    """
    Dependencia de seguridad (RBAC) que valida que el usuario autenticado
    posea explícitamente el rol de 'admin'.
    De lo contrario, lanza una excepción de nivel 403 Forbidden.
    """
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación no permitida. Se requiere rol de administrador."
        )
    return usuario


@router.get("/", response_model=List[UsuarioResponse], summary="Listar usuarios del sistema")
def listar_usuarios(
    db: Session = Depends(get_db),
    admin: UsuarioModel = Depends(require_admin_role)
):
    """
    Obtiene la lista completa de usuarios registrados.
    Requiere autenticación con rol de Administrador.
    """
    return db.query(UsuarioModel).all()


@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED, summary="Registrar nuevo usuario")
def crear_usuario(
    payload: UsuarioCreateAdmin,
    db: Session = Depends(get_db),
    admin: UsuarioModel = Depends(require_admin_role)
):
    """
    Permite a un administrador registrar una nueva cuenta de usuario
    definiendo explícitamente el rol del mismo (estudiante, personal_mantenimiento, admin).
    """
    # Validar unicidad del correo electrónico
    usuario_existente = db.query(UsuarioModel).filter(UsuarioModel.email == payload.email).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya se encuentra registrado."
        )

    # Hashear contraseña de forma segura
    hashed_pass = AuthService.hash_password(payload.password)

    nuevo_usuario = UsuarioModel(
        email=payload.email,
        nombre=payload.nombre,
        hashed_password=hashed_pass,
        rol=payload.rol
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario


@router.put("/{id}", response_model=UsuarioResponse, summary="Actualizar usuario")
def actualizar_usuario(
    id: int,
    payload: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: UsuarioModel = Depends(require_admin_role)
):
    """
    Modifica selectivamente las propiedades de un usuario existente.
    """
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado."
        )

    # Si se intenta cambiar el email, comprobar unicidad
    if payload.email is not None:
        existente = db.query(UsuarioModel).filter(
            UsuarioModel.email == payload.email,
            UsuarioModel.id != id
        ).first()
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ya está asignado a otra cuenta."
            )
        usuario.email = payload.email

    if payload.nombre is not None:
        usuario.nombre = payload.nombre

    if payload.rol is not None:
        usuario.rol = payload.rol

    # Comentario en español: Hashear de forma segura utilizando la utilidad AuthService (que internamente implementa bcrypt)
    # la nueva contraseña en caso de que el administrador decida actualizarla en la edición del usuario,
    # impidiendo almacenar contraseñas en texto plano y garantizando la confidencialidad de la cuenta en la BD.
    if payload.password is not None:
        usuario.hashed_password = AuthService.hash_password(payload.password)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/{id}", summary="Eliminar usuario")
def eliminar_usuario(
    id: int,
    db: Session = Depends(get_db),
    admin: UsuarioModel = Depends(require_admin_role)
):
    """
    Elimina físicamente una cuenta de usuario del sistema relacional.
    Previene la auto-eliminación accidental del administrador logueado.
    """
    usuario = db.query(UsuarioModel).filter(UsuarioModel.id == id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado."
        )

    if usuario.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No está permitido eliminarse a sí mismo de la plataforma."
        )

    db.delete(usuario)
    db.commit()
    return {"message": "Usuario eliminado exitosamente del sistema."}
