export interface HeaderRecord {
  height: number;
  hash: string;
  prevHash: string;
  time: number;
  bits: number;
  nonce: number;
  version: number;
  merkleRoot: string;
  difficulty: number;
}
