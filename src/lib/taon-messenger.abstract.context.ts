import { createContext, TaonBaseContext } from 'taon/src';

import { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonDirectMessageAttachmentEntity } from './taon-direct-message-attachment.entity';
import { TaonDirectConversationReadStateEntity } from './taon-direct-conversation-read-state.entity';
import { TaonMessengerController } from './taon-messenger.controller';

export const TaonMessengerAbstractContext = createContext(() => ({
  contextName: 'TaonMessengerAbstractContext',
  abstract: true,
  contexts: { TaonBaseContext },
  entities: {
    TaonDirectConversationEntity,
    TaonDirectMessageEntity,
    TaonDirectMessageAttachmentEntity,
    TaonDirectConversationReadStateEntity,
  },
  controllers: { TaonMessengerController },
}));
