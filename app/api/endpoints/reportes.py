# app/api/endpoints/reportes.py
"""
Capa de Controladores / Enrutadores (FastAPI APIRouter).
Responsabilidad: Exponer las rutas HTTP (puntos de acceso externos) para realizar
las operaciones CRUD sobre la entidad "Reporte".

Este archivo define las rutas HTTP correspondientes a la API de reportes.
Inyecta la sesión de la base de datos relacional (SQLAlchemy Session) en cada una
de las rutas y delega la ejecución de la lógica operacional a ReporteService.
- Las rutas GET son de acceso público.
- Las rutas POST, PUT y DELETE están protegidas y exigen un token de acceso JWT válido.
- Utiliza FastAPI BackgroundTasks para liberar inmediatamente la respuesta HTTP.
"""

from typing import List, Optional
from datetime import datetime, timezone
import json
import uuid
import os
import logging
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import APIRouter, status, Depends, HTTPException, Form, File, UploadFile, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError

from app.models.reporte import ReporteModel
from app.models.usuario import UsuarioModel
from app.models.comentario import ComentarioModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate, ReporteResponse
from app.schemas.comentario import ComentarioBase, ComentarioResponse
from app.services.reportes import ReporteService
from app.services.supabase_storage import subir_imagen_a_supabase
from app.core.database import get_db
from app.core.config import settings
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

# Se inicializa el APIRouter con el prefijo '/reportes' y la etiqueta 'Reportes' para Swagger
router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"]
)

# Esquema para extraer el token JWT Bearer desde la cabecera 'Authorization'
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# =========================================================================
# ⚙️ FUNCIONES EN SEGUNDO PLANO (BACKGROUND TASKS)
# =========================================================================

def publicar_y_limpiar_cache(canal: str | None, mensaje: dict | None, claves_a_eliminar: list[str]):
    """
    Función auxiliar ejecutada en segundo plano por FastAPI para no bloquear el hilo de respuesta HTTP.
    Realiza la evicción de las claves indicadas en Redis y publica eventos en el canal de Pub/Sub.
    """
    try:
        redis_client = get_redis_client()
        
        # Evicción de caché
        for clave in claves_a_eliminar:
            redis_client.delete(clave)
            logger.info(f"📡 [BACKGROUND TASK] Clave de caché '{clave}' invalidada con éxito.")
        
        # Publicación en Pub/Sub
        if canal and mensaje:
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"📡 [BACKGROUND TASK] Evento '{mensaje.get('tipo')}' publicado en '{canal}'.")
            
    except Exception as err:
        logger.error(f"❌ [BACKGROUND TASK ERROR] Error en la ejecución de tareas de Redis en segundo plano: {err}")

# =========================================================================
# 🛡️ DEPENDENCIA DE SEGURIDAD PARA VALIDAR TOKENS JWT
# =========================================================================

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> UsuarioModel:
    """
    Dependencia de seguridad que valida el token JWT recibido en las cabeceras HTTP.
    """
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la firma del token o ha expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Verificamos de forma segura si el token está en la lista negra de Redis
    try:
        redis_client = get_redis_client()
        if redis_client.exists(f"blacklist:{token}"):
            logger.warning("Intento de acceso denegado: Token se encuentra en la lista negra (Blacklist).")
            raise credenciales_exception
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error al verificar la lista negra de tokens en Redis: {err}")

    try:
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

    # Buscar el usuario dueño del token
    try:
        usuario = db.query(UsuarioModel).filter(UsuarioModel.email == email).first()
    except SQLAlchemyError as db_err:
        logger.error(f"❌ [DATABASE ERROR] Error al consultar usuario en get_current_user: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de base de datos al validar credenciales del usuario."
        )
        
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
    description="Ruta pública. Retorna la lista completa de reportes de infraestructura."
)
def listar_reportes(db: Session = Depends(get_db)):
    """
    Retorna la lista de reportes registrados.
    Delega al servicio para centralizar y unificar la gestión de caché.
    """
    return ReporteService.listar_todos(db)


