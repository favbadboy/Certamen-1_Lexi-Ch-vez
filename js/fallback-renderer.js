/**
 * Motor de Renderizado 2.5D de Respaldo para el Gemelo Digital
 * Permite visualizar e interactuar con el Apple Shuffle circular incluso si Chrome tiene WebGL desactivado
 * Cumple con el requisito de la rúbrica: "Software de Gemelo Digital 2D o VR"
 */

export class Fallback2DRenderer {
    constructor(container, state, dynamicScreen) {
        this.container = container;
        this.state = state;
        this.dynamicScreen = dynamicScreen;

        // Limpiar contenedor
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // Crear canvas 2D de alta resolución
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Ángulos de orientación pseudo-3D
        this.pitch = 0.55; // Inclinación hacia la cámara (similar a la captura de Blender)
        this.yaw = 0.0;
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindMouseEvents();

        // Banner informativo sutil
        this.showModeBanner();

        // Iniciar loop de render
        this.animate();
    }

    resize() {
        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    showModeBanner() {
        const banner = document.createElement('div');
        banner.style = `
            position: fixed;
            top: 86px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 132, 255, 0.9);
            backdrop-filter: blur(12px);
            color: #ffffff;
            padding: 8px 18px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            z-index: 999;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        banner.innerHTML = `
            <span>💡 <strong>Modo 2D/2.5D Activo:</strong> Tu modelo circular está funcionando. Para activar 3D WebGL en Chrome, haz clic en "Reiniciar" en la pestaña de Configuración que tienes abierta, o abre este enlace en Safari.</span>
            <button style="background: none; border: none; color: white; cursor: pointer; font-size: 14px;" onclick="this.parentElement.remove()">✕</button>
        `;
        document.body.appendChild(banner);
    }

    bindMouseEvents() {
        this.buttonHoldTimer = null;
        this.isHoldingButton = false;
        this.screenDrag = null;

        this.canvas.addEventListener('mousedown', (e) => {
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.handlePointerDown(e.clientX, e.clientY);
            if (!this.screenDrag) {
                this.isDragging = true;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.yaw += dx * 0.008;
                this.pitch = Math.max(0.2, Math.min(1.2, this.pitch + dy * 0.006));
                this.lastMouse = { x: e.clientX, y: e.clientY };
            }
        });

        const cancelHold = (e) => {
            this.isDragging = false;

            // Procesar botón físico
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

            // Procesar gestos de pantalla (Swipe vs Tap)
            if (this.screenDrag && this.state.powerState === 'ON') {
                const clientX = e ? (e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : this.screenDrag.startX)) : this.screenDrag.startX;
                const clientY = e ? (e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : this.screenDrag.startY)) : this.screenDrag.startY;

                const deltaX = clientX - this.screenDrag.startX;
                const deltaY = clientY - this.screenDrag.startY;
                const dist = Math.hypot(deltaX, deltaY);

                if (deltaY < -35 && Math.abs(deltaY) > Math.abs(deltaX) * 0.75) {
                    this.state.swipeUp();
                } else if (deltaX < -35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
                    this.state.swipeLeft();
                } else if (deltaX > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
                    this.state.swipeRight();
                } else if (dist < 20) {
                    this.state.touchScreen(this.screenDrag.uvX, this.screenDrag.uvY);
                }
                this.screenDrag = null;
            }
        };

        window.addEventListener('mouseup', cancelHold);
        window.addEventListener('touchend', cancelHold);
        window.addEventListener('touchcancel', cancelHold);

        // Eventos táctiles para móviles/trackpad
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this.lastMouse = { x: t.clientX, y: t.clientY };
                this.handlePointerDown(t.clientX, t.clientY);
                if (!this.screenDrag) {
                    this.isDragging = true;
                }
            }
        });
    }

    handlePointerDown(clientX, clientY) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.32;

        const screenCenterY = cy - 25 * this.pitch - (this.state.explodedView || 0) * 80;
        const radiusX = scale;
        const radiusY = scale * Math.sin(this.pitch);

        // Comprobar clic en la Pantalla (elipse)
        const dx = (clientX - cx) / radiusX;
        const dy = (clientY - screenCenterY) / radiusY;
        const distSq = dx * dx + dy * dy;

        if (distSq <= 1.0) {
            // Si está apagado, la pantalla permanece negra y no responde
            if (this.state.powerState === 'OFF') {
                return;
            }

            const uvX = (dx + 1.0) / 2.0;
            const uvY = (dy + 1.0) / 2.0;
            this.screenDrag = {
                startX: clientX,
                startY: clientY,
                uvX: uvX,
                uvY: 1.0 - uvY
            };
            return;
        }

        // Comprobar clic en el Botón exterior (borde frontal)
        const btnY = cy + radiusY * 0.75 + (this.state.explodedView || 0) * 40;
        if (Math.abs(clientX - cx) < 35 && Math.abs(clientY - btnY) < 20) {
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
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Actualizar interfaz dinámica
        this.dynamicScreen.update();

        // Dibujar el modelo circular de Blender
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = Math.min(this.width, this.height) * 0.32;

        ctx.clearRect(0, 0, this.width, this.height);

        // Despiece digital
        const explode = this.state.explodedView || 0;
        const casingOffset = -explode * 30;
        const screenOffset = -explode * 80;
        const btnOffset = explode * 50;

        const rX = scale;
        const rY = scale * Math.sin(this.pitch);
        const depth = 50 * Math.cos(this.pitch);

        // 1. Sombra suave en el suelo
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.filter = 'blur(16px)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + depth + 20, rX * 1.05, rY * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. ELEMENTO 1: CARCASA EXTERIOR (Disco con volumen y bordes biselados)
        const casingY = cy + casingOffset;

        // Pared lateral cilíndrica de la carcasa
        const sideGrad = ctx.createLinearGradient(cx - rX, casingY, cx + rX, casingY);
        sideGrad.addColorStop(0, '#5a5e68');
        sideGrad.addColorStop(0.3, '#8e939e');
        sideGrad.addColorStop(0.6, '#a4a9b5');
        sideGrad.addColorStop(0.85, '#6e727c');
        sideGrad.addColorStop(1, '#4e525a');

        ctx.fillStyle = sideGrad;
        ctx.beginPath();
        ctx.ellipse(cx, casingY, rX, rY, 0, 0, Math.PI); // Cara inferior
        ctx.lineTo(cx + rX, casingY - depth);
        ctx.ellipse(cx, casingY - depth, rX, rY, 0, 0, Math.PI, true); // Cara superior
        ctx.closePath();
        ctx.fill();

        // Cara superior de la Carcasa con bisel satinado
        const topGrad = ctx.createRadialGradient(cx - rX * 0.2, casingY - depth - rY * 0.2, 10, cx, casingY - depth, rX);
        topGrad.addColorStop(0, '#b0b5c2');
        topGrad.addColorStop(0.6, '#828691');
        topGrad.addColorStop(1, '#5a5e68');

        ctx.fillStyle = topGrad;
        ctx.beginPath();
        ctx.ellipse(cx, casingY - depth, rX, rY, 0, 0, Math.PI * 2);
        ctx.fill();

        // Aro exterior biselado
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. ELEMENTO 3: BOTÓN EXTERIOR (Metálico limpio sin bordes naranjos)
        const btnY = casingY - depth * 0.35 + btnOffset;
        const btnW = 44;
        const btnH = 20;

        ctx.save();
        // Sombra del botón
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(cx - btnW / 2 + 2, btnY + 2, btnW, btnH, 6);
        ctx.fill();

        // Cuerpo metálico del botón
        const btnGrad = ctx.createLinearGradient(cx - btnW / 2, btnY, cx + btnW / 2, btnY + btnH);
        btnGrad.addColorStop(0, '#5a5e68');
        btnGrad.addColorStop(0.5, '#7e838f');
        btnGrad.addColorStop(1, '#3e4149');
        ctx.fillStyle = btnGrad;
        ctx.beginPath();
        ctx.roundRect(cx - btnW / 2, btnY, btnW, btnH, 6);
        ctx.fill();

        // Borde metálico sutil y limpio
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // 4. ELEMENTO 2: PANTALLA (Disco circular superior interactivo con textura Canvas)
        const screenY = casingY - depth + screenOffset;
        const sRadiusX = rX * 0.78;
        const sRadiusY = rY * 0.78;

        // Aro bisel oscuro de la pantalla
        ctx.strokeStyle = '#2b2d33';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(cx, screenY, sRadiusX + 2, sRadiusY + 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Dibujar el contenido dinámico del Canvas OLED tipo iPhone recortado en elipse
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, screenY, sRadiusX, sRadiusY, 0, 0, Math.PI * 2);
        ctx.clip();

        // Proyectar el canvas virtual de la pantalla
        const virtualCanvas = this.dynamicScreen.canvas;
        ctx.drawImage(virtualCanvas, cx - sRadiusX, screenY - sRadiusY, sRadiusX * 2, sRadiusY * 2);

        // Brillo/reflejo del vidrio protector
        const glassGrad = ctx.createLinearGradient(cx - sRadiusX, screenY - sRadiusY, cx + sRadiusX, screenY + sRadiusY);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        glassGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.04)');
        glassGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.0)');
        glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.ellipse(cx, screenY, sRadiusX, sRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
