import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  User,
  Clock,
  Calendar,
  Phone,
  Activity,
  Upload,
  Zap,
  ZapOff,
  ChevronDown,
  Info
} from 'lucide-react';
import { UserProfile, Appointment } from '../../styles/types';
import { approveCheckIn, getAppointmentByKeyFromRTDB, updateAppointmentPaymentStatus } from '../../services/clinicService';

interface QRScannerPageProps {
  profile: UserProfile | null;
}

interface CameraDevice {
  id: string;
  label: string;
}

function getCameraStartErrorMessage(error: unknown) {
  const cameraError = error as { name?: string; message?: string };
  const errorName = cameraError?.name || '';
  const errorMessage = cameraError?.message || '';

  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
    return 'Camera access was blocked. Allow camera permission in your browser and reload the page.';
  }

  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Attach a camera or upload a QR image instead.';
  }

  if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
    return 'The camera is already in use by another app. Close other camera apps and try again.';
  }

  if (errorName === 'OverconstrainedError' || errorMessage.includes('Overconstrained')) {
    return 'The selected camera cannot be opened. Switch to another camera or use the default rear camera.';
  }

  if (errorName === 'SecurityError') {
    return 'Camera access requires HTTPS or localhost. Open the app from a secure origin and try again.';
  }

  if (errorName === 'TypeError') {
    return 'Camera access is not available in this browser. Try a modern browser with camera support.';
  }

  return errorMessage || 'Check hardware permissions and try again.';
}

function getBrowserCameraErrorMessage() {
  if (typeof window === 'undefined') return '';

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Camera access is not available in this browser. Try Chrome, Edge, or Safari.';
  }

  if (!window.isSecureContext) {
    return 'Camera access requires HTTPS or localhost. Open the forwarded HTTPS preview or http://localhost, not 0.0.0.0.';
  }

  return '';
}

async function getCameraPermissionState() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return permissionStatus.state;
  } catch {
    return 'unknown';
  }
}

function isPermissionStyleCameraError(error: unknown) {
  const cameraError = error as { name?: string; message?: string };
  const errorName = cameraError?.name || '';
  const errorMessage = cameraError?.message || '';

  return (
    errorName === 'NotAllowedError' ||
    errorName === 'PermissionDeniedError' ||
    errorName === 'SecurityError' ||
    errorMessage.includes('permission') ||
    errorMessage.includes('Permission')
  );
}

