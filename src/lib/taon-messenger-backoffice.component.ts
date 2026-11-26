import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, of, switchMap, timer } from 'rxjs';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerApiService } from './taon-messenger-api.service';

@Component({
  selector: 'taon-messenger-backoffice',
  standalone: true,
  imports: [
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  templateUrl: './taon-messenger-backoffice.component.html',
  styleUrl: './taon-messenger-backoffice.component.scss',
  providers: [TaonMessengerApiService],
})
export class TaonMessengerBackofficeComponent implements OnInit {
  private readonly api = inject(TaonMessengerApiService);

  readonly conversations = signal<TaonDirectConversationEntity[]>([]);

  readonly selected = signal<TaonDirectConversationEntity | null>(null);

  readonly messages = signal<TaonDirectMessageEntity[]>([]);

  draft = '';
  readonly pendingAttachments = signal<any[]>([]);
  readonly sending = signal(false);

  ngOnInit() {
    this.api.conversations$().pipe(takeUntilDestroyed()).subscribe(items => this.conversations.set(items));
    timer(0, 5000).pipe(
      switchMap(() => {
        const conversation = this.selected();
        if (!conversation) return of([] as TaonDirectMessageEntity[]);
        return this.api.messages$(conversation.id, this.messages().at(-1)?.cursor || 0).pipe(
          catchError(() => of([] as TaonDirectMessageEntity[])),
          exhaustMap(messages => of(messages)),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(newer => {
      if (newer.length) this.messages.update(items => [...items, ...newer]);
    });
  }

  async open(conversation: TaonDirectConversationEntity) {
    this.selected.set(conversation);
    this.messages.set([]);
    this.pendingAttachments.set([]);
    await this.refresh();
    await this.api.markRead(conversation.id);
  }

  async refresh() {
    const conversation = this.selected();
    if (!conversation) return;
    const cursor = this.messages().at(-1)?.cursor || 0;
    const newer = await this.api.messages(conversation.id, cursor);
    if (newer.length) this.messages.update(items => [...items, ...newer]);
  }

  async markUnread(conversation: TaonDirectConversationEntity) {
    await this.api.markUnread(conversation.id);
  }

  async selectAttachments(event: Event) {
    const input = event.target as HTMLInputElement;
    const conversation = this.selected();
    const files = Array.from(input.files || []);
    if (!conversation || !files.length) return;
    try {
      const uploaded = await this.api.uploadAttachments(conversation.id, files);
      this.pendingAttachments.update(items => [...items, ...uploaded]);
    } catch (error) {
      console.error(error);
    } finally {
      input.value = '';
    }
  }

  async removePendingAttachment(attachment: any) {
    await this.api.removeAttachment(attachment.key);
    this.pendingAttachments.update(items => items.filter(item => item.key !== attachment.key));
  }

  async send() {
    const conversation = this.selected();
    const content = this.draft.trim();
    const keys = this.pendingAttachments().map(attachment => attachment.key);
    if (!conversation || (!content && !keys.length) || this.sending()) return;
    this.sending.set(true);
    try {
      const sent = await this.api.send(conversation.id, content, keys);
      this.draft = '';
      this.pendingAttachments.set([]);
      this.messages.update(items => [...items, sent]);
    } catch (error) {
      console.error(error);
    } finally {
      this.sending.set(false);
    }
  }
}
