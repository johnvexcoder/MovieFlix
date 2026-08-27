"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function PinInput({ length = 4, onComplete, disabled = false, error = false }: PinInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (disabled) return;

      // Only allow digits
      if (value && !/^\d$/.test(value)) return;

      const newValues = [...values];
      newValues[index] = value;
      setValues(newValues);

      // Auto-focus next input
      if (value && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      if (value && index === length - 1) {
        const pin = newValues.join("");
        if (pin.length === length) {
          onComplete(pin);
        }
      }
    },
    [values, length, onComplete, disabled]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "Backspace" && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newValues = [...values];
        newValues[index - 1] = "";
        setValues(newValues);
      }
    },
    [values, disabled]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;

      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);

      if (pasted) {
        const newValues = Array(length).fill("");
        pasted.split("").forEach((char, i) => {
          newValues[i] = char;
        });
        setValues(newValues);

        const focusIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[focusIndex]?.focus();

        if (pasted.length === length) {
          onComplete(pasted);
        }
      }
    },
    [length, onComplete, disabled]
  );

  return (
    <div className="flex gap-2">
      {values.map((value, index) => (
        <AnimatePresence key={index} mode="wait">
          <motion.div
            initial={false}
            animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={disabled}
              className={`h-14 w-14 text-center text-2xl font-bold ${
                error
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }`}
              autoComplete="off"
            />
          </motion.div>
        </AnimatePresence>
      ))}
    </div>
  );
}
