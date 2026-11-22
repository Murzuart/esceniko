# Esceniko – Plataforma Digital para el Gremio Creativo

Vitrina para artistas independientes: publican su perfil y los clientes los encuentran para comprar obras o contratar servicios.

## Estructura
- `frontend/` – páginas (HTML, CSS, JS)
- `backend/` – API REST en Python (FastAPI + SQLite)

## Cómo ver el frontend
Abre la carpeta con VS Code y ejecuta `frontend/index.html` con la extensión **Live Server**.

## Cómo ejecutar el API
Requiere Python 3.10 o superior. Desde la carpeta `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows (en Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Documentación interactiva: http://127.0.0.1:8000/docs
- La base de datos `esceniko.db` se crea sola la primera vez, con 8 artistas de ejemplo.

### Endpoints actuales
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/artistas` | Lista artistas. Filtros: `disciplina`, `ciudad`, `modalidad`, `q` |
| GET | `/artistas/{id}` | Detalle de un artista |
| GET | `/disciplinas` | Disciplinas disponibles |
| GET | `/estadisticas` | Cifras del inicio |

## Estado actual
- [x] Frontend base: inicio, login, registro, mi perfil y detalle de artista (escritorio y móvil)
- [x] API REST en Python (lectura)
- [x] Base de datos SQLite con datos de ejemplo
- [ ] Conexión frontend ↔ API
- [ ] Login, CRUD y panel de administración

## Ramas
- `main`: versión estable
- `develop`: integración
- `frontend`: trabajo del frontend
- `backend`: trabajo del API
