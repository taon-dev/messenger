import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  TaonBaseAbstractEntity,
  TaonBaseEntity,
  TaonEntity,
  UpdateDateColumn,
} from 'taon/src';

@TaonEntity({
  className: 'TaonDirectMessageEntity',
  createTable: true,
})
export class TaonDirectMessageEntity extends TaonBaseAbstractEntity<TaonDirectMessageEntity> {
  //#region @websql
  @Index()
  @Column({ type: 'integer' })
  //#endregion
  conversationId: number;

  //#region @websql
  @Index()
  @Column({ type: 'integer' })
  //#endregion
  senderId: number;

  //#region @websql
  @Column({ type: 'varchar', length: 20 })
  //#endregion
  senderType: 'client' | 'administrator';

  //#region @websql
  @Column({ type: 'text', nullable: true })
  //#endregion
  content: string | null;

  //#region @websql
  @Index()
  @Column({ type: 'integer', default: 0 })
  //#endregion
  cursor: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  //#region @websql
  @Column({ type: 'datetime', nullable: true })
  //#endregion
  deletedAt: Date | null;
}
