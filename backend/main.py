"""API REST de Esceniko (FastAPI + SQLite) con CRUD y sesiones."""
import secrets
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from database import conectar, encriptar_password, iniciar_base_de_datos


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    iniciar_base_de_datos()
    yield


app = FastAPI(title="Esceniko API", version="0.2.0", lifespan=ciclo_de_vida)

# CORS: permite que el frontend (Live Server) llame al API desde cualquier puerto local.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

seguridad = HTTPBearer(auto_error=False)

ETIQUETA_MODALIDAD = {"presencial": "Presencial", "virtual": "Virtual", "ambas": "Presencial y virtual"}
ETIQUETA_OFERTA = {"obra": "Obra para la venta", "servicio": "Servicio por contratar"}


# --- ESQUEMAS PYDANTIC ---

class Disciplina(BaseModel):
    slug: str
    nombre: str


class ArtistaResumen(BaseModel):
    id: int
    nombre_artistico: str
    disciplina: str
    disciplina_nombre: str
    emoji: str
    ciudad: str
    modalidad: str
    modalidad_texto: str
    descripcion_corta: str


class ArtistaDetalle(ArtistaResumen):
    oferta: str
    oferta_texto: str
    precio: Optional[int]
    whatsapp: str
    descripcion: str
    estado: str = "aprobado"


class ArtistaEntrada(BaseModel):
    nombre_artistico: str = Field(..., min_length=2)
    disciplina: str
    emoji: str = "🎭"
    oferta: Literal["obra", "servicio"] = "servicio"
    modalidad: Literal["presencial", "virtual", "ambas"] = "ambas"
    ciudad: str = Field(..., min_length=2)
    precio: Optional[int] = Field(None, ge=0)
    whatsapp: str = Field(..., min_length=7)
    descripcion_corta: str = Field(..., min_length=5)
    descripcion: str = ""
    estado: Literal["pendiente", "aprobado"] = "aprobado"


class Estadisticas(BaseModel):
    talentos: int
    disciplinas: int
    artistas: int


class LoginEntrada(BaseModel):
    email: str
    password: str


