'use client';
import * as React from 'react';
import { Upload, FileCheck, AlertCircle, Loader2, Zap, ExternalLink } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const FileUploadComponent: React.FC = () => {
  const [uploading, setUploading] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [fileName, setFileName] = React.useState<string>('');
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);

  const handleFileUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type', 'file');
    el.setAttribute('accept', 'application/pdf');
    el.addEventListener('change', async () => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        if (file) {
          setUploading(true);
          setFileName(file.name);
          setUploadStatus('idle');
          setStatusMessage('');
          setUploadedUrl(null);

          try {
            const formData = new FormData();
            formData.append('pdf', file);

            const res = await fetch(`${API_BASE}/api/upload-pdf`, {
              method: 'POST',
              body: formData,
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              throw new Error(data.message || data.error || 'Upload failed');
            }

            const url = data.url ?? null;
            setUploadStatus('success');
            setStatusMessage(
              data.ingested
                ? 'Report uploaded. It’s being processed so your care team can read it — try asking about it in chat in a few seconds.'
                : 'Document uploaded successfully!'
            );
            setUploadedUrl(url);

            setTimeout(() => {
              setUploadStatus('idle');
              setStatusMessage('');
              setFileName('');
              setUploadedUrl(null);
            }, 8000);
          } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            setStatusMessage(error instanceof Error ? error.message : 'Upload failed. Please try again.');
            setUploadedUrl(null);
            setTimeout(() => {
              setUploadStatus('idle');
              setStatusMessage('');
              setFileName('');
            }, 5000);
          } finally {
            setUploading(false);
          }
        }
      }
    });
    el.click();
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Document Upload</h2>
        <p className="text-sm text-slate-500">Upload your PDF to use as context for your care team</p>
      </div>

      <div 
        onClick={!uploading ? handleFileUploadButtonClick : undefined}
        className={`relative group ${uploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Main upload box - medical professional style */}
        <div className={`relative bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 transition-all duration-200 ${
          uploading ? 'opacity-60 border-slate-300' : 'group-hover:border-blue-300 group-hover:bg-blue-50/30'
        }`}>
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Icon */}
            <div className="relative bg-slate-100 group-hover:bg-blue-50 p-6 rounded-2xl border border-slate-200 transition-colors">
              {uploading ? (
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              ) : uploadStatus === 'success' ? (
                <FileCheck className="w-12 h-12 text-emerald-600" />
              ) : uploadStatus === 'error' ? (
                <AlertCircle className="w-12 h-12 text-red-600" />
              ) : (
                <Upload className="w-12 h-12 text-blue-600 group-hover:text-blue-700 transition-colors" />
              )}
            </div>

            {/* Text content */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">
                {uploading ? 'Uploading...' : uploadStatus === 'success' ? 'Success!' : uploadStatus === 'error' ? 'Error' : 'Click to Upload PDF'}
              </h3>
              
              {fileName && (
                <p className="text-sm text-slate-600 font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 max-w-[250px] truncate">
                  {fileName}
                </p>
              )}
              
              {statusMessage && (
                <p className={`text-sm font-medium ${
                  uploadStatus === 'success' ? 'text-emerald-600' : 
                  uploadStatus === 'error' ? 'text-red-600' : 
                  'text-blue-600'
                }`}>
                  {statusMessage}
                </p>
              )}

              {uploadStatus === 'success' && uploadedUrl && (
                <a
                  href={uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-mono bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 truncate max-w-full"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{uploadedUrl}</span>
                </a>
              )}
              
              {!uploading && uploadStatus === 'idle' && !statusMessage && (
                <p className="text-sm text-slate-500">
                  Drag & drop or click to browse
                </p>
              )}
            </div>

            {/* Upload hint */}
            {!uploading && uploadStatus === 'idle' && (
              <div className="flex items-center gap-2 pt-2">
                <div className="h-px flex-1 bg-slate-200"></div>
                <span className="text-xs text-slate-400 font-medium">PDF files only</span>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="mt-6 grid grid-cols-1 gap-3">
        <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-1">Report processing</h4>
              <p className="text-xs text-slate-600">Uploaded reports are processed so Dentist, Physiotherapist, and Nutrition assistants can read and answer from them.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadComponent;
