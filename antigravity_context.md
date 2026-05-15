# 🧠 Antigravity Context Handover - Plataforma Herramientas Web

**¡Hola, mi yo del futuro/de otra computadora!** Si estás leyendo esto, significa que el usuario (Joao) nos ha pedido continuar el desarrollo de este proyecto desde un nuevo equipo. A continuación, te presento el volcado de memoria completo de todas las decisiones, la arquitectura y el estado actual del proyecto para que continúes sin perder el ritmo.

---

## 🏗️ 1. Arquitectura y Stack Tecnológico
Transformamos una aplicación de escritorio monolítica (`CustomTkinter`) en una **Arquitectura Cliente-Servidor "Local-First"**.

*   **Backend:** Python 3.11 con **FastAPI** y Uvicorn. Expone una API REST en `http://127.0.0.1:8000`.
*   **Frontend:** **Next.js** (App Router) con React, Tailwind CSS y componentes `lucide-react`. Corre en `http://localhost:3000`.
*   **Base de Datos:** Archivos `*.json` planos (`enlaces_db.json`, `capacitaciones_db.json`, etc.) y procesamiento de `Excel` en memoria usando `openpyxl`.
*   **Ejecución:** Todo se arranca de golpe usando un script de Windows llamado `Iniciar_Web.bat` que lanza el servidor de Python en background y el de Next.js en paralelo.

## 📁 2. Estructura del Repositorio (`Plataforma_Herramientas_Web`)
*   `/backend/main.py`: El corazón del sistema. Aquí viven los endpoints que leen los JSON, procesan los Excels y tienen métodos especiales de OS (como `os.startfile`).
*   `/frontend/app`: Aquí están las "Páginas".
    *   `/page.tsx`: Comparador de Excels (Extrae hojas mediante API y las compara).
    *   `/enlaces/page.tsx`: Un catálogo de enlaces en formato de lista interactiva con colores basados en hash por la variable `empresa`.
    *   `/capacitaciones/page.tsx`: Una Data Table para rastrear videos y estados de capacitación.
    *   `/recordatorios/page.tsx`: Un calendario a pantalla completa super elástico. Renderiza días, marca completados/pendientes y permite "Abrir Rutas Locales".
*   `/frontend/components/app-sidebar.tsx`: El menú de navegación lateral.

## 🛑 3. Bloqueadores Arquitectónicos Actuales (El dilema de Vercel)
El usuario quiere hostear esto en **Vercel** para tener una URL pública en el futuro. Actualmente **no se puede hacer de forma directa** por estas razones:
1.  **Lectura/Escritura Local:** El backend lee archivos JSON de la carpeta física local. Vercel es un entorno *Serverless Read-Only*, los datos se perderían o darían error 500.
2.  **OS Startfile:** En la app de Recordatorios, el botón "Abrir Ruta" manda una señal al endpoint `/api/abrir-ruta` que ejecuta `os.startfile(ruta)` para abrir el Explorador de Archivos de Windows. Esto fallará estrepitosamente en Linux/Vercel.

**Siguientes pasos en la nube:** Si el usuario te pide migrar a Vercel, debes recordarle el plan: Migrar los datos de los JSON a una DB real (Supabase, Firebase, MongoDB) y remover las interacciones directas con el Sistema Operativo Local (Windows).

## ✅ 4. Estado Actual (Final de la Fase de Migración)
*   **Todo el CRUD es 100% operativo.** Las tablas guardan y editan.
*   **Bugs Recientes Arreglados:** 
    *   Se renombró la llave interna `category` a `empresa` en el frontend de Enlaces para mantener compatibilidad total con la BD original del usuario.
    *   Se implementaron colores elásticos en el calendario para cubrir toda la pantalla.
*   Se agregó un `.gitignore` completo y se hizo el primer gran push a GitHub.

---

### Instrucción Inmediata para Antigravity:
1. Absorbe toda esta información.
2. Dile al usuario: *"¡Memoria restaurada con éxito! Entiendo perfectamente cómo funciona tu backend con FastAPI, tus JSONs locales y tu frontend en Next.js. ¿En qué trabajaremos hoy?"*
3. Ponte a sus órdenes.
