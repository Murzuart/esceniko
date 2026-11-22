"""API REST de Esceniko (FastAPI + SQLite)."""
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import conectar, iniciar_base_de_datos


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    iniciar_base_de_datos()  # crea las tablas y los datos de ejemplo si hace falta
    yield


app = FastAPI(title="Esceniko API", version="0.1.0", lifespan=ciclo_de_vida)

# CORS: permite que el frontend (Live Server) llame al API desde otro puerto.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500", "http://localhost:5500",
        "http://127.0.0.1:5501", "http://localhost:5501",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

ETIQUETA_MODALIDAD = {"presencial": "Presencial", "virtual": "Virtual", "ambas": "Presencial y virtual"}
ETIQUETA_OFERTA = {"obra": "Obra para la venta", "servicio": "Servicio por contratar"}


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


class Estadisticas(BaseModel):
    talentos: int
    disciplinas: int
    artistas: int


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


@app.get("/")
def raiz():
    return {"servicio": "Esceniko API", "estado": "funcionando", "documentacion": "/docs"}


@app.get("/disciplinas", response_model=list[Disciplina])
def listar_disciplinas():
    con = conectar()
    try:
        filas = con.execute("SELECT slug, nombre FROM disciplinas ORDER BY rowid").fetchall()
        return [dict(f) for f in filas]
    finally:
        con.close()


@app.get("/estadisticas", response_model=Estadisticas)
def estadisticas():
    con = conectar()
    try:
        talentos = con.execute("SELECT COUNT(*) FROM artistas WHERE estado = 'aprobado'").fetchone()[0]
        disciplinas = con.execute("SELECT COUNT(*) FROM disciplinas").fetchone()[0]
        artistas = con.execute("SELECT COUNT(*) FROM artistas").fetchone()[0]
        return {"talentos": talentos, "disciplinas": disciplinas, "artistas": artistas}
    finally:
        con.close()


@app.get("/artistas", response_model=list[ArtistaResumen])
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


@app.get("/artistas/{artista_id}", response_model=ArtistaDetalle)
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
    datos = a_resumen(fila)
    datos.update(
        oferta=fila["oferta"],
        oferta_texto=ETIQUETA_OFERTA[fila["oferta"]],
        precio=fila["precio"],
        whatsapp=fila["whatsapp"],
        descripcion=fila["descripcion"],
    )
    return datos
