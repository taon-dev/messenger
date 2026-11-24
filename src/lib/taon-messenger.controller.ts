import {
  TaonAuthContextRepository,
  TaonSessionCoreGroups,
  TaonSessionRepository,
} from '@taon-dev/session/src';
import {
  Body,
  GET,
  POST,
  Query,
  Taon,
  TaonBaseCrudController,
  TaonController,
  HttpStatusEnum,
  getStatusCode,
  Models,
} from 'taon/src';

import { TaonDirectConversationReadStateEntity } from './taon-direct-conversation-read-state.entity';
import { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import { TaonDirectMessageEntity } from './taon-direct-message.entity';

interface SendMessageInput {
  conversationId?: number;
  content?: string;
  clientRequestId?: string;
}

@TaonController<TaonMessengerController>({
  className: 'TaonMessengerController',
  allowedMethods: [
    'conversation',
    'messages',
    'send',
    'markRead',
    'conversations',
  ],
})
export class TaonMessengerController extends TaonBaseCrudController<TaonDirectMessageEntity> {
  entityClassResolveFn = () => TaonDirectMessageEntity;

  private readonly session = this.inject(TaonSessionRepository);

  private readonly auth = this.inject(TaonAuthContextRepository);

  private repository<T>(entity: new () => T) {
    return this.ctx.connection.manager.getRepository(entity as any);
  }

  private async user(
    req: Models.TaonCtrlBeforeEachRequestParams<TaonMessengerController>['req'],
  ) {
    //#region @backendFunc
    await this.session.throwIfNotAuthenticated({ req });
    const context = await this.auth.getContext(req.userId, req.sessionId);
    return {
      id: Number(req.userId),
      isAdmin:
        !!context?.isSuperUser ||
        !!context?.isInGroup(TaonSessionCoreGroups.Administrator),
    };
    //#endregion
  }

  @GET()
  conversation(): Taon.Response<TaonDirectConversationEntity> {
    //#region @websqlFunc
    return async req => {
      const current = await this.user(req);
      if (current.isAdmin) {
        Taon.error({
          status: getStatusCode(HttpStatusEnum.FORBIDDEN),
          message: 'Administrators must select a client conversation.',
        });
      }
      const conversationRepo = this.repository(TaonDirectConversationEntity);
      let conversation = await conversationRepo.findOne({
        where: { clientId: current.id },
      });
      if (!conversation) {
        conversation = await conversationRepo.save(
          conversationRepo.create({
            clientId: current.id,
            lastMessageCursor: 0,
          }),
        );
      }
      return conversation as any;
    };
    //#endregion
  }

  @GET()
  conversations(): Taon.Response<TaonDirectConversationEntity[]> {
    //#region @websqlFunc
    return async req => {
      const current = await this.user(req);
      if (!current.isAdmin)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.FORBIDDEN),
          message: 'Administrator access required.',
        });
      return this.repository(TaonDirectConversationEntity).find({
        order: { updatedAt: 'DESC' },
      }) as any;
    };
    //#endregion
  }

  @GET()
  messages(
    @Query('conversationId') conversationId?: number,
    @Query('afterCursor') afterCursor?: number,
  ): Taon.Response<TaonDirectMessageEntity[]> {
    //#region @websqlFunc
    return async req => {
      const current = await this.user(req);
      const conversation = await this.authorizedConversation(
        Number(conversationId),
        current.id,
        current.isAdmin,
      );
      const cursor = Number(afterCursor) || 0;
      return this.repository(TaonDirectMessageEntity)
        .createQueryBuilder('message')
        .where('message.conversationId = :conversationId', {
          conversationId: conversation.id,
        })
        .andWhere('message.cursor > :cursor', { cursor })
        .andWhere('message.deletedAt IS NULL')
        .orderBy('message.cursor', 'ASC')
        .getMany() as any;
    };
    //#endregion
  }

  @POST()
  send(
    @Body() input: SendMessageInput,
  ): Taon.Response<TaonDirectMessageEntity> {
    //#region @websqlFunc
    return async req => {
      const current = await this.user(req);
      let conversation: Partial<TaonDirectConversationEntity>;
      if (current.isAdmin) {
        if (!input.conversationId)
          Taon.error({
            status: getStatusCode(HttpStatusEnum.BAD_REQUEST),
            message: 'Conversation is required.',
          });
        conversation = await this.authorizedConversation(
          Number(input.conversationId),
          current.id,
          true,
        );
      } else {
        const conversationRepo = this.repository(TaonDirectConversationEntity);
        conversation = await conversationRepo.findOne({
          where: { clientId: current.id },
        });
        if (!conversation) {
          conversation = await conversationRepo.save(
            conversationRepo.create({
              clientId: current.id,
              lastMessageCursor: 0,
            }),
          );
        }
      }
      const content = input.content?.trim();
      if (!content)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.BAD_REQUEST),
          message: 'Message text is required.',
        });

      const cursor = Number(conversation.lastMessageCursor || 0) + 1;
      conversation.lastMessageCursor = cursor;
      await this.repository(TaonDirectConversationEntity).save(conversation);
      return this.repository(TaonDirectMessageEntity).save(
        this.repository(TaonDirectMessageEntity).create({
          conversationId: conversation.id,
          senderId: current.id,
          senderType: current.isAdmin ? 'administrator' : 'client',
          content,
          cursor,
          deletedAt: null,
        }),
      ) as any;
    };
    //#endregion
  }

  @POST()
  markRead(
    @Query('conversationId') conversationId: number,
  ): Taon.Response<boolean> {
    //#region @websqlFunc
    return async req => {
      const current = await this.user(req);
      const conversation = await this.authorizedConversation(
        Number(conversationId),
        current.id,
        current.isAdmin,
      );
      const readRepo = this.repository(TaonDirectConversationReadStateEntity);
      let state = await readRepo.findOne({
        where: { conversationId: conversation.id, participantId: current.id },
      });
      if (!state) {
        state = readRepo.create({
          conversationId: conversation.id,
          participantId: current.id,
          readCursor: conversation.lastMessageCursor || 0,
        });
      } else {
        state.readCursor = conversation.lastMessageCursor || 0;
      }
      await readRepo.save(state);
      return true;
    };
    //#endregion
  }

  private async authorizedConversation(
    conversationId: number,
    userId: number,
    isAdmin: boolean,
  ) {
    if (!conversationId)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.BAD_REQUEST),
        message: 'Conversation is required.',
      });
    const conversation = await this.repository(
      TaonDirectConversationEntity,
    ).findOne({
      where: { id: conversationId },
    });
    if (!conversation)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.NOT_FOUND),
        message: 'Conversation not found.',
      });
    if (!isAdmin && conversation.clientId !== userId) {
      Taon.error({
        status: getStatusCode(HttpStatusEnum.FORBIDDEN),
        message: 'Conversation access denied.',
      });
    }
    return conversation;
  }
}
