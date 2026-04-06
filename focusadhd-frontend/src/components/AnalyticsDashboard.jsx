import React, { useEffect, useState } from 'react';
import { fetchWithAuth } from '../services/api';
import { TrendingUp, BarChart, Clock, Zap, Target, BookOpen } from 'lucide-react';

export function AnalyticsDashboard({ sessionId, onRestart, knowledgeScore = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getStats() {
      try {
        const res = await fetchWithAuth(`/learning/${sessionId}/analytics`);
        setData(res);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    getStats();
  }, [sessionId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold">Calculating your focus score...</p>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
        <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
            <Zap className="fill-yellow-400 text-yellow-400" />
            Session Analytics
        </h2>
        <p className="opacity-80 font-medium">Here is how you focused today.</p>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            icon={<Target className="text-emerald-500" />}
            label="Focus Score"
            value={`${data?.focus_score}%`}
            subtext={data?.focus_score > 80 ? "Excellent" : "Needs work"}
        />
        <StatCard 
            icon={<BarChart className="text-blue-500" />}
            label="Distractions"
            value={data?.total_drifts}
            subtext="Times looked away"
        />
        <StatCard 
            icon={<Clock className="text-amber-500" />}
            label="Total Drift"
            value={`${data?.total_distraction_time}s`}
            subtext="Time spent off-task"
        />
        <StatCard 
            icon={<TrendingUp className="text-indigo-500" />}
            label="Duration"
            value={data?.duration_display || `${Math.round(data?.session_duration_seconds / 60)}m`}
            subtext="Session length"
        />
        <StatCard 
            icon={<BookOpen className="text-purple-500" />}
            label="Knowledge"
            value={`${knowledgeScore}`}
            subtext="Questions answered"
        />
      </div>

      <div className="px-8 pb-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            Focus Timeline
        </h3>
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden border border-slate-200 dark:border-slate-700">
            {data?.timeline.length === 0 ? (
                <div className="w-full h-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-600 font-bold">PERFECT FOCUS</div>
            ) : (
                <div className="w-full h-full flex bg-emerald-500">
                    {/* Visual representation of distractions as red bars - simplified for now */}
                    {data?.timeline.map((item, idx) => (
                        <div 
                            key={idx}
                            style={{ width: `${Math.min(5, (item.duration / data.session_duration_seconds) * 100)}%` }}
                            className="bg-red-500 h-full border-r border-red-400"
                        />
                    ))}
                </div>
            )}
        </div>
        <p className="mt-8 text-center">
            <button 
                onClick={onRestart}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3 rounded-2xl shadow-lg transition-transform active:scale-95"
            >
                START NEW TOPIC
            </button>
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext }) {
    return (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-4">
                {icon}
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white my-1">{value}</p>
            <p className="text-xs font-medium text-slate-400">{subtext}</p>
        </div>
    )
}
