/**
 * Generador de Interfaz Dinámica para la Pantalla del Gemelo Digital
 * Renderiza en un Canvas 2D de alta resolución (1024x1024) y lo proyecta como THREE.CanvasTexture
 * Estética Apple Watch / watchOS y Apple Music:
 * - Portadas auténticas para cada canción
 * - Íconos funcionales de Airplay y Fila en las esquinas inferiores
 * - Íconos funcionales de Aleatorio (🔀), Repetición (🔁) y Autoplay (♾️) debajo de la barra de volumen
 * - Configuración funcional de brillo (+ / -) y volumen (+ / -)
 * - Ícono oficial de Configuración perfeccionado
 * - Menú de Apps estilo watchOS con carrusel por gestos Swipe
 */

import { PowerStates, ScreenViews } from './state.js';

export class DynamicScreen {
    constructor(state, THREE) {
        this.state = state;
        this.THREE = THREE;

        // Crear canvas virtual en memoria
        this.width = 1024;
        this.height = 1024;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d');

        // Polyfill para compatibilidad con roundRect
        if (!this.ctx.roundRect) {
            this.ctx.roundRect = function(x, y, w, h, r) {
                if (typeof r === 'undefined') r = 5;
                if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
                this.beginPath();
                this.moveTo(x + r.tl, y);
                this.lineTo(x + w - r.tr, y);
                this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
                this.lineTo(x + w, y + h - r.br);
                this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
                this.lineTo(x + r.bl, y + h);
                this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
                this.lineTo(x, y + r.tl);
                this.quadraticCurveTo(x, y, x + r.tl, y);
                this.closePath();
            };
        }

        // Textura Three.js vinculada al canvas
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.generateMipmaps = true;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        // Efectos táctiles y animaciones
        this.ripples = [];
        this.waveOffset = 0;

        // Escuchar eventos de toque desde el Raycaster 3D
        this.state.on('screenTouch', (coords) => this.handleScreenTouch(coords.x, coords.y));

        // Render inicial
        this.render();
    }

    getTexture() {
        return this.texture;
    }

    // Procesa un toque proveniente del modelo 3D (coordenadas UV: 0.0 a 1.0)
    handleScreenTouch(uvX, uvY) {
        if (this.state.powerState !== PowerStates.ON) return;

        // En Three.js UV (0,0) es inferior-izquierda, mientras Canvas (0,0) es superior-izquierda
        const pxX = uvX * this.width;
        const pxY = (1 - uvY) * this.height;

        // Agregar animación de pulsación (Ripple táctil)
        this.ripples.push({ x: pxX, y: pxY, radius: 10, alpha: 0.8 });

        // 1. Barra Home Inferior (Gesto Home / Swipe Arriba)
        if (pxY >= 930 && !this.state.audio.isQueueOpen) {
            this.state.swipeUp();
            return;
        }

        // 2. Interacciones específicas según la vista activa
        switch (this.state.currentView) {
            case ScreenViews.APP_MENU:
                this.handleMenuTouch(pxX, pxY);
                break;
            case ScreenViews.SETTINGS:
                this.handleSettingsTouch(pxX, pxY);
                break;
            case ScreenViews.FIND_MY:
                this.handleFindMyTouch(pxX, pxY);
                break;
            case ScreenViews.MUSIC:
            default:
                this.handleMusicTouch(pxX, pxY);
                break;
        }
    }

