import { Injectable } from '@angular/core';
import { TaonBaseAngularService } from 'taon/src';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerController } from './taon-messenger.controller';

@Injectable()
export class TaonMessengerApiService extends TaonBaseAngularService {
  private readonly controller = this.inject(TaonMessengerController);

  async conversation(): Promise<TaonDirectConversationEntity> {
    const response = await this.controller.conversation().request!();
    if (response.statusCode >= 400 || !response.body?.json)
      throw new Error(response.responseText || 'Unable to open conversation.');
    return response.body.json;
  }

  async conversations(): Promise<TaonDirectConversationEntity[]> {
    const response = await this.controller.conversations().request!();
    if (response.statusCode >= 400)
      throw new Error(response.responseText || 'Unable to load conversations.');
    return response.body?.json || [];
  }

  async messages(
    conversationId: number,
    afterCursor = 0,
  ): Promise<TaonDirectMessageEntity[]> {
    const response = await this.controller.messages(conversationId, afterCursor)
      .request!();
    if (response.statusCode >= 400)
      throw new Error(response.responseText || 'Unable to load messages.');
    return response.body?.json || [];
  }

  async send(
    conversationId: number | undefined,
    content: string,
  ): Promise<TaonDirectMessageEntity> {
    const response = await this.controller.send({ conversationId, content })
      .request!();
    if (response.statusCode >= 400 || !response.body?.json)
      throw new Error(response.responseText || 'Unable to send message.');
    return response.body.json;
  }

  async markRead(conversationId: number): Promise<void> {
    await this.controller.markRead(conversationId).request!;
  }
}
