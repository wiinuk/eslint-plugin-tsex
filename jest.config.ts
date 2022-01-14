import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
    transform: { "^.+\\.tsx?$": "ts-jest" },
};
export default config;
