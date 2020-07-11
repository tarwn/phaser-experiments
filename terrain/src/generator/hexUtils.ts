

export const getNextHighestEvenEdge = (degrees: number) => {
  return Math.ceil((degrees + 1) / 60) * 60 % 360;
};

export const getNextLowestEvenEdge = (degrees: number) => {
  return Math.floor((degrees + 359) / 60) * 60 % 360;
};

export const roundTo = (v: number, precision: number): number => {
  const raise = Math.pow(10, precision);
  return Math.round(v * raise) / raise;
};
