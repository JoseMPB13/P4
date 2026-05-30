# app/api/endpoints/auth.py
"""
Capa de Controladores de Autenticación (APIRouter).
Responsabilidad: Exponer las rutas de registro e inicio de sesión de usuarios.
- POST /auth/register: Valida que el correo no esté registrado y crea un usuario hasheando la clave.
- POST /auth/login: Verifica las credenciales del usuario y genera un token JWT temporal de acceso.

Maneja códigos de estado HTTP semánticos y comentarios académicos explicativos en español.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timezone
import logging

from app.core.database import get_db
from app.core.config import settings
from app.models.usuario import UsuarioModel
from app.schemas.usuario import UsuarioCreate, UsuarioLogin, UsuarioResponse, Token
from app.services.auth import AuthService
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

# Inicializar el enrutador de autenticación con la etiqueta para OpenAPI/Swagger
router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"]
)

# Esquema para extraer el token JWT Bearer desde la cabecera 'Authorization' en el logout
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@router.post(
    "/register",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo usuario",
    description="Crea un nuevo usuario en la base de datos si el correo electrónico no está en uso."
)
def registrar_usuario(payload: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Controlador para el registro de nuevos usuarios en la plataforma.
    
    ¿Por qué 201 Created?: Indica que la petición POST fue procesada de forma exitosa y
    resultó en la creación física de una nueva entidad de usuario en la base de datos relacional.
    
    ¿Por qué 400 Bad Request?: Si el correo electrónico ya se encuentra registrado, se lanza
    esta excepción debido a que viola la restricción de unicidad del email del negocio.
    """
    # 1. Verificar si ya existe un usuario con el mismo email registrado
    usuario_existente = db.query(UsuarioModel).filter(UsuarioModel.email == payload.email).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya se encuentra registrado en el sistema."
        )
    
    # 2. Hashear la contraseña en texto plano de forma segura utilizando bcrypt
    hashed_pass = AuthService.hash_password(payload.password)
    
    # 3. Instanciar la entidad de usuario
    # Comentario en español: Se fuerza el rol de "estudiante" de manera rígida e inmutable en el backend.
    # Esto asegura que ninguna cuenta pueda ser creada con privilegios elevados ('admin' o 'personal_mantenimiento')
    # a través de la inyección de atributos no autorizados en el payload de la petición.
    nuevo_usuario = UsuarioModel(
        email=payload.email,
        nombre=payload.nombre,
        hashed_password=hashed_pass,
        rol="estudiante"
    )
    
    # 4. Guardar la entidad en la base de datos transaccionalmente
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario) # Recupera el ID autoincremental de la base de datos
    
    return nuevo_usuario

@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión y obtener token",
    description="Autentica las credenciales (correo y contraseña) del usuario y retorna un Token JWT válido por 1 hora."
)
def iniciar_sesion(payload: UsuarioLogin, db: Session = Depends(get_db)):
    """
    Controlador para autenticar usuarios mediante credenciales básicas.
    
    ¿Por qué 200 OK?: Indica que las credenciales son válidas y retorna un cuerpo JSON
    estructurado con el Token de acceso JWT.
    
    ¿Por qué 401 Unauthorized?: Si el usuario no existe en la base de datos o si la
    verificación criptográfica de la contraseña con bcrypt falla, se deniega el acceso
    sin proveer detalles específicos de cuál falló (previniendo enumeración de usuarios).
    """
    # 1. Buscar al usuario por correo electrónico en la base de datos
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == payload.email).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas (correo o contraseña no válidos)."
        )
    
    # 2. Verificar criptográficamente si la contraseña en texto plano coincide con el hash almacenado
    password_valido = AuthService.verificar_password(payload.password, usuario.hashed_password)
    if not password_valido:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas (correo o contraseña no válidos)."
        )
    
    # 3. Generar el Token de acceso JWT codificando declaraciones de identidad
    token_data = {
        "sub": usuario.email, # 'sub' claim estándar para la identidad del sujeto
        "nombre": usuario.nombre,
        "id": usuario.id,
        "rol": usuario.rol
    }
    access_token = AuthService.crear_access_token(data=token_data)
    
    # 4. Retornar el token formateado según el esquema Token
    return Token(
        access_token=access_token,
        token_type="bearer"
    )

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Cerrar sesión del usuario",
    description="Invalida el token JWT actual agregándolo a la lista negra (blacklist) de Redis con un tiempo de expiración automático (TTL) igual al tiempo restante de validez del token."
)
def cerrar_sesion(
    token: str = Depends(oauth2_scheme),
    redis_client = Depends(get_redis_client)
):
    """
    Controlador para invalidar tokens de acceso JWT tras el logout del usuario.
    
    Comentario en español:
    1. Extraemos la fecha de expiración del payload del token sin levantar error si ya expiró 
       (si ya expiró no es necesario hacer nada, pero si sigue activo se lee el claim 'exp').
    2. Calculamos el tiempo de vida restante (TTL) del token respecto a la hora del servidor UTC.
    3. Si el TTL es mayor a 0, guardamos en Redis f'blacklist:{token}' con expiración automática.
       Esto simula el comportamiento de invalidación dinámica de tokens de Express/Node.js en Redis.
    """
    try:
        # Decodificar el token sin validar la expiración temporal de forma estricta (queremos leer 'exp' incluso si está cerca de expirar)
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_signature": True} # Siempre verificamos la firma para evitar falsificaciones
        )
        
        exp = payload.get("exp")
        if exp:
            ahora = datetime.now(timezone.utc).timestamp()
            ttl = int(exp - ahora)
            
            # Solo guardamos en la lista negra si el token aún no ha expirado
            if ttl > 0:
                redis_client.setex(f"blacklist:{token}", ttl, "true")
                logger.info("Logout: Token agregado a la lista negra de Redis exitosamente.")
                return {"mensaje": "Sesión cerrada de manera exitosa. Token invalidado."}
    except Exception as err:
        logger.error(f"Logout: Error al decodificar o almacenar token en lista negra: {err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no válido o alterado criptográficamente."
        )
        
    return {"mensaje": "Sesión cerrada de manera exitosa."}
