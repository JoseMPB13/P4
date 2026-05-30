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

from typing import List, Optional
from fastapi import APIRouter, status, Depends, HTTPException, Form, File, UploadFile
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session, joinedload
from app.models.reporte import ReporteModel
import json
import uuid
import os

from app.schemas.reporte import ReporteCreate, ReporteUpdate, ReporteResponse
from app.services.reportes import ReporteService
from app.services.supabase_storage import subir_imagen_a_supabase
from app.core.database import get_db
from app.core.config import settings
from app.models.usuario import UsuarioModel
# Comentario en español: Importamos get_redis_client para validar si un token está en la lista negra
from app.redis.client import get_redis_client
import logging

logger = logging.getLogger(__name__)

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
    2. Validación de Lista Negra: Se verifica en Redis si el token ha sido invalidado por Logout.
    3. Decodificación: Se procesa el token con 'jwt.decode' usando el SECRET y ALGORITHM.
       Si el token expiró, está mal formado o alterado, se lanza una excepción de PyJWT (InvalidTokenError).
    4. Consulta de Integridad: Se extrae el claim del correo ('sub') y se busca el registro en
       la base de datos. Si el usuario no existe, el token no es válido.
    """
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la firma del token o ha expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Comentario en español: Verificamos de forma segura y resiliente si el token está en la lista negra de Redis (Logout)
    try:
        redis_client = get_redis_client()
        if redis_client.exists(f"blacklist:{token}"):
            logger.warning("Intento de acceso denegado: Token se encuentra en la lista negra (Blacklist).")
            raise credenciales_exception
    except HTTPException:
        raise
    except Exception as err:
        # En caso de error de conexión con Redis, registramos pero permitimos pasar (Fail-Open)
        logger.error(f"Error al verificar la lista negra de tokens en Redis: {err}")

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
    # Comentario en español: 1. Comprobar si existe la clave 'cache:reportes' en Redis (Flujo Cache Hit)
    try:
        redis_client = get_redis_client()
        cached_data = redis_client.get("cache:reportes")
        if cached_data:
            logger.info("📡 [REDIS CACHE] Hit en endpoint GET / - Retornando datos desde 'cache:reportes'.")
            return json.loads(cached_data)
    except Exception as err:
        # En caso de error de conexión con Redis, registramos pero permitimos pasar (Fail-Open)
        logger.error(f"❌ [REDIS ERROR] Falló la lectura de caché 'cache:reportes': {err}")

    # Comentario en español: 2. Flujo Cache Miss: realizar consulta a PostgreSQL en Supabase de forma segura
    try:
        logger.info("📡 [REDIS CACHE] Miss en endpoint GET / - Consultando base de datos relacional.")
        reportes = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).all()

        # Comentario en español: 3. Serializar a formato compatible (lista de diccionarios)
        datos_serializados = [ReporteService._reporte_a_dict(r) for r in reportes]
    except Exception as db_err:
        # Comentario en español: Registramos el error de base de datos detallado en los logs para auditoría interna
        # y lanzamos una excepción limpia del framework con código HTTP 502 Bad Gateway.
        logger.error(f"❌ [DATABASE ERROR] Error al consultar o serializar reportes en el flujo Cache Miss: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de base de datos al recuperar reportes de infraestructura."
        )

    # Comentario en español: 4. Guardar datos serializados en Redis con un TTL de 300 segundos
    try:
        redis_client = get_redis_client()
        redis_client.setex("cache:reportes", 300, json.dumps(datos_serializados))
        logger.info("📡 [REDIS CACHE] Datos guardados en la clave 'cache:reportes' con TTL de 300 segundos.")
    except Exception as err:
        logger.error(f"❌ [REDIS ERROR] Falló la escritura en caché 'cache:reportes': {err}")

    return datos_serializados


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
    description="Ruta Protegida. Requiere cabecera 'Authorization: Bearer <TOKEN>'. Crea un reporte de incidencia desde Multipart/Form-Data."
)
def crear_reporte(
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
    Crea un nuevo reporte recibiendo parámetros tipo Form y un archivo opcional.
    Exige la inyección de 'current_user' para asegurar la identidad de quien reporta.
    
    ¿Cómo maneja FastAPI la carga de archivos con 'UploadFile'?
    ----------------------------------------------------------
    FastAPI expone la clase 'UploadFile' que almacena en memoria los archivos de pequeño
    tamaño y en un archivo temporal en disco si exceden el límite, garantizando la
    estabilidad de la memoria del servidor. Mediante 'imagen.file.read()' obtenemos
    directamente los bytes del stream de archivo.
    """
    imagen_url = None
    if imagen is not None and imagen.filename:
        # Validación de seguridad del tipo de contenido (MIME type)
        if not imagen.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo proporcionado debe ser una imagen con formato válido (image/*)."
            )
        
        # Generación de nombre único para evitar colisiones
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
            
        # Subir los bytes directamente a Supabase Storage
        imagen_url = subir_imagen_a_supabase(file_bytes, file_name, imagen.content_type)
        
    # Construcción de payload e invocación del servicio
    payload = ReporteCreate(
        titulo=titulo,
        descripcion=descripcion,
        tipo_problema=tipo_problema,
        ubicacion=ubicacion,
        usuario_id=usuario_id,
        imagen_url=imagen_url,
        asignado_a=asignado_a
    )
    
    # Se ejecuta la creación y persistencia (commit) a través del servicio
    nuevo_reporte = ReporteService.crear(db, payload)

    # Comentario en español: Invalidación destructiva de la caché. Eliminamos 'cache:reportes' después de confirmar la persistencia.
    try:
        redis_client = get_redis_client()
        redis_client.delete("cache:reportes")
        logger.info("📡 [REDIS CACHE] Caché 'cache:reportes' invalidada tras creación de un reporte.")
    except Exception as err:
        logger.error(f"❌ [REDIS ERROR] Falló la invalidación de la caché 'cache:reportes' tras creación: {err}")

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
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
    """
    Actualiza el reporte indicado. Si el ID no existe en la base de datos, lanza 404.
    Exige autenticación mediante token JWT.
    """
    # Se ejecuta la actualización y persistencia (commit) a través del servicio registrando el autor
    reporte_actualizado = ReporteService.actualizar(db, id, payload, autor_id=current_user.id)

    # Comentario en español: Invalidación destructiva de la caché. Eliminamos 'cache:reportes' después de confirmar la persistencia.
    try:
        redis_client = get_redis_client()
        redis_client.delete("cache:reportes")
        logger.info(f"📡 [REDIS CACHE] Caché 'cache:reportes' invalidada tras actualizar reporte ID {id}.")
    except Exception as err:
        logger.error(f"❌ [REDIS ERROR] Falló la invalidación de la caché 'cache:reportes' tras actualización: {err}")

    return reporte_actualizado


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
    # Se ejecuta la eliminación y persistencia (commit) a través del servicio
    ReporteService.eliminar(db, id)

    # Comentario en español: Invalidación destructiva de la caché. Eliminamos 'cache:reportes' después de confirmar la persistencia.
    try:
        redis_client = get_redis_client()
        redis_client.delete("cache:reportes")
        logger.info(f"📡 [REDIS CACHE] Caché 'cache:reportes' invalidada tras eliminar reporte ID {id}.")
    except Exception as err:
        logger.error(f"❌ [REDIS ERROR] Falló la invalidación de la caché 'cache:reportes' tras eliminación: {err}")

    return {
        "mensaje": f"El reporte con ID {id} ha sido eliminado exitosamente de la base de datos."
    }


from app.schemas.comentario import ComentarioBase, ComentarioResponse
from app.models.comentario import ComentarioModel

@router.post(
    "/{id}/comentarios",
    response_model=ComentarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar comentario a una incidencia",
    description="Ruta Protegida. Registra un nuevo comentario/nota técnica asociado a la incidencia e invalida su caché."
)
def agregar_comentario(
    id: int,
    payload: ComentarioBase,
    db: Session = Depends(get_db),
    current_user: UsuarioModel = Depends(get_current_user)
):
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

    # Invalidar cachés para asegurar actualización inmediata
    try:
        redis_client = get_redis_client()
        redis_client.delete("study:reportes:all")
        redis_client.delete("cache:reportes")
        redis_client.delete(f"study:reportes:{id}")
        logger.info(f"📡 [REDIS CACHE] Cachés invalidadas tras registrar comentario en reporte #{id}.")
    except Exception as err:
        logger.error(f"❌ [REDIS ERROR] Falló la invalidación tras registrar comentario: {err}")

    return nuevo_comentario
