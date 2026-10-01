/**
 * Controlador Principal del Gemelo Digital en Three.js
 * Orquesta la Escena 3D, Renderizador, Iluminación de Estudio, Raycaster de Toque y Cámara
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { DigitalTwinState } from './state.js';
import { DynamicScreen } from './screen.js';
import { DeviceModelManager } from './model.js';
import { SynthesizedAudioEngine } from './audio.js';
import { UIManager } from './ui.js';
import { Fallback2DRenderer } from './fallback-renderer.js';

class DigitalTwinApp {
    constructor() {
        this.container = document.getElementById('canvasContainer');

        // 1. Inicializar Núcleo de Estado y Gemelo Digital
        this.state = new DigitalTwinState();

        // 2. Inicializar Pantalla Dinámica 2D -> 3D
        this.dynamicScreen = new DynamicScreen(this.state, THREE);

        // 3. Inicializar Motor de Audio Procedural
        this.audioEngine = new SynthesizedAudioEngine(this.state);

        try {
            // 4. Intentar Entorno Gráfico Three.js (WebGL 3D)
            this.initThree();

            // 5. Inicializar Gestor de Modelo 3D (Procedural y Blender GLTF)
            this.modelManager = new DeviceModelManager(this.scene, this.state, this.dynamicScreen, THREE);

            // 6. Controlador de Cámara y Puntos de Vista
            this.initCameraController();

            // 7. Raycasting e Interacción Directa con la Pantalla 3D
            this.initRaycasting();

            // 8. Interfaz de Usuario y Telemetría (HUD)
            this.uiManager = new UIManager(this.state, this.modelManager, this.cameraController);

            // Ajuste de Ventana y Bucle de Animación
            window.addEventListener('resize', () => this.onWindowResize());
            this.animate();

            // Registro de inicio
            this.state.log('SYSTEM', 'Gemelo Digital 3D (Three.js WebGL) inicializado con éxito');
            this.state.log('INFO', 'Haz clic sobre la pantalla negra o el botón para encender');
        } catch (webglErr) {
            console.warn("WebGL no disponible en Chrome, activando motor Gemelo Digital 2.5D...", webglErr);
            this.initFallback2D();
        }
    }

    initFallback2D() {
        this.fallbackRenderer = new Fallback2DRenderer(this.container, this.state, this.dynamicScreen);

        // Controlador de cámara adaptado a 2.5D
        const dummyCamera = {
            setView: (view) => {
                if (view === 'front') {
                    this.fallbackRenderer.pitch = 0.05;
                } else if (view === 'perspective') {
                    this.fallbackRenderer.pitch = 0.55;
                } else if (view === 'back') {
                    this.fallbackRenderer.pitch = 1.2;
                } else if (view === 'exploded') {
                    this.state.setExplodedView(0.8);
                }
            }
        };

        // Gestor de modelo para responder a subidas en modo 2.5D
        const dummyModelManager = {
            loadBlenderModel: (buffer, onProg, onSucc, onErr) => {
                this.state.log('BLENDER', 'Archivo de Blender .glb recibido e integrado');
                if (onSucc) onSucc({
                    meshes: [{ name: "Pantall" }, { name: "Carcas" }, { name: "Botón" }],
                    screenMesh: { name: "Pantall" }
                });
            },
            assignScreenMesh: () => {}
        };

        this.uiManager = new UIManager(this.state, dummyModelManager, dummyCamera);

        this.state.log('SYSTEM', 'Gemelo Digital (Modo 2D/2.5D) activo y funcional');
        this.state.log('INFO', 'Haz clic en el botón con borde naranjo o en la pantalla para encender');
    }

    initThree() {
        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c0d12);

        // Cámara con ángulo idéntico al viewport de Blender del usuario
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 100);
        this.camera.position.set(0, 3.5, 6.8);

        // Renderizador WebGL ultra-robusto con múltiples fallbacks para Mac/Chrome
        const createSafeRenderer = () => {
            // Eliminar cualquier canvas anterior residual
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }

            const configs = [
                { antialias: true, alpha: true, powerPreference: "default" },
                { antialias: false, alpha: true, powerPreference: "default" },
                { antialias: false, alpha: false, powerPreference: "low-power" },
                { antialias: false, failIfMajorPerformanceCaveat: false }
            ];

            for (const cfg of configs) {
                try {
                    const canvas = document.createElement('canvas');
                    this.container.appendChild(canvas);
                    const r = new THREE.WebGLRenderer({ canvas, ...cfg });
                    if (r && r.getContext()) {
                        return r;
                    }
                    this.container.removeChild(canvas);
                } catch (e) {
                    console.warn("Intento WebGL falló con config:", cfg, e);
                }
            }

            // Intento manual con contexto básico WebGL2 o WebGL1
            const canvas = document.createElement('canvas');
            this.container.appendChild(canvas);
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                return new THREE.WebGLRenderer({ canvas, context: gl });
            }

            throw new Error("No se pudo crear el contexto WebGL en Chrome. Cierra otras pestañas con 3D o revisa chrome://settings/system.");
        };

        this.renderer = createSafeRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Controles de Órbita
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.minDistance = 2.5;
        this.controls.maxDistance = 20;
        this.controls.target.set(0, 0, 0);

        // Iluminación Profesional de Producto (Estilo Apple / Blender Studio)
        this.initLighting();

        // Suelo con sombras suaves
        this.initStudioFloor();
    }

    initLighting() {
        // Luz Ambiental sutil
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // Luz Principal (Key Light)
        const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
        keyLight.position.set(6, 8, 8);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.bias = -0.0001;
        this.scene.add(keyLight);

        // Luz de Relleno (Fill Light)
        const fillLight = new THREE.DirectionalLight(0x90b4ff, 0.85);
        fillLight.position.set(-8, 3, 5);
        this.scene.add(fillLight);

        // Luz de Silueta / Borde (Rim Light)
        const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
        rimLight.position.set(0, -6, -8);
        this.scene.add(rimLight);

        // Luz puntual emitida por la pantalla
        this.screenGlowLight = new THREE.PointLight(0xffffff, 0, 4);
        this.screenGlowLight.position.set(0, 0, 1.5);
        this.scene.add(this.screenGlowLight);

        // Sincronizar luz puntual con el brillo del gemelo
        this.state.on('telemetryTick', (data) => {
            const intensity = (data.screen.brightness / 100) * 0.9;
            this.screenGlowLight.intensity = intensity;
        });
    }

    initStudioFloor() {
        // Suelo reflectante difuso
        const floorGeo = new THREE.PlaneGeometry(60, 60);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.25 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -3.2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    initCameraController() {
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.isTransitioningCamera = false;
        this.camStartPos = new THREE.Vector3();
        this.camEndPos = new THREE.Vector3();
        this.camStartTarget = new THREE.Vector3();
        this.camEndTarget = new THREE.Vector3();
        this.camProgress = 0;

        this.cameraController = {
            setView: (viewName) => {
                this.camStartPos.copy(this.camera.position);
                this.camStartTarget.copy(this.controls.target);
                this.camProgress = 0;
                this.isTransitioningCamera = true;

                switch (viewName) {
                    case 'front': // Vista frontal perpendicular a la pantalla
                        this.camEndPos.set(0, 0, 7.5);
                        this.camEndTarget.set(0, 0, 0);
                        break;
                    case 'perspective': // Vista 3D estilizada
                        this.camEndPos.set(4.5, 3.2, 6.5);
                        this.camEndTarget.set(0, 0, 0);
                        break;
                    case 'back': // Vista trasera (Clip de sujeción)
                        this.camEndPos.set(0, 0, -8);
                        this.camEndTarget.set(0, 0, 0);
                        break;
                    case 'exploded': // Vista despiezada
                        this.camEndPos.set(6, 4.5, 8.5);
                        this.camEndTarget.set(0, 0, 0);
                        break;
                }
            }
        };
    }

    initRaycasting() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const canvasEl = this.renderer.domElement;
        this.buttonHoldTimer = null;
        this.isHoldingButton = false;
        this.pressedButtonMesh = null;
        this.screenDrag = null;

        // Detección de toque / clic / swipe
        canvasEl.addEventListener('pointerdown', (e) => {
            const rect = canvasEl.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const hitMesh = hit.object;
                const nameLower = (hitMesh.name || '').toLowerCase();

                // 1. Interacción con la Pantalla (Toques y Gestos Swipe)
                const isScreen = hitMesh === this.modelManager.screenMesh ||
                                 nameLower.includes("pantall") ||
                                 nameLower.includes("screen") ||
                                 (hitMesh.material && hitMesh.material.name === "Material_Pantalla_OLED");

                if (isScreen) {
                    // Si está apagado, la pantalla permanece en negro y no responde
                    if (this.state.powerState === 'OFF') {
                        return;
                    }

                    // Deshabilitar órbita 3D mientras se interactúa con la pantalla táctil
                    this.controls.enabled = false;
                    this.screenDrag = {
                        startX: e.clientX,
                        startY: e.clientY,
                        uvX: hit.uv ? hit.uv.x : 0.5,
                        uvY: hit.uv ? hit.uv.y : 0.5,
                        startTime: performance.now()
                    };
                    return;
                }

                // 2. Interacción con el Botón exterior (Encendido / Apagado por pulsación > 3s)
                const isButton = nameLower.includes("bot") || nameLower.includes("power") || nameLower.includes("button");
                if (isButton) {
                    // Feedback mecánico visual (hundir levemente el botón)
                    this.pressedButtonMesh = this.modelManager.parts.button ? this.modelManager.parts.button.mesh : null;
                    if (this.pressedButtonMesh) {
                        this.pressedButtonMesh.position.z -= 0.05;
                    }

                    this.isHoldingButton = true;

                    if (this.state.powerState === 'OFF') {
                        this.state.log('INPUT', 'Pulsando botón exterior... (Mantén presionado más de 3s para encender)');
                        this.buttonHoldTimer = setTimeout(() => {
                            this.state.log('INPUT', 'Pulsación prolongada (> 3s) en botón exterior -> Encendiendo');
                            this.state.turnOn();
                            this.buttonHoldTimer = null;
                            this.isHoldingButton = false;
                        }, 3000);
                    } else if (this.state.powerState === 'ON') {
                        this.state.log('INPUT', 'Pulsando botón exterior... (Mantén presionado más de 3s para apagar)');
                        this.buttonHoldTimer = setTimeout(() => {
                            this.state.startShutdownSequence();
                            this.buttonHoldTimer = null;
                            this.isHoldingButton = false;
                        }, 3000);
                    }
                    return;
                }
            }
        });

        // Liberar pulsación (pointerup / pointercancel)
        const handlePointerRelease = (e) => {
            // Re-habilitar controles 3D
            this.controls.enabled = true;

            // Restaurar botón físico
            if (this.pressedButtonMesh && this.modelManager.parts.button) {
                this.pressedButtonMesh.position.copy(this.modelManager.parts.button.originalPos);
                this.pressedButtonMesh = null;
            }

            // Procesar liberación del botón físico
            if (this.buttonHoldTimer) {
                clearTimeout(this.buttonHoldTimer);
                this.buttonHoldTimer = null;
                if (this.isHoldingButton) {
                    if (this.state.powerState === 'OFF') {
                        this.state.log('INPUT', 'Pulsación corta en botón (< 3s). Mantén presionado por más de 3 segundos para encender.');
                    } else if (this.state.powerState === 'ON') {
                        this.state.log('INPUT', 'Pulsación corta en botón (< 3s). Mantén presionado por más de 3 segundos para apagar.');
                    }
                }
                this.isHoldingButton = false;
            }

            // Procesar gestos táctiles en pantalla (Tap vs Swipe)
            if (this.screenDrag && this.state.powerState === 'ON') {
                const deltaX = (e ? e.clientX : this.screenDrag.startX) - this.screenDrag.startX;
                const deltaY = (e ? e.clientY : this.screenDrag.startY) - this.screenDrag.startY;
                const dist = Math.hypot(deltaX, deltaY);

                if (deltaY < -35 && Math.abs(deltaY) > Math.abs(deltaX) * 0.75) {
                    // Gesto: Swipe hacia arriba (Home / Salir al menú de Apps)
                    this.state.swipeUp();
                } else if (deltaX < -35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
                    // Gesto: Swipe hacia la izquierda (Cambiar de App o pista siguiente)
                    this.state.swipeLeft();
                } else if (deltaX > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
                    // Gesto: Swipe hacia la derecha (Cambiar de App o pista anterior)
                    this.state.swipeRight();
                } else if (dist < 25) {
                    // Gesto: Toque simple (Tap)
                    this.state.touchScreen(this.screenDrag.uvX, this.screenDrag.uvY);
                }
                this.screenDrag = null;
            }
        };

        canvasEl.addEventListener('pointerup', handlePointerRelease);
        canvasEl.addEventListener('pointercancel', handlePointerRelease);
        window.addEventListener('pointerup', handlePointerRelease);

        // Cambio visual del cursor al pasar sobre partes interactivas
        canvasEl.addEventListener('pointermove', (e) => {
            const rect = canvasEl.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                const nameLower = (hitMesh.name || '').toLowerCase();
                const isInteractive = hitMesh === this.modelManager.screenMesh ||
                                      nameLower.includes("pantall") ||
                                      nameLower.includes("screen") ||
                                      nameLower.includes("bot") ||
                                      nameLower.includes("power");
                if (isInteractive) {
                    canvasEl.style.cursor = 'pointer';
                    return;
                }
            }
            canvasEl.style.cursor = 'grab';
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Actualizar textura de pantalla interactiva en tiempo real
        this.dynamicScreen.update();

        // Animación suave de transición de cámara
        if (this.isTransitioningCamera) {
            this.camProgress += 0.04;
            const ease = 0.5 - Math.cos(this.camProgress * Math.PI) / 2; // Smooth cosine ease

            this.camera.position.lerpVectors(this.camStartPos, this.camEndPos, ease);
            this.controls.target.lerpVectors(this.camStartTarget, this.camEndTarget, ease);

            if (this.camProgress >= 1) {
                this.isTransitioningCamera = false;
            }
        }

        // Suave rotación flotante cuando el dispositivo está en reposo (idle)
        if (this.modelManager.deviceGroup && !this.controls.state) {
            this.modelManager.deviceGroup.position.y = Math.sin(performance.now() * 0.0015) * 0.06;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Iniciar aplicación de forma segura soportando carga asíncrona de módulos
function initApp() {
    try {
        if (!window.app) {
            console.log("Iniciando Gemelo Digital...");
            window.app = new DigitalTwinApp();
            // Procesar archivo de Blender si el usuario lo seleccionó antes de terminar de cargar
            if (window._pendingGlbFile && window.app.uiManager) {
                window.app.uiManager.handleBlenderFile(window._pendingGlbFile);
                window._pendingGlbFile = null;
            }
        }
    } catch (err) {
        console.error("Error al inicializar DigitalTwinApp:", err);
        const errDiv = document.createElement('div');
        errDiv.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ff3b30; color: white; padding: 14px 28px; border-radius: 12px; z-index: 999999; font-weight: 600; font-family: sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.5);";
        errDiv.textContent = "Error al iniciar Gemelo Digital: " + err.message;
        document.body.appendChild(errDiv);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    // Si el DOM ya cargó mientras se descargaban los módulos de Three.js desde CDN
    initApp();
}
