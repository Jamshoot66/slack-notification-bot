import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  gitlabWebhookReceiver(@Body() props): Promise<void> {
    console.log('');
    console.log(
      `[${new Date().toISOString()}] GOT NEW REQUEST ======================================================`,
    );
    console.log('');
    console.log(props);
    return this.appService.parseWebhook(props);
  }
}
