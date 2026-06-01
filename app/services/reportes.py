# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Implementar las reglas de negocio de los Reportes de Infraestructura.
Mapea las peticiones con los modelos relacionales (SQLAlchemy) e interactúa con la
base de datos física en Supabase utilizando la sesión activa de BD.

Esta versión implementa una gestión robusta de excepciones con transacciones seguras
(try-except SQLAlchemyError y rollbacks) y consultas altamente optimizadas (joinedload).
La publicación de eventos en Redis y la evicción de caché se delegan para ser ejecutadas
en segundo plano. Todos los comentarios nuevos y modificados están estrictamente en español.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class ReporteService:
    """
    Servicio encargado del procesamiento operacional de Reportes.
    Traduce operaciones de negocio en consultas ORM a través de SQLAlchemy.
    """

    @staticmethod
    def _reporte_a_dict(reporte: ReporteModel) -> dict:
        """
        Función auxiliar para convertir un objeto ORM ReporteModel a un diccionario
        estructurado apto para serialización JSON. Esta selección es segura ya que utiliza
        campos específicos y no expone datos sensibles. Incluye también comentarios e historial.
        """
        return {
            "id": reporte.id,
            "titulo": reporte.titulo,
            "descripcion": reporte.descripcion,
            "tipo_problema": reporte.tipo_problema,
            "ubicacion": reporte.ubicacion,
            "imagen_url": reporte.imagen_url,
            "prioridad": reporte.prioridad,
            "estado": reporte.estado,
            "creado_en": reporte.creado_en.isoformat() if isinstance(reporte.creado_en, datetime) else reporte.creado_en,
            "usuario_id": reporte.usuario_id,
            "asignado_a": reporte.asignado_a,
            "usuario": {
                "id": reporte.usuario.id,
                "email": reporte.usuario.email,
                "nombre": reporte.usuario.nombre,
                "rol": reporte.usuario.rol
            } if reporte.usuario else None,
            "tecnico": {
                "id": reporte.tecnico.id,
                "email": reporte.tecnico.email,
                "nombre": reporte.tecnico.nombre,
                "rol": reporte.tecnico.rol
            } if reporte.tecnico else None,
            "comentarios": [
                {
                    "id": c.id,
                    "reporte_id": c.reporte_id,
                    "usuario_id": c.usuario_id,
                    "texto": c.texto,
                    "creado_en": c.creado_en.isoformat() if isinstance(c.creado_en, datetime) else c.creado_en,
                    "usuario": {
                        "id": c.usuario.id,
                        "email": c.usuario.email,
                        "nombre": c.usuario.nombre,
                        "rol": c.usuario.rol
                    } if c.usuario else None
                } for c in reporte.comentarios
            ] if reporte.comentarios else [],
            "historial": [
                {
                    "id": h.id,
                    "reporte_id": h.reporte_id,
                    "usuario_id": h.usuario_id,
                    "estado_anterior": h.estado_anterior,
                    "estado_nuevo": h.estado_nuevo,
                    "cambiado_en": h.cambiado_en.isoformat() if isinstance(h.cambiado_en, datetime) else h.cambiado_en,
                    "usuario": {
                        "id": h.usuario.id,
                        "email": h.usuario.email,
                        "nombre": h.usuario.nombre,
                        "rol": h.usuario.rol
                    } if h.usuario else None
                } for h in reporte.historial
            ] if reporte.historial else []
        }

    @staticmethod
    def listar_todos(db: Session) -> List[ReporteModel]:
        """
        Retorna la lista de todos los reportes registrados.
        Implementa caché de lectura con Redis utilizando la clave estandarizada 'cache:reportes:all'.
        """
        clave_cache = "cache:reportes:all"
        try:
            redis_client = get_redis_client()
            cached_data = redis_client.get(clave_cache)
            if cached_data:
                logger.info("📡 [REDIS CACHE] Hit en listar_todos. Retornando datos desde caché.")
                return json.loads(cached_data)
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la lectura de caché en listar_todos: {err}")

        logger.info("Servicio: Listando todos los reportes desde la base de datos.")
        try:
            # Carga ansiosa para prevenir problemas de consultas N+1
            reportes = db.query(ReporteModel).options(
                joinedload(ReporteModel.usuario),
                joinedload(ReporteModel.tecnico)
            ).all()
        except SQLAlchemyError as db_err:
            logger.error(f"❌ [DATABASE ERROR] Error al listar reportes desde base de datos: {db_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Error de base de datos al recuperar el listado de fallas o problemas."
            )

        try:
            redis_client = get_redis_client()
            datos_serializados = [ReporteService._reporte_a_dict(r) for r in reportes]
            # Guardamos en caché por 300 segundos
            redis_client.setex(clave_cache, 300, json.dumps(datos_serializados))
            logger.info("📡 [REDIS CACHE] Listado de reportes almacenado en caché exitosamente.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la escritura en caché en listar_todos: {err}")

        return reportes

    @staticmethod
    def obtener_por_id(db: Session, id: int) -> ReporteModel:
        """
        Busca un reporte por su ID.
        Implementa caché individual con la clave estandarizada 'cache:reportes:{id}'.
        Aplica joinedload para relaciones, comentarios e historial del reporte.
        """
        clave_cache = f"cache:reportes:{id}"
        try:
            redis_client = get_redis_client()
            cached_data = redis_client.get(clave_cache)
            if cached_data:
                logger.info(f"📡 [REDIS CACHE] Hit en obtener_por_id para ID: {id}. Retornando desde caché.")
                return json.loads(cached_data)
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la lectura de caché para ID {id}: {err}")

        logger.info(f"Servicio: Buscando reporte con ID: {id} en la base de datos.")
        try:
            from app.models.comentario import ComentarioModel
            from app.models.historial import HistorialEstadosModel
            
            # Carga ansiosa unificada para evitar el problema de consultas N+1
            reporte = db.query(ReporteModel).options(
                joinedload(ReporteModel.usuario),
                joinedload(ReporteModel.tecnico),
                joinedload(ReporteModel.comentarios).joinedload(ComentarioModel.usuario),
                joinedload(ReporteModel.historial).joinedload(HistorialEstadosModel.usuario)
            ).filter(ReporteModel.id == id).first()
        except SQLAlchemyError as db_err:
            logger.error(f"❌ [DATABASE ERROR] Error al consultar reporte individual {id}: {db_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Error de base de datos al recuperar el detalle del problema o falla."
            )

        if not reporte:
            logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reporte {id} no encontrado"
            )

        try:
            redis_client = get_redis_client()
            datos_serializados = ReporteService._reporte_a_dict(reporte)
            # Guardamos en caché por 3600 segundos (1 hora)
            redis_client.setex(clave_cache, 3600, json.dumps(datos_serializados))
            logger.info(f"📡 [REDIS CACHE] Reporte ID {id} almacenado en caché exitosamente.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la escritura en caché para ID {id}: {err}")

        return reporte

    @staticmethod
    def crear(db: Session, reporte_en: ReporteCreate) -> ReporteModel:
        """
        Registra un reporte en la base de datos física aplicando control transaccional robusto.
        La invalidación de caché y publicación de eventos se delega al controlador.
        """
        nuevo_reporte = ReporteModel(
            titulo=reporte_en.titulo,
            descripcion=reporte_en.descripcion,
            tipo_problema=reporte_en.tipo_problema,
            ubicacion=reporte_en.ubicacion,
            imagen_url=reporte_en.imagen_url,
            prioridad="media",
            estado="pendiente",
            creado_en=datetime.now(timezone.utc),
            usuario_id=reporte_en.usuario_id,
            asignado_a=reporte_en.asignado_a
        )
        
        try:
            db.add(nuevo_reporte)
            db.commit()
            db.refresh(nuevo_reporte)
            logger.info(f"Servicio: Reporte creado exitosamente en base de datos con ID: {nuevo_reporte.id}")
            return nuevo_reporte
        except SQLAlchemyError as db_err:
            db.rollback()
            logger.error(f"❌ [DATABASE ERROR] Error al crear reporte en base de datos: {db_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Error de base de datos al registrar el nuevo problema o falla."
            )

    @staticmethod
    def actualizar(db: Session, id: int, reporte_en: ReporteUpdate, autor_id: int | None = None) -> ReporteModel:
        """
        Modifica un reporte y registra la trazabilidad de estados de forma atómica y segura.
        """
        try:
            reporte = db.query(ReporteModel).filter(ReporteModel.id == id).first()
            if not reporte:
                logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado para actualizar.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporte {id} no encontrado"
                )

            estado_previo = reporte.estado
            tecnico_previo = reporte.asignado_a

            if reporte_en.prioridad is not None:
                reporte.prioridad = reporte_en.prioridad

            if reporte_en.estado is not None and reporte_en.estado != estado_previo:
                reporte.estado = reporte_en.estado

            if reporte_en.asignado_a is not None and reporte_en.asignado_a != tecnico_previo:
                reporte.asignado_a = reporte_en.asignado_a

            # Trazabilidad inmutable de cambio de estado
            if estado_previo != reporte.estado and autor_id is not None:
                from app.models.historial import HistorialEstadosModel
                nuevo_historial = HistorialEstadosModel(
                    reporte_id=reporte.id,
                    usuario_id=autor_id,
                    estado_anterior=estado_previo,
                    estado_nuevo=reporte.estado
                )
                db.add(nuevo_historial)

            db.commit()
            db.refresh(reporte)
            logger.info(f"Servicio: Reporte ID {id} actualizado exitosamente en base de datos.")
            return reporte
        except HTTPException:
            raise
        except SQLAlchemyError as db_err:
            db.rollback()
            logger.error(f"❌ [DATABASE ERROR] Error al actualizar reporte ID {id}: {db_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Error de base de datos al modificar el problema o falla."
            )

    @staticmethod
    def eliminar(db: Session, id: int) -> bool:
        """
        Elimina físicamente el reporte bajo control transaccional seguro con rollback.
        """
        try:
            reporte = db.query(ReporteModel).filter(ReporteModel.id == id).first()
            if not reporte:
                logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado para eliminar.")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reporte {id} no encontrado"
                )
            
            db.delete(reporte)
            db.commit()
            logger.info(f"Servicio: Reporte ID {id} eliminado físicamente de la base de datos.")
            return True
        except HTTPException:
            raise
        except SQLAlchemyError as db_err:
            db.rollback()
            logger.error(f"❌ [DATABASE ERROR] Error al eliminar reporte ID {id}: {db_err}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Error de base de datos al remover el problema o falla."
            )
