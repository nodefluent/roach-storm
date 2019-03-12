export interface TopicConfig {
    topic: string;
    timestamp: number;
    parseAsJson: boolean;
    targetTopic: string;
    chunkSize?: number;
}
