import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { Loader2, Plus, BookOpen, Clock, Activity, Calendar, Zap, Lightbulb, TrendingUp, ChevronRight } from "lucide-react";

const QUICK_TIPS = [
  "Try the Simplify button when you feel stuck on a paragraph.",
  "Enable AI Voice for a different way to absorb content.",
  "You can override any adaptation from the toolbar — you're always in control."
];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [topic, setTopic] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [dashboardData, setDashboardData] = useState(null);
  const [fetching, setFetching] = useState(true);
  
  const [currentTip, setCurrentTip] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await fetchWithAuth('/users/me/dashboard');
        setDashboardData(data);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setFetching(false);
      }
    }
    loadDashboard();
    
    const tipInterval = setInterval(() => {
        setCurrentTip(prev => (prev + 1) % QUICK_TIPS.length);
    }, 15000);
    return () => clearInterval(tipInterval);
  }, []);

  const startSession = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setLoadingAction(true);
    try {
      const data = await fetchWithAuth('/sessions', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim() })
      });
      navigate(`/learn/${data.session_id}?topic=${encodeURIComponent(topic.trim())}`);
    } catch (err) {
      console.error(err);
      alert("Failed to start session. " + err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const formatFocusTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatRelativeDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const getStateBadgeColor = (state) => {
    switch (state?.toLowerCase()) {
      case 'focused': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
      case 'drifting': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
      case 'overloaded': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
      case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Welcome Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {fetching ? (
              <div className="h-8 w-48 bg-blue-100 dark:bg-slate-700/50 animate-pulse rounded mb-2"></div>
          ) : (
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                Hello, {(() => {
                    const metadataName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name;
                    if (metadataName && metadataName !== 'Student') return metadataName;
                    
                    const backendName = dashboardData?.display_name;
                    if (!backendName || backendName === 'Student' || backendName === 'Learner') return 'Learner';
                    
                    if (backendName.includes('@')) return backendName.split('@')[0];
                    return backendName;
                })()}! 👋
              </h1>
          )}
          <p className="text-blue-600 dark:text-blue-300">Ready to explore a new concept?</p>
        </div>
      </div>

      {/* KPI Stats Row (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fetching ? (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 animate-pulse h-28"></div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 animate-pulse h-28"></div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 animate-pulse h-28"></div>
          </>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Sessions</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{dashboardData?.kpis.total_sessions || 0}</p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Focus Time</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{formatFocusTime(dashboardData?.kpis.focus_seconds || 0)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Engagement</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{dashboardData?.kpis.avg_engagement || 0}%</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Main Content) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Highest Priority CTA */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/30 p-8">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Dive into a new topic</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Enter a topic, concept, or paste a question to begin a focused learning session.</p>
            
            <form onSubmit={startSession} className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. What is Machine Learning?"
                className="w-full pl-6 pr-40 py-5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:bg-white focus:border-indigo-500 transition-all text-slate-900 dark:text-white text-lg shadow-inner font-medium outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!topic.trim() || loadingAction}
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center tracking-wide"
              >
                {loadingAction ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Start Learning <Plus className="h-5 w-5 ml-1" /></>}
              </button>
            </form>
          </section>

          {/* Recent Sessions List */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-indigo-500" />
                Recent Sessions
                </h3>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {fetching ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
                ) : dashboardData?.recent_sessions.length === 0 ? (
                <div className="p-12 text-center">
                    <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">Your completed sessions will appear here.</p>
                </div>
                ) : (
                dashboardData?.recent_sessions.map(session => (
                    <div 
                        key={session.id} 
                        onClick={() => navigate(`/learn/${session.id}?topic=${encodeURIComponent(session.topic)}`)}
                        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer group"
                    >
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-1 mb-1 group-hover:text-indigo-600 transition-colors">{session.topic}</h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {formatRelativeDate(session.created_at)}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStateBadgeColor(session.dominant_state)}`}>
                                    {session.dominant_state}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Resume Session</span>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>
                ))
                )}
            </div>
            {dashboardData?.recent_sessions.length === 7 && (
                <div className="p-4 text-center border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                    <button className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                        View All Sessions
                    </button>
                </div>
            )}
          </section>

        </div>

        {/* Right Column (Sidebar) */}
        <div className="lg:col-span-1 space-y-8">
            
            {/* Quick Tips Panel */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 border border-indigo-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute -right-4 -top-4 text-indigo-100 dark:text-slate-700/50 transform rotate-12">
                    <Lightbulb className="w-32 h-32" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 relative z-10 flex items-center">
                    <Zap className="w-5 h-5 text-indigo-500 mr-2" /> Quick Tips
                </h3>
                
                <div className="relative z-10 min-h-[100px] flex items-center">
                    <p className="text-slate-700 dark:text-slate-300 font-medium text-lg leading-relaxed transition-opacity duration-500">
                        "{QUICK_TIPS[currentTip]}"
                    </p>
                </div>

                <div className="flex gap-2 mt-4 relative z-10">
                    {QUICK_TIPS.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentTip ? 'w-6 bg-indigo-500' : 'w-2 bg-indigo-200 dark:bg-slate-600'}`}></div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
