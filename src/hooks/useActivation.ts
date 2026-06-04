import { useState } from "react";

const ACTIVATION_STORAGE_KEY = "eduscheduler_activated_key";

export function useActivation() {
  const [isActivated, setIsActivated] = useState(() => {
    return !!localStorage.getItem(ACTIVATION_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async (key: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate network request delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Dummy validation logic: EDU-XXXX-XXXX-XXXX
      const regex = /^EDU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

      if (regex.test(key)) {
        localStorage.setItem(ACTIVATION_STORAGE_KEY, key.toUpperCase());
        setIsActivated(true);
        return true;
      } else {
        setError("Invalid product key format. Expected format: EDU-XXXX-XXXX-XXXX.");
        return false;
      }
    } catch {
      setError("Activation failed. Please check your connection.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { isActivated, isLoading, activate, error };
}
