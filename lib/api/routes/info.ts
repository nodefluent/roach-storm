import * as express from "express";
import RoachStorm from "../../RoachStorm";

const routeInfo = (roachStorm: RoachStorm) => {

    const router = express.Router();
    const topicConfigModel = roachStorm.mongoWrapper.getTopicConfig();
    const discovery = roachStorm.discovery;
    const consumer = roachStorm.consumer;

    router.get("/", (req, res) => {
        res.json({
            parent: "/api",
            self: "/api/info",
            children: [
                "/api/info/consumer",
                "/api/info/consumer/analytics",
                "/api/info/consumer/lag",

                "/api/info/topics/discovered",
                "/api/info/topics/configured",
                "/api/info/topics/available",
                "/api/info/topics",
                "/api/info/topics/describe/:topic",
            ],
        });
    });

    router.get("/consumer", async (req, res) => {

        try {
            res.status(200).json(await consumer.getKafkaStats());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/consumer/analytics", async (req, res) => {

        try {
            res.status(200).json(await consumer.getAnalytics());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/consumer/lag", async (req, res) => {

        try {
            res.status(200).json(await consumer.getLagStatus());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics", (req, res) => {

        try {
            res.status(200).json(discovery.getMetadata());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/describe/:topic", (req, res) => {

        try {
            res.status(200).json(discovery.getMetadataForTopic(req.params.topic));
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/discovered", (req, res) => {

        try {
            res.status(200).json(discovery.getDiscoveredTopics());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/configured", async (req, res) => {

        try {
            res.status(200).json(await topicConfigModel.listAsTopics());
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    router.get("/topics/available", async (req, res) => {

        try {

            const configuredTopics = await topicConfigModel.listAsTopics();
            const discoveredTopics = discovery.getDiscoveredTopics();
            const availableTopics: string[] = [];

            discoveredTopics.forEach((discoveredTopic) => {
                if (configuredTopics.indexOf(discoveredTopic) === -1) {
                    availableTopics.push(discoveredTopic);
                }
            });

            res.status(200).json(availableTopics);
        } catch (error) {
            res.status(500).json({
                error: "An error occured " + error.message,
            });
        }
    });

    return router;
};

export { routeInfo };
