# app/api/endpoints/reportes.py
"""
Capa de Rutas / Endpoints.
Responsabilidad: Exponer las rutas HTTP (enrutadores de FastAPI) para el recurso
'Reportes', enlazando las solicitudes REST con el servicio de negocio.

Este controlador de rutas se ha sincronizado para interactuar con la clase
`ReporteService` y utilizar las nuevas propiedades de los esquemas (`ReporteResponse`,
`ReporteCreate`, `ReporteUpdate`).
"""

from typing import List
from fastapi import APIRouter, HTTPException, status

from app.schemas.reporte import ReporteCreate, ReporteUpdate, ReporteResponse
from app.services.reportes import ReporteService

router = APIRouter()

@router.get(
    "/",
    response_model=List[ReporteResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todos los reportes",
    description="Retorna la lista completa de todos los reportes de infraestructura registrados en memoria."
)
def listar_reportes():
    """
    Invoca al servicio para obtener todos los reportes y darles formato.
    """
    return ReporteService.obtener_todos()


@router.get(
    "/{reporte_id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener un reporte por ID",
    description="Busca y retorna un único reporte de infraestructura según su ID."
)
def obtener_reporte(reporte_id: int):
    """
    Retorna el reporte encontrado. Lanza error 404 si el ID no corresponde a ningún registro.
    """
    reporte = ReporteService.obtener_por_id(reporte_id)
    if not reporte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reporte con ID {reporte_id} no encontrado."
        )
    return reporte


@router.post(
    "/",
    response_model=ReporteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear un reporte",
    description="Crea un nuevo reporte validando que el título y ubicación no estén vacíos."
)
def crear_reporte(payload: ReporteCreate):
    """
    Valida el payload JSON de entrada y delega la creación al servicio.
    """
    try:
        # Crea el reporte llamando a la clase de servicio
        return ReporteService.crear(payload)
    except ValueError as err:
        # En caso de fallar alguna validación interna de Pydantic o del servicio
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )


@router.put(
    "/{reporte_id}",
    response_model=ReporteResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar reporte (PUT)",
    description="Actualiza de manera opcional y validada la prioridad y/o el estado del reporte."
)
def actualizar_reporte(reporte_id: int, payload: ReporteUpdate):
    """
    Modifica la prioridad o el estado del reporte indicado.
    Lanza error 404 si el reporte no existe.
    """
    try:
        reporte_actualizado = ReporteService.actualizar(reporte_id, payload)
        if not reporte_actualizado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se pudo actualizar. El reporte con ID {reporte_id} no existe."
            )
        return reporte_actualizado
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )


@router.delete(
    "/{reporte_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar un reporte",
    description="Elimina de forma permanente un reporte por su ID."
)
def eliminar_reporte(reporte_id: int):
    """
    Elimina el reporte. Retorna código 204 sin contenido si la operación es exitosa.
    Lanza 404 si el reporte no existe.
    """
    eliminado = ReporteService.eliminar(reporte_id)
    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se pudo eliminar. El reporte con ID {reporte_id} no existe."
        )
    return None
