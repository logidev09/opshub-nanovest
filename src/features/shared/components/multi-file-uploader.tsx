"use client";

import { useState } from "react";
import { AttachmentItem } from "@/features/shared/lib/attachment-helper";

interface MultiFileUploaderProps {
  files: AttachmentItem[];
  onChange: (files: AttachmentItem[]) => void;
  label?: string;
  accept?: string;
  disabled?: boolean;
}

export function MultiFileUploader({
  files,
  onChange,
  label = "Lampirkan Dokumen (Bisa Banyak File: PDF, PNG, JPG, JPEG, DOCX, TXT)",
  accept = ".pdf,.png,.jpeg,.jpg,.docx,.txt",
  disabled = false,
}: MultiFileUploaderProps) {
  const [reading, setReading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setReading(true);
    const fileList = Array.from(selectedFiles);
    const newItems: AttachmentItem[] = [];

    let processedCount = 0;
    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        newItems.push({ name: file.name, data: base64 });
        processedCount++;

        if (processedCount === fileList.length) {
          onChange([...files, ...newItems]);
          setReading(false);
          e.target.value = ""; // Reset input
        }
      };
      reader.onerror = () => {
        processedCount++;
        if (processedCount === fileList.length) {
          setReading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </label>

      <div className="relative flex items-center justify-between border border-zinc-800 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs">
        <input
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || reading}
          className="absolute inset-0 opacity-0 cursor-pointer w-full z-10 disabled:cursor-not-allowed"
        />
        <span className="text-zinc-400 truncate max-w-[240px]">
          {reading ? "Membaca berkas..." : files.length > 0 ? `${files.length} berkas dipilih` : "Pilih satu atau beberapa berkas..."}
        </span>
        <button
          type="button"
          disabled={disabled || reading}
          className="px-3 py-1 rounded-lg bg-zinc-850 text-[10px] font-bold text-emerald-400 hover:bg-zinc-800 transition shrink-0"
        >
          {reading ? "Memproses..." : "+ Tambah Berkas"}
        </button>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 text-[10px] text-zinc-300 font-mono"
            >
              <span className="truncate max-w-[140px]">📁 {file.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  className="text-zinc-500 hover:text-red-400 font-bold ml-1 transition"
                  title="Hapus berkas ini"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
