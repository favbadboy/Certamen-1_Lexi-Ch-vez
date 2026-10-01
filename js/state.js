/**
 * Gemelo Digital - Gestor de Estados, Datos y Lógica del Sistema
 * Rúbrica Punto 2: Datos, variables y estados del Gemelo Digital
 * Rúbrica Punto 3: Lógica de funcionamiento y respuesta del sistema
 */

export const PowerStates = {
    OFF: 'OFF',
    BOOTING: 'BOOTING',
    ON: 'ON',
    SHUTTING_DOWN: 'SHUTTING_DOWN'
};

export const ScreenViews = {
    MUSIC: 'MUSIC',
    APP_MENU: 'APP_MENU',
    SETTINGS: 'SETTINGS',
    FIND_MY: 'FIND_MY'
};

export class DigitalTwinState {
    constructor() {
        // --- 1. Variables de Estado Global ---
        this.powerState = PowerStates.OFF;
        this.currentView = ScreenViews.MUSIC;
        this.currentMenuAppIndex = 0; // Índice de carrusel de apps estilo Apple Watch
        this.menuApps = [
            { id: ScreenViews.MUSIC, name: 'Música', icon: 'music', subtitle: 'Reproductor de Audio' },
            { id: ScreenViews.SETTINGS, name: 'Configuración', icon: 'settings', subtitle: 'Ajustes del Sistema' },
            { id: ScreenViews.FIND_MY, name: 'Encontrar', icon: 'findmy', subtitle: 'Buscar Dispositivos' }
        ];
        this.bootProgress = 0; // 0 a 100% durante arranque

        // --- 2. Variables de Hardware y Telemetría ---
        this.battery = {
            level: 84, // Porcentaje 0 - 100
            isCharging: false,
            health: 98, // Porcentaje de salud química
            drainRate: 0.05, // % por segundo
            voltage: 3.82 // Voltios
        };

        this.screen = {
            brightness: 0, // 0 a 100%
            targetBrightness: 0,
            userBrightness: 100, // Nivel de brillo establecido en Ajustes (15% a 100%)
            autoBrightness: false,
            resolution: { width: 1024, height: 1024 }
        };

        this.hardware = {
            temperature: 27.4, // Grados Celsius
            cpuLoad: 8, // Porcentaje de uso CPU
            ramUsed: 42, // MB utilizados de 128MB
            headphonesConnected: false,
            clipAngle: 0 // Grados de apertura del clip
        };

        this.explodedView = 0; // 0.0 (ensamblado) a 1.0 (despiece total)

        // --- 3. Datos de Audio y Multimedia (estilo Apple Music watchOS) ---
        this.audio = {
            isPlaying: false,
            volume: 0.75, // 0.0 a 1.0
            currentTime: 42, // Segundos
            shuffle: false, // Modo Aleatorio (🔀)
            repeat: 'OFF', // Modo Repetición ('OFF' | 'ALL' | 'ONE' 🔁)
            autoplay: true, // Modo Autoplay continuo (♾️)
            airplayOutput: 'AirPods Pro de Flex', // Salida Airplay activa
            isQueueOpen: false, // Fila / Cola de reproducción activa
            tracks: [
                {
                    title: "Starboy",
                    artist: "The Weeknd ft. Daft Punk",
                    album: "Starboy (Deluxe)",
                    duration: 230,
                    coverColor1: "#ff0077",
                    coverColor2: "#7700ff"
                },
                {
                    title: "Midnight City",
                    artist: "M83",
                    album: "Hurry Up, We're Dreaming",
                    duration: 244,
                    coverColor1: "#00c6ff",
                    coverColor2: "#0072ff"
                },
                {
                    title: "Blinding Lights",
                    artist: "The Weeknd",
                    album: "After Hours",
                    duration: 200,
                    coverColor1: "#ff416c",
                    coverColor2: "#ff4b2b"
                },
                {
                    title: "Get Lucky",
                    artist: "Daft Punk ft. Pharrell",
                    album: "Random Access Memories",
                    duration: 248,
                    coverColor1: "#8a4500",
                    coverColor2: "#422000"
                }
            ],
            currentTrackIndex: 0
        };

        // Sistema de notificaciones Toast dinámicas (estilo Apple pill)
        this.activeToast = null;
        this.toastTimer = null;

        // --- 4. Sistema de Suscripciones y Logs ---
        this.listeners = new Map();
        this.eventLogs = [];
        this.lastUpdateTime = performance.now();

        // Iniciar loop de simulación física del gemelo digital
        this.startSimulationLoop();
    }

