import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let app: any;

async function createNestServer() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.init();
  }
  return app;
}

module.exports = async (req: any, res: any) => {
  const app = await createNestServer();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
};
