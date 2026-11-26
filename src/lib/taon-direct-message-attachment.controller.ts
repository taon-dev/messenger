import {
  TaonAuthContextRepository,
  TaonSessionCoreGroups,
  TaonSessionProvider,
  TaonSessionRepository,
} from '@taon-dev/session/src';
import {
  ClassHelpers,
  ExpressRequest,
  ExpressResponse,
  GET,
  DELETE,
  HttpStatusEnum,
  Models,
  Query,
  Taon,
  TaonBaseStorageController,
  TaonController,
  TaonStorageObject,
  TaonUploadedFile,
  getStatusCode,
} from 'taon/src';
import { UtilsJwt } from 'tnp-core/src';

import { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import { TaonDirectMessageAttachmentEntity } from './taon-direct-message-attachment.entity';
import { TaonDirectMessageEntity } from './taon-direct-message.entity';

interface MessageAttachmentQuery {
  conversationId?: number;
  messageId?: number;
}

@TaonController<TaonDirectMessageAttachmentController>({
  className: 'TaonDirectMessageAttachmentController',
  allowedMethods: [
    'uploadFormDataToServer',
    'download',
    'delete',
    'exists',
    'listAttachments',
    'removeAttachment',
  ],
})
export class TaonDirectMessageAttachmentController extends TaonBaseStorageController<MessageAttachmentQuery> {
  private readonly session = this.inject(TaonSessionRepository);

  private readonly auth = this.inject(TaonAuthContextRepository);

  private readonly sessionProvider = this.inject(TaonSessionProvider);

  private repo<T>(entity: new () => T) {
    return this.ctx.connection.manager.getRepository(entity as any);
  }

  private async current(req: any) {
    //#region @websqlFunc
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

  private async authorizedConversation(conversationId: number, req: any) {
    const current = await this.current(req);
    const conversation = await this.repo(TaonDirectConversationEntity).findOne({
      where: { id: conversationId },
    });
    if (!conversation)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.NOT_FOUND),
        message: 'Conversation not found.',
      });
    if (!current.isAdmin && conversation.clientId !== current.id)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.FORBIDDEN),
        message: 'Conversation access denied.',
      });
    return { conversation, current };
  }

  protected async beforeEachRequest({
    req,
  }: Models.TaonCtrlBeforeEachRequestParams<TaonDirectMessageAttachmentController>): Promise<void> {
    const conversationId = Number(req.query?.conversationId);
    if (conversationId > 0)
      await this.authorizedConversation(conversationId, req);
    const key = typeof req.query?.key === 'string' ? req.query.key : '';
    if (key) {
      const attachment = await this.repo(
        TaonDirectMessageAttachmentEntity,
      ).findOne({ where: { storageKey: key } });
      if (!attachment)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.NOT_FOUND),
          message: 'Attachment not found.',
        });
      const message = await this.repo(TaonDirectMessageEntity).findOne({
        where: { id: attachment.messageId },
      });
      if (!message)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.NOT_FOUND),
          message: 'Message not found.',
        });
      await this.authorizedConversation(message.conversationId, req);
    }
  }

  protected async handleUploadFiles(
    files: TaonUploadedFile[],
    queryParams?: MessageAttachmentQuery,
    req?: ExpressRequest,
    res?: ExpressResponse,
  ): Promise<TaonStorageObject[]> {
    if (!req)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.BAD_REQUEST),
        message: 'Upload request context is required.',
      });
    if (!files.length || files.length > 10)
      Taon.error({
        status: getStatusCode(HttpStatusEnum.BAD_REQUEST),
        message: 'Between 1 and 10 attachments are allowed.',
      });
    const conversationId = Number(queryParams?.conversationId);
    await this.authorizedConversation(conversationId, req);
    const objects = await super.handleUploadFiles(
      files.map(file => {
        file.originalFileName = file.fileName;
        file.fileName = `${crypto.randomUUID()}__${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        return file;
      }),
      queryParams,
      req,
      res,
    );
    const attachmentRepo = this.repo(TaonDirectMessageAttachmentEntity);
    const { current } = await this.authorizedConversation(conversationId, req);
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      const file = files[i];
      await attachmentRepo.save(
        attachmentRepo.create({
          messageId: 0,
          conversationId,
          uploadedBy: current.id,
          storageKey: object.key,
          fileName: file.originalFileName || file.fileName,
          mimeType: (file as any).mimeType || (file as any).type || null,
          sizeBytes:
            Number((object as any).size) || Number((file as any).size) || null,
        }),
      );
    }
    return Promise.all(
      objects.map(async object => ({
        ...object,
        downloadUrl: this.buildStorageDownloadUrl({
          req,
          key: object.key,
          private: true,
          download: true,
        }),
      })),
    );
  }

  @GET()
  listAttachments(
    @Query('conversationId') conversationId: number,
  ): Taon.Response<TaonDirectMessageAttachmentEntity[]> {
    return async req => {
      await this.authorizedConversation(Number(conversationId), req);
      const messages = await this.repo(TaonDirectMessageEntity).find({
        where: { conversationId: Number(conversationId), deletedAt: null },
      });
      const ids = messages.map((m: any) => m.id);
      if (!ids.length) return [] as any;
      return this.repo(TaonDirectMessageAttachmentEntity)
        .createQueryBuilder('attachment')
        .where('attachment.messageId IN (:...ids)', { ids })
        .getMany() as any;
    };
  }

  @DELETE()
  removeAttachment(@Query('key') key: string): Taon.Response<boolean> {
    return async req => {
      const attachment = await this.repo(
        TaonDirectMessageAttachmentEntity,
      ).findOne({ where: { storageKey: key } });
      if (!attachment)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.NOT_FOUND),
          message: 'Attachment not found.',
        });
      const message = await this.repo(TaonDirectMessageEntity).findOne({
        where: { id: attachment.messageId },
      });
      if (!message)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.NOT_FOUND),
          message: 'Message not found.',
        });
      const { current } = await this.authorizedConversation(
        message.conversationId,
        req,
      );
      if (message.senderId !== current.id)
        Taon.error({
          status: getStatusCode(HttpStatusEnum.FORBIDDEN),
          message: 'You cannot remove another user attachment.',
        });
      await this.repo(TaonDirectMessageAttachmentEntity).delete({
        id: attachment.id,
      });
      if (await this.storageObjectExists(key))
        await Taon.getResponseValue(this.delete(key));
      return true;
    };
  }

  afterFileUploadHook(): void {}

  async isPublicStorageKey(): Promise<boolean> {
    return false;
  }

  buildStorageDownloadUrl(options: {
    req: ExpressRequest;
    key: string;
    private: boolean;
    token?: string;
    download?: boolean;
  }): string {
    const url = new URL(this.getThisControllerMethodFullUrl('download'));
    url.search = '';
    url.searchParams.set('key', options.key);
    if (options.download) url.searchParams.set('download', 'true');
    if (options.token) url.searchParams.set('token', options.token);
    return `${this.ctx.frontendHostUri.origin}${url.pathname}${url.search}`;
  }

  async createStorageDownloadToken(options: {
    key: string;
    expiresAt: number;
  }): Promise<string> {
    const expiresInSeconds = Math.floor(
      (options.expiresAt - Date.now()) / 1000,
    );
    return UtilsJwt.sign(
      {
        storageController: ClassHelpers.getName(this),
        key: options.key,
        expiresAt: options.expiresAt,
      },
      this.sessionProvider.cookies.ACCESS_TOKEN_SECRET,
      { expiresIn: expiresInSeconds },
    );
  }
}
