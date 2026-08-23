declare module "bitcore-lib" {
  export namespace Networks {
    const livenet: unknown;
  }
}

declare module "bitcore-p2p" {
  import { EventEmitter } from "events";

  export interface BlockHeaderObject {
    hash: string;
    version: number;
    prevHash: string;
    merkleRoot: string;
    time: number;
    bits: number;
    nonce: number;
  }

  export class BlockHeader {
    toObject(): BlockHeaderObject;
    validProofOfWork(): boolean;
    validTimestamp(): boolean;
    getDifficulty(): number;
  }

  export interface HeadersMessage {
    command: "headers";
    headers: BlockHeader[];
  }

  export interface InventoryItem {
    type: number;
    hash: Buffer;
  }

  export interface InvMessage {
    command: "inv";
    inventory: InventoryItem[];
  }

  export class Peer extends EventEmitter {
    constructor(options: { host: string; network?: unknown; port?: number });
    host: string;
    subversion: string;
    bestHeight: number;
    connect(): void;
    disconnect(): void;
    sendMessage(message: unknown): void;
    on(event: "ready", listener: () => void): this;
    on(event: "headers", listener: (message: HeadersMessage) => void): this;
    on(event: "inv", listener: (message: InvMessage) => void): this;
    on(event: "disconnect", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export class Messages {
    constructor(options?: { network?: unknown });
    GetHeaders(options: { starts: Buffer[]; stop?: Buffer }): unknown;
  }

  export const Inventory: {
    TYPE: {
      ERROR: number;
      TX: number;
      BLOCK: number;
      FILTERED_BLOCK: number;
    };
  };
}
