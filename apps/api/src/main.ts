import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5200').split(','),
    credentials: true,
  });

  const port = Number.parseInt(process.env.PORT ?? '5201', 10);
  await app.listen(port);
  new Logger('Bootstrap').log(`Rodno API słucha na http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
