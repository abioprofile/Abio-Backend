import { pino } from "pino";
import env from "@/env";

const logger = pino({
    level: env.LOG_LEVEL,
    name: "abio-backend",
    transport:
        env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            }
            : undefined,
});

export default logger;