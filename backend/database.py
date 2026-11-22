"""Base de datos SQLite de Esceniko: conexión, tablas y datos de ejemplo."""
import hashlib
import sqlite3
from pathlib import Path

RUTA_DB = Path(__file__).parent / "esceniko.db"

DISCIPLINAS = [
    ("cantantes-y-serenatas", "Cantantes y serenatas"),
    ("bandas-y-trios", "Bandas y tríos"),
    ("pintura-y-arte-digital", "Pintura y arte digital"),
    ("fotografia", "Fotografía"),
    ("modelado-3d", "Modelado 3D"),
    ("edicion-de-video", "Edición de video"),
    ("danza-y-teatro", "Danza y teatro"),
]

# (nombre, disciplina, emoji, oferta, modalidad, ciudad, precio, whatsapp, corta, larga)
ARTISTAS_EJEMPLO = [
    ("Camila Rojas", "cantantes-y-serenatas", "🎤", "servicio", "ambas", "Bogotá", 250000,
     "573000000001",
     "Voz de música popular y baladas para serenatas, cumpleaños y celebraciones familiares.",
     "Cantante con más de ocho años de experiencia en eventos familiares y corporativos. "
     "Su repertorio va de la música popular a las baladas románticas.\n\n"
     "Puede presentarse en persona en Bogotá o acompañar celebraciones a distancia, "
     "con videollamada y repertorio a la medida."),
    ("Mateo Vargas", "pintura-y-arte-digital", "🎨", "obra", "virtual", "Medellín", 400000,
     "573000000002",
     "Retratos y paisajes en óleo, además de ilustración digital por encargo.",
     "Pintor y artista digital. Sus óleos de retrato y paisaje se venden como obra original.\n\n"
     "También recibe encargos de ilustración digital, con entrega de archivos en alta resolución."),
    ("Lucía Fernández", "fotografia", "📷", "servicio", "presencial", "Cali", 300000,
     "573000000003",
     "Fotografía de eventos y retrato, con entrega de galería digital.",
     "Fotógrafa de eventos sociales y retrato. Cubre matrimonios, grados y sesiones personales.\n\n"
     "Entrega una galería digital con las fotos editadas pocos días después del evento."),
    ("Andrés Pineda", "modelado-3d", "🧊", "servicio", "virtual", "Bogotá", 500000,
     "573000000004",
     "Personajes y objetos 3D para videojuegos y publicidad.",
     "Modelador 3D enfocado en personajes y objetos para videojuegos y piezas publicitarias.\n\n"
     "Trabaja de forma remota y entrega los modelos listos para usar en motores de juego."),
    ("Valentina Cruz", "edicion-de-video", "🎬", "servicio", "virtual", "Barranquilla", 200000,
     "573000000005",
     "Edición de reels, videoclips y piezas publicitarias.",
     "Editora de video para redes sociales, videoclips y publicidad.\n\n"
     "Recibe el material en bruto por internet y devuelve la pieza final con ajustes incluidos."),
    ("Trío Cuerdas del Sur", "bandas-y-trios", "🎶", "servicio", "presencial", "Bucaramanga", 600000,
     "573000000006",
     "Trío de cuerdas para bodas, aniversarios y eventos familiares.",
     "Trío de cuerdas que ameniza bodas, aniversarios y reuniones familiares.\n\n"
     "El repertorio se ajusta al gusto de quien contrata, de música andina a clásicos románticos."),
    ("Colectivo Telón Abierto", "danza-y-teatro", "💃", "servicio", "ambas", "Pereira", 700000,
     "573000000007",
     "Danza contemporánea y teatro corto para eventos y festivales.",
     "Colectivo de danza contemporánea y teatro breve, con montajes para eventos y festivales.\n\n"
     "Se presenta en escenarios físicos o prepara piezas grabadas para eventos virtuales."),
    ("Nora Beltrán", "fotografia", "📷", "obra", "ambas", "Cartagena", 180000,
     "573000000008",
     "Fotografía de paisaje y de producto, con venta de impresiones.",
     "Fotógrafa de paisaje y de producto. Vende impresiones de sus series en distintos tamaños.\n\n"
     "También toma fotos de producto para tiendas y marcas pequeñas."),
]


def encriptar_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def conectar():
    """Abre una conexión a la base de datos. Las filas se leen como diccionarios."""
    con = sqlite3.connect(RUTA_DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def crear_tablas(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS disciplinas (
        slug   TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usuarios (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre        TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol           TEXT NOT NULL CHECK (rol IN ('artista', 'cliente', 'admin')),
        creado_en     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sesiones (
        token      TEXT PRIMARY KEY,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        creado_en  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS artistas (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        nombre_artistico  TEXT NOT NULL,
        disciplina        TEXT NOT NULL REFERENCES disciplinas(slug),
        emoji             TEXT NOT NULL DEFAULT '🎭',
        oferta            TEXT NOT NULL CHECK (oferta IN ('obra', 'servicio')),
        modalidad         TEXT NOT NULL CHECK (modalidad IN ('presencial', 'virtual', 'ambas')),
        ciudad            TEXT NOT NULL,
        precio            INTEGER,
        whatsapp          TEXT NOT NULL,
        descripcion_corta TEXT NOT NULL,
        descripcion       TEXT NOT NULL DEFAULT '',
        estado            TEXT NOT NULL DEFAULT 'aprobado'
                          CHECK (estado IN ('pendiente', 'aprobado')),
        creado_en         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)


def cargar_datos_de_ejemplo(con):
    """Inserta disciplinas, usuario admin y artistas de ejemplo si las tablas están vacías."""
    con.executemany("INSERT OR IGNORE INTO disciplinas (slug, nombre) VALUES (?, ?)", DISCIPLINAS)

    hay_usuarios = con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if hay_usuarios == 0:
        con.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
            ("Administrador Esceniko", "admin@esceniko.com", encriptar_password("admin123"), "admin"),
        )

    hay = con.execute("SELECT COUNT(*) FROM artistas").fetchone()[0]
    if hay == 0:
        con.executemany(
            """INSERT INTO artistas (nombre_artistico, disciplina, emoji, oferta, modalidad,
                   ciudad, precio, whatsapp, descripcion_corta, descripcion)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ARTISTAS_EJEMPLO,
        )


def iniciar_base_de_datos():
    con = conectar()
    try:
        crear_tablas(con)
        cargar_datos_de_ejemplo(con)
        con.commit()
    finally:
        con.close()