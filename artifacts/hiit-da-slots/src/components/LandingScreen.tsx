import React from 'react';
import { Play } from 'lucide-react';

interface Props {
  onStart: () => void;
}

export default function LandingScreen({ onStart }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative z-10">
      {/* Decorative neon elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>
      
      <div className="mb-12">
        <h1 className="text-6xl md:text-8xl font-display glitch-wrapper neon-text-primary tracking-tighter">
          <span className="glitch" data-text="HIIT DA SLOTS">HIIT DA SLOTS</span>
        </h1>
        <p className="mt-6 text-xl md:text-2xl text-foreground/80 max-w-lg mx-auto font-sans tracking-wide">
          Gamble with your sweat. Roll the slots, crush the workout.
        </p>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
        <button 
          onClick={onStart}
          className="relative arcade-btn-primary px-12 py-5 text-2xl rounded-lg font-bold flex items-center gap-3 bg-background"
        >
          <Play className="w-8 h-8 fill-current" />
          INSERT COIN TO PLAY
        </button>
      </div>
    </div>
  );
}
