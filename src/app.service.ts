import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IReleaseCommitData {
  isRelease: boolean;
  version: string;
}

const checkCommit = (commitTitle: string): IReleaseCommitData => ({
  isRelease: Boolean(commitTitle.match(/(release.*:)/g)?.length),
  version: commitTitle.match(/(v\d.\d.\d)/g)?.[0] ?? '',
});

interface ISlackMessageField {
  title: string;
  value: string;
  short: boolean;
}

interface ISlackMessageBlock {
  type: string;
  text: {
    type: string;
    text: string;
  };
  accessory?: {
    type: string;
    image_url: string;
    alt_text: string;
  };
}

interface ISlackMessage {
  text?: string;
  pretext?: string;
  fields?: Partial<ISlackMessageField>[];
  blocks?: ISlackMessageBlock[];
}

@Injectable()
export class AppService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  getHello(): string {
    return 'Hello World! ';
  }

  sentMessageToSlack(slackMessage: ISlackMessage) {
    const url = this.configService.get<string>('SLACK_WEBHOOK_URL');
    return this.httpService.post(url, slackMessage).toPromise();
  }

  async parseWebhook(props): Promise<void> {
    const changelogUrl = this.configService.get<string>('CHANGELOG_URL');
    for await (const commit of props.commits) {
      const { isRelease, version } = checkCommit(commit.title);
      if (isRelease) {
        await this.sentMessageToSlack({
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `Release ${version} !`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<${changelogUrl}|Full changelog>`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: commit.message,
              },
              accessory: {
                type: 'image',
                image_url: 'https://i.ibb.co/ZM7xvrY/release-cat.png',
                alt_text: 'releasing cat',
              },
            },
          ],
        });
      }
    }
  }
}
