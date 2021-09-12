export interface EnvObject extends Record<string, string> {
    REDIRECT_URL: string,
    VAPID_PRIVATE_KEY: string,
    VAPID_PUBLIC_KEY: string,
    MONGO_DB_ENDPOINT: string,
    DB_NAME: string,
    TIME_RANGE: string,
    NOTIFICATION_FREQUENCY_THRESHOLD: string,
    TIME_TO_WAIT: string
}