export function pad(str: string | number, num: number) {
  return `    ${("" + str).substr(0, num)}`.substr(-num, num);
}