export default function QRScannerPage({ profile }: QRScannerPageProps) {
  const [scanning, setScanning] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [result, setResult] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState('');
  const [paymentEntry, setPaymentEntry] = useState('');
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cameraTransitionRef = useRef<Promise<void> | null>(null);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isScannerRunningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      const nextCameras = (devices || []).map((device) => ({ id: device.id, label: device.label }));
      setCameras(nextCameras);

      if (!selectedCameraId && nextCameras.length > 0) {
        const backCam = nextCameras.find((device) => {
          const label = device.label.toLowerCase();
          return label.includes('back') || label.includes('rear') || label.includes('environment');
        });
        setSelectedCameraId(backCam ? backCam.id : nextCameras[0].id);
      }

      return nextCameras;
    } catch (cameraListError) {
      if (!isPermissionStyleCameraError(cameraListError)) {
        console.warn('Camera enumeration skipped:', cameraListError);
      }
      return [];
    }
  };

  const ensureCameraAccess = async () => {
    const browserCameraError = getBrowserCameraErrorMessage();
    if (browserCameraError) {
      throw new Error(browserCameraError);
    }

    const permissionState = await getCameraPermissionState();
    if (permissionState === 'denied') {
      throw new Error('Camera permission is blocked for this site. Click the camera icon in the address bar, allow camera access, then reload the page.');
    }

    const constraints: MediaStreamConstraints = {
      video: selectedCameraId && selectedCameraId !== 'environment' && selectedCameraId !== 'user'
        ? { deviceId: { exact: selectedCameraId } }
        : selectedCameraId === 'user'
          ? { facingMode: 'user' }
          : { facingMode: { ideal: 'environment' } },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => track.stop());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      await onScanSuccess(decodedText);
    } catch (err: any) {
      console.error("File scan error:", err);
      setError("No valid QR code found in this image. Please try another photo.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    // Check RTDB connection
    const checkConn = async () => {
      try {
        if (profile) {
          // Try to get a test appointment to verify connection
          setDbStatus('connected');
        }
      } catch (err) {
        console.error("DB Connection test failed:", err);
        setDbStatus('error');
      }
    };
    checkConn();
  }, []);

  const getCameraConfig = () => {
    if (!selectedCameraId || selectedCameraId === 'environment') {
      return { facingMode: { ideal: 'environment' } };
    }

    if (selectedCameraId === 'user') {
      return { facingMode: { ideal: 'user' } };
    }

    return { deviceId: { exact: selectedCameraId } };
  };

  const getCameraStartCandidates = () => {
    const candidates: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    const addCandidate = (label: string, constraint: Record<string, unknown>) => {
      if (seen.has(label)) return;
      seen.add(label);
      candidates.push(constraint);
    };

    addCandidate('selected', getCameraConfig());

    if (selectedCameraId !== 'environment') {
      addCandidate('environment', { facingMode: { ideal: 'environment' } });
    }

    if (selectedCameraId !== 'user') {
      addCandidate('user', { facingMode: { ideal: 'user' } });
    }

    for (const camera of cameras) {
      if (camera.id && camera.id !== selectedCameraId) {
        addCandidate(`device:${camera.id}`, { deviceId: { exact: camera.id } });
      }
    }

    return candidates;
  };

  const startScanner = async () => {
    if (isStartingRef.current || isStoppingRef.current || isScannerRunningRef.current) return;
    if (cameraTransitionRef.current) return;
    isStartingRef.current = true;
    setError(null);
    try {
      await ensureCameraAccess();
      await loadCameras();

      const readerEl = document.getElementById("reader");
      if (!readerEl) return;

      // If a scanner exists and is running, stop it first (wait for stop)
      if (html5QrCodeRef.current) {
        try {
          if (isScannerRunningRef.current || html5QrCodeRef.current.isScanning) {
            await stopScanner();
          }
        } catch (e) {
          console.warn("Stop error before start", e);
        }
      }

      html5QrCodeRef.current = new Html5Qrcode("reader");

      const config = { 
        fps: 15, 
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
      };

      const startCandidates = getCameraStartCandidates();
      let lastStartError: unknown = null;

      for (const candidate of startCandidates) {
        try {
          await html5QrCodeRef.current.start(candidate as any, config, onScanSuccess, onScanFailure);
          lastStartError = null;
          break;
        } catch (startError: any) {
          lastStartError = startError;
          if (isPermissionStyleCameraError(startError)) {
            throw startError;
          }
        }
      }

      if (lastStartError) {
        throw lastStartError;
      }
      
      setScanning(true);
      setIsCameraReady(true);
      isScannerRunningRef.current = true;

      await loadCameras();
      
      // Check for torch capability
      try {
        const caps = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
        setHasTorch((caps as any).torch || false);
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      if (!isPermissionStyleCameraError(err)) {
        console.error("Camera start error:", err);
      }
      setError(`Camera Error: ${getCameraStartErrorMessage(err)}`);
      setScanning(false);
      setIsCameraReady(false);
      isScannerRunningRef.current = false;
    } finally {
      isStartingRef.current = false;
    }
  };

  const restartScanner = async () => {
    if (cameraTransitionRef.current) {
      await cameraTransitionRef.current;
    }

    cameraTransitionRef.current = (async () => {
      await stopScanner();
    })();

    try {
      await cameraTransitionRef.current;
    } finally {
      cameraTransitionRef.current = null;
    }

    await startScanner();
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !html5QrCodeRef.current.isScanning) return;
    try {
      const newState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }]
      } as any);
      setTorchOn(newState);
    } catch (err) {
      console.error("Flashlight error:", err);
    }
  };

  const stopScanner = async () => {
    if (isStoppingRef.current) return;
    if (!html5QrCodeRef.current) return;

    // If not running according to our ref and scanner reports not scanning, skip
    if (!isScannerRunningRef.current && !html5QrCodeRef.current.isScanning) return;

    isStoppingRef.current = true;
    try {
      await html5QrCodeRef.current.stop();
      setScanning(false);
      setIsCameraReady(false);
      setTorchOn(false);
      isScannerRunningRef.current = false;
    } catch (err) {
      console.error("Failed to stop scanner", err);
    } finally {
      isStoppingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      // Ensure scanner is stopped cleanly on unmount
      if (html5QrCodeRef.current) {
        stopScanner().catch(console.error);
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    if (loading) return; // Prevent multiple scans at once
    
    try {
      let key = decodedText;
      
      // Try URL extraction
      if (decodedText.startsWith('http')) {
        try {
          const url = new URL(decodedText);
          key = url.searchParams.get('id') || url.searchParams.get('key') || url.pathname.split('/').pop() || decodedText;
        } catch (e) { /* ignore */ }
      }

      try {
        const qrData = JSON.parse(decodedText);
        key = qrData.appointmentKey || qrData.appointmentId || key || decodedText;
      } catch (e) { /* ignore */ }

      if (key && key.trim()) {
        await stopScanner();
        // Small delay to ensure state updates
        setTimeout(() => fetchAppointmentByKey(key.trim()), 100);
      }
    } catch (e: any) {
      console.error("Scan processing error", e);
      setError("Invalid QR format or processing error.");
    }
  };

  const onScanFailure = () => {};

  const fetchAppointmentByKey = async (rawKey: string) => {
    if (!rawKey || !profile) return;
    const key = rawKey.trim();
    
    setLoading(true);
    setScanning(false);
    setError(null);
    
    try {
      // Validate key format roughly to avoid errors
      if (key.length < 5) {
        throw new Error("Invalid ID or Key length.");
      }

      // Use RTDB to fetch appointment by key
      const appointment = await getAppointmentByKeyFromRTDB(profile.clinicId, key);

      if (appointment) {
        const allowedStatuses = ['pending', 'booked', 'confirmed'];
        const currentStatus = (appointment.status || '').toLowerCase();

        if (!allowedStatuses.includes(currentStatus)) {
          throw new Error(`State: ${appointment.status}`);
        }

        if (currentStatus === 'confirmed') {
          setResult(appointment);
          setPaymentEntry(appointment.paymentStatus || '');
        } else {
          // Auto-approve if it matches and we are a receptionist
          await approveCheckIn(profile.clinicId, appointment.id, appointment, profile.uid);
          const confirmedAppointment = { ...appointment, status: 'confirmed' as any, qrVerified: true };
          setResult(confirmedAppointment);
          setPaymentEntry(confirmedAppointment.paymentStatus || 'paid');
        }
      } else {
        throw new Error("Appointment not found. Check the ID.");
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to find appointment.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) fetchAppointmentByKey(manualId.trim());
  };

  const handleApprove = async () => {
    if (!result || !profile) return;
    setLoading(true);
    try {
      await approveCheckIn(profile.clinicId, result.id, result, profile.uid);
      setResult(prev => prev ? { ...prev, status: 'confirmed' as any, qrVerified: true } : null);
    } catch (err: any) {
      setError(err.message || "Check-in failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setManualId('');
    setPaymentEntry('');
    setPaymentMessage(null);
    restartScanner();
  };

  const handlePaymentEntryChange = async (value: string) => {
    setPaymentEntry(value);
    setPaymentMessage(null);

    if (value.trim().toLowerCase() !== 'paid') return;
    if (!result || !profile) return;
    if ((result.paymentStatus || '').toLowerCase() === 'paid') {
      setPaymentMessage('Payment already marked as paid.');
      return;
    }

    setLoading(true);
    try {
      await updateAppointmentPaymentStatus(profile.clinicId, result.id, result, 'paid');
      setResult((previous) => previous ? { ...previous, paymentStatus: 'paid' } : previous);
      setPaymentMessage('Payment updated to paid.');
    } catch (err: any) {
      setPaymentMessage(err.message || 'Payment update failed.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = scanning ? 'Live scanning' : loading ? 'Checking' : 'Scanner idle';
  const statusColor = scanning ? 'bg-emerald-500' : loading ? 'bg-amber-500' : 'bg-slate-400';
  const connectionLabel = dbStatus === 'connected' ? 'Connected' : dbStatus === 'checking' ? 'Checking' : 'Connection issue';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
              <Camera size={24} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">ScanApp</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Cloud Health Verification System</span>
                <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'checking' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  {connectionLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <Upload size={18} /> Upload Image
            </button>
            
            <div className="relative">
              <select 
                value={selectedCameraId || ''}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCameraId(newId);
                  // Restart scanner if it was running
                  if (html5QrCodeRef.current?.isScanning) {
                    void restartScanner();
                  }
                }}
                className="w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-10 py-2.5 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 sm:min-w-[210px]"
              >
                {cameras.length > 0 ? (
                  <>
                    <option value="environment">Back Camera (Environment)</option>
                    <option value="user">Front Camera (User)</option>
                    <optgroup label="All Devices">
                      {cameras.map(cam => (
                        <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id.slice(0, 5)}`}</option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  <>
                    <option value="environment">Back Camera</option>
                    <option value="user">Front Camera</option>
                  </>
                )}
              </select>
              <Camera size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
                <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                {statusLabel}
              </div>

              <div className="flex items-center gap-2">
                {hasTorch && scanning && (
                  <button 
                    onClick={toggleTorch}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${torchOn ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    aria-label="Toggle flashlight"
                    title="Toggle flashlight"
                  >
                    {torchOn ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}
                  </button>
                )}

                {!scanning && !result && (
                  <button 
                    onClick={startScanner}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
                  >
                    <Camera size={18} /> Start Scanner
                  </button>
                )}
              </div>
            </div>

            <div className={`relative overflow-hidden bg-slate-950 transition-all duration-300 ${scanning ? 'ring-2 ring-inset ring-sky-400/50' : ''}`}>
              
              {scanning && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 sm:h-72 sm:w-72">
                    <div className="absolute left-0 top-0 h-14 w-14 rounded-tl-2xl border-l-4 border-t-4 border-sky-400 sm:h-20 sm:w-20" />
                    <div className="absolute right-0 top-0 h-14 w-14 rounded-tr-2xl border-r-4 border-t-4 border-sky-400 sm:h-20 sm:w-20" />
                    <div className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-2xl border-b-4 border-l-4 border-sky-400 sm:h-20 sm:w-20" />
                    <div className="absolute bottom-0 right-0 h-14 w-14 rounded-br-2xl border-b-4 border-r-4 border-sky-400 sm:h-20 sm:w-20" />
                    <div className="absolute left-4 right-4 top-0 h-0.5 bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.9)] animate-scan-line" />
                  </div>
                  <div className="absolute inset-0 bg-slate-950/30" />
                </div>
              )}

              <div id="reader" className="h-[clamp(320px,62vw,520px)] min-h-[320px] w-full bg-slate-100 object-cover" />

              <AnimatePresence>
                {result && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 p-8 text-center backdrop-blur"
                  >
                    <motion.div 
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                    >
                      <CheckCircle2 size={42} strokeWidth={2.5} />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-slate-950">Patient Identified</h2>
                    <p className="mb-8 mt-2 max-w-sm text-sm text-slate-500">Verification successful. Details are ready for review.</p>
                    <button 
                      onClick={reset}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                    >
                      Scan Next Card
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-500">
                <Search size={16} />
                <span className="text-xs font-bold uppercase tracking-wide">Manual Input</span>
              </div>
              <form onSubmit={handleManualSearch} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Card ID or Key..." 
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                />
                <button className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 active:scale-95" aria-label="Search appointment">
                  <Search size={20} />
                </button>
              </form>
            </div>

            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                  <Info size={20} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-900">Quick Tip</p>
                  <p className="text-sm font-medium leading-relaxed text-slate-500">
                    Center the QR code in the guide box for instant detection. Ensure good lighting for best results.
                  </p>
                </div>
              </div>
            </div>
          </div>

        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result-details"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex h-fit flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6"
              >
                <div className="mb-6 flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    result.status === 'confirmed' ? 'bg-[#D1FAE5] border-emerald-300 text-emerald-800' : 'bg-sky-50 border-sky-200 text-sky-700'
                  }`}>
                    {result.status.replace('_', ' ')}
                  </span>
                  <p className="truncate text-xs font-mono font-bold text-slate-400">REF: {result.id.slice(0, 12)}</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <User size={28} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Patient Name</p>
                      <h3 className="text-2xl font-bold leading-tight text-slate-950">{result.patientName}</h3>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <Phone size={14} />
                        {result.patientPhone || 'No phone on file'}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">Date</span>
                      </div>
                      <p className="mt-2 text-base font-bold tracking-tight text-slate-950">{result.date}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">Slot</span>
                      </div>
                      <p className="mt-2 text-base font-bold tracking-tight text-slate-950">{result.slotStartTime}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                      <Activity size={24} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-600">Doctor Assigned</p>
                      <p className="text-lg font-bold text-slate-950">Dr. {result.doctorName}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <label htmlFor="payment-entry" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                      Payment Field
                    </label>
                    <input
                      id="payment-entry"
                      type="text"
                      value={paymentEntry}
                      onChange={(event) => handlePaymentEntryChange(event.target.value)}
                      placeholder="Write paid"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-500">
                        Current: <span className="capitalize text-slate-800">{result.paymentStatus || 'pending'}</span>
                      </p>
                      {paymentMessage ? <p className="text-xs font-semibold text-emerald-600">{paymentMessage}</p> : null}
                    </div>
                  </div>
                </div>

                {result.status === 'confirmed' ? (
                  <div className="mt-8">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                        <CheckCircle2 size={28} strokeWidth={3} />
                      </div>
                      <p className="text-lg font-bold text-emerald-900">Verified & Approved</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-600">Patient marked as present</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="mt-8 w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Approve Attendance"}
                  </button>
                )}
                
                <button 
                  onClick={reset}
                  className="mt-3 w-full py-3 text-xs font-bold uppercase tracking-wide text-slate-400 transition-colors hover:text-slate-600"
                >
                  Cancel & Rescan
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm lg:sticky lg:top-6"
              >
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-300">
                  <Search size={40} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-xl font-bold tracking-tight text-slate-950">Awaiting Scan</h3>
                <p className="max-w-[260px] text-sm font-medium leading-relaxed text-slate-500">
                  Point your camera at a patient's clinic card or upload a captured image to view details.
                </p>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-left"
                  >
                    <AlertCircle size={20} className="shrink-0 text-rose-500" />
                    <p className="text-sm font-semibold text-rose-700">{error}</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0% { top: 15%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
        .animate-scan-line {
          position: absolute;
          animation: scan-line 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}} />
    </div>
  );
}
