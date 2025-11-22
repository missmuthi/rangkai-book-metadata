<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Html5Qrcode } from 'html5-qrcode';

	interface Props {
		onscan?: (detail: { text: string }) => void;
		onerror?: (detail: { message: string }) => void;
		autopause?: boolean; // Auto-pause when tab is hidden
	}

	let { onscan, onerror: onErrorCallback, autopause = true }: Props = $props();

	let lastScan = $state<string | null>(null);
	let lastScanAt = $state<number | null>(null);
	let error = $state<string | null>(null);
	let status = $state<string>('Camera starting...');
	let isPaused = $state(false);

	let html5Qrcode: Html5Qrcode | null = null;
	let audioContext: AudioContext | null = null;
	let wakeLock: any = null;
	let errorElement = $state<HTMLDivElement | null>(null);
	let availableCameras: any[] = [];
	let currentCameraIndex = $state(0);

	const DEBOUNCE_MS = 3000;
	const BEEP_FREQUENCY = 800;
	const BEEP_DURATION = 0.1;

	/**
	 * Play audio feedback on successful scan
	 * Reuses AudioContext for better performance
	 */
	function playBeep() {
		try {
			if (!audioContext) {
				audioContext = new AudioContext();
			}

			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			oscillator.frequency.value = BEEP_FREQUENCY;
			oscillator.type = 'sine';

			gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + BEEP_DURATION);

			oscillator.start(audioContext.currentTime);
			oscillator.stop(audioContext.currentTime + BEEP_DURATION);
		} catch (err) {
			// Audio failed, continue silently
			console.debug('Audio beep failed:', err);
		}
	}

	/**
	 * Handle successful barcode scan with debouncing
	 */
	function onScanSuccess(decodedText: string) {
		const normalized = decodedText.trim();

		// Debounce duplicate scans
		if (normalized === lastScan && Date.now() - (lastScanAt ?? 0) < DEBOUNCE_MS) {
			return;
		}

		lastScan = normalized;
		lastScanAt = Date.now();

		playBeep();
		onscan?.({ text: normalized });
	}

	/**
	 * Handle scan errors (mostly per-frame decode failures)
	 */
	function onScanError(_errorMessage: string) {
		// Ignore noisy per-frame decode failures
	}

	/**
	 * Request wake lock to prevent screen from sleeping during scanning
	 */
	async function requestWakeLock() {
		try {
			if ('wakeLock' in navigator) {
				wakeLock = await (navigator as any).wakeLock.request('screen');
				wakeLock.addEventListener('release', () => {
					console.debug('Wake lock released');
				});
			}
		} catch (err) {
			console.debug('Wake lock request failed:', err);
		}
	}

	/**
	 * Release wake lock
	 */
	async function releaseWakeLock() {
		try {
			if (wakeLock) {
				await wakeLock.release();
				wakeLock = null;
			}
		} catch (err) {
			console.debug('Wake lock release failed:', err);
		}
	}

	/**
	 * Pause scanning (e.g., when tab is hidden)
	 */
	async function pauseScanning() {
		if (html5Qrcode && !isPaused) {
			try {
				await html5Qrcode.pause();
				isPaused = true;
				status = 'Scanning paused';
				await releaseWakeLock();
			} catch (err) {
				console.debug('Pause failed:', err);
			}
		}
	}

	/**
	 * Resume scanning (e.g., when tab becomes visible)
	 */
	async function resumeScanning() {
		if (html5Qrcode && isPaused) {
			try {
				html5Qrcode.resume();
				isPaused = false;
				status = 'Scanning...';
				await requestWakeLock();
			} catch (err) {
				console.debug('Resume failed:', err);
			}
		}
	}

	/**
	 * Switch between available cameras
	 */
	async function switchCamera() {
		if (!html5Qrcode || availableCameras.length <= 1) return;

		try {
			await html5Qrcode.stop();
			
			currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
			const nextCamera = availableCameras[currentCameraIndex];

			await html5Qrcode.start(
				nextCamera.id,
				{
					fps: 10,
					qrbox: {
						width: 250,
						height: 150
					},
					aspectRatio: 1.0
				},
				onScanSuccess,
				onScanError
			);

			status = 'Scanning...';
			isPaused = false;
		} catch (err) {
			console.error('Camera switch failed:', err);
			setError('Failed to switch camera');
		}
	}

	// Expose methods to parent component
	export { pauseScanning, resumeScanning, switchCamera };

	/**
	 * Handle page visibility changes
	 */
	function handleVisibilityChange() {
		if (!autopause) return;

		if (document.hidden) {
			pauseScanning();
		} else {
			resumeScanning();
		}
	}

	/**
	 * Set error and announce to screen readers
	 */
	function setError(message: string) {
		error = message;
		status = message;
		onErrorCallback?.({ message });

		// Focus error for screen readers
		if (errorElement) {
			errorElement.focus();
		}
	}

	onMount(() => {
		let mounted = true;

		async function initScanner() {
			try {
				// Lazy load html5-qrcode library
				const { Html5Qrcode } = await import('html5-qrcode');
				if (!mounted) return;

				html5Qrcode = new Html5Qrcode('reader', { verbose: false });

				// Try to get available cameras
				const cameras = await Html5Qrcode.getCameras();
				
				// Store available cameras
				if (cameras && cameras.length > 0) {
					availableCameras = cameras;
				}
				
				// Prefer rear camera (environment) if available
				let cameraId: string | { facingMode: string };
				if (cameras && cameras.length > 0) {
					const rearCamera = cameras.find(cam => 
						cam.label.toLowerCase().includes('back') || 
						cam.label.toLowerCase().includes('rear')
					);
					cameraId = rearCamera?.id || cameras[0].id;
					currentCameraIndex = rearCamera ? cameras.indexOf(rearCamera) : 0;
				} else {
					// Fallback to facingMode if camera enumeration not available
					cameraId = { facingMode: 'environment' };
				}

				await html5Qrcode.start(
					cameraId,
					{
						fps: 10,
						qrbox: {
							width: 250,
							height: 150
						},
						aspectRatio: 1.0
					},
					onScanSuccess,
					onScanError
				);

				if (!mounted) {
					await html5Qrcode.stop();
					await html5Qrcode.clear();
					return;
				}

				status = 'Scanning...';
				
				// Request wake lock
				await requestWakeLock();

				// Add visibility change listener
				if (autopause) {
					document.addEventListener('visibilitychange', handleVisibilityChange);
				}

			} catch (err) {
				if (!mounted) return;
				
				let errorMsg = 'Camera permission denied';
				if (err instanceof Error) {
					if (err.message.includes('NotAllowedError')) {
						errorMsg = 'Camera access denied. Please allow camera permissions.';
					} else if (err.message.includes('NotFoundError')) {
						errorMsg = 'No camera found. Please connect a camera.';
					} else if (err.message.includes('NotReadableError')) {
						errorMsg = 'Camera is already in use by another application.';
					} else {
						errorMsg = err.message;
					}
				}
				
				setError(errorMsg);
			}
		}

		initScanner();

		return () => {
			mounted = false;
		};
	});

	onDestroy(async () => {
		// Remove visibility listener
		if (autopause) {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		}

		// Release wake lock
		await releaseWakeLock();

		// Close audio context
		if (audioContext) {
			try {
				await audioContext.close();
			} catch (err) {
				console.debug('Audio context close failed:', err);
			}
		}

		// Stop and cleanup scanner
		if (html5Qrcode) {
			try {
				await html5Qrcode.stop();
				await html5Qrcode.clear();
			} catch (err) {
				console.debug('Scanner cleanup failed:', err);
			}
		}
	});
