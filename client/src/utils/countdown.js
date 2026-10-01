import { useState, useEffect, useRef } from 'react';

/**
 * Format total seconds to MM:SS string (e.g. 04:59, 00:05, 00:00).
 */
export function formatCountdown(seconds) {
  if (seconds === null || seconds === undefined || seconds <= 0 || isNaN(seconds)) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Custom hook to calculate and update backwards countdown once per second
 * using the authoritative server-side meetingJoinDeadline and serverTime offset.
 */
export function useCountdownTimer(deadline, serverTime) {
  const serverOffsetRef = useRef(serverTime ? serverTime - Date.now() : 0);

  useEffect(() => {
    if (serverTime) {
      serverOffsetRef.current = serverTime - Date.now();
    }
  }, [serverTime]);

  const calculateRemaining = () => {
    if (!deadline) return null;
    const currentEffectiveServerTime = Date.now() + serverOffsetRef.current;
    const remainingMs = deadline - currentEffectiveServerTime;
    return Math.max(0, Math.floor(remainingMs / 1000));
  };

  const [secondsRemaining, setSecondsRemaining] = useState(calculateRemaining);

  useEffect(() => {
    if (!deadline) {
      setSecondsRemaining(null);
      return;
    }

    // Immediate initial sync
    const initial = calculateRemaining();
    setSecondsRemaining(initial);

    // 1-second interval tick for UI display only
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const isExpired = secondsRemaining !== null && secondsRemaining <= 0;

  return {
    secondsRemaining,
    isExpired,
    formatted: formatCountdown(secondsRemaining)
  };
}