class UsuarioPublico(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str


class RespuestaLogin(BaseModel):
    token: str
    usuario: UsuarioPublico


SELECT_ARTISTA = """
    SELECT a.*, d.nombre AS disciplina_nombre
    FROM artistas a JOIN disciplinas d ON d.slug = a.disciplina
"""


def a_resumen(fila) -> dict:
    return {
        "id": fila["id"],
        "nombre_artistico": fila["nombre_artistico"],
        "disciplina": fila["disciplina"],
        "disciplina_nombre": fila["disciplina_nombre"],
        "emoji": fila["emoji"],
        "ciudad": fila["ciudad"],
        "modalidad": fila["modalidad"],
        "modalidad_texto": ETIQUETA_MODALIDAD[fila["modalidad"]],
        "descripcion_corta": fila["descripcion_corta"],
    }


def a_detalle(fila) -> dict:
    datos = a_resumen(fila)
    datos.update(
        oferta=fila["oferta"],
        oferta_texto=ETIQUETA_OFERTA[fila["oferta"]],
        precio=fila["precio"],
        whatsapp=fila["whatsapp"],
        descripcion=fila["descripcion"],
        estado=fila["estado"],
    )
    return datos


# --- DEPENDENCIA DE SESIÓN ---

def requerir_admin(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(seguridad),
) -> dict:
    if credenciales is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para realizar esta acción",
        )
    con = conectar()
    try:
        fila = con.execute(
            """
            SELECT u.id, u.nombre, u.email, u.rol
            FROM sesiones s
            JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token = ?
            """,
            (credenciales.credentials,),
        ).fetchone()
    finally:
        con.close()

    if fila is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada",
        )
    if fila["rol"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return dict(fila)


# --- RUTAS DE SESIÓN ---

@app.post("/login", response_model=RespuestaLogin, tags=["Sesiones"])
def iniciar_sesion(datos: LoginEntrada):
    con = conectar()
    try:
        usuario = con.execute(
            "SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)",
            (datos.email.strip(),),
        ).fetchone()
        if usuario is None or usuario["password_hash"] != encriptar_password(datos.password):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

        token = secrets.token_hex(24)
        con.execute(
            "INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)",
            (token, usuario["id"]),
        )
        con.commit()
        return {
            "token": token,
            "usuario": {
                "id": usuario["id"],
                "nombre": usuario["nombre"],
                "email": usuario["email"],
                "rol": usuario["rol"],
            },
        }
    finally:
        con.close()


@app.get("/sesion", response_model=UsuarioPublico, tags=["Sesiones"])
def verificar_sesion(admin: dict = Depends(requerir_admin)):
    return admin


@app.post("/logout", tags=["Sesiones"])
def cerrar_sesion(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(seguridad),
):
    if credenciales:
        con = conectar()
        try:
            con.execute("DELETE FROM sesiones WHERE token = ?", (credenciales.credentials,))
            con.commit()
        finally:
            con.close()
    return {"mensaje": "Sesión cerrada correctamente"}


# --- RUTAS PÚBLICAS DE CONSULTA ---

@app.get("/", tags=["Público"])
def raiz():
    return {"servicio": "Esceniko API", "estado": "funcionando", "documentacion": "/docs"}


@app.get("/disciplinas", response_model=list[Disciplina], tags=["Público"])
def listar_disciplinas():
    con = conectar()
    try:
        filas = con.execute("SELECT slug, nombre FROM disciplinas ORDER BY rowid").fetchall()
        return [dict(f) for f in filas]
    finally:
        con.close()


@app.get("/estadisticas", response_model=Estadisticas, tags=["Público"])
def estadisticas():
    con = conectar()
    try:
        talentos = con.execute("SELECT COUNT(*) FROM artistas WHERE estado = 'aprobado'").fetchone()[0]
        disciplinas = con.execute("SELECT COUNT(*) FROM disciplinas").fetchone()[0]
        artistas = con.execute("SELECT COUNT(*) FROM artistas").fetchone()[0]
        return {"talentos": talentos, "disciplinas": disciplinas, "artistas": artistas}
    finally:
        con.close()


@app.get("/artistas", response_model=list[ArtistaResumen], tags=["Público"])
def listar_artistas(
    disciplina: Optional[str] = Query(None, description="Slug de la disciplina"),
    ciudad: Optional[str] = Query(None),
    modalidad: Optional[str] = Query(None, pattern="^(presencial|virtual|ambas)$"),
    q: Optional[str] = Query(None, description="Texto a buscar en nombre, disciplina o descripción"),
):
    condiciones = ["a.estado = 'aprobado'"]
    parametros: list = []
    if disciplina:
        condiciones.append("a.disciplina = ?")
        parametros.append(disciplina)
    if ciudad:
        condiciones.append("LOWER(a.ciudad) = LOWER(?)")
        parametros.append(ciudad)
    if modalidad:
        condiciones.append("a.modalidad = ?")
        parametros.append(modalidad)
    if q:
        condiciones.append(
            "(LOWER(a.nombre_artistico) LIKE ? OR LOWER(d.nombre) LIKE ? "
            "OR LOWER(a.descripcion_corta) LIKE ? OR LOWER(a.ciudad) LIKE ?)"
        )
        parametros += [f"%{q.lower().strip()}%"] * 4
    consulta = SELECT_ARTISTA + " WHERE " + " AND ".join(condiciones) + " ORDER BY a.id"
    con = conectar()
    try:
        return [a_resumen(f) for f in con.execute(consulta, parametros).fetchall()]
    finally:
        con.close()


@app.get("/artistas/{artista_id}", response_model=ArtistaDetalle, tags=["Público"])
def obtener_artista(artista_id: int):
    con = conectar()
    try:
        fila = con.execute(
            SELECT_ARTISTA + " WHERE a.id = ? AND a.estado = 'aprobado'", (artista_id,)
        ).fetchone()
    finally:
        con.close()
    if fila is None:
        raise HTTPException(status_code=404, detail="Artista no encontrado")
    return a_detalle(fila)


# --- RUTAS CRUD ADMINISTRACIÓN ---

@app.get("/admin/artistas", response_model=list[ArtistaDetalle], tags=["Admin CRUD"])
def admin_listar_artistas(admin: dict = Depends(requerir_admin)):
    con = conectar()
    try:
        filas = con.execute(SELECT_ARTISTA + " ORDER BY a.id DESC").fetchall()
        return [a_detalle(f) for f in filas]
    finally:
        con.close()


@app.post("/artistas", response_model=ArtistaDetalle, status_code=201, tags=["Admin CRUD"])
def crear_artista(datos: ArtistaEntrada, admin: dict = Depends(requerir_admin)):
    con = conectar()
    try:
        disc = con.execute(
            "SELECT slug FROM disciplinas WHERE slug = ?", (datos.disciplina,)
        ).fetchone()
        if disc is None:
            raise HTTPException(status_code=400, detail="La disciplina seleccionada no existe")

        cursor = con.execute(
            """
            INSERT INTO artistas (
                usuario_id, nombre_artistico, disciplina, emoji, oferta,
                modalidad, ciudad, precio, whatsapp, descripcion_corta, descripcion, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                admin["id"], datos.nombre_artistico, datos.disciplina, datos.emoji,
                datos.oferta, datos.modalidad, datos.ciudad, datos.precio,
                datos.whatsapp, datos.descripcion_corta, datos.descripcion, datos.estado,
            ),
        )
        nuevo_id = cursor.lastrowid
        con.commit()
        fila = con.execute(SELECT_ARTISTA + " WHERE a.id = ?", (nuevo_id,)).fetchone()
        return a_detalle(fila)
    finally:
        con.close()


@app.put("/artistas/{artista_id}", response_model=ArtistaDetalle, tags=["Admin CRUD"])
def actualizar_artista(
    artista_id: int,
    datos: ArtistaEntrada,
    admin: dict = Depends(requerir_admin),
):
    con = conectar()
    try:
        existe = con.execute("SELECT id FROM artistas WHERE id = ?", (artista_id,)).fetchone()
        if existe is None:
            raise HTTPException(status_code=404, detail="Artista no encontrado")

        disc = con.execute(
            "SELECT slug FROM disciplinas WHERE slug = ?", (datos.disciplina,)
        ).fetchone()
        if disc is None:
            raise HTTPException(status_code=400, detail="La disciplina seleccionada no existe")

        con.execute(
            """
            UPDATE artistas SET
                nombre_artistico = ?, disciplina = ?, emoji = ?, oferta = ?,
                modalidad = ?, ciudad = ?, precio = ?, whatsapp = ?,
                descripcion_corta = ?, descripcion = ?, estado = ?
            WHERE id = ?
            """,
            (
                datos.nombre_artistico, datos.disciplina, datos.emoji, datos.oferta,
                datos.modalidad, datos.ciudad, datos.precio, datos.whatsapp,
                datos.descripcion_corta, datos.descripcion, datos.estado, artista_id,
            ),
        )
        con.commit()
        fila = con.execute(SELECT_ARTISTA + " WHERE a.id = ?", (artista_id,)).fetchone()
        return a_detalle(fila)
    finally:
        con.close()


@app.delete("/artistas/{artista_id}", tags=["Admin CRUD"])
def eliminar_artista(artista_id: int, admin: dict = Depends(requerir_admin)):
    con = conectar()
    try:
        cursor = con.execute("DELETE FROM artistas WHERE id = ?", (artista_id,))
        con.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Artista no encontrado")
        return {"mensaje": "Artista eliminado correctamente", "id": artista_id}
    finally:
        con.close()