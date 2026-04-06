import { useState, useEffect } from "react";
import { fetchWithAuth } from "../services/api";
import { Loader2, Save, User, Settings as SettingsIcon, Volume2, Sparkles, Check } from "lucide-react";

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    preferred_style: "Balanced",
    audio_enabled: false,
    vision_enabled: false
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await fetchWithAuth('/users/me');
        setFormData({
            display_name: data.display_name || "",
            email: data.email || "",
            preferred_style: data.preferred_style || "Balanced",
            audio_enabled: data.audio_enabled || false,
            vision_enabled: data.vision_enabled || false
        });
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await fetchWithAuth('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
            display_name: formData.display_name,
            preferred_style: formData.preferred_style,
            audio_enabled: formData.audio_enabled,
            vision_enabled: formData.vision_enabled
        })
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-indigo-500" />
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your profile and learning preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Profile Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Profile Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
              <input 
                type="text" 
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                placeholder="What should we call you?"
              />
            </div>
          </div>
        </section>

        {/* AI Learning Preferences */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Learning Preferences
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">AI Teaching Style</label>
              <select 
                name="preferred_style"
                value={formData.preferred_style}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white appearance-none"
              >
                <option value="Balanced">Balanced (Default)</option>
                <option value="Concise">Concise & Direct (Bullet points)</option>
                <option value="Detailed">Highly Detailed & Academic</option>
                <option value="Story-driven">Story-driven & Metaphorical</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">This determines how the AI formats your initial content before it adapts to your behavior.</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Attention Monitor</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Toggle camera-based focus tracking. <span className="underline decoration-dotted">Local processing only.</span></p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="vision_enabled" checked={formData.vision_enabled} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : success ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {saving ? 'Saving...' : success ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
