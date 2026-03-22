import React, { useState } from 'react';
import { WorkoutPlan } from '../types';
import { formatSeconds } from '../utils/timeUtils';
import { Play, Edit2, RotateCcw, Clock, Zap, Target } from 'lucide-react';
import WorkoutEditor from './WorkoutEditor';

interface Props {
  plan: WorkoutPlan;
  onStart: () => void;
  onRegenerate: () => void;
  onUpdatePlan: (newPlan: WorkoutPlan) => void;
  onStartOver: () => void;
}

export default function WorkoutReadyScreen({ plan, onStart, onRegenerate, onUpdatePlan, onStartOver }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <WorkoutEditor 
        plan={plan} 
        onSave={(newPlan) => {
          onUpdatePlan(newPlan);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 max-w-4xl mx-auto pb-32">
      {/* Header Summary */}
      <div className="arcade-card p-6 md:p-8 rounded-xl mb-8 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 text-primary/10">
          {plan.options.mode === 'time-attack' ? <Clock size={200} /> : <Zap size={200} />}
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            {plan.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-secondary/20 text-secondary border border-secondary/50 rounded-full text-xs font-bold uppercase tracking-widest">
                {tag}
              </span>
            ))}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-display mb-2 neon-text-primary uppercase">
            Workout Ready
          </h1>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm font-sans">
            <div>
              <p className="text-muted-foreground uppercase text-xs font-bold mb-1">Mode</p>
              <p className="text-foreground flex items-center gap-1">
                {plan.options.mode === 'time-attack' ? <Clock size={16} className="text-primary"/> : <Zap size={16} className="text-secondary"/>}
                {plan.options.mode === 'time-attack' ? 'Time Attack' : 'Rep Quest'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-bold mb-1">Duration</p>
              <p className="text-foreground font-mono">{formatSeconds(plan.estimatedDurationSeconds)}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-bold mb-1">Circuits</p>
              <p className="text-foreground">{plan.circuits.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-bold mb-1">Targets</p>
              <p className="text-foreground truncate" title={plan.options.muscles.join(', ')}>
                {plan.options.muscles.length > 0 ? plan.options.muscles.join(', ') : 'Full Body'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Circuit List (Read-only preview) */}
      <div className="space-y-12">
        {plan.circuits.map((circuit) => (
          <div key={circuit.id} className="relative">
            <h3 className="text-2xl font-display text-accent mb-6 flex items-center gap-4 before:h-[2px] before:flex-1 before:bg-gradient-to-r before:from-transparent before:to-accent/50 after:h-[2px] after:flex-1 after:bg-gradient-to-l after:from-transparent after:to-accent/50">
              Circuit {circuit.circuitNumber}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {circuit.items.filter(i => i.type === 'exercise').map((item, idx) => {
                const exItem = item as any;
                return (
                  <div key={item.id} className="arcade-card p-4 rounded-lg flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-background border border-primary/30 flex items-center justify-center font-display text-xl text-primary/80">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-display text-lg tracking-wide">{exItem.exercise.exercise}</h4>
                      <p className="text-sm text-muted-foreground font-sans">
                        {plan.options.mode === 'time-attack' 
                          ? `${exItem.targetTime} sec` 
                          : `${exItem.targetReps} reps`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action Bar - fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border flex flex-wrap justify-center gap-4 z-50">
        <button onClick={onStartOver} className="px-6 py-3 text-muted-foreground hover:text-foreground font-display uppercase tracking-widest text-sm transition-colors">
          Start Over
        </button>
        <button onClick={onRegenerate} className="arcade-btn-secondary px-6 py-3 rounded flex items-center gap-2 text-sm">
          <RotateCcw size={18} /> Spin Again
        </button>
        <button onClick={() => setIsEditing(true)} className="px-6 py-3 border border-border hover:border-primary text-foreground rounded font-display uppercase tracking-widest text-sm transition-colors flex items-center gap-2">
          <Edit2 size={18} /> Edit
        </button>
        <button onClick={onStart} className="arcade-btn-primary px-8 py-3 rounded flex items-center gap-2 animate-pulse-glow">
          <Play size={20} className="fill-current" /> START WORKOUT
        </button>
      </div>
    </div>
  );
}