    // Suscripción a eventos
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, payload) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(payload));
        }
    }

    // Registro de eventos para la Consola del Gemelo Digital (Rúbrica Puntos 3 y 4)
    log(tipo, mensaje, detalle = '') {
        const timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');
        const entry = { time: timeStr, tipo, mensaje, detalle };
        this.eventLogs.unshift(entry);
        if (this.eventLogs.length > 50) this.eventLogs.pop();
        this.emit('log', entry);
    }

    // --- LÓGICA DE FUNCIONAMIENTO (Rúbrica Punto 3) ---
    // Entrada -> Interpretación -> Decisión -> Estado -> Respuesta

    // 1. Tocar la pantalla (Interacción directa en el modelo 3D)
    touchScreen(uvX, uvY) {
        if (this.powerState === PowerStates.OFF) {
            // Pantalla en reposo apagada: sólo responde a pulsación prolongada en el botón físico
            return;
        }

        if (this.powerState === PowerStates.BOOTING || this.powerState === PowerStates.SHUTTING_DOWN) {
            return;
        }

        // Si está encendido, delegar el toque a la interfaz interactiva de la pantalla
        this.emit('screenTouch', { x: uvX, y: uvY });
    }

    // Gestos Táctiles (Gesto Home Swipe Up y Navegación Horizontal Swipe Left / Right)
    swipeUp() {
        if (this.powerState !== PowerStates.ON) return;

        if (this.currentView !== ScreenViews.APP_MENU) {
            this.currentView = ScreenViews.APP_MENU;
            this.log('GESTURE', 'Swipe hacia arriba (Gesto Home) -> Abriendo Menú de Apps estilo watchOS');
            this.emit('viewChange', this.currentView);
        } else {
            // Si ya está en el menú, abrir la app actualmente seleccionada
            const activeApp = this.menuApps[this.currentMenuAppIndex];
            this.openApp(activeApp.id);
        }
    }

    swipeLeft() {
        if (this.powerState !== PowerStates.ON) return;

        if (this.currentView === ScreenViews.APP_MENU) {
            this.currentMenuAppIndex = (this.currentMenuAppIndex + 1) % this.menuApps.length;
            const app = this.menuApps[this.currentMenuAppIndex];
            this.log('GESTURE', 'Swipe a la izquierda -> App: ' + app.name);
            this.emit('menuIndexChange', this.currentMenuAppIndex);
        } else if (this.currentView === ScreenViews.MUSIC) {
            this.nextTrack();
        }
    }

    swipeRight() {
        if (this.powerState !== PowerStates.ON) return;

        if (this.currentView === ScreenViews.APP_MENU) {
            this.currentMenuAppIndex = (this.currentMenuAppIndex - 1 + this.menuApps.length) % this.menuApps.length;
            const app = this.menuApps[this.currentMenuAppIndex];
            this.log('GESTURE', 'Swipe a la derecha -> App: ' + app.name);
            this.emit('menuIndexChange', this.currentMenuAppIndex);
        } else if (this.currentView === ScreenViews.MUSIC) {
            this.prevTrack();
        }
    }

    openApp(appId) {
        if (this.powerState !== PowerStates.ON) return;
        this.currentView = appId;
        const appObj = this.menuApps.find(a => a.id === appId);
        const name = appObj ? appObj.name : appId;
        this.log('ACTION', 'Lanzando aplicación: ' + name);
        this.emit('viewChange', this.currentView);
    }

    triggerFindMyPing() {
        if (this.powerState !== PowerStates.ON) return;
        this.log('ACTION', 'Encontrar: Emitiendo señal sonora y baliza Ultra Wideband');
        this.emit('findMyPing');
    }

    // 2. Encender el dispositivo (sólo por botón físico > 3s)
    turnOn() {
        if (this.battery.level <= 0) {
            this.log('ERROR', 'Intento de encendido denegado: Batería descargada (0%)');
            return;
        }

        if (this.powerState !== PowerStates.OFF) return;

        this.powerState = PowerStates.BOOTING;
        this.bootProgress = 0;
        this.screen.targetBrightness = this.screen.userBrightness || 100;
        this.screen.brightness = this.screen.userBrightness || 100;
        this.log('STATE', 'POWER_OFF -> BOOTING', 'Iniciando Kernel y controladores de pantalla');
        this.emit('powerChange', this.powerState);
        this.emit('brightnessChange', this.screen.brightness);

        // Simular secuencia de arranque con logo de Apple
        const bootInterval = setInterval(() => {
            this.bootProgress += 20;
            this.hardware.cpuLoad = 45;
            this.hardware.temperature += 0.2;
            this.emit('bootProgress', this.bootProgress);

            if (this.bootProgress >= 100) {
                clearInterval(bootInterval);
                this.powerState = PowerStates.ON;
                this.hardware.cpuLoad = 12;
                this.screen.brightness = this.screen.userBrightness || 100;
                this.log('STATE', 'BOOTING -> POWER_ON', 'Sistema listo. Interfaz activa (estilo watchOS/iOS)');
                this.emit('powerChange', this.powerState);
                this.emit('brightnessChange', this.screen.brightness);
            }
        }, 150);
    }

    // 3. Apagar el dispositivo (Botón físico o reposo)
    // Secuencia de Apagado por pulsación prolongada (> 3s)
    startShutdownSequence() {
        if (this.powerState === PowerStates.OFF || this.powerState === PowerStates.SHUTTING_DOWN) return;

        this.log('INPUT', 'Pulsación prolongada (> 3s) en botón exterior');
        this.log('STATE', 'POWER_ON -> SHUTTING_DOWN', 'Iniciando secuencia: "Apagando dispositivo"');
        this.powerState = PowerStates.SHUTTING_DOWN;
        this.audio.isPlaying = false;
        this.emit('powerChange', this.powerState);
        this.emit('audioChange', this.audio);

        // Mostrar pantalla de apagado con logo de Apple y apagar completamente tras 2.5 segundos
        setTimeout(() => {
            this.powerState = PowerStates.OFF;
            this.currentView = ScreenViews.MUSIC;
            this.screen.targetBrightness = 0;
            this.screen.brightness = 0;
            this.hardware.cpuLoad = 2;
            this.log('STATE', 'SHUTTING_DOWN -> POWER_OFF', 'Dispositivo apagado en reposo (pantalla negra OLED)');
            this.emit('powerChange', this.powerState);
            this.emit('brightnessChange', 0);
        }, 2500);
    }

    // 4. Apagar inmediatamente (comando de reposo)
    turnOff() {
        this.startShutdownSequence();
    }

    // 5. Alternar Encendido / Apagado
    togglePower() {
        if (this.powerState === PowerStates.OFF) {
            this.turnOn();
        } else {
            this.startShutdownSequence();
        }
    }

    // 5. Control de Reproducción de Música
    togglePlayPause() {
        if (this.powerState !== PowerStates.ON) return;

        this.audio.isPlaying = !this.audio.isPlaying;
        const accion = this.audio.isPlaying ? 'REPRODUCIENDO' : 'PAUSADO';
        this.log('INPUT', 'Pulsador Multimedia: ' + accion);
        this.log('DECISION', this.audio.isPlaying ? 'Activar decodificador de audio y consumo dinámico' : 'Pausar stream de audio');
        this.emit('audioChange', this.audio);
    }

    // Modo Aleatorio (🔀 Shuffle)
    toggleShuffle() {
        if (this.powerState !== PowerStates.ON) return;
        this.audio.shuffle = !this.audio.shuffle;
        const stateStr = this.audio.shuffle ? 'Activado' : 'Desactivado';
        this.log('INPUT', 'Modo Aleatorio (Shuffle): ' + stateStr);
        this.showToast(`Aleatorio: ${stateStr}`);
        this.emit('audioChange', this.audio);
    }

    // Modo Repetición (🔁 Repeat: OFF -> ALL -> ONE)
    toggleRepeat() {
        if (this.powerState !== PowerStates.ON) return;
        const modes = ['OFF', 'ALL', 'ONE'];
        const currentIdx = modes.indexOf(this.audio.repeat);
        this.audio.repeat = modes[(currentIdx + 1) % modes.length];
        const labels = { OFF: 'Desactivado', ALL: 'Repetir todo', ONE: 'Repetir 1 canción' };
        this.log('INPUT', 'Modo Repetición: ' + labels[this.audio.repeat]);
        this.showToast(`Repetición: ${labels[this.audio.repeat]}`);
        this.emit('audioChange', this.audio);
    }

    // Modo Autoplay Infinito (♾️)
    toggleAutoplay() {
        if (this.powerState !== PowerStates.ON) return;
        this.audio.autoplay = !this.audio.autoplay;
        const stateStr = this.audio.autoplay ? 'Activado' : 'Desactivado';
        this.log('INPUT', 'Modo Autoplay: ' + stateStr);
        this.showToast(`Autoplay: ${stateStr}`);
        this.emit('audioChange', this.audio);
    }

    // Salida Airplay (Audio Output Destination)
    cycleAirplayOutput() {
        if (this.powerState !== PowerStates.ON) return;
        const outputs = ['AirPods Pro de Flex', 'Shuffle Altavoz', 'iPhone de Flex'];
        const currentIdx = outputs.indexOf(this.audio.airplayOutput);
        this.audio.airplayOutput = outputs[(currentIdx + 1) % outputs.length];
        this.log('ACTION', 'Salida AirPlay cambiada a: ' + this.audio.airplayOutput);
        this.showToast(`AirPlay: ${this.audio.airplayOutput}`);
        this.emit('airplayChange', this.audio.airplayOutput);
        this.emit('audioChange', this.audio);
    }

    // Fila / Cola de Reproducción (Up Next)
    toggleQueue() {
        if (this.powerState !== PowerStates.ON) return;
        this.audio.isQueueOpen = !this.audio.isQueueOpen;
        this.log('ACTION', this.audio.isQueueOpen ? 'Abriendo Fila de Reproducción' : 'Cerrando Fila de Reproducción');
        this.emit('queueChange', this.audio.isQueueOpen);
    }

    playTrack(index) {
        if (this.powerState !== PowerStates.ON) return;
        this.audio.currentTrackIndex = (index + this.audio.tracks.length) % this.audio.tracks.length;
        this.audio.currentTime = 0;
        this.audio.isPlaying = true;
        this.audio.isQueueOpen = false;
        this.log('ACTION', 'Reproduciendo desde Fila: ' + this.getCurrentTrack().title);
        this.showToast(`Reproduciendo: ${this.getCurrentTrack().title}`);
        this.emit('audioChange', this.audio);
    }

    nextTrack() {
        if (this.powerState !== PowerStates.ON) return;

        // Si repetir 1 canción está activo
        if (this.audio.repeat === 'ONE') {
            this.audio.currentTime = 0;
            this.log('ACTION', 'Repitiendo canción: ' + this.getCurrentTrack().title);
            this.emit('audioChange', this.audio);
            return;
        }

        // Si aleatorio está activo
        if (this.audio.shuffle && this.audio.tracks.length > 1) {
            let nextIdx;
            do {
                nextIdx = Math.floor(Math.random() * this.audio.tracks.length);
            } while (nextIdx === this.audio.currentTrackIndex);
            this.audio.currentTrackIndex = nextIdx;
        } else {
            this.audio.currentTrackIndex = (this.audio.currentTrackIndex + 1) % this.audio.tracks.length;
        }

        this.audio.currentTime = 0;
        this.log('ACTION', 'Pista siguiente seleccionada: ' + this.getCurrentTrack().title);
        this.emit('audioChange', this.audio);
    }

    prevTrack() {
        if (this.powerState !== PowerStates.ON) return;
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
        } else {
            this.audio.currentTrackIndex = (this.audio.currentTrackIndex - 1 + this.audio.tracks.length) % this.audio.tracks.length;
            this.audio.currentTime = 0;
        }
        this.log('ACTION', 'Pista anterior seleccionada: ' + this.getCurrentTrack().title);
        this.emit('audioChange', this.audio);
    }

    setVolume(value) {
        this.audio.volume = Math.max(0, Math.min(1, value));
        this.log('INPUT', 'Ajuste de volumen: ' + Math.round(this.audio.volume * 100) + '%');
        this.emit('volumeChange', this.audio.volume);
    }

    // Ajuste funcional de brillo de pantalla (15% a 100%)
    setBrightness(value) {
        const clamped = Math.max(15, Math.min(100, Math.round(value)));
        this.screen.userBrightness = clamped;
        this.screen.targetBrightness = clamped;
        this.screen.brightness = clamped;
        this.log('INPUT', 'Ajuste de brillo de pantalla: ' + clamped + '%');
        this.emit('brightnessChange', clamped);
        this.emit('telemetryTick', {
            screen: this.screen,
            battery: this.battery,
            hardware: this.hardware,
            audio: this.audio
        });
    }

    seekAudio(progress) {
        if (this.powerState !== PowerStates.ON) return;
        const track = this.getCurrentTrack();
        this.audio.currentTime = Math.max(0, Math.min(track.duration, progress * track.duration));
        this.log('INPUT', 'Salto temporal en pista: ' + Math.round(this.audio.currentTime) + 's');
        this.emit('audioChange', this.audio);
    }

    getCurrentTrack() {
        return this.audio.tracks[this.audio.currentTrackIndex];
    }

    // Notificaciones temporales tipo pill en la parte superior
    showToast(message, duration = 2200) {
        this.activeToast = message;
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.activeToast = null;
            this.toastTimer = null;
        }, duration);
    }

    // 6. Conectar / Desconectar Cargador (Entrada Externa)
    toggleCharging() {
        this.battery.isCharging = !this.battery.isCharging;
        const msg = this.battery.isCharging ? 'Cargador conectado (+5V USB-C/Dock)' : 'Cargador desconectado';
        this.log('TELEMETRY', msg);
        this.emit('batteryChange', this.battery);
    }

    // 7. Conectar / Desconectar Auriculares Físicos
    toggleHeadphones() {
        this.hardware.headphonesConnected = !this.hardware.headphonesConnected;
        const msg = this.hardware.headphonesConnected ? 'Jack 3.5mm: Auriculares detectados' : 'Jack 3.5mm: Desconectado';
        this.log('HARDWARE', msg);
        this.emit('hardwareChange', this.hardware);
    }

    // 8. Ajustar Despiece Digital (Rúbrica Punto 1 - Jerarquía y Partes)
    setExplodedView(factor) {
        this.explodedView = Math.max(0, Math.min(1, factor));
        this.emit('explodedViewChange', this.explodedView);
    }

    // --- BUCLE DE SIMULACIÓN FÍSICA Y TELEMETRÍA (Digital Twin Engine) ---
    startSimulationLoop() {
        setInterval(() => {
            const now = performance.now();
            const dt = (now - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = now;

            this.updatePhysicsAndTelemetry(dt);
        }, 200); // 5Hz actualización de telemetría interna
    }

    updatePhysicsAndTelemetry(dt) {
        // Suavizado del brillo de pantalla
        const brightnessDiff = this.screen.targetBrightness - this.screen.brightness;
        this.screen.brightness += brightnessDiff * Math.min(1, dt * 10);

        // 1. Lógica de consumo de Batería
        if (this.battery.isCharging) {
            this.battery.level = Math.min(100, this.battery.level + 0.6 * dt);
            this.battery.voltage = 4.15;
            this.hardware.temperature = Math.min(36.0, this.hardware.temperature + 0.15 * dt);
        } else {
            // Tasa de descarga según estado
            let currentDrain = 0.005; // Descarga base en standby (OFF)
            if (this.powerState === PowerStates.ON) {
                currentDrain += 0.04 * (this.screen.brightness / 100); // Consumo de pantalla OLED
                if (this.audio.isPlaying) {
                    currentDrain += 0.06 * (0.5 + this.audio.volume * 0.5); // Consumo DAC y amplificador
                }
            }
            this.battery.drainRate = currentDrain;
            this.battery.level = Math.max(0, this.battery.level - currentDrain * dt);
            this.battery.voltage = 3.6 + (this.battery.level / 100) * 0.55;

            // Apagado automático por batería agotada
            if (this.battery.level <= 0 && this.powerState !== PowerStates.OFF) {
                this.log('ALERT', 'Batería Crítica 0%: Ejecutando apagado forzado de emergencia');
                this.turnOff();
            }
        }

        // 2. Progreso de audio
        if (this.powerState === PowerStates.ON && this.audio.isPlaying) {
            const track = this.getCurrentTrack();
            this.audio.currentTime += dt;
            if (this.audio.currentTime >= track.duration) {
                this.nextTrack();
            }
            this.hardware.cpuLoad = 18 + Math.sin(now => performance.now() * 0.002) * 5;
            this.hardware.temperature = Math.min(33.5, this.hardware.temperature + 0.05 * dt);
        } else if (this.powerState === PowerStates.ON) {
            this.hardware.cpuLoad = 8;
            this.hardware.temperature = Math.max(26.0, this.hardware.temperature - 0.04 * dt);
        } else {
            this.hardware.cpuLoad = 2;
            this.hardware.temperature = Math.max(24.0, this.hardware.temperature - 0.08 * dt);
        }

        // Emitir actualización de telemetría a la interfaz
        this.emit('telemetryTick', {
            battery: this.battery,
            hardware: this.hardware,
            screen: this.screen,
            audio: this.audio,
            powerState: this.powerState
        });
    }
}
