import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Camera } from 'lucide-react';

const FOCUS_THRESHOLD_S = 2.0; 

export function FocusWatcher({ onDriftDetected, onStatusUpdate, onDistractionEnded, visionEnabled, onDisable }) {
  const videoRef = useRef(null);
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [stream, setStream] = useState(null);
  const [awayTimer, setAwayTimer] = useState(0);
  const [isUserAway, setIsUserAway] = useState(false);
  const lastProcessed = useRef(Date.now());
  const awayStartTimeRef = useRef(null);
  const [currentLabel, setCurrentLabel] = useState('Engaged');
  // Keep refs to current values so cleanup callbacks can access them
  const isUserAwayRef = useRef(false);
  const awayTimerRef = useRef(0);
  const onDistractionEndedRef = useRef(onDistractionEnded);
  useEffect(() => { onDistractionEndedRef.current = onDistractionEnded; }, [onDistractionEnded]);
  // Keep refs in sync with state so cleanup can read latest values
  useEffect(() => { isUserAwayRef.current = isUserAway; }, [isUserAway]);
  useEffect(() => { awayTimerRef.current = awayTimer; }, [awayTimer]);
  // Initialize MediaPipe
  useEffect(() => {
    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setFaceLandmarker(landmarker);
      } catch (err) {
        console.error("Failed to init MediaPipe:", err);
      }
    }
    initMediaPipe();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update parent when status changes
  useEffect(() => {
    onStatusUpdate?.({ 
        isAway: isUserAway, 
        timeAway: Math.round(awayTimer * 10) / 10,
        isActive: isWatching 
    });
  }, [isUserAway, awayTimer, isWatching, onStatusUpdate]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 160, height: 120, facingMode: "user" } 
      });
      setStream(s);
      setIsWatching(true);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopCamera = () => {
    // If user was away when camera stops, record that distraction now
    if (isUserAwayRef.current && awayStartTimeRef.current) {
      const elapsed = (Date.now() - awayStartTimeRef.current) / 1000;
      if (elapsed > 1.2) {
        onDistractionEndedRef.current?.(Math.round(elapsed * 10) / 10);
      }
      awayStartTimeRef.current = null;
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsWatching(false);
    onDisable?.();
  };

  useEffect(() => {
    if (visionEnabled && !isWatching) {
        startCamera();
    } else if (!visionEnabled && isWatching) {
        stopCamera();
    }
  }, [visionEnabled]); // Auto-start/stop based on prop

  // Ensure stream is attached when video element renders
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.error("Video play failed:", e));
      };
    }
  }, [stream, isWatching]);

  useEffect(() => {
    if (!faceLandmarker || !isWatching || !videoRef.current) return;

    let requestRef;
    const detect = () => {
      const now = Date.now();
      if (videoRef.current && videoRef.current.readyState >= 2 && now - lastProcessed.current > 100) {
        const results = faceLandmarker.detectForVideo(videoRef.current, now);
        let lookAwayLabel = null;
        
        if (results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const blendshapes = results.faceBlendshapes[0]?.categories || [];
            
            // 1. Yaw (Side to Side)
            const nose = landmarks[1];
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];
            const eyeDist = Math.abs(rightEye.x - leftEye.x);
            const noseOffset = Math.abs((nose.x - leftEye.x) - (rightEye.x - nose.x));
            const isLookingLeftRight = noseOffset > eyeDist * 0.45; 

            // 2. Pitch (Bowed Down / Up)
            // Heuristic: Y distance between eyes and nose
            const eyeY = (leftEye.y + rightEye.y) / 2;
            const eyeToNoseY = Math.abs(nose.y - eyeY);
            const isBowed = eyeToNoseY < eyeDist * 0.15 || eyeToNoseY > eyeDist * 0.6;

            // 3. Eyes Closed (Drowsiness/Blink)
            const blinkLeft = blendshapes.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
            const blinkRight = blendshapes.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;
            const areEyesClosed = (blinkLeft + blinkRight) / 2 > 0.65; // User says "close my eyes"

            if (isLookingLeftRight) lookAwayLabel = "Looking Away";
            else if (isBowed) lookAwayLabel = "Head Bowed";
            else if (areEyesClosed) lookAwayLabel = "Eyes Closed";

            if (lookAwayLabel) {
                if (!awayStartTimeRef.current) awayStartTimeRef.current = now;
                const elapsedS = (now - awayStartTimeRef.current) / 1000;
                setAwayTimer(elapsedS);

                if (elapsedS >= FOCUS_THRESHOLD_S && !isUserAway) {
                    setIsUserAway(true);
                    setCurrentLabel("Looking Away");
                    onDriftDetected?.(lookAwayLabel);
                }
            } else {
                if (awayStartTimeRef.current) {
                    const elapsedS = (now - awayStartTimeRef.current) / 1000;
                    // Cap at 12 hours just for sanity
                    const cappedElapsedS = Math.min(elapsedS, 43200);
                    if (cappedElapsedS > 1.2) {
                        onDistractionEnded?.(Math.round(cappedElapsedS * 10) / 10);
                    }
                    awayStartTimeRef.current = null;
                }
                setAwayTimer(0);
                setCurrentLabel("Engaged");
                if (isUserAway) setIsUserAway(false);
            }
        } else {
            lookAwayLabel = "Not in Frame";
            if (!awayStartTimeRef.current) awayStartTimeRef.current = now;
            const elapsedS = (now - awayStartTimeRef.current) / 1000;
            setAwayTimer(elapsedS);

            if (elapsedS >= FOCUS_THRESHOLD_S && !isUserAway) {
                setIsUserAway(true);
                setCurrentLabel("Taking a Break");
                onDriftDetected?.("User completely off camera");
            }
        }
        lastProcessed.current = now;
      }

      requestRef = requestAnimationFrame(detect);
    };

    requestRef = requestAnimationFrame(detect);
    return () => {
      cancelAnimationFrame(requestRef);
      // On unmount/stop — flush any in-progress away period so it isn't lost
      if (isUserAwayRef.current && awayStartTimeRef.current) {
        const elapsed = (Date.now() - awayStartTimeRef.current) / 1000;
        if (elapsed > 1.2) {
          onDistractionEndedRef.current?.(Math.round(elapsed * 10) / 10);
        }
        awayStartTimeRef.current = null;
      }
    };
  }, [faceLandmarker, isWatching, isUserAway, onDriftDetected, onDistractionEnded]);

  return (
    <div className="flex flex-col p-5 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-sm transition-all overflow-hidden w-full relative group">
      
      <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-400">Attention Monitor</h4>
          {visionEnabled && isWatching && (
              <button onClick={stopCamera} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Turn Off Camera">
                  ✕
              </button>
          )}
      </div>

      <div className="relative w-full aspect-video rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden mb-5 border border-slate-200 dark:border-slate-800 flex justify-center items-center">
        {!isWatching ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                <Camera className="w-8 h-8 opacity-30 mb-1" />
                <button 
                    onClick={startCamera}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg font-bold transition-colors shadow-sm border border-indigo-100 dark:border-indigo-800"
                >
                    Enable Tracking
                </button>
             </div>
        ) : (
            <>
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`h-full max-w-[160px] object-cover -scale-x-100 opacity-90 transition-all ${isUserAway ? 'grayscale opacity-40' : ''}`} 
                />
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full border-[3px] border-white dark:border-slate-900 ${isUserAway ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`}></div>
            </>
        )}
      </div>
      
      {isWatching && (
          <div className="space-y-4 text-center">
              <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">Status:</span>
                  <span className={`text-sm font-black ${isUserAway ? 'text-amber-500' : 'text-emerald-500'}`}>{currentLabel}</span>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-tight px-2">
                       Local processing only.<br/>No video is uploaded.
                  </p>
              </div>
          </div>
      )}
    </div>
  );
}
