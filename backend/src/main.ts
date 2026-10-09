import * as fs from 'fs';
import * as path from 'path';
import './common/utils/node-crypto-polyfill';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import type { RequestHandler } from 'express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/observability/app-logger.service';
import { requestContextMiddleware } from './common/observability/request-context.middleware';
import { resolveAllowedOrigins } from './common/utils/cors-origins';
import { resolveStaticAssetMounts } from './common/utils/static-assets.util';
import { resolveUploadsDir } from './common/utils/uploads.util';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    requireEnv('DATABASE_URL');
    requireEnv('JWT_SECRET');
    requireEnv('JWT_REFRESH_SECRET');
    requireEnv('INTEGRATIONS_ENCRYPTION_KEY');
  }

  const uploadsDir = resolveUploadsDir();
  // Ensure reports directory exists
  const reportsDir = path.join(uploadsDir, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AppLogger(),
  });

  // Behind a reverse proxy (nginx, Caddy, Traefik — the usual self-hosted
  // front ends) Express must be
  // told to trust it, otherwise req.ip is the proxy's address: ThrottlerGuard
  // keys every request on it, collapsing the per-IP login limit into one shared
  // bucket. Handlers read req.ip rather than parsing X-Forwarded-For by hand,
  // which is only safe once this is set.
  app.set('trust proxy', 1);

  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerEnabled = !isProduction;

  const securityHeaders = helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // This origin serves JSON and user-uploaded files, never its own UI,
        // so nothing here needs to execute or embed anything.
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    // The frontend is a separate origin in dev and in any split deployment;
    // helmet's same-origin default would block it from loading avatars and
    // statement previews.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  const securityHeadersMiddleware: RequestHandler = (req, res, next) => {
    // Swagger UI ships inline scripts and styles that the policy above
    // deliberately forbids. It is mounted in non-production only, so this
    // exemption cannot widen the production policy.
    if (swaggerEnabled && req.path.startsWith('/api/docs')) {
      return next();
    }
    return securityHeaders(req, res, next);
  };

  app.use(securityHeadersMiddleware);

  // Serve only public frontend assets and explicitly public upload subtrees.
  const publicPath = path.join(__dirname, 'public');
  for (const mount of resolveStaticAssetMounts(uploadsDir, publicPath)) {
    if (mount.ensure) {
      fs.mkdirSync(mount.root, { recursive: true });
    }
    if (fs.existsSync(mount.root)) {
      // biome-ignore lint/correctness/useHookAtTopLevel: NestJS app.use* methods are not React hooks
      app.useStaticAssets(mount.root, mount.prefix ? { prefix: mount.prefix } : undefined);
    }
  }

  // Auth tokens travel as httpOnly cookies; the CSRF guard and both JWT
  // strategies read them from req.cookies.
  app.use(cookieParser());

  // Pinned rather than inherited: Express defaults to 100 kb, which is safe but
  // implicit. File uploads go through multer, which has its own limits.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Request context & correlation IDs
  app.use(requestContextMiddleware);

  // Global prefix for API versioning
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  // biome-ignore lint/correctness/useHookAtTopLevel: NestJS app.use* methods are not React hooks
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration — shared with the notifications gateway.
  const allowedOrigins = resolveAllowedOrigins();

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('Missing required environment variable: FRONTEND_URL (or CORS_ORIGINS)');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    // content-disposition: file downloads read the server's file name from it;
    // hidden from cross-origin JS, every export fell back to a generic name.
    exposedHeaders: ['x-request-id', 'x-trace-id', 'content-disposition'],
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Lumio API')
    .setDescription('REST API для загрузки выписок, классификации, отчётов и интеграций')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Вставьте access_token из /auth/login или /auth/refresh',
      },
      'bearer',
    )
    .addServer(process.env.API_BASE_URL || 'http://localhost:3001/api/v1')
    .build();

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log({ type: 'startup', url: `http://localhost:${port}` });
  logger.log({ type: 'startup', api: `http://localhost:${port}/api/v1` });
  logger.log({ type: 'startup', swagger: `http://localhost:${port}/api/docs` });
}

bootstrap();
