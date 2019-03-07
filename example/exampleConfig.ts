const roachConfig = {
    kafka: {
        consumer: {
            noptions: {
                "metadata.broker.list": "localhost:9092",
                "group.id": "roach-example-group",
                "event_cb": false,
                "api.version.request": true,
                "socket.keepalive.enable": true,
                "socket.blocking.max.ms": 100,
                "enable.auto.commit": false,
                "heartbeat.interval.ms": 250,
                "retry.backoff.ms": 250,
                "fetch.min.bytes": 100,
                "fetch.message.max.bytes": 3 * 1024 * 1024,
                "queued.min.messages": 100,
                "fetch.error.backoff.ms": 100,
                "queued.max.messages.kbytes": 500,
                "fetch.wait.max.ms": 1000,
                "queue.buffering.max.ms": 1000,
                "batch.num.messages": 45000,
                // "security.protocol": "sasl_ssl",
                // "ssl.key.location": "/tmp/kafka-clients-key/service-client.key.pem",
                // "ssl.certificate.location": "/tmp/kafka-clients-certificate/service-client.cert.pem",
                // "ssl.ca.location": "/tmp/ca-chain-certificate/ca-chain.cert.pem",
                // "sasl.mechanisms": "PLAIN"
            },
            tconf: {
                "auto.offset.reset": "earliest",
            },
        },
        batchOptions: {
            batchSize: 500,
            commitEveryNBatch: 1,
            concurrency: 1,
            commitSync: false,
            noBatchCommits: false,
        },
    },
    discovery: {
        enabled: true,
        scanMs: 48000,
        topicBlacklist: [],
    },
    mongo: {
        url: "mongodb://localhost:27017/roach_example",
        options: {
            keepAlive: 120,
            autoIndex: true,
            reconnectTries: Number.MAX_VALUE,
            reconnectInterval: 500,
            poolSize: 20,
        },
    },
    http: {
        port: 1912,
        // access: "*" is default
        access: {
            token1: ["topic1", "topic2", "__topic"],
            token2: ["topic3"],
            token3: "*", // any access, also allows to change topic config
        },
    },
    pubSubConfig: {
        projectId: "sample-google-cloud-project-id",
    },
};

export {
    roachConfig,
};