</script>

<div class="camera-scanner">
	<!-- Scanner Container -->
	<div 
		class="scanner-container bg-black rounded-lg overflow-hidden"
		role="region"
		aria-label="Barcode scanner camera feed"
	>
		<div id="reader" class="w-full"></div>
		
		{#if isPaused}
			<div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
				<p class="text-white text-sm">Scanning paused</p>
			</div>
		{/if}
	</div>

	<!-- Status and Error Messages -->
	<div class="status-container mt-4 text-center">
		{#if error}
			<div 
				bind:this={errorElement}
				role="alert"
				aria-live="assertive"
				tabindex="-1"
				class="text-red-600 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded px-2 py-1"
			>
				{error}
			</div>
			<p class="text-sm text-gray-500 mt-2">
				Please check your camera permissions and try again
			</p>
		{:else}
			<p 
				class="text-gray-700"
				role="status"
				aria-live="polite"
			>
				{status}
			</p>
			<p class="text-sm text-gray-500 mt-2" id="scanner-instructions">
				Align the book's barcode within the frame
			</p>
		{/if}
	</div>
</div>

<style>
	.camera-scanner {
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
	}

	.scanner-container {
		position: relative;
		min-height: 300px;
	}

	:global(#reader) {
		border: none;
	}

	:global(#reader video) {
		width: 100%;
		height: auto;
		display: block;
	}

	:global(#reader__scan_region) {
		border: 2px solid rgba(59, 130, 246, 0.5) !important;
	}
</style>
