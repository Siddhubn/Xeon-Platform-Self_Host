import "dotenv/config";
export interface StorageConfig {
    readonly controllerUrl: string;
    /**
     * Pageserver base URL.
     * Required when PageserverClient is implemented; optional for current SDK usage.
     */
    readonly pageserverUrl: string;
    /**
     * Endpoint storage base URL.
     * Required when EndpointStorageClient is implemented; optional for current SDK usage.
     */
    readonly endpointStorageUrl: string;
}
export interface PostgresConfig {
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly database: string;
}
export interface MinioConfig {
    readonly endpoint: string;
    readonly port: number;
    readonly accessKey: string;
    readonly secretKey: string;
    readonly bucket: string;
    readonly ssl: boolean;
}
export interface SDKConfig {
    readonly storage: StorageConfig;
    readonly postgres: PostgresConfig;
    readonly minio: MinioConfig;
}
export declare const config: Readonly<SDKConfig>;
//# sourceMappingURL=config.d.ts.map