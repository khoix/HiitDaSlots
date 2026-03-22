import React, { useState, useEffect, useRef } from 'react';
import { WorkoutPlan, WorkoutItem, ExerciseWorkoutItem, RestWorkoutItem } from '../types';
import { formatSeconds } from '../utils/timeUtils';
import { Play, Pause, FastForward, CheckCircle, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  plan: WorkoutPlan;
  onFinish: () => void;
  onQuit: () => void;
}

export default function WorkoutRunner({ plan, onFinish, onQuit }: Props) {
  // Flatten items for linear progression
  const flatItems = plan.circuits.flatMap(c => 
    c.items.map(item => ({ ...item, circuitNum: c.circuitNumber }))
  );
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const currentItem = flatItems[currentIndex] as any;
  const isDone = currentIndex >= flatItems.length;

  // Initialize timer when item changes
  useEffect(() => {
    if (isDone) return;
    
    if (currentItem.type === 'rest') {
      setTimeLeft(currentItem.duration);
      setIsRunning(true);
    } else if (currentItem.type === 'exercise' && plan.options.mode === 'time-attack') {
      setTimeLeft(currentItem.targetTime);
      setIsRunning(false); // Wait for user to tap start for the first exercise
    } else {
      setTimeLeft(null); // Rep quest exercise
      setIsRunning(false);
    }
  }, [currentIndex, isDone, currentItem?.id]);

  // Tick timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isRunning && timeLeft !== null && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft(t => (t !== null ? t - 1 : null));
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      handleNext(); // auto advance when time is up
    }
    return () => clearInterval(intervalId);
  }, [isRunning, timeLeft]);

  const handleNext = () => {
    if (currentIndex < flatItems.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setCurrentIndex(flatItems.length); // Trigger done state
    }
  };

  const toggleTimer = () => setIsRunning(!isRunning);

  if (isDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-32 h-32 text-primary mb-8 animate-bounce" />
        <h1 className="text-6xl font-display neon-text-primary uppercase mb-4">Workout Complete!</h1>
        <p className="text-xl text-muted-foreground mb-12">You crushed {plan.circuits.length} circuits.</p>
        <button onClick={onFinish} className="arcade-btn-primary px-12 py-4 text-xl rounded">
          CLAIM REWARD
        </button>
      </div>
    );
  }

  const progressPct = ((currentIndex) / flatItems.length) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Progress Bar Top */}
      <div className="h-2 w-full bg-border fixed top-0 left-0 z-50">
        <div 
          className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-muted-foreground text-sm uppercase tracking-widest font-bold mb-4">
          Circuit {currentItem.circuitNum} of {plan.circuits.length}
        </div>

        {currentItem.type === 'rest' ? (
          // REST VIEW
          <div className="w-full max-w-md arcade-card p-10 rounded-2xl flex flex-col items-center text-center border-secondary/50">
            <h2 className="text-4xl font-display text-secondary uppercase mb-6 neon-text-secondary">Rest</h2>
            <div className="text-8xl font-display font-mono text-white mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              {formatSeconds(timeLeft || 0)}
            </div>
            
            {/* Next up preview */}
            {currentIndex < flatItems.length - 1 && flatItems[currentIndex + 1].type === 'exercise' && (
              <div className="mt-4 p-4 bg-background/50 rounded-lg w-full border border-border">
                <p className="text-xs text-muted-foreground uppercase mb-1">Up Next</p>
                <p className="text-lg font-display text-primary truncate">
                  {(flatItems[currentIndex + 1] as ExerciseWorkoutItem).exercise.exercise}
                </p>
              </div>
            )}
          </div>
        ) : (
          // EXERCISE VIEW
          <div className={cn(
            "w-full max-w-lg arcade-card p-8 md:p-12 rounded-2xl flex flex-col items-center text-center transition-all duration-500",
            isRunning ? "border-primary shadow-[0_0_30px_hsl(var(--primary)_/_0.2)]" : "border-border"
          )}>
            <h2 className="text-4xl md:text-5xl font-display text-white uppercase mb-8 leading-tight">
              {currentItem.exercise.exercise}
            </h2>
            
            {plan.options.mode === 'time-attack' ? (
              <div className="flex flex-col items-center">
                <div className={cn(
                  "text-8xl font-display font-mono mb-8 transition-colors",
                  timeLeft !== null && timeLeft <= 5 ? "text-destructive neon-text-destructive" : "text-primary neon-text-primary"
                )}>
                  {formatSeconds(timeLeft || 0)}
                </div>
                
                <div className="flex gap-4">
                  <button onClick={toggleTimer} className="w-20 h-20 rounded-full border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                    {isRunning ? <Pause size={32} /> : <Play size={32} className="ml-2" />}
                  </button>
                  <button onClick={handleNext} className="w-20 h-20 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center hover:border-foreground hover:text-foreground transition-colors">
                    <FastForward size={32} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="text-7xl font-display text-secondary neon-text-secondary mb-12">
                  {currentItem.targetReps}
                </div>
                
                <button onClick={handleNext} className="arcade-btn-secondary px-10 py-5 rounded-xl text-2xl flex items-center gap-3">
                  <CheckCircle size={28} /> DONE
                </button>
              </div>
            )}
            
            <div className="mt-8 text-sm text-muted-foreground max-w-xs font-sans">
              {currentItem.exercise.description}
            </div>
          </div>
        )}
      </div>

      <button onClick={onQuit} className="absolute top-6 right-6 text-muted-foreground hover:text-destructive font-display uppercase tracking-widest text-xs">
        Quit
      </button>
    </div>
  );
}