    handleMusicTouch(pxX, pxY) {
        // A) Si el modal de la Fila (Queue) está abierto
        if (this.state.audio.isQueueOpen) {
            // Botón Cerrar (✕)
            if (pxX >= 780 && pxY <= 150) {
                this.state.toggleQueue();
                return;
            }
            // Filas de canciones
            const startY = 220;
            const rowH = 120;
            for (let i = 0; i < this.state.audio.tracks.length; i++) {
                const ry = startY + i * rowH;
                if (pxY >= ry && pxY <= ry + rowH && pxX >= 180 && pxX <= 844) {
                    this.state.playTrack(i);
                    return;
                }
            }
            // Fuera de filas cierra la cola
            this.state.toggleQueue();
            return;
        }

        // B) Esquina Inferior Izquierda: AIRPLAY
        const dAirplay = Math.hypot(pxX - 180, pxY - 840);
        if (dAirplay <= 55) {
            this.state.cycleAirplayOutput();
            return;
        }

        // C) Esquina Inferior Derecha: FILA (Queue)
        const dQueue = Math.hypot(pxX - 844, pxY - 840);
        if (dQueue <= 55) {
            this.state.toggleQueue();
            return;
        }

        // D) Botones de Modos debajo de la barra de volumen:
        // 1. Aleatorio (Shuffle 🔀)
        const dShuffle = Math.hypot(pxX - 382, pxY - 735);
        if (dShuffle <= 38) {
            this.state.toggleShuffle();
            return;
        }

        // 2. Repetición (Repeat 🔁)
        const dRepeat = Math.hypot(pxX - 512, pxY - 735);
        if (dRepeat <= 38) {
            this.state.toggleRepeat();
            return;
        }

        // 3. Autoplay (Infinito ♾️)
        const dAutoplay = Math.hypot(pxX - 642, pxY - 735);
        if (dAutoplay <= 38) {
            this.state.toggleAutoplay();
            return;
        }

        // E) Controles Principales Multimedia:
        // Play / Pause
        const dPlay = Math.hypot(pxX - 512, pxY - 585);
        if (dPlay <= 48) {
            this.state.togglePlayPause();
            return;
        }

        // Siguiente
        const dNext = Math.hypot(pxX - 642, pxY - 585);
        if (dNext <= 40) {
            this.state.nextTrack();
            return;
        }

        // Anterior
        const dPrev = Math.hypot(pxX - 382, pxY - 585);
        if (dPrev <= 40) {
            this.state.prevTrack();
            return;
        }

        // Barra de Progreso (Scrubber)
        const scrubX = 292;
        const scrubW = 440;
        const scrubY = 500;
        if (pxX >= scrubX && pxX <= scrubX + scrubW && pxY >= scrubY - 18 && pxY <= scrubY + 22) {
            const progress = (pxX - scrubX) / scrubW;
            this.state.seekAudio(progress);
            return;
        }

        // Barra de Volumen
        const volX = 332;
        const volW = 360;
        const volY = 665;
        if (pxX >= volX && pxX <= volX + volW && pxY >= volY - 18 && pxY <= volY + 22) {
            const vol = (pxX - volX) / volW;
            this.state.setVolume(vol);
            return;
        }

        // Tocar la carátula alterna la reproducción
        if (pxX >= 422 && pxX <= 602 && pxY >= 195 && pxY <= 375) {
            this.state.togglePlayPause();
            return;
        }
    }

    handleMenuTouch(pxX, pxY) {
        // Flecha izquierda (‹)
        if (pxX <= 160 && Math.abs(pxY - 500) < 180) {
            this.state.swipeRight();
            return;
        }

        // Flecha derecha (›)
        if (pxX >= this.width - 160 && Math.abs(pxY - 500) < 180) {
            this.state.swipeLeft();
            return;
        }

        // Tocar la tarjeta de la app central o botón "Abrir"
        if (Math.abs(pxX - this.width / 2) < 220 && pxY >= 200 && pxY <= 780) {
            const currentApp = this.state.menuApps[this.state.currentMenuAppIndex];
            this.state.openApp(currentApp.id);
            return;
        }
    }

    handleSettingsTouch(pxX, pxY) {
        // Botón < Menú
        if (pxX <= 220 && pxY <= 120) {
            this.state.openApp(ScreenViews.APP_MENU);
            return;
        }

        // Brillo - (Minus)
        if (pxX >= 220 && pxX <= 315 && pxY >= 195 && pxY <= 275) {
            this.state.setBrightness(this.state.screen.userBrightness - 15);
            return;
        }

        // Brillo + (Plus)
        if (pxX >= 705 && pxX <= 810 && pxY >= 195 && pxY <= 275) {
            this.state.setBrightness(this.state.screen.userBrightness + 15);
            return;
        }

        // Volumen - (Minus)
        if (pxX >= 220 && pxX <= 315 && pxY >= 355 && pxY <= 435) {
            this.state.setVolume(this.state.audio.volume - 0.15);
            return;
        }

        // Volumen + (Plus)
        if (pxX >= 705 && pxX <= 810 && pxY >= 355 && pxY <= 435) {
            this.state.setVolume(this.state.audio.volume + 0.15);
            return;
        }
    }

    handleFindMyTouch(pxX, pxY) {
        // Botón < Menú
        if (pxX <= 220 && pxY <= 120) {
            this.state.openApp(ScreenViews.APP_MENU);
            return;
        }

        // Botón Reproducir Sonido
        if (pxX >= 292 && pxX <= 732 && pxY >= 770 && pxY <= 850) {
            this.state.triggerFindMyPing();
            return;
        }
    }

    // Ciclo de dibujo llamado en el requestAnimationFrame de Three.js
    update() {
        this.render();
        this.texture.needsUpdate = true;
    }

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // Recorte circular idéntico al disco de la pantalla en Blender
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
        ctx.clip();

