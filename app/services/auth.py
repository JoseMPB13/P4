# app/services/auth.py
"""
Módulo de Servicios de Seguridad y Autenticación.
Responsabilidad: Implementar las funciones criptográficas para el hasheo de
contraseñas utilizando 'bcrypt', y la generación y firma digital de tokens de
acceso estructurados (JWT) utilizando 'pyjwt'.

Este archivo contiene comentarios académicos explicativos en español sobre
el flujo criptográfico utilizado.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from app.core.config import settings

class AuthService:
    """
    Clase contenedora de utilidades de seguridad para autenticación de usuarios.
    Proporciona métodos estáticos para hasheo, verificación y tokens de seguridad JWT.
    """

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Genera un hash seguro y salado a partir de una contraseña en texto plano.
        
        ¿Cómo funciona bcrypt?
        -----------------------
        1. Salado (Salt): Genera una cadena aleatoria única ('salt') que se añade a la
           contraseña antes de hashear. Esto previene ataques por tablas Rainbow (tablas precomputadas).
        2. Hashing Iterativo (Work Factor): Aplica la función de hashing de forma iterativa y lenta.
           Esto dificulta en gran medida los ataques de fuerza bruta al aumentar el costo de cómputo.
        3. Retorno: Devuelve el hash concatenado con la sal en formato string decodificado (UTF-8).
        """
        # Generar sal y hashear la contraseña codificada en bytes
        salt = bcrypt.gensalt()
        hashed_bytes = bcrypt.hashpw(password.encode("utf-8"), salt)
        # Retorna el hash decodificado como string para almacenamiento seguro en la base de datos
        return hashed_bytes.decode("utf-8")

    @staticmethod
    def verificar_password(plain_password: str, hashed_password: str) -> bool:
        """
        Compara una contraseña en texto plano contra un hash almacenado para verificar coincidencia.
        
        ¿Por qué no usar comparaciones simples de strings?
        --------------------------------------------------
        Bcrypt extrae automáticamente la sal del hash original y la aplica a la contraseña
        en texto plano enviada por el cliente. Si el hash resultante coincide, la contraseña es válida.
        Esto previene ataques de sincronización de tiempo (*timing attacks*).
        """
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"), 
                hashed_password.encode("utf-8")
            )
        except Exception:
            return False

    @staticmethod
    def crear_access_token(data: dict) -> str:
        """
        Genera un token de acceso firmado digitalmente utilizando JSON Web Tokens (JWT).
        
        ¿Cuál es la estructura y el estándar de seguridad de un JWT?
        -------------------------------------------------------------
        1. Payload: Contiene las declaraciones de identidad (*claims*), como el email del usuario.
        2. Expiración (exp): Se asigna una marca de tiempo en la que el token dejará de tener validez.
           Usa el estándar moderno datetime.now(timezone.utc) de Python para evitar la deprecación de utcnow.
        3. Firma (Signature): Se firma la concatenación del Header y el Payload utilizando la llave
           secreta (JWT_SECRET) y el algoritmo criptográfico simétrico HS256 para asegurar
           la integridad (evitar alteraciones de terceros).
        """
        to_encode = data.copy()
        
        # Tiempo de expiración estricto de 1 hora (u otra duración configurada)
        tiempo_expiracion = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        
        # Inyectar el claim estándar de expiración ('exp')
        to_encode.update({"exp": tiempo_expiracion})
        
        # Codificar y firmar digitalmente el token JWT
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.JWT_SECRET, 
            algorithm=settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