@router.get(
    "/mantenimiento",
    response_model=List[ReporteResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar reportes asignados al personal de mantenimiento",
    description="Ruta Protegida. Retorna la lista de fallas asignadas al técnico autenticado."
)
def listar_reportes_mantenimiento(
    db: Session = Depends(get_db),
    usuario_actual: UsuarioModel = Depends(get_current_user)
):
    """
    Retorna únicamente los reportes donde 'asignado_a' coincide con el ID del técnico autenticado.
    """
    try:
        reportes = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.asignado_a == usuario_actual.id).all()
        
        return [ReporteService._reporte_a_dict(r) for r in reportes]
    except SQLAlchemyError as db_err:
        logger.error(f"❌ [DATABASE ERROR] Error al consultar reportes asignados: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de base de datos al recuperar sus asignaciones de mantenimiento."
        )


@router.get(
    "/{id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un reporte por ID",
    description="Ruta pública. Busca un reporte de infraestructura según su ID entero único."
)
def obtener_reporte(id: int, db: Session = Depends(get_db)):
    """
    Busca un reporte en la base de datos por ID llamando al servicio.
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
    description="Ruta Protegida. Requiere cabecera 'Authorization: Bearer <TOKEN>'. Crea un reporte desde Multipart/Form-Data."
)
def crear_reporte(
    background_tasks: BackgroundTasks,
    titulo: str = Form(...),
    descripcion: str = Form(...),
    tipo_problema: str = Form(...),
    ubicacion: str = Form(...),
    usuario_id: int = Form(...),
    asignado_a: Optional[int] = Form(None),
    imagen: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Crea un nuevo reporte.
    Libera la respuesta HTTP de inmediato y delega la mensajería/caché en segundo plano.
    """
    imagen_url = None
    if imagen is not None and imagen.filename:
        if not imagen.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo proporcionado debe ser una imagen con formato válido (image/*)."
            )
        
        ext = os.path.splitext(imagen.filename)[1]
        if not ext or len(ext) > 10:
            ext = ".jpg"
        file_name = f"{uuid.uuid4()}{ext}"
        
        try:
            file_bytes = imagen.file.read()
        except Exception as e:
            logger.error(f"Error al leer bytes del archivo subido: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo leer el archivo de imagen adjunto."
            )
            
        imagen_url = subir_imagen_a_supabase(file_bytes, file_name, imagen.content_type)
        
    payload = ReporteCreate(
        titulo=titulo,
        descripcion=descripcion,
        tipo_problema=tipo_problema,
        ubicacion=ubicacion,
        usuario_id=usuario_id,
        imagen_url=imagen_url,
        asignado_a=asignado_a
    )
    
    nuevo_reporte = ReporteService.crear(db, payload)

    # Pre-cargar relaciones para armar el mensaje de evento completo
    try:
        db_reporte_completo = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == nuevo_reporte.id).first()
    except SQLAlchemyError as db_err:
        logger.error(f"❌ [DATABASE ERROR] Error al consultar reporte completo tras creación: {db_err}")
        db_reporte_completo = nuevo_reporte

    payload_datos = ReporteService._reporte_a_dict(db_reporte_completo)
    mensaje = {
        "tipo": "reporte:creado",
        "payload": payload_datos,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

    # Planificar invalidación de caché global y publicación Pub/Sub en segundo plano
    background_tasks.add_task(
        publicar_y_limpiar_cache,
        "campus:reporte:nuevo",
        mensaje,
        ["cache:reportes:all"]
    )

    return nuevo_reporte


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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Actualiza el reporte.
    Responde inmediatamente y delega tareas en segundo plano.
    """
    # Consultar estado previo para discriminar la acción
    try:
        reporte_previo = db.query(ReporteModel).filter(ReporteModel.id == id).first()
    except SQLAlchemyError as db_err:
        logger.error(f"❌ [DATABASE ERROR] Error al consultar reporte previo ID {id}: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de base de datos al validar el reporte."
        )

    if not reporte_previo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reporte {id} no encontrado"
        )
    
    estado_previo = reporte_previo.estado
    tecnico_previo = reporte_previo.asignado_a
    
    # Determinar acción
    accion = "actualizar_estado"
    if payload.asignado_a is not None and payload.asignado_a != tecnico_previo:
        accion = "asignar_tecnico"

    reporte_actualizado = ReporteService.actualizar(db, id, payload, autor_id=current_user.id)

    # Consultar reporte completo con relaciones frescas
    try:
        db_reporte_completo = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == reporte_actualizado.id).first()
    except SQLAlchemyError:
        db_reporte_completo = reporte_actualizado

    canal = "campus:resuelto" if db_reporte_completo.estado == "resuelto" else "campus:estado:actualizado"
    payload_datos = ReporteService._reporte_a_dict(db_reporte_completo)
    
    mensaje = {
        "tipo": "reporte:actualizado",
        "accion": accion,
        "payload": payload_datos,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

    # Planificar invalidación de caché e información Pub/Sub en segundo plano
    background_tasks.add_task(
        publicar_y_limpiar_cache,
        canal,
        mensaje,
        ["cache:reportes:all", f"cache:reportes:{id}"]
    )

    return reporte_actualizado


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Eliminar un reporte",
    description="Ruta Protegida. Elimina físicamente un reporte de la base de datos relacional."
)
def eliminar_reporte(
    id: int, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Elimina el reporte llamando al servicio.
    Responde inmediatamente y delega tareas en segundo plano.
    """
    ReporteService.eliminar(db, id)

    mensaje = {
        "tipo": "reporte:eliminado",
        "payload": {"id": id},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

    # Planificar tareas en segundo plano
    background_tasks.add_task(
        publicar_y_limpiar_cache,
        "campus:reporte:eliminado",
        mensaje,
        ["cache:reportes:all", f"cache:reportes:{id}"]
    )

    return {
        "mensaje": f"El reporte con ID {id} ha sido eliminado exitosamente."
    }


@router.post(
    "/{id}/comentarios",
    response_model=ComentarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar comentario a un problema o falla",
    description="Ruta Protegida. Registra un nuevo comentario asociado a la falla."
)
def agregar_comentario(
    id: int,
    payload: ComentarioBase,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Agrega un comentario a un reporte.
    Responde de forma inmediata y notifica asíncronamente en segundo plano.
    """
    try:
        # Validar la existencia física del reporte
        reporte = db.query(ReporteModel).filter(ReporteModel.id == id).first()
        if not reporte:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reporte no encontrado."
            )

        # Crear el registro del comentario
        nuevo_comentario = ComentarioModel(
            reporte_id=id,
            usuario_id=current_user.id,
            texto=payload.texto
        )

        db.add(nuevo_comentario)
        db.commit()
        db.refresh(nuevo_comentario)
        
        # Pre-cargar relación de usuario para que Pydantic lo serialice en el DTO
        db.refresh(nuevo_comentario, ["usuario"])
        
    except HTTPException:
        raise
    except SQLAlchemyError as db_err:
        db.rollback()
        logger.error(f"❌ [DATABASE ERROR] Error al agregar comentario al reporte {id}: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de base de datos al registrar el comentario."
        )

    # Consultar reporte completo con relaciones para notificar la actualización
    try:
        db_reporte_completo = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == id).first()
    except SQLAlchemyError:
        db_reporte_completo = None

    if db_reporte_completo:
        payload_datos = ReporteService._reporte_a_dict(db_reporte_completo)
        mensaje = {
            "tipo": "reporte:actualizado",
            "accion": "agregar_comentario",
            "payload": payload_datos,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }
        
        # Planificar invalidación de caché y publicación Pub/Sub en segundo plano
        background_tasks.add_task(
            publicar_y_limpiar_cache,
            "campus:estado:actualizado",
            mensaje,
            ["cache:reportes:all", f"cache:reportes:{id}"]
        )

    return nuevo_comentario
