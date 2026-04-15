import React, { Suspense, lazy, useCallback, useState } from "react";
import {
  AppState,
  SetupOptions,
  WorkoutPlan,
  WorkoutHistoryEntry,
  SavedWorkoutEntry,
} from "./types";
import {
  generateWorkoutPlan,
  reapplyPlanExerciseTargets,
} from "./utils/workoutGenerator";
import {
  appendHistoryFromPlan,
  resolveStrictExercisePool,
  setLastCompletedFromPlan,
} from "./storage/workoutLibraryStorage";
import { BgmMusicProvider } from "./context/BgmMusicContext";
import {
  SessionMediaProvider,
  SessionMediaWorkoutBridge,
} from "./context/SessionMediaContext";
import LandingScreen from "./components/LandingScreen";
import SetupForm from "./components/SetupForm";
import SlotReel from "./components/SlotReel";
import WorkoutReadyScreen from "./components/WorkoutReadyScreen";
import WorkoutRunner from "./components/WorkoutRunner";

const DemoLaunchPage = lazy(() => import("./components/DemoLaunchPage"));
const WorkoutHistoryScreen = lazy(() => import("./components/WorkoutHistoryScreen"));
const SavedWorkoutsScreen = lazy(() => import("./components/SavedWorkoutsScreen"));
const FavoriteExercisesScreen = lazy(
  () => import("./components/FavoriteExercisesScreen")
);
const ExerciseCatalogScreen = lazy(() => import("./components/ExerciseCatalogScreen"));
const WorkoutBuilderScreen = lazy(() => import("./components/WorkoutBuilderScreen"));

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
    return (
      <Suspense fallback={null}>
        <DemoLaunchPage demoUrl={launcherDemoUrl} />
      </Suspense>
    );
  }

  const [appState, setAppState] = useState<AppState>("landing");
  const [setupOptions, setSetupOptions] = useState<SetupOptions | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [activeSavedWorkoutId, setActiveSavedWorkoutId] = useState<string | null>(null);
  const [activeSavedWorkoutName, setActiveSavedWorkoutName] = useState<string | null>(null);
  const [builderReturn, setBuilderReturn] = useState<"landing" | "savedWorkouts">(
    "landing"
  );

  const handleSetupComplete = (options: SetupOptions) => {
    try {
      const plan = buildPlanForOptions(options);
      setSetupOptions(options);
      setWorkoutPlan(plan);
      setActiveSavedWorkoutId(null);
      setActiveSavedWorkoutName(null);
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
      setActiveSavedWorkoutId(null);
      setActiveSavedWorkoutName(null);
      setAppState("spinning");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not regenerate workout.");
    }
  };

  const handleStartOver = () => {
    setSetupOptions(null);
    setWorkoutPlan(null);
    setActiveSavedWorkoutId(null);
    setActiveSavedWorkoutName(null);
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
    const normalizedPlan = reapplyPlanExerciseTargets(entry.plan);
    setSetupOptions(entry.plan.options);
    setWorkoutPlan(normalizedPlan);
    setActiveSavedWorkoutId(null);
    setActiveSavedWorkoutName(null);
    setAppState("ready");
  };

  const replaySavedWorkout = (entry: SavedWorkoutEntry) => {
    const normalizedPlan = reapplyPlanExerciseTargets(entry.plan);
    setSetupOptions(entry.plan.options);
    setWorkoutPlan(normalizedPlan);
    setActiveSavedWorkoutId(entry.id);
    setActiveSavedWorkoutName(entry.name);
    setAppState("ready");
  };

  const playPlanFromBuilder = (plan: WorkoutPlan) => {
    setSetupOptions(plan.options);
    setWorkoutPlan(plan);
    setActiveSavedWorkoutId(null);
    setActiveSavedWorkoutName(null);
    setAppState("ready");
  };

  return (
    <BgmMusicProvider>
      <SessionMediaProvider appState={appState}>
        <SessionMediaWorkoutBridge workoutRunning={appState === "running"} />
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
            <Suspense fallback={null}>
              <WorkoutHistoryScreen
                onBack={() => setAppState("landing")}
                onReplay={replayFromHistory}
              />
            </Suspense>
          )}

          {appState === "savedWorkouts" && (
            <Suspense fallback={null}>
              <SavedWorkoutsScreen
                onBack={() => setAppState("landing")}
                onReplay={replaySavedWorkout}
                onOpenBuilder={() => {
                  setBuilderReturn("savedWorkouts");
                  setAppState("workoutBuilder");
                }}
              />
            </Suspense>
          )}

          {appState === "favoriteExercises" && (
            <Suspense fallback={null}>
              <FavoriteExercisesScreen onBack={() => setAppState("landing")} />
            </Suspense>
          )}

          {appState === "exerciseCatalog" && (
            <Suspense fallback={null}>
              <ExerciseCatalogScreen onBack={() => setAppState("landing")} />
            </Suspense>
          )}

          {appState === "workoutBuilder" && (
            <Suspense fallback={null}>
              <WorkoutBuilderScreen
                onBack={() => setAppState(builderReturn)}
                onPlayPlan={playPlanFromBuilder}
              />
            </Suspense>
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
              savedWorkoutId={activeSavedWorkoutId}
              savedWorkoutName={activeSavedWorkoutName}
              onSavedWorkoutLinked={(id) => {
                setActiveSavedWorkoutId(id);
                if (!id) setActiveSavedWorkoutName(null);
              }}
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
      </SessionMediaProvider>
    </BgmMusicProvider>
  );
}

export default App;
