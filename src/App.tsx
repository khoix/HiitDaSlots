import React, { useCallback, useState } from "react";
import {
  AppState,
  SetupOptions,
  WorkoutPlan,
  WorkoutHistoryEntry,
  SavedWorkoutEntry,
} from "./types";
import { generateWorkoutPlan } from "./utils/workoutGenerator";
import {
  appendHistoryFromPlan,
  resolveStrictExercisePool,
  setLastCompletedFromPlan,
} from "./storage/workoutLibraryStorage";
import { BgmMusicProvider } from "./context/BgmMusicContext";
import DemoLaunchPage from "./components/DemoLaunchPage";
import LandingScreen from "./components/LandingScreen";
import SetupForm from "./components/SetupForm";
import SlotReel from "./components/SlotReel";
import WorkoutReadyScreen from "./components/WorkoutReadyScreen";
import WorkoutRunner from "./components/WorkoutRunner";
import WorkoutHistoryScreen from "./components/WorkoutHistoryScreen";
import SavedWorkoutsScreen from "./components/SavedWorkoutsScreen";
import FavoriteExercisesScreen from "./components/FavoriteExercisesScreen";
import ExerciseCatalogScreen from "./components/ExerciseCatalogScreen";
import WorkoutBuilderScreen from "./components/WorkoutBuilderScreen";

function buildPlanForOptions(options: SetupOptions): WorkoutPlan {
  const mode = options.exerciseSourceMode ?? "catalog";
  const strictPool =
    mode !== "catalog" ? resolveStrictExercisePool(mode) : undefined;
  return generateWorkoutPlan(options, strictPool);
}

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isDemoLauncher = searchParams.get("demoLauncher") === "1";
  const launcherDemoUrl = searchParams.get("demoUrl");

  if (isDemoLauncher) {
    return <DemoLaunchPage demoUrl={launcherDemoUrl} />;
  }

  const [appState, setAppState] = useState<AppState>("landing");
  const [setupOptions, setSetupOptions] = useState<SetupOptions | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [builderReturn, setBuilderReturn] = useState<"landing" | "savedWorkouts">(
    "landing"
  );

  const handleSetupComplete = (options: SetupOptions) => {
    try {
      const plan = buildPlanForOptions(options);
      setSetupOptions(options);
      setWorkoutPlan(plan);
      setAppState("spinning");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not generate workout.");
    }
  };

  const handleRegenerate = () => {
    if (!setupOptions) return;
    try {
      const plan = buildPlanForOptions(setupOptions);
      setWorkoutPlan(plan);
      setAppState("spinning");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not regenerate workout.");
    }
  };

  const handleStartOver = () => {
    setSetupOptions(null);
    setWorkoutPlan(null);
    setAppState("landing");
  };

  const handleWorkoutFinished = useCallback(() => {
    if (workoutPlan) {
      appendHistoryFromPlan(workoutPlan);
      setLastCompletedFromPlan(workoutPlan);
    }
    setAppState("landing");
  }, [workoutPlan]);

  const replayFromHistory = (entry: WorkoutHistoryEntry) => {
    setSetupOptions(entry.plan.options);
    setWorkoutPlan(entry.plan);
    setAppState("ready");
  };

  const replaySavedWorkout = (entry: SavedWorkoutEntry) => {
    setSetupOptions(entry.plan.options);
    setWorkoutPlan(entry.plan);
    setAppState("ready");
  };

  const playPlanFromBuilder = (plan: WorkoutPlan) => {
    setSetupOptions(plan.options);
    setWorkoutPlan(plan);
    setAppState("ready");
  };

  return (
    <BgmMusicProvider>
      <div className="min-h-screen w-full bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
        <main className="flex min-h-screen w-full flex-col">
          {appState === "landing" && (
            <LandingScreen
              onStart={() => setAppState("setup")}
              onOpenHistory={() => setAppState("history")}
              onOpenCatalog={() => setAppState("exerciseCatalog")}
              onOpenSavedWorkouts={() => setAppState("savedWorkouts")}
              onOpenFavoriteExercises={() => setAppState("favoriteExercises")}
              onOpenWorkoutBuilder={() => {
                setBuilderReturn("landing");
                setAppState("workoutBuilder");
              }}
            />
          )}

          {appState === "setup" && (
            <SetupForm
              onComplete={handleSetupComplete}
              onCancel={() => setAppState("landing")}
            />
          )}

          {appState === "history" && (
            <WorkoutHistoryScreen
              onBack={() => setAppState("landing")}
              onReplay={replayFromHistory}
            />
          )}

          {appState === "savedWorkouts" && (
            <SavedWorkoutsScreen
              onBack={() => setAppState("landing")}
              onReplay={replaySavedWorkout}
              onOpenBuilder={() => {
                setBuilderReturn("savedWorkouts");
                setAppState("workoutBuilder");
              }}
            />
          )}

          {appState === "favoriteExercises" && (
            <FavoriteExercisesScreen onBack={() => setAppState("landing")} />
          )}

          {appState === "exerciseCatalog" && (
            <ExerciseCatalogScreen onBack={() => setAppState("landing")} />
          )}

          {appState === "workoutBuilder" && (
            <WorkoutBuilderScreen
              onBack={() => setAppState(builderReturn)}
              onPlayPlan={playPlanFromBuilder}
            />
          )}

          {appState === "spinning" && workoutPlan && (
            <SlotReel
              plan={workoutPlan}
              onComplete={() => setAppState("ready")}
            />
          )}

          {appState === "ready" && workoutPlan && (
            <WorkoutReadyScreen
              plan={workoutPlan}
              onStart={() => setAppState("running")}
              onRegenerate={handleRegenerate}
              onUpdatePlan={(p) => setWorkoutPlan(p)}
              onStartOver={handleStartOver}
            />
          )}

          {appState === "running" && workoutPlan && (
            <WorkoutRunner
              plan={workoutPlan}
              onFinish={handleWorkoutFinished}
              onQuit={() => setAppState("ready")}
            />
          )}
        </main>
      </div>
    </BgmMusicProvider>
  );
}

export default App;
