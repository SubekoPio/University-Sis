// Purpose: Serialize HTTP and unexpected errors into one API error shape.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/** Stable JSON shape returned for every failed HTTP request. */
export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
}

/** Converts framework and unexpected errors into consistent HTTP responses. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /** Writes a normalized error response without leaking internal failures. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = isHttpException ? exception.getResponse() : undefined;

    if (!isHttpException) {
      this.logger.error(
        "Unhandled request error.",
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      statusCode,
      code: this.getErrorCode(statusCode, errorResponse),
      message: this.getErrorMessage(statusCode, errorResponse),
      timestamp: new Date().toISOString(),
      path: request.path,
    } satisfies ApiErrorResponse);
  }

  private getErrorCode(statusCode: number, response: string | object | undefined): string {
    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      Array.isArray(response.message)
    ) {
      return "VALIDATION_ERROR";
    }

    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "TOO_MANY_REQUESTS";
      default:
        return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? "INTERNAL_SERVER_ERROR"
          : "HTTP_ERROR";
    }
  }

  private getErrorMessage(statusCode: number, response: string | object | undefined): string {
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error.";
    }

    if (typeof response === "string") {
      return response;
    }

    if (typeof response === "object" && response !== null && "message" in response) {
      const { message } = response;
      if (typeof message === "string") {
        return message;
      }

      if (
        Array.isArray(message) &&
        message.every((entry): entry is string => typeof entry === "string")
      ) {
        return message.join("; ");
      }
    }

    return "Request failed.";
  }
}
