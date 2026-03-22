import React, { useState } from 'react';
import { WorkoutMode, SetupOptions } from '../types';
import { getAllUniqueMuscles } from '../utils/parseMuscles';
import { ChevronRight, Target, Clock, Zap, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onComplete: (options: SetupOptions) => void;
}

export default function SetupForm({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<WorkoutMode>('time-attack');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [circuits, setCircuits] = useState(3);
  const [exercisesPerCircuit, setExercisesPerCircuit] = useState(4);
  const [workInterval, setWorkInterval] = useState(45);
  const [restBetweenExercises, setRestBetweenExercises] = useState(15);
  const [restBetweenCircuits, setRestBetweenCircuits] = useState(60);

  const allMuscles = getAllUniqueMuscles();

  const handleNext = () => {
    if (step === 2 && selectedMuscles.length === 0) {
      alert("Please select at least one muscle group!");
      return;
    }
    setStep(s => s + 1);
  };

  const handleFinish = () => {
    onComplete({
      mode,
      muscles: selectedMuscles,
      circuits,
      exercisesPerCircuit,
      workInterval,
      restBetweenExercises,
      restBetweenCircuits
    });
  };

  const toggleMuscle = (m: string) => {
    if (selectedMuscles.includes(m)) {
      setSelectedMuscles(selectedMuscles.filter(x => x !== m));
    } else {
      setSelectedMuscles([...selectedMuscles, m]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl arcade-card p-6 md:p-10 rounded-xl relative overflow-hidden">
        {/* Step indicator */}
        <div className="flex justify-between mb-8 relative z-10">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-display border-2 transition-all duration-300",
                step >= i ? "border-primary bg-primary/20 neon-text-primary shadow-[0_0_10px_hsl(var(--primary))]" : "border-border text-muted-foreground bg-background"
              )}>
                {i}
              </div>
              <span className="text-xs mt-2 uppercase tracking-widest text-muted-foreground hidden sm:block">
                {i === 1 ? 'Mode' : i === 2 ? 'Target' : 'Params'}
              </span>
            </div>
          ))}
          {/* Connecting line */}
          <div className="absolute top-5 left-10 right-10 h-[2px] bg-border -z-10">
            <div 
              className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_hsl(var(--primary))]"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Mode */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-6 text-center text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
              <Settings2 className="text-secondary" /> Select Mode
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => setMode('time-attack')}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all",
                  mode === 'time-attack' 
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)_/_0.3)]" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <Clock className={cn("w-10 h-10 mb-4", mode === 'time-attack' ? "text-primary" : "text-muted-foreground")} />
                <h3 className="text-2xl font-display mb-2">Time Attack</h3>
                <p className="text-sm text-foreground/70 font-sans">Work against the clock. Intervals of work and rest.</p>
              </button>
              <button
                onClick={() => setMode('rep-quest')}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all",
                  mode === 'rep-quest' 
                    ? "border-secondary bg-secondary/10 shadow-[0_0_15px_hsl(var(--secondary)_/_0.3)]" 
                    : "border-border hover:border-secondary/50"
                )}
              >
                <Zap className={cn("w-10 h-10 mb-4", mode === 'rep-quest' ? "text-secondary" : "text-muted-foreground")} />
                <h3 className="text-2xl font-display mb-2">Rep Quest</h3>
                <p className="text-sm text-foreground/70 font-sans">Complete the target reps at your own pace.</p>
              </button>
            </div>
            <div className="mt-10 flex justify-end">
              <button onClick={handleNext} className="arcade-btn-primary px-8 py-3 rounded flex items-center gap-2">
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Muscles */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-6 text-center text-foreground uppercase tracking-widest flex items-center justify-center gap-3">
              <Target className="text-accent" /> Target Areas
            </h2>
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {allMuscles.map(m => {
                const isSelected = selectedMuscles.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMuscle(m)}
                    className={cn(
                      "px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider transition-all",
                      isSelected 
                        ? "border-accent bg-accent/20 text-accent shadow-[0_0_10px_hsl(var(--accent)_/_0.4)]" 
                        : "border-border text-foreground/60 hover:border-accent/50 hover:text-foreground"
                    )}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between mt-10">
              <button onClick={() => setStep(1)} className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest transition-colors">
                Back
              </button>
              <button onClick={handleNext} className="arcade-btn-primary px-8 py-3 rounded flex items-center gap-2">
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Parameters */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-display mb-8 text-center text-foreground uppercase tracking-widest">
              Game Settings
            </h2>
            
            <div className="space-y-6 max-w-md mx-auto">
              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-primary mb-2">
                  <span>Circuits</span>
                  <span className="text-foreground">{circuits}</span>
                </label>
                <input 
                  type="range" min="1" max="10" value={circuits} 
                  onChange={e => setCircuits(parseInt(e.target.value))}
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-primary mb-2">
                  <span>Exercises Per Circuit</span>
                  <span className="text-foreground">{exercisesPerCircuit}</span>
                </label>
                <input 
                  type="range" min="2" max="8" value={exercisesPerCircuit} 
                  onChange={e => setExercisesPerCircuit(parseInt(e.target.value))}
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {mode === 'time-attack' && (
                <div>
                  <label className="flex justify-between text-sm uppercase font-bold text-secondary mb-2">
                    <span>Work Interval (sec)</span>
                    <span className="text-foreground">{workInterval}s</span>
                  </label>
                  <input 
                    type="range" min="20" max="90" step="5" value={workInterval} 
                    onChange={e => setWorkInterval(parseInt(e.target.value))}
                    className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-secondary mb-2">
                  <span>Rest Between Exercises (sec)</span>
                  <span className="text-foreground">{restBetweenExercises}s</span>
                </label>
                <input 
                  type="range" min="0" max="60" step="5" value={restBetweenExercises} 
                  onChange={e => setRestBetweenExercises(parseInt(e.target.value))}
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="flex justify-between text-sm uppercase font-bold text-accent mb-2">
                  <span>Rest Between Circuits (sec)</span>
                  <span className="text-foreground">{restBetweenCircuits}s</span>
                </label>
                <input 
                  type="range" min="30" max="180" step="15" value={restBetweenCircuits} 
                  onChange={e => setRestBetweenCircuits(parseInt(e.target.value))}
                  className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-between mt-12">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest transition-colors">
                Back
              </button>
              <button onClick={handleFinish} className="arcade-btn-secondary px-8 py-3 rounded flex items-center gap-2">
                Generate Workout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
