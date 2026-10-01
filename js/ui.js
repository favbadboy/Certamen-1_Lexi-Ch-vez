/**
 * Manejador de la Interfaz de Usuario (HUD y Paneles de Control)
 * Rúbrica Punto 4: Interacción, visualización y relación con el usuario
 * Muestra en tiempo real la telemetría, estados y permite simular condiciones externas
 */

export class UIManager {
    constructor(state, modelManager, cameraController) {
        this.state = state;
        this.modelManager = modelManager;
        this.cameraController = cameraController;

        this.initDOMElements();
        this.bindEvents();
        this.bindStateSubscriptions();
    }

    initDOMElements() {
        // Telemetría
        this.elPowerBadge = document.getElementById('valPowerState');
        this.elBatteryLevel = document.getElementById('valBatteryLevel');
        this.elBatteryBar = document.getElementById('barBattery');
        this.elTemperature = document.getElementById('valTemperature');
        this.elCpuLoad = document.getElementById('valCpuLoad');
        this.elAudioStatus = document.getElementById('valAudioStatus');
        this.elCurrentTrack = document.getElementById('valCurrentTrack');
        this.elHeadphonesBadge = document.getElementById('valHeadphones');

        // Controles de Simulación
        this.btnTogglePower = document.getElementById('btnTogglePower');
        this.btnToggleCharging = document.getElementById('btnToggleCharging');
        this.btnToggleHeadphones = document.getElementById('btnToggleHeadphones');
        this.sliderExploded = document.getElementById('sliderExploded');
        this.valExploded = document.getElementById('valExploded');

        // Consola de eventos
        this.consoleLogs = document.getElementById('consoleLogs');

        // Carga de Blender
        this.fileInputGlb = document.getElementById('fileInputGlb');
        this.selectScreenMesh = document.getElementById('selectScreenMesh');
        this.dropZone = document.getElementById('dropZone');
    }

