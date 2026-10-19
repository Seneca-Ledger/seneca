/** `0x899c…7a65`: enough of an address to tell two of them apart. */
export function shortenAddress(address: string | null): string {
  // A manual holding has no address; the row then shows its label alone.
  return address ? `${address.slice(0, 6)}\u2026${address.slice(-4)}` : '';
}
