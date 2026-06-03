import React, { useState } from "react";
import { Lock, KeyRound, AlertCircle } from "lucide-react";
import { Button } from "../../../components/ui";

interface ActivationScreenProps {
  onActivate: (key: string) => Promise<boolean>;
  error: string | null;
  isLoading: boolean;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  onActivate,
  error,
  isLoading,
}) => {
  const [keySegments, setKeySegments] = useState(["EDU", "", "", ""]);

  const handleSegmentChange = (index: number, value: string) => {
    if (index === 0) return; // 'EDU' is fixed

    const cleanValue = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    const newSegments = [...keySegments];
    newSegments[index] = cleanValue;
    setKeySegments(newSegments);

    // Auto-advance
    if (cleanValue.length === 4 && index < 3) {
      const nextInput = document.getElementById(`segment-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && keySegments[index] === "" && index > 1) {
      const prevInput = document.getElementById(`segment-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullKey = keySegments.join("-");
    await onActivate(fullKey);
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Lock className="text-slate-900" size={32} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Activate EduScheduler Pro
            </h1>
            <p className="text-slate-400">Enter your product key to unlock the application.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block text-left">
                Product Key
              </label>
              <div className="flex gap-2 items-center justify-center">
                {keySegments.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <input
                      id={`segment-${idx}`}
                      type="text"
                      value={segment}
                      readOnly={idx === 0}
                      onChange={(e) => handleSegmentChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-full max-w-[5rem] text-center font-mono text-lg bg-slate-900/50 border ${
                        error
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-slate-600 focus:border-amber-500"
                      } text-white rounded-lg px-2 py-3 focus:outline-none focus:ring-2 ${
                        error ? "focus:ring-red-500/20" : "focus:ring-amber-500/20"
                      } transition-all ${idx === 0 ? "text-slate-500 bg-slate-800/80 cursor-not-allowed" : ""}`}
                      placeholder={idx === 0 ? "EDU" : "XXXX"}
                    />
                    {idx < 3 && <span className="text-slate-500 font-bold">-</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-left">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || keySegments.some((s) => s.length < 3)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 text-lg h-auto"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> Activating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <KeyRound size={20} /> Activate License
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700/50 text-center text-sm text-slate-500">
            <p>
              Need a product key?{" "}
              <a href="#" className="text-amber-500 hover:text-amber-400 transition-colors">
                Purchase a license
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
