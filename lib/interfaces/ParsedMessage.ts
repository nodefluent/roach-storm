export interface ParsedMessage {
    key: string | Buffer | null;
    timestamp: number;
    partition: number;
    offset: number;
    value: string | Buffer;
    processedAt: number;
}
