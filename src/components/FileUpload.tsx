import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: Record<string, string[]>;
  label?: string;
  maxSize?: number;
  onError?: (error: string) => void;
  loading?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  acceptedFileTypes = {
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls']
  },
  label = 'Drag & drop files here, or click to select files',
  maxSize = 8 * 1024 * 1024, // 8MB default
  onError,
  loading = false
}) => {
  const [error, setError] = useState<string | null>(null);
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let errorMessage = 'File upload failed';
      
      if (rejection.errors) {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          errorMessage = `File is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(1)}MB`;
        } else if (error.code === 'file-invalid-type') {
          const allowedTypes = Object.values(acceptedFileTypes).flat().join(', ');
          errorMessage = `Invalid file type. Allowed types: ${allowedTypes}`;
        }
      }
      
      setError(errorMessage);
      onError?.(errorMessage);
      return;
    }
    
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload, maxSize, acceptedFileTypes, onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: false,
    maxSize,
    disabled: loading
  });
  
  const allowedExtensions = Object.values(acceptedFileTypes).flat().join(', ');

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors
          ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 
            error ? 'border-red-500 bg-red-50 dark:bg-red-900' :
            'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-400'}
          text-gray-600 dark:text-gray-400
        `}
      >
        <input {...getInputProps()} aria-label="File upload" />
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <p>Uploading...</p>
          </div>
        ) : isDragActive ? (
          <p>Drop the files here ...</p>
        ) : (
          <div>
            <p>{label}</p>
            <p className="text-sm text-gray-500 mt-1">
              Accepted formats: {allowedExtensions} (max {(maxSize / 1024 / 1024).toFixed(1)}MB)
            </p>
          </div>
        )}
      </div>
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export type { FileUploadProps };

export default FileUpload;