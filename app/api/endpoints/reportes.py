# app/api/endpoints/reportes.py
"""
Capa de Controladores / Enrutadores (FastAPI APIRouter).
Responsabilidad: Exponer las rutas HTTP (puntos de acceso externos) para realizar
las operaciones CRUD sobre la entidad "Reporte".

Este archivo define las rutas HTTP correspondientes a la API de reportes.
Inyecta la sesión de la base de datos relacional (SQLAlchemy Session) en cada una
de las rutas y delega la ejecución de la lógica operacional a ReporteService.
Retorna códigos de estado HTTP semánticos explicados en español en cada caso.
"""

from typing import List
from fastapi import APIRouter, status, Depends
from sqlalchemy.orm import Session

from app.schemas.reporte import ReporteCreate, ReporteUpdate, ReporteResponse
from app.services.reportes import ReporteService
from app.core.database import get_db

# Se inicializa el APIRouter con el prefijo '/reportes' y la etiqueta 'Reportes' para Swagger
router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"]
)

@router.get(
    "/",
    response_model=List[ReporteResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todos los reportes",
    description="Retorna la lista completa de reportes de infraestructura de la universidad."
)
def listar_reportes(db: Session = Depends(get_db)):
    """
    Retorna la lista de reportes registrados.
    
    ¿Por qué 200 OK?: Es el código de estado estándar para peticiones GET exitosas
    que devuelven información. Indica que el servidor procesó correctamente la búsqueda.
    """
    return ReporteService.listar_todos(db)


@router.get(
    "/{id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un reporte por ID",
    description="Busca un reporte de infraestructura según su ID entero único."
)
def obtener_reporte(id: int, db: Session = Depends(get_db)):
    """
    Delega la búsqueda al servicio. Si no se encuentra, el servicio lanza un 404.
    
    ¿Por qué 200 OK?: Indica que la solicitud fue exitosa y se retorna el reporte solicitado.
    ¿Por qué 404 Not Found (desde servicio)?: Indica al cliente que el ID buscado no existe en la base de datos.
    """
    return ReporteService.obtener_por_id(db, id)


@router.post(
    "/",
    response_model=ReporteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un reporte",
    description="Crea un reporte con estado inicial 'pendiente' y prioridad 'media'."
)
def crear_reporte(payload: ReporteCreate, db: Session = Depends(get_db)):
    """
    Crea un reporte a partir del body JSON validado por Pydantic.
    
    ¿Por qué 201 Created?: Es el código estándar HTTP específico para indicar que
    una petición POST fue exitosa y resultó en la creación exitosa de un nuevo recurso.
    
    ¿Por qué 400 Bad Request / 422 Unprocessable Entity (FastAPI automático)?:
    Si faltan campos requeridos en el esquema Pydantic (como 'titulo' o 'ubicacion')
    o si no pasan las validaciones de caracteres vacíos, FastAPI intercepta y devuelve
    este error indicando qué campos fallaron.
    """
    return ReporteService.crear(db, payload)


@router.put(
    "/{id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar un reporte",
    description="Permite actualizar opcionalmente la prioridad y el estado de un reporte."
)
def actualizar_reporte(id: int, payload: ReporteUpdate, db: Session = Depends(get_db)):
    """
    Actualiza el reporte indicado. Si el ID no existe en la base de datos, lanza 404.
    
    ¿Por qué 200 OK?: Indica que la modificación se realizó correctamente y se
    retorna el recurso modificado con sus nuevos valores.
    """
    return ReporteService.actualizar(db, id, payload)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK,
    summary="Eliminar un reporte",
    description="Elimina físicamente un reporte de la base de datos relacional."
)
def eliminar_reporte(id: int, db: Session = Depends(get_db)):
    """
    Delega la eliminación al servicio. Si se elimina con éxito, retorna un mensaje descriptivo.
    
    ¿Por qué 200 OK?: A diferencia del código 204 (sin contenido), el código 200 OK
    permite responder con un mensaje estructurado JSON al cliente indicando el éxito
    de la eliminación (ej. Confirmación en pantalla).
    """
    ReporteService.eliminar(db, id)
    return {
        "mensaje": f"El reporte con ID {id} ha sido eliminado exitosamente de la base de datos."
    }
