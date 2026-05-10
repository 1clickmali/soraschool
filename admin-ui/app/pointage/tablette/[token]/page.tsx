"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle, Loader2, QrCode, ShieldX, WifiOff } from "lucide-react";
import { schoolApi, type SchoolInstitution, type StaffTabletScanResponse } from "@/lib/school-api";
import { cn } from "@/lib/utils";

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function statusColor(result?: string) {
  if (!result) return "border-slate-200 bg-white";
  if (["CHECK_IN", "CHECK_OUT"].includes(result)) return "border-emerald-200 bg-emerald-50";
  if (["LATE", "EARLY_DEPARTURE"].includes(result)) return "border-amber-200 bg-amber-50";
  return "border-red-200 bg-red-50";
}

export default function TabletPointagePage() {
  const params = useParams();
  const token = params.token as string;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const cameraActiveRef = useRef(false);

  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [manualPayload, setManualPayload] = useState("");
  const [result, setResult] = useState<StaffTabletScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    schoolApi.staffTabletInfo(token).then(({ data, error }) => {
      if (data?.institution) setInstitution(data.institution);
      if (error) setError(error);
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    return () => {
      cameraActiveRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const submitScan = async (payload: string) => {
    if (!online) {
      setError("Connexion indisponible. Le pointage nécessite internet en V1 pour éviter les doublons.");
      return;
    }
    if (!payload.trim() || scanLoading) return;
    setScanLoading(true);
    setError(null);
    const { data, error } = await schoolApi.staffTabletScan(token, payload.trim());
    setScanLoading(false);
    if (error) {
      setResult(null);
      setError(error);
      return;
    }
    if (data) {
      setResult(data);
      setManualPayload("");
    }
  };

  const startCamera = async () => {
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setError("Scanner caméra non supporté par ce navigateur. Collez le contenu du QR dans le champ manuel.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
      cameraActiveRef.current = true;
      setCameraActive(true);
      const detector = new Detector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!videoRef.current || !canvasRef.current || !cameraActiveRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.readyState >= 2 && !scanningRef.current) {
          const ctx = canvas.getContext("2d");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const codes = await detector.detect(canvas);
            const value = codes[0]?.rawValue;
            if (value) {
              scanningRef.current = true;
              await submitScan(value);
              setTimeout(() => { scanningRef.current = false; }, 2500);
            }
          } catch {
            // Certains navigateurs lèvent une erreur temporaire si l'image n'est pas prête.
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setError("Impossible d'activer la caméra. Vérifiez l'autorisation navigateur.");
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-800">
        <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Chargement du pointage tablette...</div>
      </div>
    );
  }

  if (error && !institution) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <ShieldX className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold">Lien de pointage expiré ou désactivé</h1>
          <p className="mt-2 text-sm text-slate-500">Veuillez contacter la Direction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe,transparent_38%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-4 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-4xl flex-col justify-center gap-6">
        <header className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">SoraSchool Pointage</p>
              <h1 className="mt-1 text-3xl font-black">{institution?.name ?? "Établissement"}</h1>
              <p className="text-sm text-slate-500">Interface tablette sécurisée, réservée au scan QR du personnel.</p>
            </div>
            <div className={cn("flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold", online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
              {online ? <CheckCircle className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              {online ? "Connexion active" : "Hors connexion"}
            </div>
          </div>
        </header>

        <main className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-xl backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3"><QrCode className="h-7 w-7 text-sky-600" /></div>
              <div>
                <h2 className="text-2xl font-bold">Scanner QR code</h2>
                <p className="text-sm text-slate-500">Premier scan = arrivée, second scan = départ.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950">
              <video ref={videoRef} playsInline muted className={cn("aspect-video w-full object-cover", !cameraActive && "hidden")} />
              {!cameraActive && (
                <div className="grid aspect-video place-items-center text-center text-white">
                  <div>
                    <Camera className="mx-auto h-14 w-14 text-sky-300" />
                    <p className="mt-3 text-sm text-slate-300">Activez la caméra pour scanner une carte personnel.</p>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button disabled={!online || scanLoading} onClick={startCamera} className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-sky-500 disabled:bg-slate-300">
              {scanLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
              Activer la caméra
            </button>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="text-sm font-semibold text-slate-600">Mode manuel si caméra indisponible</label>
              <textarea value={manualPayload} onChange={(e) => setManualPayload(e.target.value)} placeholder="Coller ici le contenu du QR personnel..." className="mt-2 h-24 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:border-sky-400" />
              <button disabled={!online || scanLoading || !manualPayload.trim()} onClick={() => submitScan(manualPayload)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                Valider le scan manuel
              </button>
            </div>
          </section>

          <aside className={cn("rounded-[2rem] border p-6 shadow-xl", statusColor(result?.result))}>
            <h2 className="text-xl font-bold">Résultat immédiat</h2>
            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" /> Accès refusé</div>
                <p className="mt-2 text-sm">{error}</p>
              </div>
            )}
            {!error && !result && (
              <div className="mt-8 text-center text-slate-500">
                <QrCode className="mx-auto h-16 w-16 text-slate-300" />
                <p className="mt-3">En attente d'un scan QR.</p>
              </div>
            )}
            {result && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-500">Personnel reconnu</p>
                  <p className="mt-1 text-2xl font-black">{result.staff.firstName} {result.staff.lastName}</p>
                  <p className="text-sm text-slate-500">{result.staff.customPosition || result.staff.position} · {result.staff.matricule}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-500">Statut</p>
                  <p className="mt-1 text-2xl font-black">{result.message}</p>
                  <p className="mt-2 text-sm text-slate-500">Heure : {new Date(result.scannedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {result.attendance.penaltyAmount > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    Pénalité potentielle : {result.attendance.penaltyAmount.toLocaleString("fr-FR")} FCFA. Le personnel peut justifier, le Directeur valide.
                  </div>
                )}
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