        // Estado 1: APAGADO (Pantalla completamente negra OLED, sin textos ni luces)
        if (this.state.powerState === PowerStates.OFF) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            return;
        }

        // Estado 2: ARRANQUE (Secuencia de inicio con logo de Apple)
        if (this.state.powerState === PowerStates.BOOTING) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);

            this.drawAppleLogo(ctx, w / 2, h / 2 - 40, 110);

            // Barra de progreso de arranque minimalista
            const barW = 280;
            const barH = 8;
            const barX = (w - barW) / 2;
            const barY = h / 2 + 110;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 4);
            ctx.fill();

            const fillW = (this.state.bootProgress / 100) * barW;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(barX, barY, fillW, barH, 4);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '400 22px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Iniciando Gemelo Digital...', w / 2, barY + 45);
            ctx.restore();
            return;
        }

        // Estado 3: APAGANDO DISPOSITIVO (Fondo negro, logo Apple blanco y texto)
        if (this.state.powerState === PowerStates.SHUTTING_DOWN) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);

            // Logo de Apple blanco
            this.drawAppleLogo(ctx, w / 2, h / 2 - 50, 120);

            // Texto blanco "Apagando dispositivo"
            ctx.fillStyle = '#ffffff';
            ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Apagando dispositivo', w / 2, h / 2 + 120);

            ctx.restore();
            return;
        }

        // Estado 4: ENCENDIDO (Renderizar según la vista activa de la aplicación)
        switch (this.state.currentView) {
            case ScreenViews.APP_MENU:
                this.renderAppMenu(ctx, w, h);
                break;
            case ScreenViews.SETTINGS:
                this.renderSettingsApp(ctx, w, h);
                break;
            case ScreenViews.FIND_MY:
                this.renderFindMyApp(ctx, w, h);
                break;
            case ScreenViews.MUSIC:
            default:
                this.renderMusicApp(ctx, w, h);
                break;
        }

        // Modal de Fila / Cola si está activa
        if (this.state.currentView === ScreenViews.MUSIC && this.state.audio.isQueueOpen) {
            this.renderQueueModal(ctx, w, h);
        }

        // Banner de Notificación Toast temporal estilo Apple
        if (this.state.activeToast) {
            this.drawToastNotification(ctx, w, this.state.activeToast);
        }

        // Renderizar animaciones de toques táctiles (Ripples)
        this.renderRipples(ctx);

        ctx.restore();
    }

    // ==========================================
    // 1. REPRODUCTOR DE MÚSICA (Apple Music watchOS)
    // ==========================================
    renderMusicApp(ctx, w, h) {
        const track = this.state.getCurrentTrack();

        // Fondo degradado dinámico según la pista activa con gran contraste
        const bgGradient = ctx.createLinearGradient(0, 0, w, h);
        bgGradient.addColorStop(0, '#0c0a16');
        bgGradient.addColorStop(0.35, track.coverColor1 + '55');
        bgGradient.addColorStop(0.75, track.coverColor2 + '33');
        bgGradient.addColorStop(1, '#040407');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, w, h);

        // 1. Barra de Estado Superior (Batería y Reloj)
        this.drawStatusBar(ctx, w);
        this.drawLockClock(ctx, w);

        // 2. Carátula del Álbum (200x200)
        const artSize = 190;
        const artX = (w - artSize) / 2;
        const artY = 195;
        this.drawAlbumArt(ctx, artX, artY, artSize, track);

        // 3. Título y Artista
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 30px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(track.title, w / 2, artY + artSize + 38);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.font = '500 22px -apple-system, sans-serif';
        ctx.fillText(track.artist, w / 2, artY + artSize + 68);
        ctx.restore();

        // 4. Barra de Progreso (Scrubber)
        const scrubW = 440;
        const scrubX = (w - scrubW) / 2;
        const scrubY = 500;
        const progress = Math.min(1, this.state.audio.currentTime / track.duration);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(scrubX, scrubY, scrubW, 5, 2.5);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(scrubX, scrubY, scrubW * progress, 5, 2.5);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(scrubX + scrubW * progress, scrubY + 2.5, 6, 0, Math.PI * 2);
        ctx.fill();

        // Tiempos
        const curM = Math.floor(this.state.audio.currentTime / 60);
        const curS = String(Math.floor(this.state.audio.currentTime % 60)).padStart(2, '0');
        const remTime = track.duration - this.state.audio.currentTime;
        const remM = Math.floor(remTime / 60);
        const remS = String(Math.floor(remTime % 60)).padStart(2, '0');

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '500 16px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${curM}:${curS}`, scrubX, scrubY + 22);
        ctx.textAlign = 'right';
        ctx.fillText(`-${remM}:${remS}`, scrubX + scrubW, scrubY + 22);

        // 5. Controles Multimedia (Prev, Play/Pause, Next)
        const controlsY = 585;
        const prevX = 382;
        const playX = 512;
        const nextX = 642;

        this.drawControlIcon(ctx, prevX, controlsY, 'prev');

        // Botón Play / Pause central
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(playX, controlsY, 36, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#08080c';
        if (this.state.audio.isPlaying) {
            ctx.fillRect(playX - 10, controlsY - 12, 6, 24);
            ctx.fillRect(playX + 4, controlsY - 12, 6, 24);
        } else {
            ctx.beginPath();
            ctx.moveTo(playX - 8, controlsY - 14);
            ctx.lineTo(playX + 13, controlsY);
            ctx.lineTo(playX - 8, controlsY + 14);
            ctx.closePath();
            ctx.fill();
        }

        this.drawControlIcon(ctx, nextX, controlsY, 'next');

        // 6. Barra de Volumen
        const volW = 360;
        const volX = (w - volW) / 2;
        const volY = 665;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '16px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('🔈', volX - 12, volY + 5);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(volX, volY, volW, 5, 2.5);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.roundRect(volX, volY, volW * this.state.audio.volume, 5, 2.5);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillText('🔊', volX + volW + 12, volY + 5);

        // 7. Modos Funcionales: Aleatorio, Repetición y Autoplay justo debajo del volumen
        const modesY = 735;
        this.drawShuffleButton(ctx, 382, modesY, this.state.audio.shuffle);
        this.drawRepeatButton(ctx, 512, modesY, this.state.audio.repeat);
        this.drawAutoplayButton(ctx, 642, modesY, this.state.audio.autoplay);

        // 8. Esquinas Inferiores Funcionales:
        // Esquina Inferior Izquierda: AIRPLAY
        this.drawAirplayButton(ctx, 180, 840, this.state.audio.airplayOutput);

        // Esquina Inferior Derecha: FILA (Queue)
        this.drawQueueButton(ctx, 844, 840, this.state.audio.isQueueOpen);

        // 9. Barra Home Inferior
        this.drawHomeBar(ctx, w, h, 'Desliza arriba para menú');
    }

    drawStatusBar(ctx, w) {
        // Indicador de batería en el arco superior
        const batW = 44;
        const batH = 18;
        const batX = (w - batW) / 2 + 35;
        const batY = 56;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(batX, batY, batW, batH, 5);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.roundRect(batX + batW + 2, batY + 5, 3, 8, 1);
        ctx.fill();

        const batLevel = this.state.battery.level / 100;
        ctx.fillStyle = this.state.battery.level > 20 ? '#34c759' : '#ff453a';
        ctx.beginPath();
        ctx.roundRect(batX + 3, batY + 3, (batW - 6) * batLevel, batH - 6, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 17px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        const chargingIcon = this.state.battery.isCharging ? '⚡ ' : '';
        ctx.fillText(`${chargingIcon}${Math.round(this.state.battery.level)}%`, batX - 10, 71);
    }

    drawLockClock(ctx, w) {
        const now = new Date();
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dateStr = `${dias[now.getDay()]} ${now.getDate()}`;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '500 20px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, w / 2, 108);

        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 58px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, w / 2, 165);
    }

    // Botón Funcional: Aleatorio (🔀 Shuffle)
    drawShuffleButton(ctx, cx, cy, isActive) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx - 28, cy - 24, 56, 48, 14);
        ctx.fillStyle = isActive ? 'rgba(250, 45, 85, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

        ctx.strokeStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.7)';
        ctx.font = '22px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔀', cx, cy + 7);
        ctx.restore();
    }

    // Botón Funcional: Repetición (🔁 Repeat: OFF | ALL | ONE)
    drawRepeatButton(ctx, cx, cy, mode) {
        const isActive = mode !== 'OFF';
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx - 28, cy - 24, 56, 48, 14);
        ctx.fillStyle = isActive ? 'rgba(250, 45, 85, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

        ctx.strokeStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.7)';
        ctx.font = '22px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔁', cx, cy + 7);

        // Distintivo '1' si repetir una pista está activo
        if (mode === 'ONE') {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx + 16, cy - 12, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fa2d55';
            ctx.font = '700 11px -apple-system, sans-serif';
            ctx.fillText('1', cx + 16, cy - 8);
        }
        ctx.restore();
    }

    // Botón Funcional: Autoplay Infinito (♾️)
    drawAutoplayButton(ctx, cx, cy, isActive) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx - 28, cy - 24, 56, 48, 14);
        ctx.fillStyle = isActive ? 'rgba(250, 45, 85, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

        ctx.strokeStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isActive ? '#fa2d55' : 'rgba(255, 255, 255, 0.7)';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♾', cx, cy + 8);
        ctx.restore();
    }

    // Esquina Inferior Izquierda: Ícono Funcional de AirPlay
    drawAirplayButton(ctx, cx, cy, currentDevice) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx - 36, cy - 30, 72, 60, 16);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ícono oficial vectorial de AirPlay
        ctx.strokeStyle = '#0a84ff';
        ctx.fillStyle = '#0a84ff';
        ctx.lineWidth = 2.5;

        // Triángulo inferior
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 8);
        ctx.lineTo(cx, cy - 4);
        ctx.lineTo(cx + 10, cy + 8);
        ctx.closePath();
        ctx.fill();

        // Ondas concéntricas de audio superiores
        ctx.beginPath();
        ctx.arc(cx, cy + 4, 15, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy + 4, 22, Math.PI * 1.3, Math.PI * 1.7);
        ctx.stroke();

        // Etiqueta AirPlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '500 12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AirPlay', cx, cy + 44);
        ctx.restore();
    }

    // Esquina Inferior Derecha: Ícono Funcional de Fila (Queue / Up Next)
    drawQueueButton(ctx, cx, cy, isOpen) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx - 36, cy - 30, 72, 60, 16);
        ctx.fillStyle = isOpen ? 'rgba(250, 45, 85, 0.35)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
        ctx.strokeStyle = isOpen ? '#fa2d55' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ícono oficial de Fila (3 líneas con nota musical)
        ctx.fillStyle = isOpen ? '#fa2d55' : '#ffffff';
        ctx.beginPath();
        ctx.roundRect(cx - 16, cy - 12, 32, 3.5, 1.7);
        ctx.roundRect(cx - 16, cy - 4, 32, 3.5, 1.7);
        ctx.roundRect(cx - 16, cy + 4, 20, 3.5, 1.7);
        ctx.fill();

        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♫', cx + 11, cy + 9);

        // Etiqueta Fila
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '500 12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Fila', cx, cy + 44);
        ctx.restore();
    }

    // Modal de Fila de Reproducción (Up Next Modal)
    renderQueueModal(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 8, 12, 0.94)';
        ctx.fillRect(0, 0, w, h);

        // Cabecera Fila
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 28px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Fila de Reproducción', w / 2, 85);

        // Botón Cerrar (✕)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(840, 80, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 22px -apple-system, sans-serif';
        ctx.fillText('✕', 840, 88);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = '600 18px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('A continuación:', 180, 160);

        // Lista de canciones interactivas
        const tracks = this.state.audio.tracks;
        const currentIdx = this.state.audio.currentTrackIndex;
        const startY = 190;
        const rowH = 110;

        tracks.forEach((t, i) => {
            const ry = startY + i * rowH;
            const isPlaying = i === currentIdx;

            ctx.fillStyle = isPlaying ? 'rgba(250, 45, 85, 0.22)' : 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.roundRect(170, ry, 684, 96, 20);
            ctx.fill();

            if (isPlaying) {
                ctx.strokeStyle = '#fa2d55';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Mini carátula
            ctx.fillStyle = t.coverColor1;
            ctx.beginPath();
            ctx.roundRect(190, ry + 16, 64, 64, 12);
            ctx.fill();

            // Indicador de reproducción o número
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 20px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(isPlaying ? '▶' : `${i + 1}`, 222, ry + 55);

            // Título y artista
            ctx.fillStyle = '#ffffff';
            ctx.font = isPlaying ? '700 23px -apple-system, sans-serif' : '600 22px -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(t.title, 275, ry + 44);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.font = '500 18px -apple-system, sans-serif';
            ctx.fillText(t.artist, 275, ry + 74);

            // Duración
            const m = Math.floor(t.duration / 60);
            const s = String(t.duration % 60).padStart(2, '0');
            ctx.textAlign = 'right';
            ctx.fillText(`${m}:${s}`, 820, ry + 56);
        });

        // Barra inferior
        this.drawHomeBar(ctx, w, h, 'Toca una canción para reproducir');
        ctx.restore();
    }

    // Dibuja las Portadas de Álbum reales y detalladas para cada pista
    drawAlbumArt(ctx, x, y, size, track) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;

        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 22);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.clip();

        // 1. STARBOY (The Weeknd)
        if (track.title.includes("Starboy")) {
            const grad = ctx.createLinearGradient(x, y, x + size, y + size);
            grad.addColorStop(0, '#0a1033');
            grad.addColorStop(0.5, '#1e053a');
            grad.addColorStop(1, '#ff006e');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, size, size);

            ctx.fillStyle = '#ffea00';
            ctx.font = '900 25px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STARBOY', x + size / 2, y + 36);

            ctx.strokeStyle = '#ffea00';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x + size / 2, y + 60);
            ctx.lineTo(x + size / 2, y + 155);
            ctx.moveTo(x + size / 2 - 30, y + 90);
            ctx.lineTo(x + size / 2 + 30, y + 90);
            ctx.stroke();

            ctx.fillStyle = '#0a0d18';
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size + 20, 68, 0, Math.PI * 2);
            ctx.fill();
        }
        // 2. MIDNIGHT CITY (M83)
        else if (track.title.includes("Midnight")) {
            const grad = ctx.createLinearGradient(x, y, x, y + size);
            grad.addColorStop(0, '#060719');
            grad.addColorStop(0.6, '#141438');
            grad.addColorStop(1, '#00c6ff');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, size, size);

            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 24; i++) {
                const sx = x + ((i * 37) % size);
                const sy = y + ((i * 23) % (size * 0.7));
                const sr = (i % 3 === 0) ? 2 : 1;
                ctx.beginPath();
                ctx.arc(sx, sy, sr, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#e0f7fa';
            ctx.beginPath();
            ctx.arc(x + size * 0.72, y + size * 0.32, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f112c';
            ctx.beginPath();
            ctx.arc(x + size * 0.67, y + size * 0.3, 21, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '800 22px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('M83', x + size / 2, y + 36);

            ctx.fillStyle = '#060714';
            ctx.beginPath();
            ctx.ellipse(x + size / 2, y + size + 15, size * 0.65, 48, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // 3. BLINDING LIGHTS (The Weeknd - After Hours)
        else if (track.title.includes("Blinding")) {
            const grad = ctx.createLinearGradient(x, y, x + size, y + size);
            grad.addColorStop(0, '#7f1d1d');
            grad.addColorStop(0.5, '#450a0a');
            grad.addColorStop(1, '#180202');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, size, size);

            ctx.strokeStyle = 'rgba(255, 65, 108, 0.4)';
            ctx.lineWidth = 1.5;
            for (let i = 1; i <= 5; i++) {
                ctx.beginPath();
                ctx.moveTo(x, y + size * 0.55 + i * 14);
                ctx.lineTo(x + size, y + size * 0.55 + i * 14);
                ctx.stroke();
            }

            ctx.fillStyle = '#ff4b2b';
            ctx.font = '800 20px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('AFTER HOURS', x + size / 2, y + 36);

            ctx.fillStyle = '#ff2a2a';
            ctx.beginPath();
            ctx.arc(x + size / 2, y + 110, 36, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.roundRect(x + size / 2 - 24, y + 102, 20, 10, 3);
            ctx.roundRect(x + size / 2 + 4, y + 102, 20, 10, 3);
            ctx.fill();
        }
        // 4. GET LUCKY (Daft Punk - Random Access Memories)
        else {
            const grad = ctx.createLinearGradient(x, y, x, y + size);
            grad.addColorStop(0, '#5f2b05');
            grad.addColorStop(0.6, '#381602');
            grad.addColorStop(1, '#150800');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, size, size);

            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size * 0.55, 48, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.arc(x + size / 2 - 32, y + size * 0.55, 26, Math.PI * 0.5, Math.PI * 1.5);
            ctx.fill();

            ctx.fillStyle = '#9ca3af';
            ctx.beginPath();
            ctx.arc(x + size / 2 + 32, y + size * 0.55, 26, Math.PI * 1.5, Math.PI * 0.5);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = '700 16px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DAFT PUNK', x + size / 2, y + 36);
        }

        // Reflejo de cristal
        const glassGrad = ctx.createLinearGradient(x, y, x + size, y + size);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        glassGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.03)');
        glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(x, y, size, size);

        ctx.restore();
    }

    // ==========================================
    // 2. MENÚ DE APPS ESTILO APPLE WATCH (Carrusel 1 app a la vez)
    // ==========================================
    renderAppMenu(ctx, w, h) {
        ctx.fillStyle = '#07080b';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '600 22px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('APPS', w / 2, 85);

        const appIndex = this.state.currentMenuAppIndex;
        const app = this.state.menuApps[appIndex];

        const cardY = 170;
        const iconSize = 180;
        const iconY = cardY + 50;

        // Íconos Propios Oficiales de Apple
        if (app.icon === 'music') {
            this.drawMusicAppIcon(ctx, w / 2, iconY + iconSize / 2, iconSize);
        } else if (app.icon === 'settings') {
            this.drawSettingsAppIcon(ctx, w / 2, iconY + iconSize / 2, iconSize);
        } else if (app.icon === 'findmy') {
            this.drawFindMyAppIcon(ctx, w / 2, iconY + iconSize / 2, iconSize);
        }

        // Título de la App
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(app.name, w / 2, iconY + iconSize + 65);

        // Subtítulo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font = '500 23px -apple-system, sans-serif';
        ctx.fillText(app.subtitle, w / 2, iconY + iconSize + 105);

        // Botón "Abrir"
        const btnW = 240;
        const btnH = 56;
        const btnX = (w - btnW) / 2;
        const btnY = iconY + iconSize + 140;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 28);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 22px -apple-system, sans-serif';
        ctx.fillText('Abrir', w / 2, btnY + 36);

        // Flechas laterales de navegación táctil
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '600 54px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('‹', 70, h / 2 + 10);
        ctx.fillText('›', w - 70, h / 2 + 10);

        // Puntos de paginación
        const dotY = h - 110;
        const totalApps = this.state.menuApps.length;
        const dotSpacing = 28;
        const startDotX = w / 2 - ((totalApps - 1) * dotSpacing) / 2;

        for (let i = 0; i < totalApps; i++) {
            const dx = startDotX + i * dotSpacing;
            if (i === appIndex) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(dx - 14, dotY - 4, 28, 8, 4);
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.beginPath();
                ctx.arc(dx, dotY, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '500 16px -apple-system, sans-serif';
        ctx.fillText('Desliza ◄ ► para cambiar de App', w / 2, dotY + 32);

        this.drawHomeBar(ctx, w, h);
    }

    drawMusicAppIcon(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx - size / 2, cy - size / 2);

        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#fa233b');
        grad.addColorStop(1, '#fb5c74');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, 42);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        const s = size / 100;
        ctx.translate(28 * s, 24 * s);

        ctx.beginPath();
        ctx.ellipse(8 * s, 42 * s, 8 * s, 6 * s, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(34 * s, 34 * s, 8 * s, 6 * s, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(13 * s, 40 * s);
        ctx.lineTo(13 * s, 8 * s);
        ctx.lineTo(39 * s, 2 * s);
        ctx.lineTo(39 * s, 32 * s);
        ctx.lineTo(35 * s, 32 * s);
        ctx.lineTo(35 * s, 8 * s);
        ctx.lineTo(17 * s, 13 * s);
        ctx.lineTo(17 * s, 40 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ÍCONO OFICIAL DE CONFIGURACIÓN DE APPLE (Engranaje Mecánico Preciso)
    drawSettingsAppIcon(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);

        // Fondo degradado gris titanio auténtico de Ajustes Apple
        const bgGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
        bgGrad.addColorStop(0, '#8e8e93');
        bgGrad.addColorStop(0.5, '#636366');
        bgGrad.addColorStop(1, '#3a3a3c');

        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, 42);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Corona de dientes de engranaje mecánico (8 dientes trapezoidales precisos)
        const teeth = 8;
        const outerR = size * 0.36;
        const innerR = size * 0.27;
        const toothHalfAngle = (Math.PI * 2) / (teeth * 3.8);

        ctx.fillStyle = '#e5e5ea';
        ctx.beginPath();

        for (let i = 0; i < teeth; i++) {
            const midAngle = (i * 2 * Math.PI) / teeth;
            const a1 = midAngle - toothHalfAngle * 1.5;
            const a2 = midAngle - toothHalfAngle * 0.8;
            const a3 = midAngle + toothHalfAngle * 0.8;
            const a4 = midAngle + toothHalfAngle * 1.5;

            // Raíz antes del diente
            ctx.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
            // Borde ascendente
            ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
            // Cresta del diente
            ctx.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
            // Borde descendente a la base
            ctx.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
        }
        ctx.closePath();
        ctx.fill();

        // Ranura circular de precisión en relieve
        ctx.strokeStyle = '#636366';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.19, 0, Math.PI * 2);
        ctx.stroke();

        // Orificio del eje central
        ctx.fillStyle = '#3a3a3c';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#aeaeb2';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawFindMyAppIcon(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);

        const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, size / 2);
        grad.addColorStop(0, '#00e676');
        grad.addColorStop(0.65, '#00c853');
        grad.addColorStop(1, '#057a32');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
        ctx.fill();

        const radarAngle = (performance.now() * 0.002) % (Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, size / 2 - 4, radarAngle, radarAngle + Math.PI * 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ==========================================
    // 3. APP: CONFIGURACIÓN (Brillo y Volumen 100% Funcionales)
    // ==========================================
    renderSettingsApp(ctx, w, h) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        // Botón < Menú en la esquina superior
        ctx.fillStyle = '#0a84ff';
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('‹ Menú', 70, 85);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Configuración', w / 2 + 20, 85);

        const cardW = 600;
        const cardX = (w - cardW) / 2;

        // Tarjeta 1: Brillo de Pantalla (TOTALMENTE FUNCIONAL)
        const bY = 140;
        const curBrightness = Math.round(this.state.screen.userBrightness || this.state.screen.brightness || 100);
        this.drawSettingsCard(ctx, cardX, bY, cardW, 140, 'Brillo de Pantalla', '☀️', `${curBrightness}%`);

        // Botones [-] y [+] de brillo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(cardX + 20, bY + 75, 75, 48, 14);
        ctx.roundRect(cardX + cardW - 95, bY + 75, 75, 48, 14);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 28px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('−', cardX + 57, bY + 108);
        ctx.fillText('+', cardX + cardW - 57, bY + 108);

        // Barra de brillo
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(cardX + 115, bY + 95, cardW - 230, 10, 5);
        ctx.fill();

        ctx.fillStyle = '#d97706'; // Ámbar de alto contraste
        ctx.beginPath();
        ctx.roundRect(cardX + 115, bY + 95, (cardW - 230) * (curBrightness / 100), 10, 5);
        ctx.fill();

        // Tarjeta 2: Volumen de Audio (TOTALMENTE FUNCIONAL)
        const vY = 300;
        const curVol = Math.round(this.state.audio.volume * 100);
        this.drawSettingsCard(ctx, cardX, vY, cardW, 140, 'Volumen de Audio', '🔊', `${curVol}%`);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(cardX + 20, vY + 75, 75, 48, 14);
        ctx.roundRect(cardX + cardW - 95, vY + 75, 75, 48, 14);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 28px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('−', cardX + 57, vY + 108);
        ctx.fillText('+', cardX + cardW - 57, vY + 108);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(cardX + 115, vY + 95, cardW - 230, 10, 5);
        ctx.fill();

        ctx.fillStyle = '#0a84ff';
        ctx.beginPath();
        ctx.roundRect(cardX + 115, vY + 95, (cardW - 230) * this.state.audio.volume, 10, 5);
        ctx.fill();

        // Tarjeta 3: Batería y Salud
        const batY = 460;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(cardX, batY, cardW, 120, 20);
        ctx.fill();

        ctx.fillStyle = '#34c759';
        ctx.font = '600 26px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🔋 Batería Litio-Ion', cardX + 24, batY + 45);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '500 20px -apple-system, sans-serif';
        ctx.fillText(`Nivel: ${Math.round(this.state.battery.level)}% • Salud química: 98% (Óptima)`, cardX + 24, batY + 85);

        // Tarjeta 4: Acerca del Gemelo Digital
        const infoY = 600;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(cardX, infoY, cardW, 130, 20);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('ℹ️ Acerca de Apple Shuffle', cardX + 24, infoY + 42);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '500 19px -apple-system, sans-serif';
        ctx.fillText('Modelo: Shuffle Touch (Fab Digital 2024)', cardX + 24, infoY + 76);
        ctx.fillText('Software: watchOS / iOS Core 17.5', cardX + 24, infoY + 106);

        this.drawHomeBar(ctx, w, h);
    }

    drawSettingsCard(ctx, x, y, w, h, title, icon, valueStr) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 20);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${icon}  ${title}`, x + 24, y + 42);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '600 22px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(valueStr, x + w - 24, y + 42);
    }

    // ==========================================
    // 4. APP: ENCONTRAR (Radar Apple Find My)
    // ==========================================
    renderFindMyApp(ctx, w, h) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#0a84ff';
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('‹ Menú', 70, 85);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Encontrar', w / 2 + 20, 85);

        const radarCenterY = 410;
        const now = performance.now() * 0.0015;

        [80, 160, 240, 310].forEach((rad, i) => {
            ctx.strokeStyle = `rgba(52, 199, 89, ${0.15 + i * 0.08})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(w / 2, radarCenterY, rad, 0, Math.PI * 2);
            ctx.stroke();
        });

        const pulseRad = (now * 110) % 310;
        const pulseAlpha = Math.max(0, 1 - pulseRad / 310);
        ctx.strokeStyle = `rgba(52, 199, 89, ${pulseAlpha * 0.8})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(w / 2, radarCenterY, pulseRad, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(52, 199, 89, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 310, radarCenterY);
        ctx.lineTo(w / 2 + 310, radarCenterY);
        ctx.moveTo(w / 2, radarCenterY - 310);
        ctx.lineTo(w / 2, radarCenterY + 310);
        ctx.stroke();

        ctx.fillStyle = '#34c759';
        ctx.beginPath();
        ctx.arc(w / 2, radarCenterY, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 32px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Apple Shuffle de Flex', w / 2, 670);

        ctx.fillStyle = '#34c759';
        ctx.font = '600 22px -apple-system, sans-serif';
        ctx.fillText('🟢 En esta ubicación • Muy cerca', w / 2, 715);

        const btnW = 380;
        const btnH = 64;
        const btnX = (w - btnW) / 2;
        const btnY = 770;

        ctx.fillStyle = '#34c759';
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 32);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = '700 24px -apple-system, sans-serif';
        ctx.fillText('🔊  Reproducir Sonido', w / 2, btnY + 41);

        this.drawHomeBar(ctx, w, h);
    }

    // Notificación Toast animada en forma de cápsula estilo Apple
    drawToastNotification(ctx, w, text) {
        ctx.save();
        const toastW = 380;
        const toastH = 46;
        const toastX = (w - toastW) / 2;
        const toastY = 38;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;

        ctx.fillStyle = 'rgba(28, 28, 30, 0.95)';
        ctx.beginPath();
        ctx.roundRect(toastX, toastY, toastW, toastH, 23);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 18px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, toastY + 29);
        ctx.restore();
    }

    // Dibuja la Barra Home inferior de iOS / watchOS
    drawHomeBar(ctx, w, h, hintText = '') {
        const barW = 190;
        const barH = 5.5;
        const barX = (w - barW) / 2;
        const barY = h - 35;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 2.75);
        ctx.fill();

        if (hintText) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.font = '500 15px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(hintText, w / 2, barY - 14);
        }
    }

    drawControlIcon(ctx, x, y, type) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (type === 'next') {
            ctx.moveTo(x - 14, y - 13);
            ctx.lineTo(x + 2, y);
            ctx.lineTo(x - 14, y + 13);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(x - 2, y - 13);
            ctx.lineTo(x + 14, y);
            ctx.lineTo(x - 2, y + 13);
            ctx.fill();
        } else if (type === 'prev') {
            ctx.moveTo(x + 14, y - 13);
            ctx.lineTo(x - 2, y);
            ctx.lineTo(x + 14, y + 13);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(x + 2, y - 13);
            ctx.lineTo(x - 14, y);
            ctx.lineTo(x + 2, y + 13);
            ctx.fill();
        }
    }

    drawAppleLogo(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        const scale = size / 24;
        ctx.scale(scale, scale);
        ctx.translate(-12, -12);

        const applePath = new Path2D(
            "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.56.64-1.05 1.71-.92 2.74 1.01.08 2.01-.5 2.61-1.23"
        );

        ctx.fillStyle = '#ffffff';
        ctx.fill(applePath);
        ctx.restore();
    }

    renderRipples(ctx) {
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += 3.5;
            r.alpha -= 0.04;

            if (r.alpha <= 0) {
                this.ripples.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}
