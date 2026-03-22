import React, { useState } from 'react';
import { WorkoutPlan } from '../types';
import { Save, X, RefreshCw, Trash2 } from 'lucide-react';
import { rerollExercise } from '../utils/workoutGenerator';

interface Props {
  plan: WorkoutPlan;
  onSave: (plan: WorkoutPlan) => void;
  onCancel: () => void;
}

export default function WorkoutEditor({ plan: initialPlan, onSave, onCancel }: Props) {
  const [draftPlan, setDraftPlan] = useState<WorkoutPlan>(initialPlan);

  const handleReroll = (circuitId: string, itemId: string) => {
    setDraftPlan(rerollExercise(draftPlan, circuitId, itemId));
  };

  return (
    <div className="min-h-screen py-12 px-4 max-w-4xl mx-auto pb-32">
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
            <h3 className="text-xl font-display text-secondary mb-4 uppercase tracking-widest">
              Circuit {circuit.circuitNumber}
            </h3>
            
            <div className="space-y-3">
              {circuit.items.map((item) => {
                if (item.type === 'rest') return null; // Hide rests in simple edit mode
                const exItem = item as any;
                
                return (
                  <div key={item.id} className="bg-background border border-border p-3 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-display text-lg">{exItem.exercise.exercise}</h4>
                      <p className="text-sm text-muted-foreground">
                        {exItem.exercise.muscles} • {draftPlan.options.mode === 'time-attack' ? `${exItem.targetTime}s` : `${exItem.targetReps} reps`}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleReroll(circuit.id, item.id)}
                      className="p-3 text-primary bg-primary/10 rounded hover:bg-primary hover:text-primary-foreground transition-colors group-hover:animate-pulse"
                      title="Reroll Exercise"
                    >
                      <RefreshCw size={20} />
                    </button>
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
