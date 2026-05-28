# app/api/endpoints/auth.py
"""
Capa de Controladores de Autenticación (APIRouter).
Responsabilidad: Exponer las rutas de registro e inicio de sesión de usuarios.
- POST /auth/register: Valida que el correo no esté registrado y crea un usuario hasheando la clave.
- POST /auth/login: Verifica las credenciales del usuario y genera un token JWT temporal de acceso.

Maneja códigos de estado HTTP semánticos y comentarios académicos explicativos en español.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.usuario import UsuarioModel
from app.schemas.usuario import UsuarioCreate, UsuarioLogin, UsuarioResponse, Token
from app.services.auth import AuthService

# Inicializar el enrutador de autenticación con la etiqueta para OpenAPI/Swagger
router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"]
)

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
    nuevo_usuario = UsuarioModel(
        email=payload.email,
        nombre=payload.nombre,
        hashed_password=hashed_pass
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
        "nombre": usuario.nombre
    }
    access_token = AuthService.crear_access_token(data=token_data)
    
    # 4. Retornar el token formateado según el esquema Token
    return Token(
        access_token=access_token,
        token_type="bearer"
    )
