import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, CheckCircle2, Search, XCircle } from 'lucide-react';
import { postPlacementAPI } from '../../services/api';
import { Button, LoadingSpinner, StatusBadge } from '../../components/common/UIComponents';
import { completionText, getDocumentLabel } from '../../utils/postPlacement';

const ManagerPostPlacementTracking = () => {
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
            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">Admin View</div>
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
                  <div key={required.documentKey} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {document?.fileUrl && <a href={document.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700">View</a>}
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
    </div>
  );
};

export default ManagerPostPlacementTracking;