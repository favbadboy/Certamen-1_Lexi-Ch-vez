/**
 * Generador y Cargador de Modelo 3D del Gemelo Digital
 * Rúbrica Punto 1: Modelo 3D, estructura y preparación del sistema
 * Jerarquía de componentes funcionales, Despiece Digital (Exploded View) e integración GLTF desde Blender
 */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class DeviceModelManager {
    constructor(scene, state, dynamicScreen, THREE) {
        this.scene = scene;
        this.state = state;
        this.dynamicScreen = dynamicScreen;
        this.THREE = THREE;

        // Grupo raíz que contiene el modelo del dispositivo
        this.deviceGroup = new THREE.Group();
        this.deviceGroup.name = "Apple_Shuffle_Touch_DigitalTwin";
        this.scene.add(this.deviceGroup);

        // Referencias a partes para la vista despiezada y raycasting
        this.parts = {};
        this.screenMesh = null;
        this.isCustomModelLoaded = false;

        // Materiales PBR
        this.initMaterials();

        // Construir modelo procedural por defecto (fiel al Apple Shuffle / iPod Nano touch)
        this.buildProceduralModel();

        // Suscribirse a cambios de estado
        this.state.on('explodedViewChange', (factor) => this.updateExplodedView(factor));
        this.state.on('powerChange', () => this.updateScreenEmission());
        this.state.on('brightnessChange', () => this.updateScreenEmission());
    }

    initMaterials() {
        const THREE = this.THREE;

        // 1. Aluminio Anodizado Plata / Gris Espacial Apple
        this.aluminumMaterial = new THREE.MeshStandardMaterial({
            color: 0x8a8e9b, // Tono aluminio plata elegante para gran visibilidad sobre fondo oscuro
            metalness: 0.85,
            roughness: 0.22,
            name: "Material_Aluminio_Chasis"
        });

        // 2. Vidrio Frontal Protector (Gorilla Glass)
        this.glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.05,
            roughness: 0.05,
            transmission: 0.95,
            thickness: 0.4,
            transparent: true,
            opacity: 0.35,
            reflectivity: 0.9,
            name: "Material_Vidrio_Protector"
        });

        // 3. Pantalla OLED con textura dinámica del Canvas
        this.screenMaterial = new THREE.MeshStandardMaterial({
            map: this.dynamicScreen.getTexture(),
            roughness: 0.2,
            metalness: 0.1,
            emissive: new THREE.Color(0xffffff),
            emissiveMap: this.dynamicScreen.getTexture(),
            emissiveIntensity: 0.85,
            name: "Material_Pantalla_OLED"
        });

        // 4. Componentes internos (PCB y batería)
        this.pcbMaterial = new THREE.MeshStandardMaterial({
            color: 0x0f3b15, // Verde placa de circuito
            metalness: 0.4,
            roughness: 0.5,
            name: "Material_Placa_Logica"
        });

        this.batteryMaterial = new THREE.MeshStandardMaterial({
            color: 0x1f1f1f,
            metalness: 0.6,
            roughness: 0.4,
            name: "Material_Bateria_Litio"
        });

        // 5. Botones y Clip
        this.accentMetalMaterial = new THREE.MeshStandardMaterial({
            color: 0x444852,
            metalness: 0.9,
            roughness: 0.2,
            name: "Material_Botones_Clip"
        });
    }

    // Construye el modelo 3D idéntico al de Blender del usuario (3 elementos: Carcasa, Pantalla, Botón con borde naranjo)
    buildProceduralModel() {
        const THREE = this.THREE;
        const group = this.deviceGroup;

        // Limpiar grupo por si existieran hijos
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
        this.parts = {};

        // Proporciones fieles a la captura de Blender (Shuffle.blend)
        const radius = 2.6;
        const height = 0.68;

        // --- ELEMENTO 1: EXTERIOR (CARCASA) ---
        // Disco circular con curvatura ultra suave (128 segmentos para eliminar aristas)
        const casingShape = new THREE.Shape();
        casingShape.absarc(0, 0, radius - 0.12, 0, Math.PI * 2, false);

        const extrudeSettings = {
            depth: height - 0.22,
            bevelEnabled: true,
            bevelSegments: 16,
            steps: 2,
            curveSegments: 128, // 128 segmentos de curvatura: perfectamente circular sin aristas
            bevelSize: 0.16,
            bevelThickness: 0.12
        };

        const casingGeo = new THREE.ExtrudeGeometry(casingShape, extrudeSettings);
        casingGeo.center();
        casingGeo.rotateX(-Math.PI / 2); // Superficie superior apuntando hacia +Y
        casingGeo.computeVertexNormals();

        this.aluminumMaterial.color.setHex(0x828691); // Gris satinado idéntico a Material.001 en Blender
        this.aluminumMaterial.metalness = 0.68;
        this.aluminumMaterial.roughness = 0.28;

        const casingMesh = new THREE.Mesh(casingGeo, this.aluminumMaterial);
        casingMesh.name = "Carcas"; // Nombre del objeto en Blender
        casingMesh.castShadow = true;
        casingMesh.receiveShadow = true;
        group.add(casingMesh);
        this.parts.casing = {
            mesh: casingMesh,
            originalPos: new THREE.Vector3(0, 0, 0),
            explodeOffset: new THREE.Vector3(0, -0.6, 0)
        };

        // --- ELEMENTO 2: PANTALLA (DISCO CIRCULAR SUPERIOR ULTRA SUAVE) ---
        // 128 divisiones para un borde circular perfectamente nítido
        const screenRadius = radius * 0.76;
        const screenGeo = new THREE.CircleGeometry(screenRadius, 128);
        screenGeo.computeVertexNormals();
        this.screenMesh = new THREE.Mesh(screenGeo, this.screenMaterial);
        this.screenMesh.name = "Pantall"; // Nombre del objeto en Blender
        this.screenMesh.rotation.x = -Math.PI / 2;
        this.screenMesh.position.set(0, height * 0.5 + 0.014, 0);
        this.screenMesh.castShadow = false;
        this.screenMesh.receiveShadow = false;
        group.add(this.screenMesh);
        this.parts.screen = {
            mesh: this.screenMesh,
            originalPos: this.screenMesh.position.clone(),
            explodeOffset: new THREE.Vector3(0, 1.6, 0)
        };

        // Aro de protección sutil entre pantalla y chasis (128 segmentos)
        const rimGeo = new THREE.RingGeometry(screenRadius * 0.99, screenRadius * 1.03, 128);
        rimGeo.computeVertexNormals();
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x484b54, metalness: 0.85, roughness: 0.25 });
        const rimMesh = new THREE.Mesh(rimGeo, rimMat);
        rimMesh.rotation.x = -Math.PI / 2;
        rimMesh.position.set(0, height * 0.5 + 0.016, 0);
        rimMesh.raycast = () => {};
        group.add(rimMesh);

        // --- ELEMENTO 3: BOTÓN (PEQUEÑO BOTÓN EXTERIOR PASTILLA REDONDEADA) ---
        const btnGroup = new THREE.Group();
        btnGroup.name = "Botón";

        // Pastilla redondeada ergonómica metálica
        const btnShape = this.createRoundedRectShape(0.65, 0.22, 0.08);
        const btnExtrudeSettings = {
            depth: 0.20,
            bevelEnabled: true,
            bevelSegments: 6,
            steps: 1,
            curveSegments: 32,
            bevelSize: 0.04,
            bevelThickness: 0.04
        };
        const btnGeo = new THREE.ExtrudeGeometry(btnShape, btnExtrudeSettings);
        btnGeo.center();
        btnGeo.computeVertexNormals();

        const btnMat = new THREE.MeshStandardMaterial({
            color: 0x484b52,
            metalness: 0.88,
            roughness: 0.22
        });
        const btnMesh = new THREE.Mesh(btnGeo, btnMat);
        btnMesh.name = "Botón";
        btnMesh.castShadow = true;
        btnMesh.receiveShadow = true;
        btnGroup.add(btnMesh);

        // Ubicar en el borde exterior frontal del disco (como en Blender)
        btnGroup.position.set(0, 0, radius - 0.06);
        group.add(btnGroup);
        this.parts.button = {
            mesh: btnGroup,
            originalPos: btnGroup.position.clone(),
            explodeOffset: new THREE.Vector3(0, 0, 1.4)
        };

        this.updateScreenEmission();
    }

    createRoundedRectShape(w, h, r) {
        const THREE = this.THREE;
        const shape = new THREE.Shape();
        const x = -w / 2;
        const y = -h / 2;

        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);

        return shape;
    }

    // Actualiza la vista despiezada (Exploded View) según el factor (0 a 1)
    updateExplodedView(factor) {
        for (const key in this.parts) {
            const part = this.parts[key];
            if (part && part.mesh) {
                part.mesh.position.lerpVectors(
                    part.originalPos,
                    part.originalPos.clone().add(part.explodeOffset),
                    factor
                );
            }
        }
    }

    // Controla la emisión de la pantalla según el estado de energía (OFF -> 0, ON -> Emisivo OLED)
    // Controla la emisión de la pantalla según el estado de energía y brillo dinámico
    updateScreenEmission() {
        if (!this.screenMesh || !this.screenMesh.material) return;

        if (this.state.powerState === 'OFF') {
            this.screenMesh.material.emissiveIntensity = 0.0; // Pantalla apagada en negro
            this.screenMesh.material.roughness = 0.7;
        } else {
            const factor = Math.max(0.15, (this.state.screen.brightness || 100) / 100);
            this.screenMesh.material.emissiveIntensity = 0.25 + 0.95 * factor; // Brillo dinámico real
            this.screenMesh.material.roughness = 0.15;
        }
    }

    // --- CARGA DE MODELO BLENDER PERSONALIZADO (.GLB / .GLTF) ---
    loadBlenderModel(urlOrArrayBuffer, onProgress, onSuccess, onError) {
        const THREE = this.THREE;
        const loader = new GLTFLoader();

        const handleLoad = (gltf) => {
            // Limpiar partes procedimentales actuales
            while (this.deviceGroup.children.length > 0) {
                this.deviceGroup.remove(this.deviceGroup.children[0]);
            }
            this.parts = {};

            const importedScene = gltf.scene;
            importedScene.name = "Blender_Imported_Model";

            // Normalizar escala y centrar modelo
            const box = new THREE.Box3().setFromObject(importedScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 4.0; // Tamaño estándar
            const scale = targetSize / maxDim;
            importedScene.scale.setScalar(scale);
            importedScene.position.sub(center.multiplyScalar(scale));

            // Buscar malla de pantalla en el modelo de Blender
            let detectedScreenMesh = null;
            const detectedMeshes = [];

            importedScene.traverse((child) => {
                if (child.isMesh) {
                    detectedMeshes.push(child);
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Detección automática por nombre de objeto en Blender
                    const name = child.name.toLowerCase();
                    if (name.includes('screen') || name.includes('pantalla') || name.includes('display') || name.includes('touch') || name.includes('lcd') || name.includes('oled')) {
                        detectedScreenMesh = child;
                    }
                }
            });

            // Si se detectó la pantalla o se toma la más idónea
            if (detectedScreenMesh) {
                this.assignScreenMesh(detectedScreenMesh);
                this.state.log('BLENDER', 'Pantalla detectada automáticamente en Blender: "' + detectedScreenMesh.name + '"');
            } else if (detectedMeshes.length > 0) {
                // Si no coincide con nombres comunes, asignar la primera o plana
                detectedScreenMesh = detectedMeshes[0];
                this.assignScreenMesh(detectedScreenMesh);
                this.state.log('BLENDER', 'Asignada malla principal como pantalla: "' + detectedScreenMesh.name + '". Puedes cambiarla desde el panel.');
            }

            this.deviceGroup.add(importedScene);
            this.isCustomModelLoaded = true;

            if (onSuccess) onSuccess({ gltf, meshes: detectedMeshes, screenMesh: detectedScreenMesh });
        };

        if (typeof urlOrArrayBuffer === 'string') {
            loader.load(urlOrArrayBuffer, handleLoad, onProgress, onError);
        } else {
            loader.parse(urlOrArrayBuffer, '', handleLoad, onError);
        }
    }

    // Permite al usuario asignar manualmente qué malla de su modelo de Blender es la pantalla
    assignScreenMesh(mesh) {
        if (!mesh) return;

        // Clonar material de pantalla con CanvasTexture
        mesh.material = this.screenMaterial;
        mesh.material.needsUpdate = true;
        this.screenMesh = mesh;
        this.updateScreenEmission();
    }
}
