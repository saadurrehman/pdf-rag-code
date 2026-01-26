'use client';
import * as React from 'react';
import { Upload, FileCheck, AlertCircle, Loader2, Zap } from 'lucide-react';

const FileUploadComponent: React.FC = () => {
  const [uploading, setUploading] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = React.useState<string>('');
  const [fileName, setFileName] = React.useState<string>('');

  const handleFileUploadButtonClick = () => {
    const el = document.createElement('input');
    el.setAttribute('type', 'file');
    el.setAttribute('accept', 'application/pdf');
    el.addEventListener('change', async (ev) => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        if (file) {
          setUploading(true);
          setFileName(file.name);
          setUploadStatus('idle');
          setStatusMessage('Processing your document...');
          
          try {
            const formData = new FormData();
            formData.append('pdf', file);

            const res = await fetch('http://localhost:8000/api/upload/pdf', {
              method: 'POST',
              body: formData,
            });

            if (!res.ok) {
              throw new Error('Upload failed');
            }

            const data = await res.json();
            setUploadStatus('success');
            setStatusMessage('Document uploaded successfully!');
            console.log('File uploaded:', data);
            
            // Clear status after 4 seconds
            setTimeout(() => {
              setUploadStatus('idle');
              setStatusMessage('');
              setFileName('');
            }, 4000);
          } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            setStatusMessage('Upload failed. Please try again.');
            setTimeout(() => {
              setUploadStatus('idle');
              setStatusMessage('');
              setFileName('');
            }, 4000);
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
        <h2 className="text-xl font-bold text-slate-200 mb-2">Document Upload</h2>
        <p className="text-sm text-slate-400">Upload your PDF to start analyzing with AI</p>
      </div>

      <div 
        onClick={!uploading ? handleFileUploadButtonClick : undefined}
        className={`relative group ${uploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Animated gradient border */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
        
        {/* Main upload box */}
        <div className={`relative bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 transition-all duration-300 ${
          uploading ? 'opacity-60' : 'group-hover:bg-slate-800/70 group-hover:border-slate-600/50 group-hover:scale-[1.02]'
        }`}>
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Icon */}
            <div className="relative">
              <div className={`absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-2xl blur-lg opacity-50 ${uploading ? 'animate-pulse' : 'group-hover:opacity-75'} transition-opacity`}></div>
              <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/50">
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
                ) : uploadStatus === 'success' ? (
                  <FileCheck className="w-12 h-12 text-green-400" />
                ) : uploadStatus === 'error' ? (
                  <AlertCircle className="w-12 h-12 text-red-400" />
                ) : (
                  <Upload className="w-12 h-12 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                )}
              </div>
            </div>

            {/* Text content */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-slate-200">
                {uploading ? 'Uploading...' : uploadStatus === 'success' ? 'Success!' : uploadStatus === 'error' ? 'Error' : 'Click to Upload PDF'}
              </h3>
              
              {fileName && (
                <p className="text-sm text-slate-400 font-mono bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-700/50 max-w-[250px] truncate">
                  {fileName}
                </p>
              )}
              
              {statusMessage && (
                <p className={`text-sm font-medium ${
                  uploadStatus === 'success' ? 'text-green-400' : 
                  uploadStatus === 'error' ? 'text-red-400' : 
                  'text-cyan-400'
                }`}>
                  {statusMessage}
                </p>
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
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                <span className="text-xs text-slate-600 font-medium">PDF files only</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="mt-6 grid grid-cols-1 gap-3">
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-1">AI Processing</h4>
              <p className="text-xs text-slate-500">Documents are analyzed using advanced AI models</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadComponent;
