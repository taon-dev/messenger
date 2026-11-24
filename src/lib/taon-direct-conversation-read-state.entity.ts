import {
  Column,
  Index,
  PrimaryGeneratedColumn,
  TaonBaseEntity,
  TaonEntity,
  UpdateDateColumn,
} from 'taon/src';

@TaonEntity({
  className: 'TaonDirectConversationReadStateEntity',
  createTable: true,
})
export class TaonDirectConversationReadStateEntity extends TaonBaseEntity<TaonDirectConversationReadStateEntity> {
  @PrimaryGeneratedColumn()
  id: number;

  //#region @websql
  @Index()
  @Column({ type: 'integer' })
  //#endregion
  conversationId: number;

  //#region @websql
  @Index()
  @Column({ type: 'integer' })
  //#endregion
  participantId: number;

  //#region @websql
  @Column({ type: 'integer', default: 0 })
  //#endregion
  readCursor: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
