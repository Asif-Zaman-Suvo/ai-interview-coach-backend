import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
    const { method, url } = req;
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`${method} ${url} ${Date.now() - started}ms`),
        error: () =>
          this.logger.warn(`${method} ${url} ${Date.now() - started}ms`),
      }),
    );
  }
}
