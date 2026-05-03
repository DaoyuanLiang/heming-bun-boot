import { Injectable } from "heming-bun-boot";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

/**
 * Winston-based logging service.
 * Dev: console only (colorized). Prod: console + daily rotate file.
 */
@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const isProd = process.env.NODE_ENV === "production";

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.printf(
            ({ timestamp, level, message, ...meta }) =>
              `${timestamp} [${level}] ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta) : ""
              }`
          )
        ),
      }),
    ];

    if (isProd) {
      transports.push(
        new DailyRotateFile({
          filename: "logs/app-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxFiles: "30d",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
      transports,
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }
}
