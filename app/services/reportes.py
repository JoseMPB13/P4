# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Implementar las reglas de negocio de los Reportes de Infraestructura.
Mapea las peticiones con los modelos relacionales (SQLAlchemy) e interactúa con la
base de datos física en Supabase utilizando la sesión activa de BD.

Esta versión integra la publicación asíncrona de eventos utilizando Redis Pub/Sub
a través de Upstash. Los eventos se publican en canales específicos cada vez que
se crea o modifica un reporte en la base de datos relacional de forma exitosa.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException, status
# Comentario en español: Importamos joinedload para optimizar las consultas relacionales y evitar el problema N+1.
from sqlalchemy.orm import Session, joinedload

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class ReporteService:
    """
    Servicio encargado del procesamiento operacional de Reportes.
    Traduce operaciones de negocio en consultas ORM a través de SQLAlchemy y maneja la
    publicación de eventos estructurados sobre Redis para mensajería en tiempo real.
    """

    @staticmethod
    def _reporte_a_dict(reporte: ReporteModel) -> dict:
        """
        Comentario en español: Función auxiliar para convertir un objeto ORM ReporteModel 
        a un diccionario estructurado apto para serialización JSON. Esta selección es segura 
        ya que utiliza campos específicos y no expone el hashed_password de los usuarios relacionados.
        Incluye también comentarios e historial de estados.
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
        Comentario en español: Lógica de caché de lectura: primero consulta Redis para evitar
        consultas repetidas a la base de datos de Supabase. Si no existe, realiza el query y guarda en caché.
        """
        clave_cache = "campus:reportes:all"
        try:
            redis_client = get_redis_client()
            cached_data = redis_client.get(clave_cache)
            if cached_data:
                logger.info("📡 [REDIS CACHE] Hit en listar_todos. Retornando datos desde caché.")
                return json.loads(cached_data)
        except Exception as err:
            # Resiliencia: Si falla Redis, la API continúa operando (Fail-Open)
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la lectura de caché en listar_todos: {err}")

        logger.info("Servicio: Listando todos los reportes desde la base de datos.")
        # Carga ansiosa (joinedload) para prevenir problemas de N+1 queries al resolver relaciones en Pydantic
        reportes = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).all()

        try:
            redis_client = get_redis_client()
            # Serializamos la lista de objetos ORM a un formato JSON serializable seguro
            datos_serializados = [ReporteService._reporte_a_dict(r) for r in reportes]
            # Guardamos en caché por 1 hora (3600 segundos) para optimizar accesos frecuentes
            redis_client.setex(clave_cache, 3600, json.dumps(datos_serializados))
            logger.info("📡 [REDIS CACHE] Datos almacenados en caché exitosamente.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la escritura en caché en listar_todos: {err}")

        return reportes

    @staticmethod
    def obtener_por_id(db: Session, id: int) -> ReporteModel:
        """
        Busca un reporte por su ID.
        Comentario en español: Verifica en la caché de Redis la existencia del reporte individual
        bajo el patrón de clave 'study:reportes:{id}'. Si no existe, se consulta en la base de datos relacional.
        """
        clave_cache = f"campus:reportes:{id}"
        try:
            redis_client = get_redis_client()
            cached_data = redis_client.get(clave_cache)
            if cached_data:
                logger.info(f"📡 [REDIS CACHE] Hit en obtener_por_id para ID: {id}. Retornando desde caché.")
                return json.loads(cached_data)
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la lectura de caché para ID {id}: {err}")

        logger.info(f"Servicio: Buscando reporte con ID: {id} en la base de datos.")
        from app.models.comentario import ComentarioModel
        from app.models.historial import HistorialEstadosModel
        reporte = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico),
            joinedload(ReporteModel.comentarios).joinedload(ComentarioModel.usuario),
            joinedload(ReporteModel.historial).joinedload(HistorialEstadosModel.usuario)
        ).filter(ReporteModel.id == id).first()
        
        if not reporte:
            logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reporte {id} no encontrado"
            )

        try:
            redis_client = get_redis_client()
            # Mapeamos a diccionario seguro y guardamos en caché por 1 hora
            datos_serializados = ReporteService._reporte_a_dict(reporte)
            redis_client.setex(clave_cache, 3600, json.dumps(datos_serializados))
            logger.info(f"📡 [REDIS CACHE] Reporte ID {id} almacenado en caché exitosamente.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Falló la escritura en caché para ID {id}: {err}")

        return reporte

    @staticmethod
    def crear(db: Session, reporte_en: ReporteCreate) -> ReporteModel:
        """
        Registra un reporte en la base de datos física y publica un evento en el canal 'study:sesion:creada'.
        Comentario en español: Al crear un nuevo reporte, invalidamos la caché global para obligar a leer de la base de datos
        en la siguiente llamada a listar_todos.
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
        
        db.add(nuevo_reporte)
        db.commit()
        db.refresh(nuevo_reporte)
        
        logger.info(f"Servicio: Reporte creado exitosamente en base de datos con ID: {nuevo_reporte.id}")

        # === EVICCIÓN / INVALIDACIÓN DE CACHÉ ===
        try:
            redis_client = get_redis_client()
            redis_client.delete("campus:reportes:all")
            logger.info("📡 [REDIS CACHE] Caché global 'campus:reportes:all' invalidada tras creación.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Error al invalidar la caché tras creación: {err}")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        canal = "campus:reporte:nuevo"
        
        # Consultamos el reporte completo cargando relaciones para armar el mensaje de mensajería
        db_reporte_completo = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == nuevo_reporte.id).first()

        payload_datos = ReporteService._reporte_a_dict(db_reporte_completo)

        mensaje = {
            "tipo": "reporte:creado",
            "payload": payload_datos,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }

        try:
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:creado' publicado en el canal '{canal}'.")
        except Exception as err:
            logger.error(f"Servicio: No se pudo publicar el evento en Redis: {err}")
            
        return nuevo_reporte

    @staticmethod
    # Comentario en español: Ajustamos autor_id para usar el tipo de unión nativo 'int | None' de Python 3.13 en lugar de 'Optional'
    def actualizar(db: Session, id: int, reporte_en: ReporteUpdate, autor_id: int | None = None) -> ReporteModel:
        """
        Modifica un reporte, registra la trazabilidad de estados, invalida su caché e informa la actualización en Redis.
        """
        # Obtenemos directamente de la BD con joinedload para asegurar la carga fresca de relaciones
        reporte = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == id).first()

        if not reporte:
            logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado para actualizar.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reporte {id} no encontrado"
            )
        
        # Guardar valores previos para el registro de trazabilidad inmutable
        estado_previo = reporte.estado
        tecnico_previo = reporte.asignado_a
        hubo_cambio = False
        accion = "actualizar_estado"

        if reporte_en.prioridad is not None:
            reporte.prioridad = reporte_en.prioridad

        if reporte_en.estado is not None and reporte_en.estado != estado_previo:
            reporte.estado = reporte_en.estado
            hubo_cambio = True
            accion = "actualizar_estado"

        if reporte_en.asignado_a is not None and reporte_en.asignado_a != tecnico_previo:
            reporte.asignado_a = reporte_en.asignado_a
            hubo_cambio = True
            accion = "asignar_tecnico"

        # Inyectar registro inmutable de trazabilidad si hay cambios en el estado y se provee autor de la edición
        # Comentario en español: Esta guarda condicional previene que se registren transiciones de estado idénticas
        # (transición fantasma de tipo "de pendiente a pendiente") en la bitácora de auditoría al actualizar campos que no sean el estado.
        if estado_previo != reporte.estado and autor_id is not None:
            from app.models.historial import HistorialEstadosModel
            nuevo_historial = HistorialEstadosModel(
                reporte_id=reporte.id,
                usuario_id=autor_id,
                estado_anterior=estado_previo,
                estado_nuevo=reporte.estado
            )
            db.add(nuevo_historial)
            logger.info(f"Servicio: Trazabilidad registrada. Reporte #{id} modificado por usuario ID {autor_id}.")
            
        db.commit()
        db.refresh(reporte)
        
        logger.info(f"Servicio: Reporte ID {id} actualizado en base de datos.")

        # === EVICCIÓN / INVALIDACIÓN DE CACHÉ ===
        try:
            redis_client = get_redis_client()
            redis_client.delete("campus:reportes:all")
            redis_client.delete("cache:reportes")
            redis_client.delete(f"campus:reportes:{id}")
            logger.info(f"📡 [REDIS CACHE] Cachés ('cache:reportes', 'campus:reportes:all', ID {id}) invalidadas tras actualización.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Error al invalidar la caché tras actualización: {err}")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        # Si el estado es resuelto, publicamos en 'campus:resuelto', de lo contrario en 'campus:estado:actualizado'
        canal = "campus:resuelto" if reporte.estado == "resuelto" else "campus:estado:actualizado"
        payload_datos = ReporteService._reporte_a_dict(reporte)

        # Comentario en español: Inyectamos la propiedad 'accion' para romper el acoplamiento y
        # permitir que el frontend clasifique la notificación flotante correctamente.
        mensaje = {
            "tipo": "reporte:actualizado",
            "accion": accion,
            "payload": payload_datos,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }

        try:
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:actualizado' publicado en el canal '{canal}' con acción '{accion}'.")
        except Exception as err:
            logger.error(f"Servicio: No se pudo publicar el evento de actualización en Redis: {err}")
            
        return reporte

    @staticmethod
    def eliminar(db: Session, id: int) -> bool:
        """
        Elimina físicamente el reporte e invalida sus cachés correspondientes de Redis.
        """
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

        # === EVICCIÓN / INVALIDACIÓN DE CACHÉ ===
        try:
            redis_client = get_redis_client()
            redis_client.delete("campus:reportes:all")
            redis_client.delete(f"campus:reportes:{id}")
            logger.info(f"📡 [REDIS CACHE] Cachés invalidadas para reporte ID {id} y listado global tras eliminación.")
        except Exception as err:
            logger.error(f"📡 [REDIS CACHE ERROR] Error al invalidar la caché tras eliminación: {err}")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        # Comentario en español: Publicamos el evento de eliminación en el canal campus:reporte:eliminado.
        # Esto asegura que todos los clientes suscritos (vía WebSockets) reciban la confirmación
        # en tiempo real de que el reporte físico ha sido removido y puedan responder en sus interfaces.
        canal = "campus:reporte:eliminado"
        mensaje = {
            "tipo": "reporte:eliminado",
            "payload": {"id": id},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }
        try:
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:eliminado' publicado en el canal '{canal}'.")
        except Exception as err:
            logger.error(f"Servicio: No se pudo publicar el evento de eliminación en Redis: {err}")

        return True
