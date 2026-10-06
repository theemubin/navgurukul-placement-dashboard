const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const formatMonthYear = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

export const toPeriodKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getDocumentLabel = (document) => {
  if (!document) return '';
  if (document.documentPeriod?.label) return document.documentPeriod.label;
  return document.label || document.documentKey || document.documentType || '';
};

export const completionText = (completion) => {
  if (!completion) return '0/0 Completed';
  return `${completion.completed || 0}/${completion.total || 0} Completed`;
};