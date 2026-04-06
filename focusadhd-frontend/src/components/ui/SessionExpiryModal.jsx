import { useNavigate } from "react-router-dom";

export function SessionExpiryModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSignIn = () => {
    onClose();
    navigate("/login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Session Expired
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Your session has expired. Please sign in again to continue.
        </p>
        <button
          onClick={handleSignIn}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
