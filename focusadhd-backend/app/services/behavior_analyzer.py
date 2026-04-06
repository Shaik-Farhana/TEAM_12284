from typing import List
from app.models.behavior_event import BehaviorEvent

class BehaviorAnalyzer:
    @staticmethod
    def analyze_events(events: List[BehaviorEvent]) -> dict:
        """
        Rule-based engine to classify learner state into:
        - Focused
        - Overloaded
        - Drifting
        """
        if not events:
            return {"state": "Focused", "reason": "Initial session state"}

        avg_wpm = 0
        wpm_events = [e.reading_speed_wpm for e in events if e.reading_speed_wpm is not None]
        if wpm_events:
            avg_wpm = sum(wpm_events) / len(wpm_events)

        reread_count = sum(1 for e in events if e.event_type == 'reread')

        # Priority 0: Computer Vision (MediaPipe) - most authoritative
        vision_events = [e for e in events if e.event_type in ('VisionDistractionStart', 'VisionDistractionEnd', 'TabDistractionEnd')]
        if vision_events:
            last_vision = vision_events[-1]
            if last_vision.event_type in ('VisionDistractionEnd', 'TabDistractionEnd'):
                return {
                    "state": "Focused",
                    "reason": f"Focus regained after {last_vision.pause_duration:.1f}s distraction.",
                    "wpm_avg": int(avg_wpm) if wpm_events else None,
                    "reread_count": reread_count
                }
                
            return {
                "state": "Drifting",
                "reason": f"Attention monitor: {last_vision.vision_metadata}",
                "wpm_avg": int(avg_wpm) if wpm_events else None,
                "reread_count": reread_count
            }

        longest_pause = max([e.pause_duration for e in events if e.pause_duration is not None] + [0])

        # Priority 1: High disengagement or frequent drifting
        drift_events = [e for e in events if e.event_type in ('pause', 'VisionDistractionStart') or (e.vision_metadata and 'Away' in e.vision_metadata)]
        if len(drift_events) >= 10: # Threshold increased significantly for Phase 2
            return {
                "state": "BreakSuggestion",
                "reason": "You've been drifting quite a bit. How about a 60-second micro-break?",
                "wpm_avg": int(avg_wpm) if wpm_events else None,
                "reread_count": reread_count
            }

        if longest_pause > 7.0: 
            return {
                "state": "Drifting",
                "reason": f"Lost focus (idle for {longest_pause:.1f}s)",
                "wpm_avg": int(avg_wpm) if wpm_events else None,
                "reread_count": reread_count
            }
            
        # Priority 2: Cognitive overload
        if (avg_wpm > 0 and avg_wpm < 130) or reread_count >= 1: # More sensitive reread detection
            return {
                "state": "Overloaded",
                "reason": "Reading slower or repeating sections (cognitive strain detected).",
                "wpm_avg": int(avg_wpm) if wpm_events else None,
                "reread_count": reread_count
            }
            
        # Priority 3: Baseline
        return {
            "state": "Focused",
            "reason": "Good engagement and steady reading speed.",
            "wpm_avg": int(avg_wpm) if wpm_events else None,
            "reread_count": reread_count
        }

behavior_analyzer = BehaviorAnalyzer()
