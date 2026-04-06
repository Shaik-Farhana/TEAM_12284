import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

export function SoundscapePlayer({ isUserAway }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef(null);
  
  // High-quality lofi focus track (royalty free)
  const trackUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"; 

  useEffect(() => {
    if (audioRef.current) {
        // Increase volume to 100% when user is away to "call them back"
        audioRef.current.volume = isUserAway ? 1.0 : volume;
    }
  }, [isUserAway, volume]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/50 flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 tracking-wider">Soundscape</span>
        </div>
        <button 
            onClick={togglePlay}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
            {isPlaying ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      <audio 
        ref={audioRef}
        src={trackUrl}
        loop
      />
      
      <div className="w-full flex items-center gap-2">
         <span className="text-[10px] text-slate-400 font-bold">Vol</span>
         <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
         />
      </div>
      
      {isUserAway && isPlaying && (
        <span className="text-[10px] text-indigo-500 font-bold animate-pulse text-center">
            Pulsing for focus...
        </span>
      )}
    </div>
  );
}
