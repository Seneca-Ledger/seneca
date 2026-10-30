const toDateOnlyString = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** The dates a period preset of the statements list stands for, in local time. */
export const getDatePresetRange = (preset: 'thisMonth' | 'lastMonth' | 'yearToDate', now: Date) => {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'thisMonth') {
    return {
      dateFrom: toDateOnlyString(new Date(current.getFullYear(), current.getMonth(), 1)),
      dateTo: toDateOnlyString(new Date(current.getFullYear(), current.getMonth() + 1, 0)),
    };
  }

  if (preset === 'lastMonth') {
    return {
      dateFrom: toDateOnlyString(new Date(current.getFullYear(), current.getMonth() - 1, 1)),
      dateTo: toDateOnlyString(new Date(current.getFullYear(), current.getMonth(), 0)),
    };
  }

  return {
    dateFrom: toDateOnlyString(new Date(current.getFullYear(), 0, 1)),
    dateTo: toDateOnlyString(current),
  };
};
