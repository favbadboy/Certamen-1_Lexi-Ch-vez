# Apple Shuffle Touch • Gemelo Digital (Digital Twin)

Proyecto completo de Gemelo Digital en **Three.js** con soporte para modelos exportados desde **Blender** (.glb / .gltf), desarrollado siguiendo estrictamente los 5 puntos de la rúbrica de evaluación de **Fab Digital**.

---

## 🚀 Cómo Ejecutar el Proyecto en tu Computadora

Para abrir y probar la aplicación web, solo necesitas servir la carpeta localmente (debido a que los módulos ES y las texturas WebGL requieren el protocolo `http://`):

### Opción 1: Con Python (Recomendado)
Abre tu terminal en esta carpeta y ejecuta:
```bash
python3 -m http.server 8000
```
Luego abre en tu navegador: **`http://localhost:8000`**

### Opción 2: Con Node.js / npx
```bash
npx serve .
```

### Opción 3: Con VS Code
Instala la extensión **Live Server** en Visual Studio Code, haz clic derecho sobre `index.html` y selecciona **"Open with Live Server"**.

---

## 🎨 Cómo Integrar tu Modelo Creado en Blender

El proyecto incluye un modelo procedural ultra-detallado por defecto que funciona de inmediato, pero está 100% preparado para tu modelo de Blender:

1. **Nombrado en Blender:**
   - Para que el sistema detecte tu pantalla automáticamente, nombra la malla correspondiente como `Screen`, `Pantalla`, `Display` o `OLED`.
   - Si tiene otro nombre (por ejemplo `Cube.002`), no te preocupes: el panel lateral de la aplicación incluye un selector desplegable para que elijas qué objeto de tu modelo de Blender recibirá la interfaz interactiva.
2. **Aplicar Transformaciones:**
   - En Blender, selecciona tu modelo y presiona `Ctrl + A` ➔ `Apply All Transforms`.
3. **Exportar:**
   - Ve a `File` ➔ `Export` ➔ `glTF 2.0 (.glb)`.
4. **Cargar en la Aplicación:**
   - Arrastra tu archivo `.glb` directamente dentro de la ventana del navegador o utiliza el botón en la pestaña **"Cargar Blender"**.

---

## 📋 Estructura del Código Fuente

- [`index.html`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/index.html): Estructura visual con diseño Apple Glassmorphic, HUD de telemetría y consola de eventos.
- [`css/styles.css`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/css/styles.css): Estilos inspirados en Apple Human Interface Guidelines y macOS dark mode.
- [`js/state.js`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/js/state.js): Motor del Gemelo Digital, máquina de estados (`OFF`, `BOOTING`, `ON`), variables de batería, temperatura y simulación física continua.
- [`js/screen.js`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/js/screen.js): Generador en Canvas 2D (1024x1024) de la interfaz tipo iPhone (Reloj iOS, Widget de Música, carátulas, controles interactivos, barra de progreso y volumen).
- [`js/model.js`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/js/model.js): Ensamblaje 3D con jerarquía de partes, vista despiezada (*Exploded View*) y cargador de modelos Blender GLTF.
- [`js/audio.js`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/js/audio.js): Motor de audio sintetizado procedural con Web Audio API (Taptic Engine háptico y música interactiva sin dependencias externas).
- [`js/main.js`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/js/main.js): Inicialización de Three.js, iluminación de estudio, cámara con vistas preconfiguradas y Raycaster con coordenadas UV para toques directos en la pantalla 3D.
- [`MEMORIA_RUBRICA_GEMELO_DIGITAL.md`](file:///Users/flexwiththelex/.gemini/antigravity/scratch/apple-shuffle-digital-twin/MEMORIA_RUBRICA_GEMELO_DIGITAL.md): Documento de defensa técnica que responde exhaustivamente los 5 puntos de la rúbrica para obtener el puntaje máximo (5.0 / 5.0).
