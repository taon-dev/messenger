import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, of, switchMap, timer } from 'rxjs';

import type { TaonDirectConversationEntity } from './taon-direct-conversation.entity';
import type { TaonDirectMessageEntity } from './taon-direct-message.entity';
import { TaonMessengerApiService } from './taon-messenger-api.service';

@Component({
  selector: 'taon-direct-messages',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  templateUrl: './taon-direct-messages.component.html',
  styleUrl: './taon-direct-messages.component.scss',
  providers: [TaonMessengerApiService],
})
export class TaonDirectMessagesComponent implements OnInit {
  private readonly api = inject(TaonMessengerApiService);

  readonly messages = signal<TaonDirectMessageEntity[]>([]);

  conversation?: TaonDirectConversationEntity;

  draft = '';
  readonly pendingAttachments = signal<any[]>([]);
  readonly sending = signal(false);

  ngOnInit() {
    this.api.conversation$().pipe(
      switchMap(conversation => {
        this.conversation = conversation;
        void this.api.markRead(conversation.id);
        return timer(0, 5000).pipe(
          exhaustMap(() => this.api.messages$(conversation.id, this.messages().at(-1)?.cursor || 0).pipe(
            catchError(() => of([] as TaonDirectMessageEntity[])),
          )),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(newer => {
      if (newer.length) this.messages.update(items => [...items, ...newer]);
    });
  }

  onEnter(event: Event) {
    const keyboard = event as KeyboardEvent;
    if (!keyboard.shiftKey && !keyboard.isComposing) {
      keyboard.preventDefault();
      void this.send();
    }
  }

  async markUnread() {
    if (!this.conversation) return;
    await this.api.markUnread(this.conversation.id);
  }

  async selectAttachments(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!this.conversation || !files.length) return;
    try {
      const uploaded = await this.api.uploadAttachments(this.conversation.id, files);
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
    const content = this.draft.trim();
    const keys = this.pendingAttachments().map(attachment => attachment.key);
    if ((!content && !keys.length) || !this.conversation || this.sending()) return;
    this.sending.set(true);
    try {
      const sent = await this.api.send(this.conversation.id, content, keys);
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
