# app/api/endpoints/reportes.py
"""
Capa de Controladores / Enrutadores (FastAPI APIRouter).
Responsabilidad: Exponer las rutas HTTP (puntos de acceso externos) para realizar
las operaciones CRUD sobre la entidad "Reporte".

Este archivo define las rutas HTTP correspondientes a la API de reportes.
Inyecta la sesión de la base de datos relacional (SQLAlchemy Session) en cada una
de las rutas y delega la ejecución de la lógica operacional a ReporteService.
- Las rutas GET son de acceso público.
- Las rutas POST, PUT y DELETE están protegidas y exigen un token de acceso JWT válido
  a través de la dependencia de seguridad 'get_current_user'.
"""

from typing import List
from fastapi import APIRouter, status, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.schemas.reporte import ReporteCreate, ReporteUpdate, ReporteResponse
from app.services.reportes import ReporteService
from app.core.database import get_db
from app.core.config import settings
from app.models.usuario import UsuarioModel

# Se inicializa el APIRouter con el prefijo '/reportes' y la etiqueta 'Reportes' para Swagger
router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"]
)

# Esquema para extraer el token JWT Bearer desde la cabecera 'Authorization'
# tokenUrl indica a Swagger UI el endpoint relativo de donde obtener el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# =========================================================================
# 🛡️ DEPENDENCIA DE SEGURIDAD PARA VALIDAR TOKENS JWT
# =========================================================================

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> UsuarioModel:
    """
    Dependencia de seguridad que valida el token JWT recibido en las cabeceras HTTP.
    
    ¿Cómo funciona esta validación académica?
    -----------------------------------------
    1. Extracción: OAuth2PasswordBearer intercepta la cabecera 'Authorization: Bearer <TOKEN>'.
       Si no existe, arroja automáticamente una excepción 401 Unauthorized.
    2. Decodificación: Se procesa el token con 'jwt.decode' usando el SECRET y ALGORITHM.
       Si el token expiró, está mal formado o alterado, se lanza una excepción de PyJWT (InvalidTokenError).
    3. Consulta de Integridad: Se extrae el claim del correo ('sub') y se busca el registro en
       la base de datos. Si el usuario no existe, el token no es válido.
    """
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la firma del token o ha expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decodificar el JWT y validar su expiración de forma automática
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credenciales_exception
    except InvalidTokenError:
        raise credenciales_exception

    # Buscar el usuario dueño del token en la base de datos relacional
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email).first()
    if usuario is None:
        raise credenciales_exception

    return usuario

# =========================================================================
# 🌐 RUTAS DE ACCESO PÚBLICO (GET)
# =========================================================================

@router.get(
    "/",
    response_model=List[ReporteResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todos los reportes",
    description="Ruta pública. Retorna la lista completa de reportes de infraestructura de la universidad."
)
def listar_reportes(db: Session = Depends(get_db)):
    """
    Retorna la lista de reportes registrados.
    
    ¿Por qué es público?: Cualquier persona de la comunidad universitaria puede listar
    los reportes e incidencias existentes sin necesidad de estar logueado.
    """
    return ReporteService.listar_todos(db)


@router.get(
    "/{id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un reporte por ID",
    description="Ruta pública. Busca un reporte de infraestructura según su ID entero único."
)
def obtener_reporte(id: int, db: Session = Depends(get_db)):
    """
    Busca un reporte en la base de datos por ID. Si no se encuentra, el servicio lanza un 404.
    """
    return ReporteService.obtener_por_id(db, id)

# =========================================================================
# 🛡️ RUTAS PROTEGIDAS POR AUTENTICACIÓN JWT (POST, PUT, DELETE)
# =========================================================================

@router.post(
    "/",
    response_model=ReporteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un reporte",
    description="Ruta Protegida. Requiere cabecera 'Authorization: Bearer <TOKEN>'. Crea un reporte de incidencia."
)
def crear_reporte(
    payload: ReporteCreate, 
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Crea un nuevo reporte a partir de un body JSON validado por Pydantic.
    Exige la inyección de 'current_user' para asegurar la identidad de quien reporta.
    """
    return ReporteService.crear(db, payload)


@router.put(
    "/{id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar un reporte",
    description="Ruta Protegida. Permite actualizar la prioridad y el estado de resolución de un reporte."
)
def actualizar_reporte(
    id: int, 
    payload: ReporteUpdate, 
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Actualiza el reporte indicado. Si el ID no existe en la base de datos, lanza 404.
    Exige autenticación mediante token JWT.
    """
    return ReporteService.actualizar(db, id, payload)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Eliminar un reporte",
    description="Ruta Protegida. Elimina físicamente un reporte de la base de datos relacional."
)
def eliminar_reporte(
    id: int, 
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Elimina el reporte de la base de datos.
    Ruta restringida únicamente a usuarios autenticados.
    """
    ReporteService.eliminar(db, id)
    return {
        "mensaje": f"El reporte con ID {id} ha sido eliminado exitosamente de la base de datos."
    }
