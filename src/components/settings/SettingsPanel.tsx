"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { defaultPreferences, loadLocalPreferences, saveLocalPreferences, type LocalPreferences } from "@/lib/preferences";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function SettingsPanel() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreferences(loadLocalPreferences());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async () => {
    saveLocalPreferences(preferences);
    const supabase = getSupabaseBrowserClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (supabase && user) {
      await supabase.from("user_preferences").upsert({
        user_id: user.id,
        default_session_length: preferences.defaultSessionLength,
        adaptive_mode: preferences.adaptive,
        sound_enabled: preferences.sound,
        midi_sound_enabled: preferences.midiSound,
        theme: theme ?? "system",
      }, { onConflict: "user_id" });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggle = (key: keyof Omit<LocalPreferences, "defaultSessionLength">, label: string, description: string) => (
    <label className="flex items-center justify-between gap-5 rounded-xl border border-slate-800 p-4"><span><span className="block text-sm font-medium text-white">{label}</span><span className="mt-1 block text-xs text-slate-400">{description}</span></span><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} /></label>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-bold text-white">Settings</h1>
      <Card className="mt-8 space-y-5 p-6">
        <label className="block text-sm text-slate-300">Theme<select value={theme ?? "system"} onChange={(event) => setTheme(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="block text-sm text-slate-300">Default session length<select value={preferences.defaultSessionLength} onChange={(event) => setPreferences((current) => ({ ...current, defaultSessionLength: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">{[25, 50, 71, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {toggle("adaptive", "Adaptive training", "Prefer weaker notes while retaining normal exploration.")}
        {toggle("sound", "App sound", "Play the lightweight synth for virtual and computer-keyboard input.")}
        {toggle("midiSound", "App sound for MIDI", "Off by default to avoid doubling a real piano's sound.")}
        {toggle("computerKeyboard", "Computer keyboard input", "Use A–K as a one-octave fallback input.")}
        <div className="flex items-center justify-end gap-3"><span className="text-sm text-teal-300" aria-live="polite">{saved ? "Saved" : ""}</span><Button onClick={() => void save()}>Save settings</Button></div>
      </Card>
    </div>
  );
}