    bindEvents() {
        // Botones de simulación física del gemelo
        if (this.btnTogglePower) {
            this.btnTogglePower.addEventListener('click', () => this.state.togglePower());
        }

        const btnSwipeUp = document.getElementById('btnSwipeUp');
        if (btnSwipeUp) {
            btnSwipeUp.addEventListener('click', () => this.state.swipeUp());
        }

        const btnSwipeLeft = document.getElementById('btnSwipeLeft');
        if (btnSwipeLeft) {
            btnSwipeLeft.addEventListener('click', () => this.state.swipeLeft());
        }

        const btnSwipeRight = document.getElementById('btnSwipeRight');
        if (btnSwipeRight) {
            btnSwipeRight.addEventListener('click', () => this.state.swipeRight());
        }

        if (this.btnToggleCharging) {
            this.btnToggleCharging.addEventListener('click', () => {
                this.state.toggleCharging();
                this.updateChargingButton();
            });
        }

        if (this.btnToggleHeadphones) {
            this.btnToggleHeadphones.addEventListener('click', () => {
                this.state.toggleHeadphones();
                this.updateHeadphonesButton();
            });
        }

        // Slider de Despiece Digital (Exploded View)
        if (this.sliderExploded) {
            this.sliderExploded.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (this.valExploded) this.valExploded.textContent = Math.round(val * 100) + '%';
                this.state.setExplodedView(val);
            });
        }

        // Vistas de Cámara
        document.querySelectorAll('[data-camera-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-camera-view');
                this.cameraController.setView(view);
                document.querySelectorAll('[data-camera-view]').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Pestañas del Panel Derecho
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.getAttribute('data-tab');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const target = document.getElementById(tabId);
                if (target) target.classList.add('active');
            });
        });

        // Carga de archivo Blender .GLB
        if (this.fileInputGlb) {
            this.fileInputGlb.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.handleBlenderFile(file);
            });
        }

        // Drag & Drop de archivo Blender
        if (this.dropZone) {
            window.addEventListener('dragover', (e) => e.preventDefault());
            window.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
                        this.handleBlenderFile(file);
                    }
                }
            });
        }

        // Cambio manual de malla de pantalla
        if (this.selectScreenMesh) {
            this.selectScreenMesh.addEventListener('change', (e) => {
                const selectedName = e.target.value;
                if (this.loadedMeshes) {
                    const mesh = this.loadedMeshes.find(m => m.name === selectedName);
                    if (mesh) {
                        this.modelManager.assignScreenMesh(mesh);
                        this.state.log('BLENDER', 'Pantalla reasignada a: "' + mesh.name + '"');
                    }
                }
            });
        }
    }

    handleBlenderFile(file) {
        this.state.log('FILE', 'Cargando archivo de Blender: ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)');
        const reader = new FileReader();
        reader.onload = (event) => {
            const arrayBuffer = event.target.result;
            this.modelManager.loadBlenderModel(
                arrayBuffer,
                null,
                ({ meshes, screenMesh }) => {
                    this.loadedMeshes = meshes;
                    this.state.log('SUCCESS', 'Modelo de Blender cargado e integrado correctamente al Gemelo Digital');
                    this.populateMeshSelector(meshes, screenMesh);
                },
                (error) => {
                    this.state.log('ERROR', 'Error al procesar modelo de Blender', error.message);
                }
            );
        };
        reader.readAsArrayBuffer(file);
    }

    populateMeshSelector(meshes, activeScreenMesh) {
        if (!this.selectScreenMesh) return;
        this.selectScreenMesh.innerHTML = '';
        meshes.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name + (m === activeScreenMesh ? ' (Pantalla Asignada)' : '');
            if (m === activeScreenMesh) opt.selected = true;
            this.selectScreenMesh.appendChild(opt);
        });
        const container = document.getElementById('meshSelectorContainer');
        if (container) container.style.display = 'block';
    }

    bindStateSubscriptions() {
        // Telemetría continua
        this.state.on('telemetryTick', (data) => {
            this.updateTelemetryUI(data);
        });

        // Cambios de energía
        this.state.on('powerChange', (power) => {
            if (this.elPowerBadge) {
                this.elPowerBadge.textContent = power;
                this.elPowerBadge.className = 'badge ' + (power === 'ON' ? 'badge-green' : power === 'BOOTING' ? 'badge-yellow' : 'badge-red');
            }
            if (this.btnTogglePower) {
                this.btnTogglePower.textContent = power === 'OFF' ? '⚡ Encender' : '⏸ Apagar / Reposo';
            }
        });

        // Registro de eventos en la consola del Gemelo Digital
        this.state.on('log', (logEntry) => {
            this.appendConsoleLog(logEntry);
        });
    }

    updateTelemetryUI(data) {
        if (this.elBatteryLevel) {
            this.elBatteryLevel.textContent = Math.round(data.battery.level) + '% (' + data.battery.voltage.toFixed(2) + 'V)';
        }
        if (this.elBatteryBar) {
            this.elBatteryBar.style.width = data.battery.level + '%';
            if (data.battery.isCharging) {
                this.elBatteryBar.style.backgroundColor = '#34c759';
            } else if (data.battery.level <= 20) {
                this.elBatteryBar.style.backgroundColor = '#ff3b30';
            } else {
                this.elBatteryBar.style.backgroundColor = '#0a84ff';
            }
        }

        if (this.elTemperature) {
            this.elTemperature.textContent = data.hardware.temperature.toFixed(1) + ' °C';
        }
        if (this.elCpuLoad) {
            this.elCpuLoad.textContent = Math.round(data.hardware.cpuLoad) + '%';
        }
        if (this.elAudioStatus) {
            this.elAudioStatus.textContent = data.audio.isPlaying ? 'Reproduciendo (DAC activo)' : 'En espera';
            this.elAudioStatus.className = data.audio.isPlaying ? 'status-active' : 'status-idle';
        }
        if (this.elCurrentTrack) {
            const track = this.state.getCurrentTrack();
            this.elCurrentTrack.textContent = track.title + ' - ' + track.artist;
        }
    }

    updateChargingButton() {
        if (!this.btnToggleCharging) return;
        if (this.state.battery.isCharging) {
            this.btnToggleCharging.classList.add('active');
            this.btnToggleCharging.textContent = '🔌 Desconectar Cargador';
        } else {
            this.btnToggleCharging.classList.remove('active');
            this.btnToggleCharging.textContent = '⚡ Conectar Cargador';
        }
    }

    updateHeadphonesButton() {
        if (!this.btnToggleHeadphones) return;
        if (this.state.hardware.headphonesConnected) {
            this.btnToggleHeadphones.classList.add('active');
            this.btnToggleHeadphones.textContent = '🎧 Desconectar Auriculares';
            if (this.elHeadphonesBadge) this.elHeadphonesBadge.textContent = 'Conectado (3.5mm)';
        } else {
            this.btnToggleHeadphones.classList.remove('active');
            this.btnToggleHeadphones.textContent = '🎧 Conectar Auriculares';
            if (this.elHeadphonesBadge) this.elHeadphonesBadge.textContent = 'Desconectado';
        }
    }

    appendConsoleLog(entry) {
        if (!this.consoleLogs) return;
        const line = document.createElement('div');
        line.className = 'log-entry log-' + entry.tipo.toLowerCase();

        let badgeClass = 'log-tag ';
        if (entry.tipo === 'INPUT') badgeClass += 'tag-input';
        else if (entry.tipo === 'STATE') badgeClass += 'tag-state';
        else if (entry.tipo === 'DECISION') badgeClass += 'tag-decision';
        else if (entry.tipo === 'ERROR' || entry.tipo === 'ALERT') badgeClass += 'tag-alert';
        else badgeClass += 'tag-info';

        line.innerHTML = `
            <span class="log-time">${entry.time}</span>
            <span class="${badgeClass}">${entry.tipo}</span>
            <span class="log-msg">${entry.mensaje}</span>
            ${entry.detalle ? `<span class="log-detail">${entry.detalle}</span>` : ''}
        `;

        this.consoleLogs.insertBefore(line, this.consoleLogs.firstChild);
        if (this.consoleLogs.children.length > 30) {
            this.consoleLogs.removeChild(this.consoleLogs.lastChild);
        }
    }
}
