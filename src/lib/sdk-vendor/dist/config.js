import "dotenv/config";
import { ConfigurationError } from "./errors/index.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function requireEnv(key) {
    const value = process.env[key];
    if (value === undefined || value.trim() === "") {
        throw new ConfigurationError(`Missing required environment variable: "${key}". ` +
            `Please set it in your environment or .env file.`);
    }
    return value.trim();
}
function requireEnvInt(key) {
    const raw = requireEnv(key);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ConfigurationError(`Environment variable "${key}" must be a positive integer, got: "${raw}".`);
    }
    return parsed;
}
function requireEnvBool(key) {
    const raw = requireEnv(key);
    const lower = raw.toLowerCase();
    if (lower === "true")
        return true;
    if (lower === "false")
        return false;
    throw new ConfigurationError(`Environment variable "${key}" must be "true" or "false", got: "${raw}".`);
}
// ---------------------------------------------------------------------------
// Config assembly
// ---------------------------------------------------------------------------
function buildConfig() {
    const storage = Object.freeze({
        controllerUrl: requireEnv("STORAGE_CONTROLLER_URL"),
        pageserverUrl: requireEnv("PAGESERVER_URL"),
        endpointStorageUrl: requireEnv("ENDPOINT_STORAGE_URL"),
    });
    const postgres = Object.freeze({
        host: requireEnv("POSTGRES_HOST"),
        port: requireEnvInt("POSTGRES_PORT"),
        user: requireEnv("POSTGRES_USER"),
        password: requireEnv("POSTGRES_PASSWORD"),
        database: requireEnv("POSTGRES_DATABASE"),
    });
    const minio = Object.freeze({
        endpoint: requireEnv("MINIO_ENDPOINT"),
        port: requireEnvInt("MINIO_PORT"),
        accessKey: requireEnv("MINIO_ACCESS_KEY"),
        secretKey: requireEnv("MINIO_SECRET_KEY"),
        bucket: requireEnv("MINIO_BUCKET"),
        ssl: requireEnvBool("MINIO_SSL"),
    });
    return Object.freeze({ storage, postgres, minio });
}
// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const config = buildConfig();
//# sourceMappingURL=config.js.map