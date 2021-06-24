import { HttpService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IReleaseCommitData {
  isRelease: boolean;
  version: string;
}

const checkCommit = (commitTitle: string): IReleaseCommitData => ({
  isRelease: Boolean(commitTitle.match(/(release.*:)/g)?.length),
  version: commitTitle.match(/(v?\d.\d.\d)/g)?.[0] ?? '',
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

  parseMessage(msg: string): string[] {
    return msg
      .split('\n')
      .filter((line) => line.length)
      .map((line) => {
        // prepare bold
        let newLine = line;
        const boldRegex = new RegExp(/\*\*(.+)\*\*/, 'gm');
        const boldMatches = [...newLine.matchAll(boldRegex)].flat();
        console.log('boldMatches ', boldMatches);

        if (boldMatches[1]) {
          newLine = newLine
            .replace('*', '')
            .replace(boldMatches[0], `*${boldMatches[1]}*`);
        }

        // prepare links
        const linkRegex = new RegExp(/\((\[.+\])(\(https?.+\))\)/, 'gm');
        const linkMatches = [...newLine.matchAll(linkRegex)].flat();
        if (linkMatches[2]) {
          newLine = newLine
            .replace(linkMatches[0], `<${linkMatches[2]}|${linkMatches[1]}}>`)
            .replace('(', '')
            .replace('}', '');
        }

        // prepare header
        const headerRegex = new RegExp(/### (.+)/, 'gm');
        const headerMatches = [...newLine.matchAll(headerRegex)].flat();
        if (headerMatches[1]) {
          newLine = newLine.replace(
            headerMatches[0],
            `\n *${headerMatches[1]}* \n`,
          );
        }

        // prepare diff
        const diffRegex = new RegExp(
          /(# \[.+\])(\(https:\/\/[\w.,\/\-\)]+)/,
          'gm',
        );
        const diffMatches = [...newLine.matchAll(diffRegex)].flat();
        if (diffMatches[2]) {
          const link = diffMatches[2].replace(/[()]/g, '');
          newLine = `<${link}|Diff with previous version>`;
        }

        // clean misk
        const headerDuplicateRegex = new RegExp(
          /release: \d\.\d\.\d \[skip ci\]/,
          'gm',
        );
        const headerDuplicateMatches = [
          ...newLine.matchAll(headerDuplicateRegex),
        ].flat();
        if (headerDuplicateMatches?.length) {
          newLine = '';
        }

        return newLine;
      });
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
                text: this.parseMessage(commit.message).join('\n'),
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
