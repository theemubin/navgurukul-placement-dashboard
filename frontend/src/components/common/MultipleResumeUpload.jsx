import { useState, useEffect } from 'react';
import { userAPI } from '../../services/api';
import { Plus, Trash2, Upload, Check, AlertCircle, Loader2, FileText, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const MultipleResumeUpload = ({ initialResumes = [], onUploadSuccess }) => {
  // resumes state tracks both saved resumes and active/new unsaved upload rows
  // State structure for each row:
  // - id / _id: Unique identifier
  // - role: Custom target role text (user-defined)
  // - file: Selected JavaScript File object (null initially)
  // - fileName: Selected file name for UI display
  // - status: Upload status ('idle' | 'ready' | 'uploading' | 'success' | 'error')
  // - url: Uploaded secure resume URL from Cloudinary (once saved)
  // - isSaved: Boolean indicating if it's already stored in DB
  // - errorMessage: Error message string if upload fails
  const [resumes, setResumes] = useState(
    initialResumes.length > 0
      ? initialResumes.map(r => ({ ...r, isSaved: true, status: 'success' }))
      : [{ id: 'temp-' + Date.now(), role: '', file: null, status: 'idle', errorMessage: '' }]
  );

  useEffect(() => {
    if (initialResumes) {
      setResumes(prev => {
        const unsavedRows = prev.filter(r => !r.isSaved);
        const savedRows = initialResumes.map(r => ({ ...r, isSaved: true, status: 'success' }));
        if (savedRows.length === 0 && unsavedRows.length === 0) {
          return [{ id: 'temp-' + Date.now(), role: '', file: null, status: 'idle', errorMessage: '' }];
        }
        return [...savedRows, ...unsavedRows];
      });
    }
  }, [initialResumes]);

  // 1. Function: addResumeField - Appends a new blank dynamic row
  const addResumeField = () => {
    setResumes(prev => [
      ...prev,
      { id: 'temp-' + Date.now(), role: '', file: null, status: 'idle', errorMessage: '' }
    ]);
  };

  // 2. Function: removeResume - Removes a row (calls delete API if saved, or just removes from state if unsaved)
  const removeResume = async (id, isSaved, resumeId) => {
    if (isSaved && resumeId) {
      const deletePromise = userAPI.deleteRoleResume(resumeId);
      toast.promise(deletePromise, {
        loading: 'Deleting resume...',
        success: 'Resume deleted successfully',
        error: (err) => err?.response?.data?.message || 'Failed to delete resume'
      });
      try {
        const res = await deletePromise;
        if (res.data?.success) {
          setResumes(prev => prev.filter(r => r._id !== resumeId));
          if (onUploadSuccess) onUploadSuccess(res.data.resumes);
        }
      } catch (err) {
        console.error('Delete resume error:', err);
      }
    } else {
      setResumes(prev => prev.filter(r => r.id !== id && r._id !== id));
      toast.success('Row removed');
    }
  };

  // 3. Function: handleResumeChange - Updates text role or file with client-side validation
  const handleResumeChange = (id, field, value) => {
    if (field === 'file') {
      const file = value;
      if (!file) return;

      // Validate size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Resume file size should be less than 5MB');
        return;
      }

      // Validate mime-type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Resume must be a PDF, DOC, or DOCX file');
        return;
      }

      setResumes(prev =>
        prev.map(r =>
          (r.id === id || r._id === id)
            ? { ...r, file, fileName: file.name, status: 'ready', errorMessage: '' }
            : r
        )
      );
    } else {
      setResumes(prev =>
        prev.map(r => (r.id === id || r._id === id) ? { ...r, [field]: value } : r)
      );
    }
  };

  // Trigger replace state (clears saved status to show selector again)
  const handleReplace = (id) => {
    setResumes(prev =>
      prev.map(r =>
        (r.id === id || r._id === id)
          ? { ...r, isSaved: false, status: 'idle', file: null, fileName: '', errorMessage: '' }
          : r
      )
    );
  };

  // Upload trigger for a single row
  const uploadResume = async (id) => {
    const row = resumes.find(r => r.id === id || r._id === id);
    if (!row) return;

    if (!row.role || !row.role.trim()) {
      setResumes(prev =>
        prev.map(r => (r.id === id || r._id === id) ? { ...r, errorMessage: 'Role name is required before uploading' } : r)
      );
      toast.error('Please specify a role name for this resume');
      return;
    }

    if (!row.file) {
      toast.error('Please select a resume file to upload');
      return;
    }

    // Update row status to uploading
    setResumes(prev =>
      prev.map(r => (r.id === id || r._id === id) ? { ...r, status: 'uploading', errorMessage: '' } : r)
    );

    try {
      const response = await userAPI.uploadRoleResume(row.file, row.role);
      if (response.data?.success) {
        toast.success(`Resume uploaded for role: ${row.role}`);
        // Fetch updated resumes list
        const updatedResumes = response.data.resumes || [];
        setResumes(updatedResumes.map(r => ({ ...r, isSaved: true, status: 'success' })));
        if (onUploadSuccess) onUploadSuccess(updatedResumes);
      }
    } catch (error) {
      console.error('Upload error:', error);
      const msg = error?.response?.data?.message || 'Failed to upload resume';
      toast.error(msg);
      setResumes(prev =>
        prev.map(r => (r.id === id || r._id === id) ? { ...r, status: 'error', errorMessage: msg } : r)
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-gray-50">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
            <FileText className="w-5 h-5 text-indigo-500" />
            Resume Management
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Upload dynamic, tailored resumes for different placement roles.</p>
        </div>
        <button
          type="button"
          onClick={addResumeField}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm hover:shadow-md transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Resume
        </button>
      </div>

      <div className="space-y-4">
        {resumes.map((row, idx) => (
          <div
            key={row.id || row._id}
            className={`flex flex-row items-start gap-4 p-5 rounded-2xl border transition-all ${row.status === 'success'
                ? 'bg-emerald-50/5 border-emerald-100'
                : row.status === 'error'
                  ? 'bg-rose-50/5 border-rose-100'
                  : 'bg-gray-50/50 border-gray-150 hover:border-gray-200'
              }`}
          >
            {/* Index badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-xs shrink-0 mt-1">
              {idx + 1}
            </div>

            {/* Form Column */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Target Role Input field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                  Target Role
                </label>
                <input
                  type="text"
                  value={row.role}
                  onChange={(e) => handleResumeChange(row.id || row._id, 'role', e.target.value)}
                  disabled={row.isSaved}
                  placeholder="e.g. Frontend"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 font-medium placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition-all shadow-sm"
                />
              </div>

              {/* File upload input & status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                  Resume File (PDF, DOC, DOCX)
                </label>
                {row.isSaved ? (
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl w-full gap-3 shadow-sm animate-fadeIn">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0 bg-white shadow-sm">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-emerald-800 leading-tight">Resume Uploaded</p>
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline mt-0.5 inline-block"
                        >
                          View Resume &rarr;
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReplace(row.id || row._id)}
                        className="px-4 py-1.5 bg-blue-50 hover:bg-blue-100/80 text-blue-650 rounded-lg text-sm font-semibold transition-all shadow-sm"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => removeResume(row.id || row._id, row.isSaved, row._id)}
                        className="px-4 py-1.5 bg-red-50 hover:bg-red-100/80 text-red-650 rounded-lg text-sm font-semibold transition-all shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                    <div className="relative flex-grow min-w-0">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleResumeChange(row.id || row._id, 'file', e.target.files[0])}
                        className="sr-only"
                        id={`file-input-${row.id}`}
                      />
                      <label
                        htmlFor={`file-input-${row.id}`}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-gray-200 hover:border-indigo-500 rounded-xl cursor-pointer text-sm font-medium text-gray-500 hover:text-indigo-650 shadow-sm transition-all"
                      >
                        <span className="truncate">
                          {row.fileName || 'Choose file...'}
                        </span>
                        <Upload className="w-4 h-4 text-gray-400" />
                      </label>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => uploadResume(row.id || row._id)}
                        disabled={row.status === 'uploading' || !row.file}
                        className={`flex items-center justify-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all select-none w-full sm:w-auto ${row.status === 'uploading'
                            ? 'bg-gray-400 cursor-not-allowed'
                            : !row.file
                              ? 'bg-gray-200 cursor-not-allowed text-gray-400'
                              : 'bg-indigo-650 hover:bg-indigo-700 transform active:scale-95'
                          }`}
                      >
                        {row.status === 'uploading' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeResume(row.id || row._id, row.isSaved, row._id)}
                        className="p-2.5 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors shrink-0 border border-transparent hover:border-red-100"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {resumes.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-500">No resumes uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Resume" to start uploading tailored resumes.</p>
        </div>
      )}
    </div>
  );
};

export default MultipleResumeUpload;
