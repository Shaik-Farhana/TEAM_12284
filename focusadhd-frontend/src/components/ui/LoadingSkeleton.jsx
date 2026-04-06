export function LoadingSkeleton({ type = 'text', count = 1, className = '' }) {
  const elements = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className={`space-y-4 ${className}`}>
        {elements.map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className={`w-full h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse ${className}`}></div>
    );
  }

  // Default text skeleton
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {elements.map((_, i) => (
        <div 
          key={i} 
          className="h-4 bg-slate-200 dark:bg-slate-700 rounded" 
          style={{ width: `${Math.max(60, 100 - (i * 10))}%` }}
        ></div>
      ))}
    </div>
  );
}
