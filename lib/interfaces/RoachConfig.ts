import { DiscoveryConfig } from "./DiscoveryConfig";
import { MongoConfig } from "./MongoConfig";
import { HttpConfig } from "./HttpConfig";

export interface RoachConfig {
    kafka: any;
    discovery: DiscoveryConfig;
    mongo: MongoConfig;
    http: HttpConfig;
    pubSubConfig: any;
}
