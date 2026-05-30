# app/services/supabase_storage.py
"""
Servicio de Integración con Supabase Storage.
Responsabilidad: Conectarse al almacenamiento de objetos de Supabase para subir
evidencia fotográfica de incidencias de infraestructura universitaria.

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

# Nombre del bucket público según requerimientos
BUCKET_NAME = "infraestructura-fotos"

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
    if not settings.SUPABASE_KEY or settings.SUPABASE_KEY == "placeholder_anon_or_service_key":
        logger.warning(
            "⚠️ SUPABASE_KEY no está configurada o contiene un valor placeholder. "
            "La carga fallará si el bucket requiere políticas de seguridad (RLS)."
        )

    # URL del endpoint para subir el objeto al bucket específico
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{file_name}"
    
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
        "apikey": settings.SUPABASE_KEY,
        "Content-Type": content_type
    }
    
    # Preparamos la petición POST con los bytes del archivo en el cuerpo
    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
    
    try:
        logger.info(f"Subiendo archivo '{file_name}' ({len(file_bytes)} bytes) al bucket '{BUCKET_NAME}'...")
        with urllib.request.urlopen(req) as response:
            if response.status in (200, 201):
                # La subida fue exitosa. Generamos la URL pública accesible.
                # Nota aclaratoria: Asegúrese de que el bucket 'infraestructura-fotos' esté configurado
                # como PÚBLICO en el panel de control de Supabase (Dashboard -> Storage -> Bucket Settings).
                public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{file_name}"
                logger.info(f"✅ Archivo subido con éxito. URL pública: {public_url}")
                return public_url
            else:
                raise Exception(f"Respuesta inesperada de Supabase: Status {response.status}")
                
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"❌ Error HTTP de Supabase Storage ({e.code}): {error_body}")
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
