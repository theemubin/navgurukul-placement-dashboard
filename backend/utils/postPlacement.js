const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EMPLOYMENT_TYPES = [
  'Internship',
  'Paid Internship',
  'Full-Time Placement'
];

const DOCUMENT_TYPES = {
  OFFER_LETTER: 'OFFER_LETTER',
  INTERNSHIP_STIPEND_SLIP: 'INTERNSHIP_STIPEND_SLIP',
  FULL_TIME_SALARY_SLIP: 'FULL_TIME_SALARY_SLIP'
};

const formatMonthYear = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

const toPeriodKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getInclusiveMonths = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return [];

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  const months = [];

  while (current <= finalMonth) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
};

const inferEmploymentType = (application) => {
  const jobType = String(application?.job?.jobType || '').toLowerCase();
  const salaryValue = Number(application?.offerDetails?.salary || application?.job?.salary?.max || application?.job?.salary?.min || 0);

  if (jobType === 'internship') {
    return salaryValue > 0 ? 'Paid Internship' : 'Internship';
  }

  return 'Full-Time Placement';
};

const buildRequiredDocuments = (placement) => {
  const employmentType = String(placement?.employmentType || '').trim();
  const documents = [];

  const addOfferLetter = (startDate) => {
    const start = parseDate(startDate);
    documents.push({
      documentType: DOCUMENT_TYPES.OFFER_LETTER,
      documentKey: DOCUMENT_TYPES.OFFER_LETTER,
      label: 'Offer Letter',
      required: true,
      dueDate: start ? addDays(start, 15) : null,
      period: null
    });
  };

  const addSalarySlips = (startDate, label = 'Salary Slip') => {
    const start = parseDate(startDate);
    if (!start) return;

    for (let index = 0; index < 3; index += 1) {
      const monthDate = addMonths(new Date(start.getFullYear(), start.getMonth(), 1), index);
      documents.push({
        documentType: DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP,
        documentKey: `${DOCUMENT_TYPES.FULL_TIME_SALARY_SLIP}:${toPeriodKey(monthDate)}`,
        label: `${formatMonthYear(monthDate)} ${label}`,
        required: true,
        dueDate: addMonths(start, index + 1),
        period: {
          month: monthDate.getMonth() + 1,
          year: monthDate.getFullYear(),
          label: formatMonthYear(monthDate),
          key: toPeriodKey(monthDate)
        }
      });
    }
  };

  if (employmentType === 'Full-Time Placement') {
    addOfferLetter(placement?.joiningDate);
    addSalarySlips(placement?.joiningDate, 'Salary Slip');
    return documents;
  }

  if (employmentType === 'Internship' || employmentType === 'Paid Internship') {
    addOfferLetter(placement?.internshipStartDate);

    if (employmentType === 'Paid Internship') {
      const months = getInclusiveMonths(placement?.internshipStartDate, placement?.internshipEndDate).slice(0, 3);
      months.forEach((monthDate) => {
        documents.push({
          documentType: DOCUMENT_TYPES.INTERNSHIP_STIPEND_SLIP,
          documentKey: `${DOCUMENT_TYPES.INTERNSHIP_STIPEND_SLIP}:${toPeriodKey(monthDate)}`,
          label: `${formatMonthYear(monthDate)} Stipend Slip`,
          required: true,
          dueDate: addMonths(placement?.internshipStartDate, months.indexOf(monthDate) + 1),
          period: {
            month: monthDate.getMonth() + 1,
            year: monthDate.getFullYear(),
            label: formatMonthYear(monthDate),
            key: toPeriodKey(monthDate)
          }
        });
      });
    }
  }

  return documents;
};


const buildDocumentCompletion = (placement, documents = []) => {
  const requiredDocuments = buildRequiredDocuments(placement);
  const documentMap = new Map(documents.map((doc) => [doc.documentKey, doc]));

  const items = requiredDocuments.map((required) => {
    const existing = documentMap.get(required.documentKey) || null;
    const status = existing ? existing.verificationStatus : 'Pending';
    const completed = status === 'Uploaded' || status === 'Verified';

    return {
      ...required,
      status,
      completed,
      overdue: !existing && required.dueDate ? required.dueDate < new Date() : false,
      document: existing
    };
  });

  const completedCount = items.filter((item) => item.completed).length;

  return {
    requiredDocuments: items,
    completion: {
      completed: completedCount,
      total: items.length,
      percentage: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0
    }
  };
};

const normalizeDocumentType = (documentType) => {
  const value = String(documentType || '').trim().toUpperCase();
  if (Object.values(DOCUMENT_TYPES).includes(value)) return value;
  return null;
};

const buildDocumentKey = ({ documentType, periodKey }) => {
  const normalizedType = normalizeDocumentType(documentType);
  if (!normalizedType) return '';
  if (normalizedType === DOCUMENT_TYPES.OFFER_LETTER) return DOCUMENT_TYPES.OFFER_LETTER;
  return periodKey ? `${normalizedType}:${periodKey}` : '';
};

module.exports = {
  EMPLOYMENT_TYPES,
  DOCUMENT_TYPES,
  buildRequiredDocuments,
  buildDocumentCompletion,
  buildDocumentKey,
  formatMonthYear,
  getInclusiveMonths,
  inferEmploymentType,
  normalizeDocumentType,
  parseDate,
  toPeriodKey
};