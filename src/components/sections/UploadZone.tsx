"use client";

import { useCallback, useRef, useState } from "react";

type UploadZoneProps = {
  onFileSelected: (file: File) => void;
};

export function UploadZone({ onFileSelected }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.item(0);
      if (!file) return;
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="max-w-2xl">
      <div
        className={[
          "rounded-2xl border-2 border-dashed p-12 text-center transition-all",
          isDragging
            ? "border-link-cobalt bg-link-cobalt/5 scale-[1.01]"
            : "cursor-pointer border-input-border bg-white hover:border-near-black/40 hover:bg-cloud-gray/40"
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={pickFile}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFile();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Pilih file .inp untuk diupload"
      >
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border-lavender bg-cloud-gray">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-gray"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div className="text-base font-semibold tracking-[-0.02em] text-expo-black">
          Drag & drop file <span className="font-mono">.inp</span>
        </div>
        <div className="mt-1.5 text-sm text-slate-gray">
          atau klik untuk memilih dari komputer
        </div>

        <div className="mt-5">
          <span className="inline-flex items-center rounded-full border border-border-lavender bg-white px-4 py-2 text-sm font-medium text-near-black shadow-whisper pointer-events-none">
            Pilih File
          </span>
        </div>

        <input
          accept=".inp"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          ref={inputRef}
          type="file"
        />
      </div>

      <div className="mt-2.5 px-1 text-xs text-silver">
        Format: <span className="font-mono">.inp</span> (EPANET)
      </div>
    </div>
  );
}
