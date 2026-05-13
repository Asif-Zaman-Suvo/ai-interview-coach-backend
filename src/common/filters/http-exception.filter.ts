import type { Request, Response } from 'express';
import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    response.status(status).json({
      statusCode: status,
      path: request.url,
      ...(typeof body === 'object' && body !== null ? body : { message: body }),
    });
  }
}
