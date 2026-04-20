"use client";

interface PasswordRequirementsProps {
  password: string;
}

const REQUIREMENTS = [
  { key: "length", label: "Minimal 8 karakter", test: (pwd: string) => pwd.length >= 8 },
  { key: "maxLength", label: "Maksimal 256 karakter", test: (pwd: string) => pwd.length <= 256 },
  { key: "uppercase", label: "Mengandung huruf besar (A-Z)", test: (pwd: string) => /[A-Z]/.test(pwd) },
  { key: "lowercase", label: "Mengandung huruf kecil (a-z)", test: (pwd: string) => /[a-z]/.test(pwd) },
  { key: "number", label: "Mengandung angka (0-9)", test: (pwd: string) => /[0-9]/.test(pwd) },
  { key: "symbol", label: "Mengandung simbol (!@#$%^&* dll)", test: (pwd: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) }
] as const;

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-gray">Persyaratan Password</div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1">
        {REQUIREMENTS.map((req) => {
          const isMet = req.test(password);
          return (
            <div
              key={req.key}
              className="flex items-center gap-2 text-xs"
            >
              {isMet ? (
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span className={isMet ? "text-green-700" : "text-slate-gray"}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function isPasswordValid(password: string): boolean {
  return REQUIREMENTS.every((req) => req.test(password));
}
