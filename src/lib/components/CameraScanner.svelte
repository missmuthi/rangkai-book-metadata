<script lang="ts">
        import { browser } from '$app/environment';
        import { createEventDispatcher, onMount } from 'svelte';
        import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';

        export let active = true;

        const dispatch = createEventDispatcher<{
                scan: { text: string };
                status: { active: boolean; online?: boolean };
        }>();

        let scanner: Html5Qrcode | null = null;
        let scannerModule: typeof import('html5-qrcode') | null = null;
        let isScanning = false;
        let isStarting = false;
        let facingMode: 'environment' | 'user' = 'environment';
        let statusMessage = 'Initializing camera...';
        let errorMessage: string | null = null;
        let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;
        let isOnline = browser ? navigator.onLine : true;

	const scanConfig: Html5QrcodeCameraScanConfig = {
		fps: 10,
		qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
			const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
			const size = Math.max(180, Math.min(320, Math.floor(minEdge * 0.65)));

			return { width: size, height: size };
		}
	};        onMount(() => {
                const cleanupNetworkListeners = setupNetworkListeners();
                startIfNeeded();

                return () => {
                        cleanupNetworkListeners();
                        teardown();
                };
        });

        $: if (active) {
                startIfNeeded();
        } else {
                stopScanning();
        }

        async function loadScanner(): Promise<Html5Qrcode | null> {
                if (!browser) {
                        return null;
                }

                if (!scannerModule) {
                        scannerModule = await import('html5-qrcode');
                }

                if (!scanner) {
                        const { Html5Qrcode } = scannerModule;
                        scanner = new Html5Qrcode('camera-viewfinder');
                }

                return scanner;
        }

        async function startIfNeeded() {
                if (!active || isScanning || isStarting) {
                        return;
                }

                const instance = await loadScanner();
                if (!instance) {
                        return;
                }

                isStarting = true;
                errorMessage = null;
                statusMessage = 'Starting camera...';

                try {
                        await instance.start(
                                { facingMode },
                                scanConfig,
                                handleScanSuccess,
                                handleScanError
                        );
                        isScanning = true;
                        statusMessage = 'Camera active';
                        dispatch('status', { active: true, online: isOnline });
                } catch (err) {
                        let message = err instanceof Error ? err.message : 'Unable to start camera';

                        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
                                message = 'Camera permission denied. Please allow camera access to scan.';
                        }

                        errorMessage = message;
                        statusMessage = 'Camera unavailable';
                } finally {
                        isStarting = false;
                }
        }

        async function stopScanning() {
                if (!scanner || !isScanning) {
                        return;
                }

                try {
                        await scanner.stop();
                        isScanning = false;
                        statusMessage = 'Camera stopped';
                        dispatch('status', { active: false, online: isOnline });
                } catch (_err) {
                        // Ignore stop errors
                }
        }

        async function teardown() {
                if (cooldownTimeout) {
                        clearTimeout(cooldownTimeout);
                        cooldownTimeout = null;
                }

                await stopScanning();

                if (scanner) {
                        try {
                                await scanner.clear();
                        } catch (_err) {
                                // Ignore clear errors
                        }
                        scanner = null;
                }
        }

        async function switchCamera() {
                facingMode = facingMode === 'environment' ? 'user' : 'environment';
                statusMessage = 'Switching camera...';
                await restartScanner();
        }

        async function restartScanner() {
                await stopScanning();

                if (active) {
                        await startIfNeeded();
                }
        }

        function handleScanSuccess(decodedText: string) {
                const text = decodedText.trim();

                if (!text) {
                        return;
                }

                playBeep();
                dispatch('scan', { text });
                pauseAfterScan();
        }

        function handleScanError(_error: string) {
                // Ignored: per-frame decode errors are expected during scanning
        }

        function pauseAfterScan() {
                if (cooldownTimeout) {
                        clearTimeout(cooldownTimeout);
                }

                stopScanning();
                statusMessage = 'Processing scan...';

                cooldownTimeout = setTimeout(() => {
                        if (active) {
                                startIfNeeded();
                        }
                }, 3000);
        }

        function playBeep() {
                try {
                        const context = new AudioContext();
                        const oscillator = context.createOscillator();
                        const gain = context.createGain();

                        oscillator.type = 'sine';
                        oscillator.frequency.value = 880;
                        gain.gain.value = 0.1;

                        oscillator.connect(gain);
                        gain.connect(context.destination);

                        oscillator.start();
                        oscillator.stop(context.currentTime + 0.15);
                } catch (_err) {
                        // Audio unavailable - ignore
                }
        }

        function setupNetworkListeners() {
                if (!browser) {
                        return () => {};
                }

                const updateOnlineStatus = () => {
                        isOnline = navigator.onLine;
                        if (!isOnline) {
                                statusMessage = 'Offline — camera ready when connection returns';
                        }
                        dispatch('status', { active: isScanning, online: isOnline });
                };

                window.addEventListener('online', updateOnlineStatus);
                window.addEventListener('offline', updateOnlineStatus);
                updateOnlineStatus();

                return () => {
                        window.removeEventListener('online', updateOnlineStatus);
                        window.removeEventListener('offline', updateOnlineStatus);
                };
        }
</script>

<div class="space-y-4">
        <div
                class="relative overflow-hidden rounded-xl bg-black shadow-lg"
                role="region"
                aria-label="Camera scanner viewfinder"
        >
                <div id="camera-viewfinder" class="aspect-[3/4] w-full"></div>

                {#if !isOnline}
                        <div class="absolute right-2 top-2 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-amber-50 shadow">
                                🔌 Offline Mode
                        </div>
                {/if}

                {#if !active}
                        <div class="absolute inset-0 flex items-center justify-center bg-black/70 text-white">Camera paused</div>
                {/if}
        </div>

        <div class="flex flex-wrap gap-2">
                <button
                        type="button"
                        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        on:click={() => {
                                active = false;
                                stopScanning();
                        }}
                        disabled={!isScanning && !isStarting}
                        aria-label="Stop camera scanning"
                        title="Stop camera scanning"
                >
                        ⏸️ Stop
                </button>
                <button
                        type="button"
                        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        on:click={switchCamera}
                        disabled={isStarting}
                        aria-label="Switch camera"
                        title="Switch camera"
                >
                        🔄 Switch
                </button>
                <button
                        type="button"
                        class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        on:click={() => {
                                active = true;
                                startIfNeeded();
                        }}
                        disabled={isScanning || isStarting}
                        aria-label="Resume camera scanning"
                        title="Resume camera scanning"
                >
                        ▶️ Resume
                </button>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                {#if errorMessage}
                        <p class="text-sm font-semibold text-red-600" role="alert" aria-live="assertive">{errorMessage}</p>
                {:else}
                        <p class="text-sm text-slate-700" role="status" aria-live="polite">{statusMessage}</p>
                        <p class="mt-1 text-xs text-slate-500">Rear camera is used for faster ISBN scanning.</p>
                {/if}
        </div>
</div>
