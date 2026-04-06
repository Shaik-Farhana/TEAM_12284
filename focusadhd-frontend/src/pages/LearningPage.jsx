import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Brain, 
  ChevronRight, 
  RefreshCcw, 
  AlertCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  List,
  Coffee,
  Volume2,
  VolumeX,
  BarChart,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { fetchWithAuth, API_BASE_URL, getAuthToken } from '../services/api';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { FocusWatcher } from '../components/FocusWatcher';
import { SoundscapePlayer } from '../components/SoundscapePlayer';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

export function LearningPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [learningState, setLearningState] = useState('Focused');
  const [learningReason, setLearningReason] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [visionStatus, setVisionStatus] = useState({ isAway: false, timeAway: 0, isActive: false });
  const [lastDistraction, setLastDistraction] = useState(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const audioRef = useRef(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [questionsBuffer, setQuestionsBuffer] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [knowledgeScore, setKnowledgeScore] = useState(0);
  const [summaries, setSummaries] = useState([]);
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const hasCompletedRef = useRef(false);
  // Track exactly how long THIS sitting has been open (not the session's total lifetime)
  const sittingStartRef = useRef(Date.now());

  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const { triggerReread, triggerVisionDrift, recordVisionFocusRegained } = useBehaviorTracker(sessionId, true);
  
  const handleDistractionEnd = (duration) => {
    setLastDistraction(duration);
    recordVisionFocusRegained(duration);
  };

  const { 
    content, 
    isStreaming, 
    error, 
    startStreaming,
    setInitialContent,
    fullText
  } = useAIStream(sessionId);

  // Cleanup on unmount or tab close
  useEffect(() => {
    const handleUnload = () => {
      if (!hasCompletedRef.current && sessionId) {
        const elapsedSeconds = Math.round((Date.now() - sittingStartRef.current) / 1000);
        const token = localStorage.getItem("token") || "";
        const url = `${API_BASE_URL}/sessions/${sessionId}/complete?access_token=${token}`;
        navigator.sendBeacon(url, JSON.stringify({ elapsed_seconds: elapsedSeconds }));
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      handleUnload();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [sessionId]);

  // Fetch session details on mount
  useEffect(() => {    async function loadSession() {
      try {
        const res = await fetchWithAuth(`/sessions/${sessionId}`);
        setTopic(res.topic);
        if (res.current_state) setLearningState(res.current_state);
        if (res.history && res.history.length > 0) {
            setInitialContent(res.history.join('\n\n'));
        }
        
        try {
            const userRes = await fetchWithAuth('/users/me');
            setVisionEnabled(userRes.vision_enabled);
            const hasSeenPrompt = localStorage.getItem('hasSeenVisionPrompt');
            if (!hasSeenPrompt && !userRes.vision_enabled) {
                setShowConsentModal(true);
            }
        } catch (e) {
            console.error("Could not fetch user settings");
        }
        
        setHasStarted(true);
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    }
    loadSession();
  }, [sessionId]);

  // Handle AI Voice Pause/Resume on Drift
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (visionStatus.isAway) {
      audioRef.current.pause();
    } else if (isVoiceEnabled) {
      // Resume only if voice is still enabled
      audioRef.current.play().catch(e => console.log("Audio resume suppressed:", e));
    }
  }, [visionStatus.isAway, isVoiceEnabled]);

  // Tag Parser for QUESTIONS and SUMMARIES + TTS Trigger
  useEffect(() => {
    if (!isStreaming && fullText) {
        // Parse Question (Buffer, don't show yet)
        const qMatch = fullText.match(/\[QUESTION\](.*?)\[\/QUESTION\]/s);
        if (qMatch) {
            try {
                const qData = JSON.parse(qMatch[1]);
                if (!questionsBuffer.find(q => q.text === qData.text)) {
                    setQuestionsBuffer(prev => [...prev, qData]);
                }
            } catch (e) { console.error("Question parse error", e); }
        }

        // Parse Summaries
        const sMatch = fullText.match(/\[SUMMARY\](.*?)\[\/SUMMARY\]/s);
        if (sMatch) {
            const lines = sMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
            if (lines.length > 0) {
                setSummaries(prev => [...new Set([...prev, ...lines])]);
            }
        }

        // TTS Trigger
        if (isVoiceEnabled && !fullText.includes('[REPLAY]')) {
            const speakContent = async () => {
                const textToRead = fullText
                    .replace(/\[QUESTION\].*?\[\/QUESTION\]/gs, '')
                    .replace(/\[SUMMARY\].*?\[\/SUMMARY\]/gs, '')
                    .trim();
                if (textToRead) {
                    try {
                        const res = await fetchWithAuth('/multimodal/tts', {
                            method: 'POST',
                            body: JSON.stringify({ text: textToRead })
                        });
                        // Support GCS public URL or base64 fallback
                        let audioSrc = null;
                        if (res.audio_url) {
                            audioSrc = res.audio_url;
                        } else if (res.audio_data) {
                            audioSrc = `data:audio/mp3;base64,${res.audio_data}`;
                        }
                        if (audioSrc) {
                            const audio = new Audio(audioSrc);
                            audioRef.current = audio;
                            audio.play();
                        }
                    } catch (e) { console.error("TTS Playback Error", e); }
                }
            };
            speakContent();
        }
    }

    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    };
  }, [isStreaming, fullText, isVoiceEnabled]);

  // Inline Question Pop-up
  useEffect(() => {
    if (!isStreaming && questionsBuffer.length > 0 && !assessmentMode) {
      const unanswered = questionsBuffer.find(q => !answeredQuestions.has(q.text));
      if (unanswered) {
          setActiveQuestion(unanswered);
      } else {
          setActiveQuestion(null);
      }
    }
  }, [isStreaming, questionsBuffer, answeredQuestions, assessmentMode]);

  const onStateUpdate = (update) => {    setLearningState(update.state);
    setLearningReason(update.reason);
    if (update.state === 'BreakSuggestion') {
        setShowBreak(true);
    }
  };

  const handleAnswer = (option) => {
    const currentQ = assessmentMode ? questionsBuffer[currentQuestionIndex] : activeQuestion;
    if (!currentQ) return;

    // Robust comparison to handle slight formatting differences from the LLM
    const optStr = String(option).trim().toLowerCase();
    const ansStr = String(currentQ.answer).trim().toLowerCase();
    const isCorrect = optStr === ansStr || optStr.includes(ansStr) || ansStr.includes(optStr);

    // Mark as answered regardless of correctness to prevent repetition
    setAnsweredQuestions(prev => new Set(prev).add(currentQ.text));

    if (isCorrect) {
        setAnswerFeedback({ type: 'success', text: 'Correct!' });
        setKnowledgeScore(prev => prev + 1);
        
        setTimeout(() => { 
            setAnswerFeedback(null);
            if (assessmentMode) {
                if (currentQuestionIndex < questionsBuffer.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                } else {
                    hasCompletedRef.current = true;
                    setShowAnalytics(true);
                }
            } else {
                setActiveQuestion(null); 
            }
        }, 1500);
    } else {
        setAnswerFeedback({ type: 'error', text: `Not quite. The correct answer was ${currentQ.answer}.` });
        setTimeout(() => {
            setAnswerFeedback(null);
            if (assessmentMode) {
                if (currentQuestionIndex < questionsBuffer.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                } else {
                    hasCompletedRef.current = true;
                    setShowAnalytics(true);
                }
            } else {
                setActiveQuestion(null);
            }
        }, 2500);
    }
  };

  const handleEndSession = async () => {
    // If there are unanswered questions in the buffer, force them in Assessment Mode
    const unanswered = questionsBuffer.filter(q => !answeredQuestions.has(q.text));
    if (unanswered.length > 0) {
        setQuestionsBuffer(unanswered);
        setAssessmentMode(true);
        setCurrentQuestionIndex(0);
    } else {
        hasCompletedRef.current = true;
        const elapsedSeconds = Math.round((Date.now() - sittingStartRef.current) / 1000);
        try {
            await fetchWithAuth(`/sessions/${sessionId}/complete`, {
                method: 'POST',
                body: JSON.stringify({ elapsed_seconds: elapsedSeconds })
            });
        } catch (e) { console.error("Final completion failed", e); }
        setShowAnalytics(true);
    }
  };

  const getStateColors = (state) => {
    switch(state) {
      case 'Overloaded': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Drifting': return 'bg-red-50 text-red-700 border-red-200';
      case 'BreakSuggestion': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const cleanContent = (text) => {
    return text
        .replace(/\[QUESTION\].*?\[\/QUESTION\]/gs, '')
        .replace(/\[SUMMARY\].*?\[\/SUMMARY\]/gs, '');
  };

  const handleConsentDecision = async (decision) => {
      setVisionEnabled(decision);
      setShowConsentModal(false);
      localStorage.setItem('hasSeenVisionPrompt', 'true');
      try {
          await fetchWithAuth('/users/me', {
              method: 'PUT',
              body: JSON.stringify({ vision_enabled: decision })
          });
      } catch (err) { }
  };

  const handleDisableCamera = async () => {
      setVisionEnabled(false);
      try {
          await fetchWithAuth('/users/me', {
              method: 'PUT',
              body: JSON.stringify({ vision_enabled: false })
          });
      } catch (err) {}
  };

  const handleGenerateVisual = async (currentContent) => {
      if (isGeneratingImage || !topic || !currentContent) return;
      setIsGeneratingImage(true);
      setGeneratedImage(null);
      try {
          const contextStr = currentContent.substring(0, 100).trim();
          const targetTopic = `${topic}: ${contextStr}`;
          
          const res = await fetchWithAuth('/multimodal/generate-image', {
              method: 'POST',
              body: JSON.stringify({ topic: targetTopic })
          });
          if (res.image_url) {
              setGeneratedImage(res.image_url);
          } else if (res.image_data) {
              setGeneratedImage(`data:image/jpeg;base64,${res.image_data}`);
          }
      } catch (e) {
          console.error("Image Generation Error", e);
      } finally {
          setIsGeneratingImage(false);
      }
  };

  useEffect(() => {
      if (!isStreaming && content && !generatedImage && !isGeneratingImage && hasStarted && topic) {
          handleGenerateVisual(content);
      }
  }, [isStreaming, content, hasStarted, topic]);

  if (!hasStarted) return null;

  if (showAnalytics) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-12">
            <div className="max-w-4xl mx-auto">
                <AnalyticsDashboard sessionId={sessionId} onRestart={() => navigate('/')} knowledgeScore={knowledgeScore} />
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Consent Modal Overlay */}
      {showConsentModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 text-slate-800 dark:text-white text-center">
            <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-3xl">🎥</span>
                </div>
                <h2 className="text-2xl font-black mb-3">Enable Attention Monitor (Optional)</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 text-sm leading-relaxed">
                    FocusADHD can use your camera to detect when you look away or seem fatigued, to help adapt content more accurately.
                </p>
                <div className="text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-8 space-y-3 font-medium text-sm text-slate-700 dark:text-slate-300">
                    <p className="flex items-start gap-2">✅ <span>All processing happens locally in your browser</span></p>
                    <p className="flex items-start gap-2">✅ <span>No video is ever recorded or uploaded</span></p>
                    <p className="flex items-start gap-2">✅ <span>You can turn this off at any time</span></p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <button 
                        onClick={() => handleConsentDecision(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all"
                    >
                        Enable Camera
                    </button>
                    <button 
                        onClick={() => handleConsentDecision(false)}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 px-6 rounded-xl transition-all"
                    >
                        Skip for Now
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Break Overlay */}
      {showBreak && (
        <div className="fixed inset-0 z-[100] bg-indigo-900/90 backdrop-blur-md flex items-center justify-center p-6 text-white text-center">
            <div className="max-w-md animate-in zoom-in duration-300">
                <Coffee className="w-16 h-16 mx-auto mb-6 text-indigo-300 animate-bounce" />
                <h2 className="text-3xl font-black mb-4">Time for a Micro-Break!</h2>
                <p className="text-indigo-100 mb-8 font-medium">Your brain has drifted a few times. Let's take 60 seconds to stretch or take a deep breath.</p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => {
                            setShowBreak(false);
                            setLearningState('Focused');
                        }}
                        className="bg-white text-indigo-900 font-bold py-3 rounded-2xl shadow-xl hover:scale-105 transition-transform"
                    >
                        I'm Ready to Continue
                    </button>
                    <button 
                        onClick={() => { setShowBreak(false); setShowAnalytics(true); }}
                        className="text-indigo-200 font-bold py-2"
                    >
                        End Session Early
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delayed Assessment Overlay */}
      {assessmentMode && questionsBuffer.length > 0 && (
        <div className="fixed inset-0 z-[110] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-white text-center">
            <div className="max-w-2xl w-full animate-in zoom-in duration-300">
                <Sparkles className="w-12 h-12 mx-auto mb-6 text-indigo-400" />
                <h2 className="text-4xl font-black mb-2 italic">Quick Check-in!</h2>
                <p className="text-slate-400 mb-12 font-medium uppercase tracking-[0.2em] text-xs">Question {currentQuestionIndex + 1} of {questionsBuffer.length}</p>
                
                <div className="bg-white/10 p-8 rounded-[2.5rem] border border-white/20 mb-10 shadow-2xl">
                    <h3 className="text-2xl font-bold mb-10 leading-snug">{questionsBuffer[currentQuestionIndex].text}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {questionsBuffer[currentQuestionIndex].options.map((opt, i) => (
                            <button 
                                key={i}
                                onClick={() => handleAnswer(opt)}
                                disabled={answerFeedback}
                                className={`p-5 rounded-3xl font-black transition-all active:scale-95 border-2 
                                    ${answerFeedback?.text.includes(opt) && answerFeedback.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 hover:bg-white/20 hover:border-white/30 text-white'}
                                `}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                    {answerFeedback && (
                        <p className={`mt-8 text-xl font-black animate-in slide-in-from-bottom duration-300 ${answerFeedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {answerFeedback.text}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-4">
                    <button 
                        onClick={() => setShowAnalytics(true)}
                        className="text-slate-400 hover:text-white font-bold py-2 px-6 rounded-xl transition-colors"
                    >
                        Skip & See Results
                    </button>
                    <div className="flex gap-2">
                         {questionsBuffer.map((_, i) => (
                             <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentQuestionIndex ? 'w-8 bg-indigo-500' : 'w-2 bg-white/20'}`}></div>
                         ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Main UI */}
      <div className="max-w-[1400px] mx-auto px-4 py-8 lg:px-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-2">
              <BookOpen className="w-4 h-4" />
              <span className="uppercase tracking-widest">Active Session</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-400">{sessionId.split('-')[0]}</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white truncate">{topic}</h1>
            
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className={`flex items-center text-sm px-3 py-1.5 rounded-full border shadow-sm transition-all ${getStateColors(visionStatus.isAway ? 'Drifting' : (learningState === 'Drifting' ? 'Focused' : learningState))}`}>
                <Brain className="w-4 h-4 mr-1.5" />
                <span className="font-semibold mr-1">State:</span> {visionStatus.isAway ? 'Drifting' : (learningState === 'Drifting' ? 'Focused' : learningState)}
              </div>
              
              {visionStatus.isAway && (
                <div className="text-sm text-red-500 font-bold flex items-center bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full animate-pulse border border-red-200 dark:border-red-900/50 shadow-sm">
                  <AlertCircle className="w-4 h-4 mr-1.5" />
                  Gaze Drifted ({visionStatus.timeAway}s)
                </div>
              )}

              {lastDistraction && !visionStatus.isAway && (
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                  Last distraction: {lastDistraction}s
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
                onClick={handleEndSession}
                className="flex items-center gap-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
            >
                <BarChart className="w-4 h-4" />
                End & Analytics
            </button>
            <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 border-2 ${isVoiceEnabled ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}
                title={isVoiceEnabled ? "Voice Enabled" : "Voice Disabled"}
            >
                {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{isVoiceEnabled ? 'AI Voice ON' : 'AI Voice OFF'}</span>
            </button>
            {isGeneratingImage && (
                <div className="flex flex-row items-center gap-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-500 px-4 py-2.5 rounded-xl font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Drawing Visual...</span>
                </div>
            )}
            <button 
                onClick={() => {
                    setGeneratedImage(null);
                    startStreaming('next', onStateUpdate);
                }}
                disabled={isStreaming || assessmentMode || (visionEnabled && !visionStatus.isActive)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
                <RefreshCcw className={`w-4 h-4 ${isStreaming ? 'animate-spin' : ''}`} />
                {(visionEnabled && !visionStatus.isActive) ? 'Enable Cam to Start' : (isStreaming ? 'Adapting...' : 'Next Concept')}
            </button>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Content Area */}
          <div className="flex-1 space-y-6 w-full">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[500px] flex flex-col relative overflow-hidden transition-all">

                <div className="p-8 md:p-12 flex-1">
                    {!content && !isStreaming ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                <MessageSquare className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="font-semibold">{(visionEnabled && !visionStatus.isActive) ? 'Please enable your Attention Monitor on the right to begin.' : 'Ready to start? Click "Next Concept" to begin your adaptive journey.'}</p>
                        </div>
                    ) : (
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-lg animate-in slide-in-from-bottom-4 duration-500">
                            {generatedImage && (
                                <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 animate-in fade-in duration-700">
                                    <img src={generatedImage} alt={`Illustration for ${topic}`} className="w-full object-cover max-h-[400px]" />
                                </div>
                            )}
                            <div className="whitespace-pre-wrap">
                                {cleanContent(content)}
                                {isStreaming && <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-1 rounded"></span>}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="m-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 font-medium">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                        <button onClick={() => startStreaming('next', onStateUpdate)} className="underline ml-auto font-bold">Retry</button>
                    </div>
                )}
            </div>
            
            {/* Inline Question Area */}
            {activeQuestion && !assessmentMode && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-8 rounded-[2rem] shadow-sm animate-in slide-in-from-bottom-4 my-2">
                    <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-black tracking-widest uppercase text-xs">Knowledge Check</span>
                    </div>
                    <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-200">{activeQuestion.text}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeQuestion.options.map((opt, i) => (
                            <button 
                                key={i}
                                onClick={() => handleAnswer(opt)}
                                disabled={answerFeedback}
                                className={`p-4 rounded-2xl font-bold transition-all border-2 text-left
                                    ${answerFeedback?.text.includes(opt) && answerFeedback.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white dark:bg-slate-800 border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-300'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                    {answerFeedback && (
                        <p className={`mt-6 text-lg font-black animate-in slide-in-from-bottom ${answerFeedback.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {answerFeedback.text}
                        </p>
                    )}
                </div>
            )}

            {/* Key Takeaways / Summaries Section */}
            {summaries.length > 0 && (                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <List className="text-indigo-600" />
                        Your Key Takeaways
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {summaries.map((s, i) => (
                            <div key={i} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-right duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-1">
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{s.replace('-', '').trim()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 lg:sticky lg:top-8 flex flex-col gap-4">
            <FocusWatcher 
                onDriftDetected={triggerVisionDrift} 
                onStatusUpdate={setVisionStatus} 
                onDistractionEnded={handleDistractionEnd}
                visionEnabled={visionEnabled}
                onDisable={handleDisableCamera}
            />
            
            <SoundscapePlayer isUserAway={visionStatus.isAway} />

            <div className="p-5 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Reading Strategy</h4>
                <button 
                    onClick={triggerReread}
                    className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all active:scale-[0.98] group"
                >
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Repeating a Section</span>
                    <RefreshCcw className="w-4 h-4 text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
                </button>
                <p className="mt-3 text-[10px] text-slate-400 leading-tight">Click this if you found a paragraph confusing and had to reread it.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for AI Streaming
function useAIStream(sessionId) {
    const [content, setContent] = useState("");
    const [fullText, setFullText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    const eventSourceRef = useRef(null);
  
    const startStreaming = async (query = "next", onStateUpdate) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
  
      setIsStreaming(true);
      setError(null);
      setContent("");
      setFullText("");
  
      const token = await getAuthToken();
      const url = `${API_BASE_URL}/learning/stream?session_id=${sessionId}&query=${encodeURIComponent(query)}&access_token=${token}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;
  
      eventSource.addEventListener('state_update', (e) => {
        const data = JSON.parse(e.data);
        onStateUpdate?.(data);
      });
  
      eventSource.addEventListener('text_chunk', (e) => {
        const data = JSON.parse(e.data);
        setContent(prev => prev + data.content);
        setFullText(prev => prev + data.content);
      });
  
      eventSource.addEventListener('done', () => {
        setIsStreaming(false);
        eventSource.close();
      });
  
      eventSource.onerror = (e) => {
        console.error("SSE Error:", e);
        setError("Connection lost. Please try again.");
        setIsStreaming(false);
        eventSource.close();
      };
    };
  
    const setInitialContent = (text) => {
        setContent(text);
        setFullText(text);
    };
  
    return { content, fullText, isStreaming, error, startStreaming, setInitialContent };
}
