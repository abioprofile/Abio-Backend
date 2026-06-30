import env from "@/env";
import Redis from "ioredis";

const cache = new Redis(env.REDIS_URL);

export default cache;
