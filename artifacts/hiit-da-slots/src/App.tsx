import React, { useState } from 'react';
import { AppState, SetupOptions, WorkoutPlan } from './types';
import { generateWorkoutPlan } from './utils/workoutGenerator';
import LandingScreen from './components/LandingScreen';
import SetupForm from './components/SetupForm';
import SlotReel from './components/SlotReel';
import WorkoutReadyScreen from './components/WorkoutReadyScreen';
import WorkoutRunner from './components/WorkoutRunner';

function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [setupOptions, setSetupOptions] = useState<SetupOptions | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);

  const handleSetupComplete = (options: SetupOptions) => {
    setSetupOptions(options);
    const plan = generateWorkoutPlan(options);
    setWorkoutPlan(plan);
    setAppState('spinning');
  };

  const handleRegenerate = () => {
    if (setupOptions) {
      const plan = generateWorkoutPlan(setupOptions);
      setWorkoutPlan(plan);
      setAppState('spinning');
    }
  };

  const handleStartOver = () => {
    setSetupOptions(null);
    setWorkoutPlan(null);
    setAppState('landing');
  };

  return (
    <div className="w-full min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      {appState === 'landing' && (
        <LandingScreen onStart={() => setAppState('setup')} />
      )}
      
      {appState === 'setup' && (
        <SetupForm onComplete={handleSetupComplete} />
      )}
      
      {appState === 'spinning' && workoutPlan && (
        <SlotReel 
          plan={workoutPlan} 
          onComplete={() => setAppState('ready')} 
        />
      )}
      
      {appState === 'ready' && workoutPlan && (
        <WorkoutReadyScreen 
          plan={workoutPlan}
          onStart={() => setAppState('running')}
          onRegenerate={handleRegenerate}
          onUpdatePlan={(p) => setWorkoutPlan(p)}
          onStartOver={handleStartOver}
        />
      )}
      
      {appState === 'running' && workoutPlan && (
        <WorkoutRunner 
          plan={workoutPlan}
          onFinish={() => setAppState('landing')}
          onQuit={() => setAppState('ready')}
        />
      )}
    </div>
  );
}

export default App;
