"use client";

import { Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Password input matching the join page's icon-wrapper pattern, with a show/hide
 * toggle. Used by every password field across sign-in, create, join, and admin.
 */
export function PasswordField({
  value,
  onChange,
  label,
  placeholder = "••••••••",
  autoFocus = false,
  onEnter
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  const field = (
    <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <Lock size={18} className="text-slate-400" />
      <input
        className="min-w-0 flex-1 outline-none"
        type={show ? "text" : "password"}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        aria-label={show ? "Hide password" : "Show password"}
        className="shrink-0 text-slate-400 transition hover:text-slate-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  );
  return label ? (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {field}
    </label>
  ) : (
    field
  );
}
