import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  TaonBaseEntity,
  TaonEntity,
  UpdateDateColumn,
} from 'taon/src';

@TaonEntity({
  className: 'TaonDirectConversationEntity',
  createTable: true,
})
export class TaonDirectConversationEntity extends TaonBaseEntity<TaonDirectConversationEntity> {
  @PrimaryGeneratedColumn()
  id: number;

  //#region @websql
  @Index()
  @Column({ type: 'integer', unique: true })
  //#endregion
  clientId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  //#region @websql
  @Column({ type: 'integer', default: 0 })
  //#endregion
  lastMessageCursor: number;
}
