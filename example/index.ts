import { RoachStorm } from "..";
import { roachConfig } from "./exampleConfig";

const roachStorm = new RoachStorm(roachConfig);
roachStorm
    .run()
    /* tslint:disable */
    .catch(console.error);
    /* tslint:enable */
