import React, { useState } from 'react';
import { WorkoutPlan } from '../types';
import { Save, X, RefreshCw } from 'lucide-react';
import { clampLoopCount, rerollExercise } from '../utils/workoutGenerator';
import { playSound } from '../audio/playSfx';
import { SOUNDS } from '../audio/soundManifest';
import { isBilateralHold, isHoldExercise } from '../utils/repDifficulty';

interface Props {
  plan: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => void;
  onCancel: () => void;
}

export default function WorkoutEditor({ plan: initialPlan, onSave, onCancel }: Props) {
  const [draftPlan, setDraftPlan] = useState<WorkoutPlan>(initialPlan);

  const formatTargetLabel = (exItem: any) => {
    if (draftPlan.options.mode === 'time-attack') {
      return `${exItem.targetTime}s`;
    }
    if (isHoldExercise(exItem.exercise) && exItem.targetTime) {
      return isBilateralHold(exItem.exercise)
        ? `${exItem.targetTime}s / side`
        : `${exItem.targetTime}s`;
    }
    return `${exItem.targetReps} reps`;
  };

  const handleReroll = (circuitId: string, itemId: string) => {
    playSound(SOUNDS.uiSelect);
    setDraftPlan(rerollExercise(draftPlan, circuitId, itemId));
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 py-12 px-4 max-w-4xl mx-auto pb-32 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display neon-text-secondary uppercase">Edit Mode</h1>
          <p className="text-muted-foreground mt-1">Swap out exercises you don't like.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="p-3 text-muted-foreground hover:text-destructive transition-colors">
            <X size={24} />
          </button>
          <button onClick={() => onSave(draftPlan)} className="arcade-btn-primary px-6 py-2 rounded flex items-center gap-2">
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {draftPlan.circuits.map((circuit) => (
          <div key={circuit.id} className="arcade-card p-6 rounded-xl border-secondary/30">
            <h3 className="text-xl font-display text-secondary mb-4 uppercase tracking-widest flex items-center gap-2 flex-wrap">
              Circuit {circuit.circuitNumber}
              {clampLoopCount(circuit.loopCount) > 1 ? (
                <span className="font-mono text-sm text-muted-foreground tabular-nums">
                  ×{clampLoopCount(circuit.loopCount)}
                </span>
              ) : null}
            </h3>
            
            <div className="space-y-3">
              {circuit.items.map((item) => {
                if (item.type === 'rest') return null; // Hide rests in simple edit mode
                const exItem = item as any;
                
                const exName = exItem.exercise.exercise;

                return (
                  <div key={item.id} className="bg-background border border-border p-3 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-colors gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-lg truncate">{exName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {exItem.exercise.muscles} • {formatTargetLabel(exItem)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReroll(circuit.id, item.id)}
                        className="p-3 text-primary bg-primary/10 rounded hover:bg-primary hover:text-primary-foreground transition-colors group-hover:animate-pulse"
                        title="Reroll Exercise"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
