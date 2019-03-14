export interface TopicConfigPipe {
    targetTopic: string;
    filter: any;
    chunkSize?: number;
    publishTombstones?: boolean;
}

export interface TopicConfig {
    sourceTopic: string;
    timestamp: number;
    pipes: TopicConfigPipe[];
    parseAsJson?: boolean;
}
