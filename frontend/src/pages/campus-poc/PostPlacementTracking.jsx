import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, CheckCircle2, Download, FileText, Image as ImageIcon, Search, X, XCircle } from 'lucide-react';
import { postPlacementAPI } from '../../services/api';
import { Button, LoadingSpinner, Modal, StatusBadge } from '../../components/common/UIComponents';
import { completionText, getDocumentLabel } from '../../utils/postPlacement';

const POCPostPlacementTracking = () => {
  const [loading, setLoading] = useState(true);
  const [placements, setPlacements] = useState([]);
  const [filters, setFilters] = useState({
    employmentType: '',
    company: '',
    batch: '',
    joiningDateFrom: '',
    joiningDateTo: '',
    documentStatus: '',
    search: ''
  });
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    document: null,
    loading: false,
    error: null
  });

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      const response = await postPlacementAPI.getAdminPlacements(filters);
      setPlacements(response.data.placements || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load post-placement tracking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, []);

  const documentFilterCount = useMemo(() => placements.filter((placement) => (placement.completion?.percentage || 0) < 100).length, [placements]);

  const verifyDocument = async (placementId, documentId, status, rejectionReason = '') => {
    try {
      await postPlacementAPI.verifyDocument(placementId, documentId, status, rejectionReason);
      toast.success(`Document ${status.toLowerCase()}`);
      await fetchPlacements();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update document status');
    }
  };

  const openPreview = (document) => {
    setPreviewModal({
      isOpen: true,
      document,
      loading: false,
      error: null
    });
  };

  const closePreview = () => {
    setPreviewModal({
      isOpen: false,
      document: null,
      loading: false,
      error: null
    });
  };

  const downloadDocument = (document) => {
    try {
      const link = document.createElement('a');
      link.href = document.fileUrl;
      link.download = document.originalName || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileText className="h-5 w-5 text-gray-400" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    return <FileText className="h-5 w-5 text-gray-400" />;
  };

  const isPreviewable = (mimeType) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/') || mimeType === 'application/pdf';
  };

  const renderDocumentCard = (document) => {
    if (!document || !document.fileUrl) return null;

    return (
      <div
        key={document._id}
        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
        onClick={() => openPreview(document)}
      >
        <div className="flex-shrink-0">
          {getFileIcon(document.mimeType)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {document.originalName || 'Document'}
          </p>
          <p className="text-xs text-gray-500">
            {document.mimeType || 'Unknown type'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            downloadDocument(document);
          }}
          className="flex-shrink-0"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Post-Placement Tracking</h1>
            <p className="mt-2 text-sm text-gray-500">Review placed students, filter records, and verify offer or salary documents.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">Placed: {placements.length}</div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">Missing Docs: {documentFilterCount}</div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">Filters Active</div>
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">Campus PoC View</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input placeholder="Search student, company, role" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <input placeholder="Company" value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })} />
          <input placeholder="Batch" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} />
          <select value={filters.employmentType} onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })}>
            <option value="">Employment Type</option>
            <option value="Internship">Internship</option>
            <option value="Paid Internship">Paid Internship</option>
            <option value="Full-Time Placement">Full-Time Placement</option>
          </select>
          <select value={filters.documentStatus} onChange={(e) => setFilters({ ...filters, documentStatus: e.target.value })}>
            <option value="">Document Status</option>
            <option value="Pending">Pending</option>
            <option value="Uploaded">Uploaded</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
          </select>
          <input type="date" value={filters.joiningDateFrom} onChange={(e) => setFilters({ ...filters, joiningDateFrom: e.target.value })} />
          <input type="date" value={filters.joiningDateTo} onChange={(e) => setFilters({ ...filters, joiningDateTo: e.target.value })} />
        </div>

        <div className="mt-4 flex gap-3">
          <Button onClick={fetchPlacements}><Search className="mr-2 h-4 w-4" />Apply Filters</Button>
          <Button variant="outline" onClick={() => { setFilters({ employmentType: '', company: '', batch: '', joiningDateFrom: '', joiningDateTo: '', documentStatus: '', search: '' }); setTimeout(fetchPlacements, 0); }}>
            Reset
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {placements.map((placement) => (
          <div key={placement._id} className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Building2 className="h-4 w-4" /> {placement.companyName || 'Unknown Company'}
                </div>
                <h2 className="mt-1 text-2xl font-black text-gray-900">{placement.student?.firstName} {placement.student?.lastName}</h2>
                <p className="text-sm font-semibold text-gray-500">{placement.designation || 'Unknown Role'} • {placement.employmentType || 'Unspecified'}</p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <StatusBadge status={placement.student?.studentProfile?.currentStatus || 'Placed'} />
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">{completionText(placement.completion)}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Joining Date</p><p className="mt-1 text-sm font-bold text-gray-900">{placement.joiningDate ? new Date(placement.joiningDate).toLocaleDateString() : 'N/A'}</p></div>
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Batch</p><p className="mt-1 text-sm font-bold text-gray-900">{placement.batchYear || 'N/A'}</p></div>
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">CTC / Salary</p><p className="mt-1 text-sm font-bold text-gray-900">{placement.ctc || placement.stipendOrSalary || 'N/A'}</p></div>
              <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentation</p><p className="mt-1 text-sm font-bold text-gray-900">{placement.completion?.percentage || 0}%</p></div>
            </div>

            <div className="mt-6 space-y-3">
              {placement.requiredDocuments?.map((required) => {
                const document = required.document;
                return (
                  <div key={required.documentKey} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-gray-900">{getDocumentLabel(required)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${document?.verificationStatus === 'Verified' ? 'bg-green-100 text-green-700' : document?.verificationStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {document?.verificationStatus || required.status || 'Pending'}
                        </span>
                      </div>
                      {required.dueDate && (
                        <p className={`mt-1 text-xs font-semibold ${required.overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {required.overdue ? 'Overdue: ' : 'Due: '}{new Date(required.dueDate).toLocaleDateString()}
                        </p>
                      )}
                      {document?.rejectionReason && <p className="mt-1 text-xs text-red-600">Reason: {document.rejectionReason}</p>}
                      
                      {/* Document Card */}
                      {document?.fileUrl && (
                        <div className="mt-3 max-w-xs">
                          {renderDocumentCard(document)}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 md:mt-0">
                      {document?.verificationStatus !== 'Verified' && (
                        <Button variant="success" size="sm" onClick={() => verifyDocument(placement._id, document?._id, 'Verified')}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Verify
                        </Button>
                      )}
                      {document?.verificationStatus !== 'Rejected' && (
                        <Button variant="danger" size="sm" onClick={() => {
                          const reason = window.prompt('Enter rejection reason');
                          if (reason !== null) verifyDocument(placement._id, document?._id, 'Rejected', reason);
                        }}>
                          <XCircle className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {placements.length === 0 && (
          <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            No post-placement records match the current filters.
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      <Modal
        isOpen={previewModal.isOpen}
        onClose={closePreview}
        title="Document Preview"
        size="xl"
      >
        {previewModal.document && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {previewModal.document.originalName || 'Document'}
                </p>
                <p className="text-xs text-gray-500">
                  {previewModal.document.mimeType || 'Unknown type'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadDocument(previewModal.document)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[400px] flex items-center justify-center">
              {isPreviewable(previewModal.document.mimeType) ? (
                previewModal.document.mimeType?.startsWith('image/') ? (
                  <img
                    src={previewModal.document.fileUrl}
                    alt={previewModal.document.originalName || 'Document preview'}
                    className="max-w-full max-h-[600px] object-contain"
                    onError={() => setPreviewModal(prev => ({ ...prev, error: 'Failed to load image' }))}
                  />
                ) : previewModal.document.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewModal.document.fileUrl}
                    title={previewModal.document.originalName || 'PDF preview'}
                    className="w-full h-[600px] border-0"
                    onError={() => setPreviewModal(prev => ({ ...prev, error: 'Failed to load PDF' }))}
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600">Preview not available for this file type</p>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">Preview not available for this file type</p>
                  <p className="text-xs text-gray-500">Please download the file to view it</p>
                </div>
              )}

              {previewModal.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                  <div className="text-center">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-900">{previewModal.error}</p>
                    <p className="text-xs text-gray-500 mt-2">Please try downloading the file instead</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default POCPostPlacementTracking;
