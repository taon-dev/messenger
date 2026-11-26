import { Injectable } from '@angular/core';
import {
  HttpResponse,
  Ng2RestFetchRequestConfig,
  RestResponseWrapper,
} from 'ng2-rest/src';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Models, TaonBaseAngularService } from 'taon/src';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import { TaonDirectMessageAttachmentController } from './taon-direct-message-attachment.controller';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerController } from './taon-messenger.controller';

@Injectable()
export class TaonMessengerApiService extends TaonBaseAngularService {
  private readonly controller = this.inject(TaonMessengerController);

  private readonly attachmentController = this.inject(
    TaonDirectMessageAttachmentController,
  );

  conversation$(): Observable<TaonDirectConversationEntity> {
    return this.cancellableRequest(
      () => this.controller.conversation().request!(),
      'Unable to open conversation.',
    );
  }

  conversations$(): Observable<TaonDirectConversationEntity[]> {
    return this.cancellableRequest(
      () => this.controller.conversations().request!(),
      'Unable to load conversations.',
      [],
    );
  }

  messages$(
    conversationId: number,
    afterCursor = 0,
  ): Observable<TaonDirectMessageEntity[]> {
    return this.cancellableRequest(
      () => this.controller.messages(conversationId, afterCursor).request!(),
      'Unable to load messages.',
      [],
    );
  }

  private cancellableRequest<T>(
    request: () => Models.Http.PromiseObservableMix<any>,
    errorMessage: string,
    fallback?: T,
  ): Observable<T> {
    return request().observable.pipe(
      map(
        response =>
          (response.statusCode >= 400
            ? (() => {
                throw new Error(response.responseText || errorMessage);
              })()
            : (response.body?.json ?? fallback)) as T,
      ),
    );
  }

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
    attachmentKeys: string[] = [],
  ): Promise<TaonDirectMessageEntity> {
    const response = await this.controller.send({
      conversationId,
      content,
      attachmentKeys,
    }).request!();
    if (response.statusCode >= 400 || !response.body?.json)
      throw new Error(response.responseText || 'Unable to send message.');
    return response.body.json;
  }

  async uploadAttachments(
    conversationId: number,
    files: File[],
  ): Promise<any[]> {
    const formData = new FormData();
    for (const file of files) formData.append('file', file);
    const response = await this.attachmentController.uploadFormDataToServer(
      formData,
      { conversationId },
    ).request!();
    if (response.statusCode >= 400)
      throw new Error(response.responseText || 'Unable to upload attachments.');
    return response.body?.json || [];
  }

  attachments$(conversationId: number): Observable<any[]> {
    return this.attachmentController.listAttachments(conversationId)
      .request!().observable.pipe(map(response => response.body?.json || []));
  }

  async removeAttachment(key: string): Promise<void> {
    await this.attachmentController.removeAttachment(key).request!();
  }

  async markRead(conversationId: number, readCursor = 0): Promise<void> {
    await this.controller.markRead(conversationId, readCursor).request!;
  }

  async markUnread(conversationId: number): Promise<void> {
    await this.controller.markUnread(conversationId).request!;
  }

  unreadCount$(): Observable<number> {
    return this.cancellableRequest(
      () => this.controller.unreadCount().request!(),
      'Unable to load unread message count.',
      0,
    );
  }
}
