import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle,
  User,
  Clock,
  Calendar,
  Phone,
  Activity,
  Database,
  RefreshCw,
  VideoOff,
  Upload,
  Zap,
  ZapOff,
  ChevronDown,
  Info
} from 'lucide-react';
import { UserProfile, Appointment } from '../../types';
import { approveCheckIn, getAppointmentByKeyFromRTDB } from '../../services/clinicService';

interface QRScannerPageProps {
  profile: UserProfile | null;
}

interface CameraDevice {
  id: string;
  label: string;
}

export default function QRScannerPage({ profile }: QRScannerPageProps) {
  const [scanning, setScanning] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [result, setResult] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState('');
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const startScanner = async () => {
    setError(null);
    try {
      const readerEl = document.getElementById("reader");
      if (!readerEl) return;

      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
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

      const cameraId = getCameraConfig();

      try {
        await html5QrCodeRef.current.start(cameraId as any, config, onScanSuccess, onScanFailure);
      } catch (startError: any) {
        // If a specific device cannot be opened, fall back to a generic rear-camera request.
        if ((startError?.name === 'OverconstrainedError' || startError?.message?.includes('Overconstrained')) && selectedCameraId && selectedCameraId !== 'environment' && selectedCameraId !== 'user') {
          await html5QrCodeRef.current.start({ facingMode: { ideal: 'environment' } } as any, config, onScanSuccess, onScanFailure);
        } else {
          throw startError;
        }
      }
      
      setScanning(true);
      setIsCameraReady(true);

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices.map(d => ({ id: d.id, label: d.label })));
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          if (!selectedCameraId) {
            setSelectedCameraId(backCam ? backCam.id : devices[0].id);
          }
        }
      } catch (cameraListError) {
        console.warn('Camera enumeration skipped or denied:', cameraListError);
      }
      
      // Check for torch capability
      try {
        const caps = html5QrCodeRef.current.getRunningTrackCameraCapabilities();
        setHasTorch((caps as any).torch || false);
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error("Camera start error:", err);
      setError(`Camera Error: ${err.message || 'Check hardware permissions'}`);
      setScanning(false);
      setIsCameraReady(false);
    }
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
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        setScanning(false);
        setIsCameraReady(false);
        setTorchOn(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
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
        } else {
          // Auto-approve if it matches and we are a receptionist
          await approveCheckIn(profile.clinicId, appointment.id, appointment, profile.uid);
          setResult({ ...appointment, status: 'confirmed' as any, qrVerified: true });
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
    startScanner();
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 mt-4 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-200">
              <Camera size={24} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">ScanApp</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-slate-500 font-medium">Cloud Health Verification System</p>
            <span className={`h-2 w-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <Upload size={18} /> Upload Image
          </button>
          
          <div className="relative group">
            <select 
              value={selectedCameraId || ''}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCameraId(newId);
                // Restart scanner if it was running
                if (html5QrCodeRef.current?.isScanning) {
                  stopScanner().then(() => {
                    // Small delay to let hardware release
                    setTimeout(() => startScanner(), 300);
                  });
                }
              }}
              className="appearance-none rounded-2xl bg-white border border-slate-200 px-10 py-3 pr-10 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer outline-none min-w-[200px]"
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

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
        <div className="lg:col-span-12 xl:col-span-7 space-y-8">
          <div className="relative group">
            <div className={`relative overflow-hidden rounded-[40px] bg-slate-100 shadow-2xl transition-all duration-500 border-[8px] ${scanning ? 'border-sky-500/30' : 'border-slate-200'}`}>
              
              {scanning && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72">
                    <div className="absolute top-0 left-0 w-20 h-20 border-t-8 border-l-8 border-sky-500 rounded-tl-3xl shadow-[0_0_15px_rgba(56,189,248,0.3)]"></div>
                    <div className="absolute top-0 right-0 w-20 h-20 border-t-8 border-r-8 border-sky-500 rounded-tr-3xl shadow-[0_0_15px_rgba(56,189,248,0.3)]"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 border-b-8 border-l-8 border-sky-500 rounded-bl-3xl shadow-[0_0_15px_rgba(56,189,248,0.3)]"></div>
                    <div className="absolute bottom-0 right-0 w-20 h-20 border-b-8 border-r-8 border-sky-500 rounded-br-3xl shadow-[0_0_15px_rgba(56,189,248,0.3)]"></div>
                    <div className="absolute top-0 left-4 right-4 h-1 bg-sky-500 shadow-[0_0_20px_rgba(56,189,248,0.9)] animate-scan-line"></div>
                  </div>
                  <div className="absolute inset-0 bg-slate-900/20" style={{ clipPath: 'polygon(0% 0%, 0% 100%, 50% 100%, 50% 15%, 85% 15%, 85% 85%, 15% 85%, 15% 15%, 50% 15%, 50% 100%, 100% 100%, 100% 0%)' }}></div>
                </div>
              )}

              <div id="reader" className="w-full h-[480px] object-cover bg-slate-50"></div>
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
                {hasTorch && scanning && (
                  <button 
                    onClick={toggleTorch}
                    className={`h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-xl ${torchOn ? 'bg-yellow-400 text-black scale-110' : 'bg-white/40 text-slate-800 hover:bg-white/60 backdrop-blur-md border border-white/50'}`}
                  >
                    {torchOn ? <Zap size={24} fill="currentColor" /> : <ZapOff size={24} />}
                  </button>
                )}
                
                {!scanning && !result && (
                  <button 
                    onClick={startScanner}
                    className="flex items-center gap-3 rounded-2xl bg-sky-600 px-10 py-4 font-bold text-white shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-95"
                  >
                    <Camera size={20} /> Start Scanner
                  </button>
                )}
              </div>

              <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center gap-2 rounded-full bg-white/60 backdrop-blur-md px-4 py-2 border border-white/20 shadow-sm">
                  <div className={`h-2 w-2 rounded-full ${scanning ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                    {scanning ? 'Live Scanning' : 'Scanner Idle'}
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {result && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl p-12 text-center"
                  >
                    <motion.div 
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100/50 mb-6"
                    >
                      <CheckCircle2 size={48} strokeWidth={2.5} />
                    </motion.div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Patient Identified</h2>
                    <p className="text-slate-500 font-medium mb-10 max-w-sm">Verification successful. Details have been loaded for your review.</p>
                    <button 
                      onClick={reset}
                      className="rounded-2xl border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                      Scan Next Card
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 px-1">
                  <Search size={16} />
                  <span className="text-xs font-black uppercase tracking-widest">Manual Input</span>
                </div>
                <form onSubmit={handleManualSearch} className="relative flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter Card ID or Key..." 
                    className="flex-1 rounded-[24px] border border-slate-200 bg-white px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-sky-100 transition-all placeholder:text-slate-300"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                  />
                  <button className="rounded-[20px] bg-slate-900 px-6 text-white transition-all hover:bg-black active:scale-95 shadow-xl shadow-slate-200">
                    <Search size={22} />
                  </button>
                </form>
              </div>

              <div className="rounded-[32px] bg-slate-50 p-6 border border-slate-200 flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-1">Quick Tip</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Center the QR code in the guide box for instant detection. Ensure good lighting for best results.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-5">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result-details"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-[40px] bg-white border border-slate-200 shadow-2xl p-10 flex flex-col h-fit sticky top-10"
              >
                <div className="flex items-center justify-between mb-10">
                  <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                    result.status === 'confirmed' ? 'bg-[#D1FAE5] border-emerald-300 text-emerald-800' : 'bg-sky-50 border-sky-200 text-sky-700'
                  }`}>
                    {result.status.replace('_', ' ')}
                  </span>
                  <p className="text-[10px] font-mono font-bold text-slate-300 tracking-tighter">REF: {result.id.slice(0, 12)}</p>
                </div>

                <div className="space-y-8">
                  <div className="flex items-start gap-5">
                    <div className="h-16 w-16 rounded-[24px] bg-sky-50 flex items-center justify-center text-sky-600 shadow-inner">
                      <User size={32} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Patient Name</p>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">{result.patientName}</h3>
                      <p className="text-slate-500 font-bold mt-1">{result.patientPhone}</p>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent"></div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Date</span>
                      </div>
                      <p className="text-lg font-black text-slate-900 tracking-tight">{result.date}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Slot</span>
                      </div>
                      <p className="text-lg font-black text-slate-900 tracking-tight">{result.slotStartTime}</p>
                    </div>
                  </div>

                  <div className="rounded-[32px] bg-sky-50 p-6 flex items-center gap-4 border border-sky-100">
                    <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center text-sky-600 shadow-sm">
                      <Activity size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-sky-600 tracking-widest mb-1">Doctor Assigned</p>
                      <p className="text-slate-900 font-black text-lg">Dr. {result.doctorName}</p>
                    </div>
                  </div>
                </div>

                {result.status === 'confirmed' ? (
                  <div className="mt-12 group">
                    <div className="rounded-[28px] bg-emerald-50 border border-emerald-200 p-6 text-center shadow-sm transition-all group-hover:scale-[1.02]">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white mb-3 shadow-md">
                        <CheckCircle2 size={28} strokeWidth={3} />
                      </div>
                      <p className="text-emerald-900 font-black text-lg uppercase tracking-tight">Verified & Approved</p>
                      <p className="text-emerald-600 text-xs font-bold mt-1">Patient marked as present</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="mt-12 w-full rounded-[28px] bg-sky-600 py-6 text-lg font-black text-white shadow-2xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Approve Attendance"}
                  </button>
                )}
                
                <button 
                  onClick={reset}
                  className="mt-4 w-full py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel & Rescan
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-[40px] border-4 border-dashed border-slate-200 bg-white p-16 text-center flex flex-col items-center sticky top-10"
              >
                <div className="h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-8 border border-slate-100">
                  <Search size={48} strokeWidth={1} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Awaiting Scan</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[240px]">
                  Point your camera at a patient's clinic card or upload a captured image to view details.
                </p>
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-10 rounded-2xl bg-red-50 p-4 border border-red-100 flex items-center gap-3 text-left"
                  >
                    <AlertCircle size={20} className="text-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-700">{error}</p>
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

function QrCodeAlt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      <rect x="7" y="7" width=".01" height=".01" /><rect x="17" y="7" width=".01" height=".01" />
      <rect x="17" y="17" width=".01" height=".01" /><rect x="7" y="17" width=".01" height=".01" />
    </svg>
  );
}
