<script lang="ts">
        import { browser } from '$app/environment';
        import { createEventDispatcher, onMount } from 'svelte';
        import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';

        export let active = true;

        const dispatch = createEventDispatcher<{
                scan: { text: string };
                status: { active: boolean };
        }>();

        let scanner: Html5Qrcode | null = null;
        let scannerModule: typeof import('html5-qrcode') | null = null;
        let isScanning = false;
        let isStarting = false;
        let statusMessage = 'Initializing camera...';
        let errorMessage: string | null = null;
        let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;

        const scanConfig: Html5QrcodeCameraScanConfig = {
                fps: 10,
                qrbox: { width: 260, height: 260 }
        };

        onMount(() => {
                startIfNeeded();

                return () => {
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
                                { facingMode: 'environment' },
                                scanConfig,
                                handleScanSuccess,
                                handleScanError
                        );
                        isScanning = true;
                        statusMessage = 'Camera active';
                        dispatch('status', { active: true });
                } catch (err) {
                        const message = err instanceof Error ? err.message : 'Unable to start camera';
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
                        dispatch('status', { active: false });
                } catch (err) {
                        console.debug('Unable to stop scanner', err);
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
                        } catch (err) {
                                console.debug('Unable to clear scanner', err);
                        }
                        scanner = null;
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
                } catch (err) {
                        console.debug('Audio unavailable', err);
                }
        }
</script>

<div class="space-y-4">
        <div
                class="relative overflow-hidden rounded-xl bg-black shadow-lg"
                role="region"
                aria-label="Camera scanner viewfinder"
        >
                <div id="camera-viewfinder" class="aspect-[3/4] w-full"></div>

                {#if !active}
                        <div class="absolute inset-0 flex items-center justify-center bg-black/70 text-white">Camera paused</div>
                {/if}
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
