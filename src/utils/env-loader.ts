import { EnvObject } from "../types/env-object";

export class EnvLoader {
    public loadedVariables: EnvObject;
    private static instance: EnvLoader;

    private constructor() {
        this.loadedVariables = {} as EnvObject;
        const variablesToLoad: Partial<EnvObject> = {
            REDIRECT_URL: undefined,
            VAPID_PRIVATE_KEY: undefined,
            VAPID_PUBLIC_KEY: undefined,
            MONGO_DB_ENDPOINT: undefined,
            DB_NAME: undefined,
            TIME_RANGE: undefined,
            NOTIFICATION_FREQUENCY_THRESHOLD: undefined,
            TIME_TO_WAIT: undefined
        }
        const loadedVariables = Object.fromEntries(Object.entries(variablesToLoad).map(([key]) => ([key, process.env[key]])));
        if (!this.areVariablesValid(loadedVariables)) {
            return;
        }
        this.loadedVariables = loadedVariables;
    }

    private areVariablesValid(loadedVariables: Record<string, string | undefined>): loadedVariables is EnvObject {
        const invalidVariables = Object.entries(loadedVariables).filter(([, value]) => value == null);
        for (const [key] of invalidVariables) {
            throw new Error(`This app cannot be executed, make sure you set a valid value for ${key} inside the .env file`);
        }
        return invalidVariables.length === 0;
    }


    public static getInstance(): EnvLoader {
        if (EnvLoader.instance == null) {
            EnvLoader.instance = new EnvLoader();
        }
        return EnvLoader.instance;
    }
}