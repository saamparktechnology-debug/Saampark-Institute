'use client';

import React, { useRef, useState } from 'react';
import { extractErrorMessage } from '@/lib/axios';
import { useCreateMaterialMutation } from '../hooks/courses.hook';
import { MaterialDownloadPayload } from '../types/courses.types';

/**
 * Resolves a browser File's MIME type or infers it from the file extension
 * so it matches the backend's ALLOWED_MATERIAL_MIME_TYPES list.
 */
function inferSupportedMimeType(file: File): string {
  if (file.type && file.type.trim().length > 0) {
    return file.type;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Triggers a real binary browser download from `payload.fileBase64`.
 * Strictly rejects records missing a real binary file on disk (zero dummy .txt fallback).
 */
export function triggerMaterialBinaryDownload(payload: MaterialDownloadPayload): void {
  if (!payload.fileBase64 || payload.fileBase64.length === 0) {
    throw new Error(
      `Binary file "${payload.fileName}" is not stored on disk. Please upload the actual file via the Course Materials uploader.`
    );
  }

  const rawBase64 = payload.fileBase64.includes(',')
    ? payload.fileBase64.slice(payload.fileBase64.indexOf(',') + 1)
    : payload.fileBase64;
  const binaryString = window.atob(rawBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: payload.mimeType || 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.fileName || 'course-material.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.appendChild(anchor);
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface MaterialFileUploadZoneProps {
  courseId: string;
  courseLabel?: string;
  compact?: boolean;
  onUploaded?: (message: string) => void;
}

/**
 * Real Drag-and-Drop + File Picker Course Material Uploader.
 * Reads the selected file from disk via FileReader (base64), auto-detects
 * fileName, mimeType, and sizeBytes, and uploads the binary payload to the backend.
 */
export function MaterialFileUploadZone({
  courseId,
  courseLabel,
  compact = false,
  onUploaded,
}: MaterialFileUploadZoneProps) {
  const createMaterialMutation = useCreateMaterialMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChosen = (file: File | undefined | null) => {
    if (!file) return;
    setErrorMsg(null);
    setFeedback(null);

    const maxBytes = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxBytes) {
      setErrorMsg('File exceeds the 50 MB maximum upload limit.');
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      const baseTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setTitle(baseTitle);
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const rawBase64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      setFileBase64(rawBase64);
      setReadingFile(false);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file from disk. Please try selecting the file again.');
      setReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    if (!courseId) {
      setErrorMsg('Please select a target course first.');
      return;
    }
    if (!selectedFile || !fileBase64) {
      setErrorMsg('Please choose a file from your computer (PDF, PPTX, DOCX, XLSX, ZIP, MP4, PNG/JPG).');
      return;
    }
    if (title.trim().length < 3) {
      setErrorMsg('Please enter a material title (at least 3 characters).');
      return;
    }

    const mimeType = inferSupportedMimeType(selectedFile);

    createMaterialMutation.mutate(
      {
        courseId,
        title: title.trim(),
          description:
            description.trim() ||
            `Uploaded file: ${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`,
          fileName: selectedFile.name,
          mimeType,
          sizeBytes: Math.max(1, selectedFile.size),
          fileBase64,
      },
      {
        onSuccess: (res) => {
          const msg = `Uploaded "${res.material.title}" (${res.material.fileName}) & alerted enrolled students on WhatsApp + Email!`;
          setFeedback(msg);
          setTitle('');
          setDescription('');
          setSelectedFile(null);
          setFileBase64(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          if (onUploaded) {
            onUploaded(msg);
          }
        },
        onError: (err) => {
          setErrorMsg(extractErrorMessage(err));
        },
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-slate-900/80 ${
        compact ? 'p-4' : 'p-5'
      } space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Upload Course Material {courseLabel ? `• ${courseLabel}` : ''}
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Select or drag &amp; drop a real PDF, PPTX, DOCX, XLSX, ZIP, image, or video lecture (up to 50 MB).
          </p>
        </div>
        {selectedFile && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            Ready: {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
          </span>
        )}
      </div>

      {/* Drag & Drop File Picker */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          handleFileChosen(dropped);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : selectedFile
            ? 'border-emerald-500/60 bg-emerald-500/5'
            : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500/60 bg-white/70 dark:bg-slate-950/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.zip,.png,.jpg,.jpeg,.webp,.mp4,.webm,.txt,.md,.csv"
          onChange={(e) => handleFileChosen(e.target.files?.[0])}
          className="hidden"
        />
        {readingFile ? (
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Reading binary file from disk...
          </p>
        ) : selectedFile ? (
          <div className="space-y-1">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              ✓ Selected File: {selectedFile.name}
            </p>
            <p className="text-[11px] text-slate-500">
              MIME: {inferSupportedMimeType(selectedFile)} •{' '}
              {(selectedFile.size / 1024).toFixed(1)} KB • Click to replace file
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Click to Browse Computer or Drag &amp; Drop File Here
            </p>
            <p className="text-[11px] text-slate-500">
              Supports PDF, PPTX, DOCX, XLSX, ZIP, PNG/JPG, MP4/WEBM (Max 50 MB)
            </p>
          </div>
        )}
      </div>

      {/* Material Title & Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Material Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Week 1 — Distributed Consensus Slides & Lab Pack"
            className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Study Notes / Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key takeaways or instructions for students..."
            className="w-full rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {feedback && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={createMaterialMutation.isPending || readingFile || !selectedFile}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow cursor-pointer"
        >
          {createMaterialMutation.isPending
            ? 'Uploading Binary File & Alerting Cohort...'
            : 'Upload File & Notify Students'}
        </button>
      </div>
    </form>
  );
}
