# app/services/supabase_storage.py
"""
Servicio de Integración con Supabase Storage.
Responsabilidad: Conectarse al almacenamiento de objetos de Supabase para subir
evidencia fotográfica de fallas o problemas de infraestructura universitaria.

Este servicio utiliza la biblioteca estándar de Python (urllib.request) para
realizar peticiones HTTP directas seguras a la API REST de Supabase Storage.
De esta forma se evita añadir dependencias de red pesadas en el entorno local.
"""

import urllib.request
import urllib.error
import logging
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

# Comentario en español: El nombre del bucket ahora se lee dinámicamente desde settings.SUPABASE_BUCKET
# para evitar valores fijos y permitir configurarlo mediante variables de entorno (.env)

def subir_imagen_a_supabase(file_bytes: bytes, file_name: str, content_type: str) -> str:
    """
    Sube los bytes de una imagen al bucket de Supabase Storage y retorna la URL pública.
    
    ¿Cómo funciona la API REST de Supabase Storage?
    ---------------------------------------------
    1. Endpoint de Carga (POST):
       https://<project-ref>.supabase.co/storage/v1/object/<bucket>/<path_de_archivo>
    2. Cabeceras Obligatorias:
       - Authorization: Bearer <API_KEY> (Clave de acceso de Supabase)
       - apikey: <API_KEY> (Cabecera requerida por el API Gateway Kong de Supabase)
       - Content-Type: Mime-type de la imagen (ej: image/png, image/jpeg)
    3. Retorno:
       Si la subida es exitosa, se genera la URL pública de acceso:
       https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path_de_archivo>
    """
    # === ADVERTENCIA DE SEGURIDAD / CONFIGURACIÓN DE VARIABLES DE ENTORNO ===
    # Comentario en español: La variable SUPABASE_KEY obtenida del archivo '.env' debe contener obligatoriamente
    # un token JWT firmado válido de la plataforma de Supabase (como la anon_key pública o la service_role_key).
    # Si esta variable contiene un texto plano simple o un marcador de posición (ej: 'placeholder_anon_or_service_key'),
    # el API Gateway Kong de Supabase rechazará inmediatamente la petición HTTP arrojando un error de tipo
    # '403 Unauthorized: Invalid Compact JWS' al no poder decodificar la firma en formato de tres partes.
    if not settings.SUPABASE_KEY or settings.SUPABASE_KEY == "placeholder_anon_or_service_key":
        logger.warning(
            "⚠️ SUPABASE_KEY no está configurada o contiene un valor placeholder. "
            "La carga fallará si el bucket requiere políticas de seguridad (RLS)."
        )

    # URL del endpoint para subir el objeto al bucket específico utilizando la configuración centralizada
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_BUCKET}/{file_name}"
    
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "apikey": settings.SUPABASE_KEY,
        "Content-Type": content_type
    }
    
    # Preparamos la petición POST con los bytes del archivo en el cuerpo
    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
    
    try:
        logger.info(f"Subiendo archivo '{file_name}' ({len(file_bytes)} bytes) al bucket '{settings.SUPABASE_BUCKET}'...")
        with urllib.request.urlopen(req) as response:
            if response.status in (200, 201):
                # La subida fue exitosa. Generamos la URL pública accesible.
                # Nota aclaratoria: Asegúrese de que el bucket configurado en settings.SUPABASE_BUCKET esté configurado
                # como PÚBLICO en el panel de control de Supabase (Dashboard -> Storage -> Bucket Settings).
                public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{file_name}"
                logger.info(f"✅ Archivo subido con éxito. URL pública: {public_url}")
                return public_url
            else:
                raise Exception(f"Respuesta inesperada de Supabase: Status {response.status}")
                
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"❌ Error HTTP de Supabase Storage ({e.code}): {error_body}")
        
        # Comentario en español: Si el error es debido a que el contenedor/bucket no existe, 
        # emitimos una alerta explícita en consola con la recomendación de creación y levantamos una excepción amigable.
        if "Bucket not found" in error_body:
            logger.error(
                f"🚨 [SUPABASE STORAGE CONFIG] El bucket '{settings.SUPABASE_BUCKET}' no fue encontrado en la nube. "
                f"Por favor, acceda al panel de administración de Supabase -> Storage y cree un bucket con el "
                f"nombre exacto '{settings.SUPABASE_BUCKET}' configurándolo en modo PÚBLICO."
            )
            raise HTTPException(
                status_code=502,
                detail=f"El contenedor de imágenes '{settings.SUPABASE_BUCKET}' no existe en Supabase Storage. "
                       f"Asegúrese de haberlo creado como bucket público en el panel de Supabase."
            )
            
        raise HTTPException(
            status_code=502,
            detail=f"Error en Supabase Storage: {error_body}"
        )
    except Exception as e:
        logger.error(f"❌ Error al conectar con Supabase Storage: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Fallo de infraestructura al subir imagen: {str(e)}"
        )
