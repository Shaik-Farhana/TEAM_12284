import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  // Settings state
  const [preferences, setPreferences] = useState({
    preferred_style: "Balanced",
    audio_enabled: false,
    font_size: "Medium",
    high_contrast: false,
    reduce_motion: false
  });

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Create or update user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id,
          ...preferences
        }, { onConflict: 'user_id' });
        
      if (settingsError) throw settingsError;

      // Mark profile as onboarded
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
        
      if (profileError) throw profileError;

      navigate('/dashboard');
    } catch (error) {
      console.error("Error saving onboarding settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
        
        {/* Progress Bar */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div className="flex space-x-2">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-2.5 w-12 rounded-full transition-colors ${
                  step >= i ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Step {step} of 3</span>
        </div>

        <div className="p-8">
          {/* Step 1: Welcome & Intro */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome to FocusADHD!</h2>
              <p className="text-slate-600 dark:text-slate-300 text-lg">
                We're excited to help you learn better. Before we start, let's set up your environment to match how you learn best.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border border-blue-100 dark:border-blue-800/50 mt-8">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center mb-2">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
                  What to expect
                </h4>
                <ul className="text-blue-800 dark:text-blue-200 space-y-2 ml-7 list-disc">
                  <li>Personalized content formatting</li>
                  <li>Real-time adaptation to your focus levels</li>
                  <li>Distraction-free learning environment</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Learning Style Preferences */}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Learning Style</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">How do you prefer your information presented?</p>
              
              <div className="space-y-4">
                {['Concise', 'Balanced', 'Detailed'].map((style) => (
                  <label 
                    key={style}
                    className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                      preferences.preferred_style === style 
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500 ring-1 ring-blue-600' 
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="style" 
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                      checked={preferences.preferred_style === style}
                      onChange={() => updatePreference('preferred_style', style)}
                    />
                    <div className="ml-4 flex-1">
                      <span className="block font-medium text-slate-900 dark:text-white">{style}</span>
                      <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {style === 'Concise' && 'Bullet points, summaries, just the facts.'}
                        {style === 'Balanced' && 'A mix of explanations and key takeaways.'}
                        {style === 'Detailed' && 'In-depth explanations with real-world examples.'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Accessibility Settings */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Accessibility Needs</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">Customize your visual and auditory experience.</p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white mb-3">Font Size</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {['Small', 'Medium', 'Large'].map((size) => (
                      <button
                        key={size}
                        onClick={() => updatePreference('font_size', size)}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                          preferences.font_size === size
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <span className="block font-medium text-slate-900 dark:text-white">Enable Audio Reading</span>
                      <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">Play text-to-speech automatically when starting a session.</span>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 group-focus-within:ring-2 group-focus-within:ring-blue-500 group-focus-within:ring-offset-2">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={preferences.audio_enabled}
                        onChange={(e) => updatePreference('audio_enabled', e.target.checked)}
                      />
                      <div className={`block h-6 w-11 rounded-full transition-colors ${preferences.audio_enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                      <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${preferences.audio_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <span className="block font-medium text-slate-900 dark:text-white">High Contrast UI</span>
                      <span className="block mt-1 text-sm text-slate-500 dark:text-slate-400">Increase contrast between text and background.</span>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 group-focus-within:ring-2 group-focus-within:ring-blue-500 group-focus-within:ring-offset-2">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={preferences.high_contrast}
                        onChange={(e) => updatePreference('high_contrast', e.target.checked)}
                      />
                      <div className={`block h-6 w-11 rounded-full transition-colors ${preferences.high_contrast ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                      <div className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${preferences.high_contrast ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <button 
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={step === 1 || loading}
            className={`flex items-center px-4 py-2 text-sm font-medium transition-colors ${
              step === 1 
                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </button>
          
          <button
            type="button"
            onClick={() => step < 3 ? setStep(step + 1) : saveSettings()}
            disabled={loading}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
            ) : null}
            {step < 3 ? "Next" : "Complete Setup"}
            {step < 3 && !loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </button>
        </div>

      </div>
    </div>
  );
}
