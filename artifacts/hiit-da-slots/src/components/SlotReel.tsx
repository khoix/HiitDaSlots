import React, { useEffect, useState } from 'react';
import { WorkoutPlan } from '../types';

interface Props {
  plan: WorkoutPlan;
  onComplete: () => void;
}

export default function SlotReel({ plan, onComplete }: Props) {
  const [phase, setPhase] = useState<'spinning' | 'stopping' | 'done'>('spinning');
  
  // Extract all unique exercises from the plan to show in the final view quickly
  const exerciseNames = plan.circuits.flatMap(c => 
    c.items.filter(i => i.type === 'exercise').map(i => (i as any).exercise.exercise)
  );
  
  // Create a long array for the blur spin effect
  const dummyData = Array.from({length: 30}, (_, i) => exerciseNames[i % exerciseNames.length] || `ITEM ${i}`);

  useEffect(() => {
    // Sequence the animation
    const stopTimer = setTimeout(() => setPhase('stopping'), 2000);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete(); // Move to ready screen after viewing jackpot
    }, 4000);
    
    return () => {
      clearTimeout(stopTimer);
      clearTimeout(doneTimer);
    }
  }, [onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h2 className="text-4xl md:text-6xl font-display mb-12 neon-text-primary uppercase tracking-widest animate-pulse">
        {phase === 'done' ? 'JACKPOT!' : 'ROLLING...'}
      </h2>
      
      <div className="flex gap-4 md:gap-8 justify-center">
        {/* We render 3 slot windows for aesthetic */}
        {[0, 1, 2].map((reelIdx) => (
          <div key={reelIdx} className="slot-window w-24 md:w-48 h-48 md:h-64 flex flex-col items-center justify-center text-center">
            {phase === 'spinning' && (
              <div className="w-full flex flex-col items-center animate-spin-reel">
                {dummyData.map((text, i) => (
                  <div key={i} className="py-4 text-xl md:text-3xl font-display text-white opacity-50 whitespace-nowrap">
                    {text}
                  </div>
                ))}
              </div>
            )}
            
            {(phase === 'stopping' || phase === 'done') && (
              <div className="text-2xl md:text-4xl font-display text-secondary animate-in zoom-in spin-in-12 duration-500 neon-text-secondary drop-shadow-lg p-4 break-words">
                {exerciseNames[reelIdx % exerciseNames.length]}
              </div>
            )}
            
            {/* Horizontal line for crosshair */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-primary/50 shadow-[0_0_10px_hsl(var(--primary))] z-10 pointer-events-none"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
